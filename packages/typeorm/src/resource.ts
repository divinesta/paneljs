import { randomUUID } from "node:crypto";
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
} from "@paneljs/paneljs";
import {
  And,
  ILike,
  In,
  LessThanOrEqual,
  Like,
  MoreThanOrEqual,
  QueryFailedError,
  type DataSource,
  type FindOptionsOrder,
  type FindOptionsWhere,
  type ObjectLiteral,
  type Repository,
} from "typeorm";

type Where = FindOptionsWhere<ObjectLiteral> | FindOptionsWhere<ObjectLiteral>[];

function usesInsensitiveSearch(driverType: string): boolean {
  return (
    driverType === "postgres" ||
    driverType === "cockroachdb" ||
    driverType === "aurora-postgres"
  );
}

function assertSimpleScope(scope: EqualityFilter): void {
  for (const key of Object.keys(scope)) {
    if (key === "AND" || key === "OR" || key === "NOT") {
      throw new Error(
        "[paneljs] TypeORM adapter only supports simple equality scope (for example { tenantId }).",
      );
    }
  }
}

function applyFilters(
  base: Record<string, unknown>,
  filters: FieldFilters | undefined,
): void {
  if (!filters) return;
  for (const [field, filter] of Object.entries(filters)) {
    if ("equals" in filter) {
      base[field] = filter.equals;
      continue;
    }
    if ("in" in filter) {
      base[field] = In(filter.in);
      continue;
    }
    if (filter.gte !== undefined && filter.lte !== undefined) {
      base[field] = And(
        MoreThanOrEqual(filter.gte),
        LessThanOrEqual(filter.lte),
      );
    } else if (filter.gte !== undefined) {
      base[field] = MoreThanOrEqual(filter.gte);
    } else if (filter.lte !== undefined) {
      base[field] = LessThanOrEqual(filter.lte);
    }
  }
}

function toTypeormWhere(
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
  const base: Record<string, unknown> = { ...query.scope };
  applyFilters(base, query.filters);
  if (query.ids !== undefined) base[meta.idField] = In(query.ids);
  if (query.id !== undefined) base[meta.idField] = query.id;

  const search = query.search;
  if (!search || search.fields.length === 0) {
    return base as FindOptionsWhere<ObjectLiteral>;
  }

  const match = caseInsensitive ? ILike : Like;
  const pattern = `%${search.text}%`;
  return search.fields.map(
    (field) =>
      ({
        ...base,
        [field]: match(pattern),
      }) as FindOptionsWhere<ObjectLiteral>,
  );
}

