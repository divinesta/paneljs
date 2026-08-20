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

function isForeignKeyViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return code === "P2003" || code === "P2014";
}

function rethrowWriteError(error: unknown): never {
  if (isForeignKeyViolation(error)) {
    throw new RequestValidationError(
      "Cannot delete this record because other records still reference it.",
    );
  }
  throw error;
}

export type PrismaDelegate = {
  findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  count(args: Record<string, unknown>): Promise<number>;
  create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
  deleteMany(args: Record<string, unknown>): Promise<{ count: number }>;
};

function toPrismaSelect(select: FieldSelect): Record<string, true | { select: Record<string, true> }> {
  const result: Record<string, true | { select: Record<string, true> }> = {};
  for (const field of select.fields) result[field] = true;
  for (const relation of select.relations) {
    result[relation.field] = { select: { [relation.displayField]: true } };
  }
  return result;
}

function toPrismaFilters(filters: FieldFilters): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [field, filter] of Object.entries(filters)) {
    if ("equals" in filter) {
      result[field] = filter.equals;
      continue;
    }
    if ("in" in filter) {
      result[field] = { in: filter.in };
      continue;
    }
    const range: Record<string, unknown> = {};
    if (filter.gte !== undefined) range.gte = filter.gte;
    if (filter.lte !== undefined) range.lte = filter.lte;
    if (Object.keys(range).length > 0) result[field] = range;
  }
  return result;
}

function toPrismaSearch(
  search: SearchQuery | undefined,
  caseInsensitive: boolean,
): Record<string, unknown> | undefined {
  if (!search || search.fields.length === 0) return undefined;
  return {
    OR: search.fields.map((field) => ({
      [field]: {
        contains: search.text,
        ...(caseInsensitive ? { mode: "insensitive" } : {}),
      },
    })),
  };
}

function combineAnd(
  parts: Array<Record<string, unknown> | undefined>,
): Record<string, unknown> {
  const conditions = parts.filter(
    (part): part is Record<string, unknown> =>
      part !== undefined && Object.keys(part).length > 0,
  );
  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0] ?? {};
  return { AND: conditions };
}

function toPrismaWhere(
  meta: AdminModelMeta,
  query: {
    scope: EqualityFilter;
    filters?: FieldFilters;
    search?: SearchQuery;
    ids?: Array<string | number>;
    id?: string | number;
  },
  caseInsensitive: boolean,
): Record<string, unknown> {
  return combineAnd([
    query.scope,
    query.filters ? toPrismaFilters(query.filters) : undefined,
    toPrismaSearch(query.search, caseInsensitive),
    query.ids !== undefined ? { [meta.idField]: { in: query.ids } } : undefined,
    query.id !== undefined ? { [meta.idField]: query.id } : undefined,
  ]);
}

/** Turn a custom-action `where` into a Prisma `where` for use with `client`. */
export function prismaActionWhere(
  idField: string,
  where: ActionWhere,
): Record<string, unknown> {
  return combineAnd([
    where.scope,
    { [idField]: { in: where.ids } },
  ]);
}

export function prismaResource(
  delegate: PrismaDelegate,
  meta: AdminModelMeta,
  options: { caseInsensitiveSearch?: boolean } = {},
): ModelResource {
  const caseInsensitive = options.caseInsensitiveSearch === true;
  return {
    findMany(query: FindManyQuery) {
      const args: Record<string, unknown> = {
        where: toPrismaWhere(meta, query, caseInsensitive),
        select: toPrismaSelect(query.select),
      };
      if (query.sort) args.orderBy = { [query.sort.field]: query.sort.direction };
      if (query.skip !== undefined) args.skip = query.skip;
      if (query.take !== undefined) args.take = query.take;
      return delegate.findMany(args);
    },
    findFirst(query: FindFirstQuery) {
      return delegate.findFirst({
        where: toPrismaWhere(meta, query, caseInsensitive),
        select: toPrismaSelect(query.select),
      });
    },
    count(query: CountQuery) {
      return delegate.count({
        where: toPrismaWhere(meta, query, caseInsensitive),
      });
    },
    create(query: CreateQuery) {
      return delegate.create({
        data: query.data,
        select: toPrismaSelect(query.select),
      });
    },
    updateMany(query: UpdateManyQuery) {
      return delegate.updateMany({
        where: toPrismaWhere(meta, query, caseInsensitive),
        data: query.data,
      });
    },
    async deleteMany(query: DeleteManyQuery) {
      try {
        return await delegate.deleteMany({
          where: toPrismaWhere(meta, query, caseInsensitive),
        });
      } catch (error) {
        rethrowWriteError(error);
      }
    },
  };
}
