import { randomUUID } from "node:crypto";
import {
  ForeignKeyConstraintViolationException,
  NotNullConstraintViolationException,
  UniqueConstraintViolationException,
  type FilterQuery,
  type MikroORM,
} from "@mikro-orm/core";
import {
  RequestValidationError,
  type ActionWhere,
  type AdminModelMeta,
  type CountQuery,
  type CreateQuery,
  type DeleteManyQuery,
  type EqualityFilter,
  type FieldFilters,
  type FieldSelect,
  type FindFirstQuery,
  type FindManyQuery,
  type ModelResource,
  type SearchQuery,
  type UpdateManyQuery,
} from "paneljs";
import { usesInsensitiveSearch } from "./introspector.js";

type Where = FilterQuery<object>;

function belongsToFkMap(meta: AdminModelMeta): Map<string, string> {
  const map = new Map<string, string>();
  for (const field of meta.fields) {
    if (field.type !== "relation" || field.relation?.kind !== "belongsTo") {
      continue;
    }
    for (const fk of field.relation.foreignKeyFields) {
      if (fk !== field.name) map.set(fk, field.name);
    }
  }
  return map;
}

function rewriteKeys(
  map: Map<string, string>,
  record: Record<string, unknown>,
): Record<string, unknown> {
  if (map.size === 0) return { ...record };
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    result[map.get(key) ?? key] = value;
  }
  return result;
}

function rewriteFieldName(map: Map<string, string>, field: string): string {
  return map.get(field) ?? field;
}

function assertSimpleScope(scope: EqualityFilter): void {
  for (const key of Object.keys(scope)) {
    if (key === "AND" || key === "OR" || key === "NOT") {
      throw new Error(
        "[paneljs] MikroORM adapter only supports simple equality scope (for example { tenantId }).",
      );
    }
  }
}

function applyFilters(
  base: Record<string, unknown>,
  filters: FieldFilters | undefined,
  fkMap: Map<string, string>,
): void {
  if (!filters) return;
  for (const [field, filter] of Object.entries(filters)) {
    const key = rewriteFieldName(fkMap, field);
    if ("equals" in filter) {
      base[key] = filter.equals;
      continue;
    }
    if ("in" in filter) {
      base[key] = { $in: filter.in };
      continue;
    }
    const range: Record<string, unknown> = {};
    if (filter.gte !== undefined) range.$gte = filter.gte;
    if (filter.lte !== undefined) range.$lte = filter.lte;
    if (Object.keys(range).length > 0) base[key] = range;
  }
}

function combineAnd(conditions: Record<string, unknown>[]): Where {
  const nonEmpty = conditions.filter(
    (condition) => Object.keys(condition).length > 0,
  );
  if (nonEmpty.length === 0) return {} as Where;
  if (nonEmpty.length === 1) return nonEmpty[0] as Where;
  return { $and: nonEmpty } as Where;
}

function toMikroormWhere(
  meta: AdminModelMeta,
  query: {
    scope: EqualityFilter;
    filters?: FieldFilters;
    search?: SearchQuery;
    ids?: Array<string | number>;
    id?: string | number;
  },
  caseInsensitive: boolean,
): Where {
  assertSimpleScope(query.scope);
  const fkMap = belongsToFkMap(meta);
  const scope = rewriteKeys(fkMap, { ...query.scope });
  const filters: Record<string, unknown> = {};
  applyFilters(filters, query.filters, fkMap);
  const target: Record<string, unknown> = {};
  if (query.ids !== undefined) target[meta.idField] = { $in: query.ids };
  if (query.id !== undefined) target[meta.idField] = query.id;

  const search = query.search;
  if (!search || search.fields.length === 0) {
    return combineAnd([scope, filters, target]);
  }

  const match = caseInsensitive ? "$ilike" : "$like";
  const pattern = `%${search.text}%`;
  const searchCondition = {
    $or: search.fields.map((field) => ({
      [rewriteFieldName(fkMap, field)]: { [match]: pattern },
    })),
  };
  return combineAnd([scope, filters, target, searchCondition]);
}

function relationPk(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value !== "object") return value;
  const record = value as { id?: unknown };
  if (record.id !== undefined) return record.id;
  return value;
}

function projectRecord(
  record: object,
  select: FieldSelect,
  meta: AdminModelMeta,
): Record<string, unknown> {
  const source = record as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const fkMap = belongsToFkMap(meta);

  for (const field of select.fields) {
    if (field in source) {
      result[field] = source[field];
      continue;
    }
    const relationName = fkMap.get(field);
    if (relationName) result[field] = relationPk(source[relationName]);
  }

  for (const relation of select.relations) {
    const value = source[relation.field];
    if (value === null || value === undefined) {
      result[relation.field] = value ?? null;
      continue;
    }
    if (typeof value === "object" && !Array.isArray(value)) {
      const related = value as Record<string, unknown>;
      result[relation.field] = {
        [relation.displayField]: related[relation.displayField] ?? null,
      };
    }
  }
  return result;
}

function relationNames(select: FieldSelect): string[] {
  return [...new Set(select.relations.map((relation) => relation.field))];
}

function entityName(meta: AdminModelMeta): string {
  return meta.name;
}

function assertWriteTarget(query: {
  id?: string | number;
  ids?: Array<string | number>;
}): void {
  if (query.id === undefined && query.ids === undefined) {
    throw new Error(
      "[paneljs] MikroORM update/delete requires id or ids so a full-table write cannot happen.",
    );
  }
}

