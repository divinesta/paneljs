import type {
  ActionWhere,
  AdminModelMeta,
  CountQuery,
  CreateQuery,
  DeleteManyQuery,
  EqualityFilter,
  FieldFilters,
  FieldSelect,
  FindFirstQuery,
  FindManyQuery,
  ModelResource,
  SearchQuery,
  UpdateManyQuery,
} from "@paneljs/paneljs";
import {
  And,
  ILike,
  In,
  LessThanOrEqual,
  Like,
  MoreThanOrEqual,
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
      const saved = await repo.save(repo.create(query.data));
      const id = saved[meta.idField] as string | number | undefined;
      if (id === undefined) {
        return projectRecord(saved, query.select);
      }
      const reloaded = await repo.findOne({
        where: { [meta.idField]: id } as FindOptionsWhere<ObjectLiteral>,
        relations: relationNames(query.select),
      });
      return projectRecord(reloaded ?? saved, query.select);
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
      const result = await repo.delete(
        toTypeormWhere(meta, query, caseInsensitive) as FindOptionsWhere<ObjectLiteral>,
      );
      return { count: result.affected ?? 0 };
    },
  };
}