function projectRecord(
  record: ObjectLiteral,
  select: FieldSelect,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of select.fields) {
    if (field in record) result[field] = record[field];
  }
  for (const relation of select.relations) {
    const value = record[relation.field];
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

function getRepository(
  dataSource: DataSource,
  meta: AdminModelMeta,
): Repository<ObjectLiteral> {
  const entity = dataSource.entityMetadatas.find(
    (candidate) =>
      candidate.name === meta.name || candidate.name === meta.clientKey,
  );
  if (!entity) {
    throw new Error(
      `[paneljs] TypeORM has no entity metadata for model "${meta.name}".`,
    );
  }
  return dataSource.getRepository(entity.target);
}

function assertWriteTarget(query: { id?: string | number; ids?: Array<string | number> }): void {
  if (query.id === undefined && query.ids === undefined) {
    throw new Error(
      "[paneljs] TypeORM update/delete requires id or ids so a full-table write cannot happen.",
    );
  }
}

function driverCode(error: unknown): string | undefined {
  if (!(error instanceof QueryFailedError)) return undefined;
  return (error.driverError as { code?: string } | undefined)?.code;
}

function driverColumn(error: unknown): string | undefined {
  if (!(error instanceof QueryFailedError)) return undefined;
  return (error.driverError as { column?: string } | undefined)?.column;
}

function isForeignKeyViolation(error: unknown): boolean {
  const code = driverCode(error);
  return (
    code === "23503" ||
    code === "ER_ROW_IS_REFERENCED" ||
    code === "ER_ROW_IS_REFERENCED_2" ||
    code === "SQLITE_CONSTRAINT_FOREIGNKEY"
  );
}

function isNotNullViolation(error: unknown): boolean {
  const code = driverCode(error);
  return (
    code === "23502" ||
    code === "ER_BAD_NULL_ERROR" ||
    code === "SQLITE_CONSTRAINT_NOTNULL"
  );
}

function rethrowWriteError(error: unknown): never {
  if (isForeignKeyViolation(error)) {
    throw new RequestValidationError(
      "Cannot delete this record because other records still reference it.",
    );
  }
  if (isNotNullViolation(error)) {
    const column = driverColumn(error);
    throw new RequestValidationError(
      column ? `Field "${column}" is required.` : "A required field was missing.",
    );
  }
  throw error;
}

/** Turn a custom-action `where` into a TypeORM find/update criteria. */
export function typeormActionWhere(
  idField: string,
  where: ActionWhere,
): FindOptionsWhere<ObjectLiteral> {
  assertSimpleScope(where.scope);
  return {
    ...where.scope,
    [idField]: In(where.ids),
  } as FindOptionsWhere<ObjectLiteral>;
}

export function typeormResource(
  dataSource: DataSource,
  meta: AdminModelMeta,
): ModelResource {
  const repo = getRepository(dataSource, meta);
  const caseInsensitive = usesInsensitiveSearch(dataSource.options.type);

  return {
    async findMany(query: FindManyQuery) {
      const records = await repo.find({
        where: toTypeormWhere(meta, query, caseInsensitive),
        relations: relationNames(query.select),
        order: query.sort
          ? ({
              [query.sort.field]: query.sort.direction.toUpperCase(),
            } as FindOptionsOrder<ObjectLiteral>)
          : undefined,
        skip: query.skip,
        take: query.take,
      });
      return records.map((record) => projectRecord(record, query.select));
    },
    async findFirst(query: FindFirstQuery) {
      const record = await repo.findOne({
        where: toTypeormWhere(meta, query, caseInsensitive),
        relations: relationNames(query.select),
      });
      return record ? projectRecord(record, query.select) : null;
    },
    count(query: CountQuery) {
      return repo.count({
        where: toTypeormWhere(meta, query, caseInsensitive),
      });
    },
    async create(query: CreateQuery) {
      try {
        const data = { ...query.data };
        for (const column of repo.metadata.columns) {
          if (
            column.generationStrategy === "uuid" &&
            data[column.propertyName] === undefined
          ) {
            data[column.propertyName] = randomUUID();
          }
        }
        const saved = await repo.save(repo.create(data));
        const id = saved[meta.idField] as string | number | undefined;
        if (id === undefined) {
          return projectRecord(saved, query.select);
        }
        const reloaded = await repo.findOne({
          where: { [meta.idField]: id } as FindOptionsWhere<ObjectLiteral>,
          relations: relationNames(query.select),
        });
        return projectRecord(reloaded ?? saved, query.select);
      } catch (error) {
        rethrowWriteError(error);
      }
    },
    async updateMany(query: UpdateManyQuery) {
      assertWriteTarget(query);
      const result = await repo.update(
        toTypeormWhere(meta, query, caseInsensitive) as FindOptionsWhere<ObjectLiteral>,
        query.data,
      );
      return { count: result.affected ?? 0 };
    },
    async deleteMany(query: DeleteManyQuery) {
      assertWriteTarget(query);
      try {
        const result = await repo.delete(
          toTypeormWhere(meta, query, caseInsensitive) as FindOptionsWhere<ObjectLiteral>,
        );
        return { count: result.affected ?? 0 };
      } catch (error) {
        rethrowWriteError(error);
      }
    },
  };
}
