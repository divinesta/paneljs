import type { DataAdapter } from "./adapter.js";
import { writeAuditEvent } from "./audit.js";
import {
  assertNoRestrictedRelations,
  loadDeletePreviewRelations,
  type DeletePreviewRelation,
} from "./deleteRelations.js";
import { DELETE_SELECTED_ACTION } from "./defaultActions.js";
import { PermissionDeniedError, RecordNotFoundError } from "./errors.js";
import {
  hasModelPermission,
  hasRegisteredActionPermission,
  type AdminOperation,
} from "./permissions.js";
import { idSelect } from "./query.js";
import type {
  FieldFilters,
  FieldSelect,
  FindManyQuery,
  SearchQuery,
} from "./query.js";
import {
  assertSelectedRelationsAreVisible,
  buildListRecordSelect,
  buildRecordSelect,
} from "./recordSelection.js";
import type { FullRegisteredModel } from "./registry.js";
import {
  applyCreateScope,
  assertScopeFieldsUnchanged,
  collectScopeFieldNames,
  resolveScope,
} from "./scope.js";
import type { AdminUser, AuditConfig, PaginatedResponse } from "./types.js";
import {
  assertRequiredCreateFields,
  RequestValidationError,
  validateHookPayload,
  validateWritePayload,
} from "./validation.js";

const MAX_ACTION_RECORDS = 100;

export type AdminListInput = {
  page?: number;
  perPage?: number;
  filters?: FieldFilters;
  search?: SearchQuery;
  sort?: FindManyQuery["sort"];
};

export type DeletePreview = {
  records: Record<string, unknown>[];
  relations: DeletePreviewRelation[];
};

export type DeleteSelectedResult = {
  requestedIds: Array<string | number>;
  deletedIds: Array<string | number>;
  partial: boolean;
};

export interface AdminServiceOptions {
  models: Map<string, FullRegisteredModel>;
  adapter: DataAdapter;
  audit?: AuditConfig;
}

/** Framework-neutral CRUD, action, scope, hook, and audit orchestration. */
export class AdminService {
  private readonly models: Map<string, FullRegisteredModel>;
  private readonly adapter: DataAdapter;
  private readonly audit: AuditConfig | undefined;

  constructor(options: AdminServiceOptions) {
    this.models = options.models;
    this.adapter = options.adapter;
    this.audit = options.audit;
  }

  async list(
    model: FullRegisteredModel,
    adminUser: AdminUser,
    input: AdminListInput = {},
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    this.authorize(model, adminUser, "list");
    const page = input.page ?? 1;
    const perPage = input.perPage ?? model.resolved.perPage;
    assertPagination(page, perPage);
    const scope = await resolveScope(model.raw, adminUser);
    const delegate = this.adapter.resource(model.meta);
    const filters = input.filters ?? {};
    const sort = input.sort ?? model.resolved.defaultSort;
    const [records, total] = await Promise.all([
      delegate.findMany({
        scope,
        filters,
        search: input.search,
        sort,
        skip: (page - 1) * perPage,
        take: perPage,
        select: buildListRecordSelect(model.meta, model),
      }),
      delegate.count({ scope, filters, search: input.search }),
    ]);

    return {
      records,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    };
  }

  async get(
    model: FullRegisteredModel,
    adminUser: AdminUser,
    id: string | number,
  ): Promise<Record<string, unknown>> {
    this.authorize(model, adminUser, "view");
    const scope = await resolveScope(model.raw, adminUser);
    const record = await this.adapter.resource(model.meta).findFirst({
      scope,
      id,
      select: buildRecordSelect(model.meta, model),
    });
    if (!record) throw new RecordNotFoundError();
    return record;
  }

  async create(
    model: FullRegisteredModel,
    adminUser: AdminUser,
    body: unknown,
  ): Promise<Record<string, unknown>> {
    this.authorize(model, adminUser, "create");
    const scope = await resolveScope(model.raw, adminUser);
    let data = applyCreateScope(
      validateWritePayload(model.meta, model.raw, adminUser, body),
      scope,
    );
    await this.validateCreateData(model, adminUser, data);

    if (model.raw.beforeCreate) {
      const hookData = await model.raw.beforeCreate(data);
      const scopeFieldNames = new Set(Object.keys(scope));
      data = validateHookPayload(
        model.meta,
        Object.fromEntries(
          Object.entries(hookData).filter(
            ([fieldName]) => !scopeFieldNames.has(fieldName),
          ),
        ),
      );
      data = applyCreateScope(data, scope);
      await this.validateCreateData(model, adminUser, data);
    }

    const record = await this.adapter.resource(model.meta).create({
      data,
      select: buildRecordSelect(model.meta, model),
    });
    if (model.raw.afterCreate) {
      await runPostCommit("afterCreate", () => model.raw.afterCreate!(record));
    }
    const recordId = record[model.meta.idField];
    await this.writeAuditSafely(adminUser, {
      type: "create",
      modelName: model.meta.name,
      recordIds:
        typeof recordId === "string" || typeof recordId === "number"
          ? [recordId]
          : [],
    });
    return record;
  }