function rethrowWriteError(error: unknown): never {
  if (error instanceof UniqueConstraintViolationException) {
    throw new RequestValidationError(
      "A record with the same unique value already exists.",
    );
  }
  if (error instanceof ForeignKeyConstraintViolationException) {
    throw new RequestValidationError(
      "Cannot delete this record because other records still reference it.",
    );
  }
  if (error instanceof NotNullConstraintViolationException) {
    throw new RequestValidationError("A required field was missing.");
  }
  throw error;
}

function applyInsertDefaults(
  orm: MikroORM,
  entityName: string,
  data: Record<string, unknown>,
): void {
  const entity = orm.getMetadata().get(entityName);
  for (const prop of Object.values(entity.properties)) {
    if (data[prop.name] !== undefined) continue;
    if (prop.kind && prop.kind !== "scalar") continue;
    if (typeof prop.onCreate === "function") {
      data[prop.name] = prop.onCreate(data, orm.em);
    }
  }
}

function applyUpdateValues(
  orm: MikroORM,
  entityName: string,
  data: Record<string, unknown>,
): void {
  const entity = orm.getMetadata().get(entityName);
  for (const prop of Object.values(entity.properties)) {
    if (data[prop.name] !== undefined) continue;
    if (typeof prop.onUpdate === "function") {
      data[prop.name] = prop.onUpdate(data, orm.em);
    }
  }
}

function fillGeneratedId(
  orm: MikroORM,
  meta: AdminModelMeta,
  data: Record<string, unknown>,
): void {
  if (data[meta.idField] !== undefined) return;
  const entity = orm.getMetadata().get(meta.name);
  const pk = entity?.properties[meta.idField];
  if (!pk || pk.autoincrement) return;
  const type = typeof pk.type === "string" ? pk.type.toLowerCase() : "";
  const defaultRaw = String(pk.defaultRaw ?? "").toLowerCase();
  if (type === "uuid" || defaultRaw.includes("uuid")) {
    data[meta.idField] = randomUUID();
  }
}

/** Turn a custom-action `where` into a MikroORM FilterQuery. */
export function mikroormActionWhere(
  orm: MikroORM,
  entityName: string,
  where: ActionWhere,
): Where {
  assertSimpleScope(where.scope);
  const entity = orm.getMetadata().get(entityName);
  const fkMap = new Map<string, string>();
  for (const prop of Object.values(entity.properties)) {
    if (prop.kind !== "m:1" && !(prop.kind === "1:1" && prop.owner)) continue;
    fkMap.set(`${prop.name}Id`, prop.name);
    if (prop.fieldNames?.[0] && prop.fieldNames[0] !== prop.name) {
      fkMap.set(prop.fieldNames[0], prop.name);
    }
  }
  const idField = entity.primaryKeys[0] ?? "id";
  return combineAnd([
    rewriteKeys(fkMap, { ...where.scope }),
    { [idField]: { $in: where.ids } },
  ]);
}

export function mikroormResource(
  orm: MikroORM,
  meta: AdminModelMeta,
): ModelResource {
  const name = entityName(meta);
  const caseInsensitive = usesInsensitiveSearch(orm);
  const fkMap = belongsToFkMap(meta);

  return {
    async findMany(query: FindManyQuery) {
      const em = orm.em.fork();
      const records = await em.find(
        name,
        toMikroormWhere(meta, query, caseInsensitive),
        {
          populate: relationNames(query.select) as never,
          orderBy: query.sort
            ? {
                [rewriteFieldName(fkMap, query.sort.field)]:
                  query.sort.direction,
              }
            : undefined,
          offset: query.skip,
          limit: query.take,
        },
      );
      return records.map((record) =>
        projectRecord(record as object, query.select, meta),
      );
    },
    async findFirst(query: FindFirstQuery) {
      const em = orm.em.fork();
      const record = await em.findOne(
        name,
        toMikroormWhere(meta, query, caseInsensitive),
        { populate: relationNames(query.select) as never },
      );
      return record
        ? projectRecord(record as object, query.select, meta)
        : null;
    },
    count(query: CountQuery) {
      return orm.em
        .fork()
        .count(name, toMikroormWhere(meta, query, caseInsensitive));
    },
    async create(query: CreateQuery) {
      const em = orm.em.fork();
      try {
        const data = rewriteKeys(fkMap, { ...query.data });
        fillGeneratedId(orm, meta, data);
        applyInsertDefaults(orm, name, data);
        const id = (await em.insert(name, data)) as string | number;
        const reloaded = await em.findOne(
          name,
          { [meta.idField]: id } as Where,
          { populate: relationNames(query.select) as never },
        );
        if (reloaded)
          return projectRecord(reloaded as object, query.select, meta);
        return projectRecord(
          { ...data, [meta.idField]: id },
          query.select,
          meta,
        );
      } catch (error) {
        rethrowWriteError(error);
      }
    },
    async updateMany(query: UpdateManyQuery) {
      assertWriteTarget(query);
      const em = orm.em.fork();
      const data = rewriteKeys(fkMap, { ...query.data });
      applyUpdateValues(orm, name, data);
      try {
        const count = await em.nativeUpdate(
          name,
          toMikroormWhere(meta, query, caseInsensitive),
          data,
        );
        return { count };
      } catch (error) {
        rethrowWriteError(error);
      }
    },
    async deleteMany(query: DeleteManyQuery) {
      assertWriteTarget(query);
      const em = orm.em.fork();
      try {
        const count = await em.nativeDelete(
          name,
          toMikroormWhere(meta, query, caseInsensitive),
        );
        return { count };
      } catch (error) {
        rethrowWriteError(error);
      }
    },
  };
}
