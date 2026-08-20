import { Router } from "express";
import {
  DELETE_SELECTED_ACTION,
  PermissionDeniedError,
  RequestValidationError,
  buildListRecordSelect,
  idSelect,
  hasModelPermission,
  hasRegisteredActionPermission,
  parseRecordId,
  resolveScope,
  writeAuditEvent,
  type AdminModelMeta,
  type AuditConfig,
  type DataAdapter,
  type FullRegisteredModel,
} from "@paneljs/paneljs";
import {
  assertNoRestrictedRelations,
  loadDeletePreviewRelations,
} from "./deleteRelations.js";
import { sendApiError } from "./httpErrors.js";
import { getAdminUser, getRegisteredModel, route } from "./routeSupport.js";

const MAX_ACTION_RECORDS = 100;

function parseIds(meta: AdminModelMeta, body: unknown): Array<string | number> {
  if (typeof body !== "object" || body === null || Array.isArray(body))
    throw new RequestValidationError("Request body must be a JSON object.");
  const ids = (body as Record<string, unknown>).ids;
  if (!Array.isArray(ids) || ids.length === 0)
    throw new RequestValidationError(
      "Action requests require at least one record ID.",
    );
  if (ids.length > MAX_ACTION_RECORDS)
    throw new RequestValidationError(
      `Actions can target at most ${MAX_ACTION_RECORDS} records at once.`,
    );

  const parsed = ids.map((raw) => {
    if (typeof raw !== "string" && typeof raw !== "number")
      throw new RequestValidationError(
        "Every action record ID must be a string or number.",
      );
    return parseRecordId(meta, String(raw));
  });

  if (new Set(parsed).size !== parsed.length)
    throw new RequestValidationError("Action record IDs must be unique.");
  return parsed;
}

function parseIdsQuery(
  meta: AdminModelMeta,
  rawIds: unknown,
): Array<string | number> {
  const ids = Array.isArray(rawIds)
    ? rawIds.flatMap((value) => String(value).split(","))
    : typeof rawIds === "string"
      ? rawIds.split(",")
      : [];
  return parseIds(meta, {
    ids: ids.map((value) => value.trim()).filter(Boolean),
  });
}

/** Create scoped, permission-aware routes for registered list-view actions. */
export function createActionRouter(
  models: Map<string, FullRegisteredModel>,
  adapter: DataAdapter,
  audit?: AuditConfig,
): Router {
  const router = Router();

  router.get(
    "/:model/actions/delete-preview",
    route(async (req, res) => {
      const adminUser = getAdminUser(req, res);
      if (!adminUser) return;
      const model = getRegisteredModel(req, res, models);
      if (!model) return;
      if (
        !hasModelPermission(adminUser, model.resolved.permissions, "delete")
      ) {
        sendApiError(res, new PermissionDeniedError());
        return;
      }

      const requestedIds = parseIdsQuery(model.meta, req.query.ids);
      const scope = await resolveScope(model.raw, adminUser);
      const delegate = adapter.resource(model.meta);
      const parentSelect = buildListRecordSelect(model.meta, model);
      const parentRecords = await delegate.findMany({
        scope,
        filters: {},
        ids: requestedIds,
        select: parentSelect,
      });
      const ids = parentRecords
        .map((record) => record[model.meta.idField])
        .filter(
          (id): id is string | number =>
            typeof id === "string" || typeof id === "number",
        );
      if (ids.length !== requestedIds.length)
        throw new RequestValidationError(
          "One or more selected records are unavailable.",
        );

      const relations = await loadDeletePreviewRelations(
        model,
        models,
        adapter,
        adminUser,
        ids,
      );

      res.json({ records: parentRecords, relations });
    }),
  );

  router.post(
    "/:model/actions/:action",
    route(async (req, res) => {
      const adminUser = getAdminUser(req, res);
      if (!adminUser) return;
      const model = getRegisteredModel(req, res, models);
      if (!model) return;
      if (!hasModelPermission(adminUser, model.resolved.permissions, "list")) {
        sendApiError(res, new PermissionDeniedError());
        return;
      }

      const actionName = req.params.action;
      const isDeleteAction = actionName === DELETE_SELECTED_ACTION.name;
      const action =
        typeof actionName === "string"
          ? model.raw.actions?.find(
              (candidate) => candidate.name === actionName,
            )
          : undefined;
      if (
        isDeleteAction &&
        !hasModelPermission(adminUser, model.resolved.permissions, "delete")
      ) {
        sendApiError(res, new PermissionDeniedError());
        return;
      }
      if (
        !isDeleteAction &&
        (!action ||
          !hasRegisteredActionPermission(
            adminUser,
            model.resolved.permissions,
            action,
          ))
      ) {
        sendApiError(res, new PermissionDeniedError());
        return;
      }

      const requestedIds = parseIds(model.meta, req.body);
      const scope = await resolveScope(model.raw, adminUser);
      const delegate = adapter.resource(model.meta);
      const where = { scope, ids: requestedIds };
      const records = await delegate.findMany({
        scope,
        filters: {},
        ids: requestedIds,
        select: idSelect(model.meta.idField),
      });
      const ids = records
        .map((record) => record[model.meta.idField])
        .filter(
          (id): id is string | number =>
            typeof id === "string" || typeof id === "number",
        );
      if (ids.length !== requestedIds.length)
        throw new RequestValidationError(
          "One or more selected records are unavailable.",
        );

      if (isDeleteAction) {
        await assertNoRestrictedRelations(
          model,
          models,
          adapter,
          adminUser,
          ids,
        );
        const deletedIds: Array<string | number> = [];
        for (const id of ids) {
          if (model.raw.beforeDelete) await model.raw.beforeDelete(String(id));
          const result = await delegate.deleteMany({ scope, id });
          if (result.count !== 1) continue;
          deletedIds.push(id);
          if (model.raw.afterDelete)
            await runPostCommit("afterDelete", () =>
              model.raw.afterDelete!(String(id)),
            );
        }
        if (deletedIds.length > 0)
          await writeAuditSafely(audit, adminUser, {
            type: "delete",
            modelName: model.meta.name,
            recordIds: deletedIds,
          });
        const partial = deletedIds.length !== ids.length;
        res.json({
          message: partial
            ? `Deleted ${deletedIds.length} ${deletedIds.length === 1 ? "record" : "records"}; some records changed before deletion.`
            : `Deleted ${deletedIds.length} ${deletedIds.length === 1 ? "record" : "records"}.`,
        });
        return;
      }

      if (!action)
        throw new Error(`Action "${String(actionName)}" was not found.`);
      // `where` must be used for every mutation in a custom action. It
      // contains both the scope and selected IDs, so it remains safe if a
      // record changes between the initial selection and the mutation.
      const result = await action.handler({
        ids,
        adminUser,
        client: adapter.client,
        where,
      });
      await writeAuditSafely(audit, adminUser, {
        type: "action",
        modelName: model.meta.name,
        recordIds: ids,
        metadata: { action: action.name },
      });
      res.json(result);
    }),
  );

  return router;
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

async function writeAuditSafely(
  audit: AuditConfig | undefined,
  actor: import("@paneljs/paneljs").AdminUser,
  event: Parameters<typeof writeAuditEvent>[2],
): Promise<void> {
  await runPostCommit("audit.write", () =>
    writeAuditEvent(audit, actor, event),
  );
}