  async update(
    model: FullRegisteredModel,
    adminUser: AdminUser,
    id: string | number,
    body: unknown,
  ): Promise<Record<string, unknown>> {
    this.authorize(model, adminUser, "update");
    const scope = await resolveScope(model.raw, adminUser);
    const delegate = this.adapter.resource(model.meta);
    const existing = await delegate.findFirst({
      scope,
      id,
      select: idSelect(model.meta.idField),
    });
    if (!existing) throw new RecordNotFoundError();

    let data = validateWritePayload(model.meta, model.raw, adminUser, body);
    await this.validateUpdateData(model, adminUser, scope, data);
    if (model.raw.beforeUpdate) {
      data = validateHookPayload(
        model.meta,
        await model.raw.beforeUpdate(String(id), data),
      );
      await this.validateUpdateData(model, adminUser, scope, data);
    }

    const result = await delegate.updateMany({ scope, id, data });
    if (result.count === 0) throw new RecordNotFoundError();
    const record = await delegate.findFirst({
      scope,
      id,
      select: buildRecordSelect(model.meta, model),
    });
    if (!record) {
      throw new Error(
        `[paneljs] Updated record "${model.meta.name}/${id}" could not be reloaded.`,
      );
    }
    if (model.raw.afterUpdate) {
      await runPostCommit("afterUpdate", () => model.raw.afterUpdate!(record));
    }
    await this.writeAuditSafely(adminUser, {
      type: "update",
      modelName: model.meta.name,
      recordIds: [id],
    });
    return record;
  }

  async delete(
    model: FullRegisteredModel,
    adminUser: AdminUser,
    id: string | number,
  ): Promise<void> {
    this.authorize(model, adminUser, "delete");
    const scope = await resolveScope(model.raw, adminUser);
    const delegate = this.adapter.resource(model.meta);
    const record = await delegate.findFirst({
      scope,
      id,
      select: buildRecordSelect(model.meta, model),
    });
    if (!record) throw new RecordNotFoundError();
    if (model.raw.beforeDelete) await model.raw.beforeDelete(String(id));
    await assertNoRestrictedRelations(
      model,
      this.models,
      this.adapter,
      adminUser,
      [id],
    );
    const result = await delegate.deleteMany({ scope, id });
    if (result.count === 0) throw new RecordNotFoundError();
    if (model.raw.afterDelete) {
      await runPostCommit("afterDelete", () =>
        model.raw.afterDelete!(String(id)),
      );
    }
    await this.writeAuditSafely(adminUser, {
      type: "delete",
      modelName: model.meta.name,
      recordIds: [id],
    });
  }

  async deletePreview(
    model: FullRegisteredModel,
    adminUser: AdminUser,
    requestedIds: Array<string | number>,
  ): Promise<DeletePreview> {
    this.authorize(model, adminUser, "delete");
    validateSelectedIds(requestedIds);
    const { records, ids } = await this.loadSelected(
      model,
      adminUser,
      requestedIds,
      buildListRecordSelect(model.meta, model),
    );
    const relations = await loadDeletePreviewRelations(
      model,
      this.models,
      this.adapter,
      adminUser,
      ids,
    );
    return { records, relations };
  }

  async deleteSelected(
    model: FullRegisteredModel,
    adminUser: AdminUser,
    requestedIds: Array<string | number>,
  ): Promise<DeleteSelectedResult> {
    this.authorize(model, adminUser, "list");
    this.authorize(model, adminUser, "delete");
    validateSelectedIds(requestedIds);
    const { ids } = await this.loadSelected(
      model,
      adminUser,
      requestedIds,
      idSelect(model.meta.idField),
    );
    await assertNoRestrictedRelations(
      model,
      this.models,
      this.adapter,
      adminUser,
      ids,
    );
    const scope = await resolveScope(model.raw, adminUser);
    const delegate = this.adapter.resource(model.meta);
    const deletedIds: Array<string | number> = [];
    for (const id of ids) {
      if (model.raw.beforeDelete) await model.raw.beforeDelete(String(id));
      const result = await delegate.deleteMany({ scope, id });
      if (result.count !== 1) continue;
      deletedIds.push(id);
      if (model.raw.afterDelete) {
        await runPostCommit("afterDelete", () =>
          model.raw.afterDelete!(String(id)),
        );
      }
    }
    if (deletedIds.length > 0) {
      await this.writeAuditSafely(adminUser, {
        type: "delete",
        modelName: model.meta.name,
        recordIds: deletedIds,
      });
    }
    return {
      requestedIds,
      deletedIds,
      partial: deletedIds.length !== ids.length,
    };
  }

  async runAction(
    model: FullRegisteredModel,
    adminUser: AdminUser,
    actionName: string,
    requestedIds: Array<string | number>,
  ): Promise<{ message: string }> {
    if (actionName === DELETE_SELECTED_ACTION.name) {
      const result = await this.deleteSelected(model, adminUser, requestedIds);
      return {
        message: result.partial
          ? `Deleted ${result.deletedIds.length} ${pluralRecord(result.deletedIds.length)}; some records changed before deletion.`
          : `Deleted ${result.deletedIds.length} ${pluralRecord(result.deletedIds.length)}.`,
      };
    }

    this.authorize(model, adminUser, "list");
    const action = model.raw.actions?.find(
      (candidate) => candidate.name === actionName,
    );
    if (
      !action ||
      !hasRegisteredActionPermission(
        adminUser,
        model.resolved.permissions,
        action,
      )
    ) {
      throw new PermissionDeniedError();
    }
    validateSelectedIds(requestedIds);
    const { ids } = await this.loadSelected(
      model,
      adminUser,
      requestedIds,
      idSelect(model.meta.idField),
    );
    const scope = await resolveScope(model.raw, adminUser);
    const result = await action.handler({
      ids,
      adminUser,
      client: this.adapter.client,
      where: { scope, ids },
    });
    await this.writeAuditSafely(adminUser, {
      type: "action",
      modelName: model.meta.name,
      recordIds: ids,
      metadata: { action: action.name },
    });
    return result;
  }

  private authorize(
    model: FullRegisteredModel,
    adminUser: AdminUser,
    operation: AdminOperation,
  ): void {
    if (!hasModelPermission(adminUser, model.resolved.permissions, operation)) {
      throw new PermissionDeniedError();
    }
  }

  private async validateCreateData(
    model: FullRegisteredModel,
    adminUser: AdminUser,
    data: Record<string, unknown>,
  ): Promise<void> {
    assertRequiredCreateFields(model.meta, model.raw, adminUser, data);
    await assertSelectedRelationsAreVisible(
      data,
      model,
      this.models,
      this.adapter,
      adminUser,
    );
  }

  private async validateUpdateData(
    model: FullRegisteredModel,
    adminUser: AdminUser,
    scope: Record<string, unknown>,
    data: Record<string, unknown>,
  ): Promise<void> {
    assertScopeFieldsUnchanged(data, scope);
    assertScopeRelationsUnchanged(data, model, scope);
    await assertSelectedRelationsAreVisible(
      data,
      model,
      this.models,
      this.adapter,
      adminUser,
    );
  }

  private async loadSelected(
    model: FullRegisteredModel,
    adminUser: AdminUser,
    requestedIds: Array<string | number>,
    select: FieldSelect,
  ): Promise<{
    records: Record<string, unknown>[];
    ids: Array<string | number>;
  }> {
    const scope = await resolveScope(model.raw, adminUser);
    const records = await this.adapter.resource(model.meta).findMany({
      scope,
      filters: {},
      ids: requestedIds,
      select,
    });
    const ids = records
      .map((record) => record[model.meta.idField])
      .filter(
        (id): id is string | number =>
          typeof id === "string" || typeof id === "number",
      );
    if (ids.length !== requestedIds.length) {
      throw new RequestValidationError(
        "One or more selected records are unavailable.",
      );
    }
    return { records, ids };
  }

  private async writeAuditSafely(
    actor: AdminUser,
    event: Parameters<typeof writeAuditEvent>[2],
  ): Promise<void> {
    await runPostCommit("audit.write", () =>
      writeAuditEvent(this.audit, actor, event),
    );
  }
}

export function validateSelectedIds(ids: Array<string | number>): void {
  if (ids.length === 0) {
    throw new RequestValidationError(
      "Action requests require at least one record ID.",
    );
  }
  if (ids.length > MAX_ACTION_RECORDS) {
    throw new RequestValidationError(
      `Actions can target at most ${MAX_ACTION_RECORDS} records at once.`,
    );
  }
  if (new Set(ids).size !== ids.length) {
    throw new RequestValidationError("Action record IDs must be unique.");
  }
}

function assertPagination(page: number, perPage: number): void {
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new RequestValidationError("Page must be a positive integer.");
  }
  if (!Number.isSafeInteger(perPage) || perPage < 1 || perPage > 200) {
    throw new RequestValidationError(
      "Records per page must be an integer from 1 to 200.",
    );
  }
}

function pluralRecord(count: number): string {
  return count === 1 ? "record" : "records";
}

async function runPostCommit(
  name: string,
  task: () => Promise<void>,
): Promise<void> {
  try {
    await task();
  } catch {
    console.error(
      `[paneljs] ${name} failed after the database write committed.`,
    );
  }
}

function assertScopeRelationsUnchanged(
  data: Record<string, unknown>,
  model: FullRegisteredModel,
  scope: Record<string, unknown>,
): void {
  const referencedNames = collectScopeFieldNames(scope);
  for (const field of model.meta.fields) {
    const relation = field.relation;
    if (
      field.type !== "relation" ||
      relation?.kind !== "belongsTo" ||
      !referencedNames.has(field.name)
    ) {
      continue;
    }
    for (const foreignKeyField of relation.foreignKeyFields) {
      if (data[foreignKeyField] !== undefined) {
        throw new RequestValidationError(
          `Field "${foreignKeyField}" is controlled by the configured scope and cannot be updated through the admin.`,
        );
      }
    }
  }
}
