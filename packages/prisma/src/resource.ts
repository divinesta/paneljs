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

function toPrismaSearch(search: SearchQuery | undefined): Record<string, unknown> | undefined {
  if (!search || search.fields.length === 0) return undefined;
  return {
    OR: search.fields.map((field) => ({
      [field]: {
        contains: search.text,
        ...(search.caseInsensitive ? { mode: "insensitive" } : {}),
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
): Record<string, unknown> {
  return combineAnd([
    query.scope,
    query.filters ? toPrismaFilters(query.filters) : undefined,
    toPrismaSearch(query.search),
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
): ModelResource {
  return {
    findMany(query: FindManyQuery) {
      const args: Record<string, unknown> = {
        where: toPrismaWhere(meta, query),
        select: toPrismaSelect(query.select),
      };
      if (query.sort) args.orderBy = { [query.sort.field]: query.sort.direction };
      if (query.skip !== undefined) args.skip = query.skip;
      if (query.take !== undefined) args.take = query.take;
      return delegate.findMany(args);
    },
    findFirst(query: FindFirstQuery) {
      return delegate.findFirst({
        where: toPrismaWhere(meta, query),
        select: toPrismaSelect(query.select),
      });
    },
    count(query: CountQuery) {
      return delegate.count({ where: toPrismaWhere(meta, query) });
    },
    create(query: CreateQuery) {
      return delegate.create({
        data: query.data,
        select: toPrismaSelect(query.select),
      });
    },
    updateMany(query: UpdateManyQuery) {
      return delegate.updateMany({
        where: toPrismaWhere(meta, query),
        data: query.data,
      });
    },
    deleteMany(query: DeleteManyQuery) {
      return delegate.deleteMany({
        where: toPrismaWhere(meta, query),
      });
    },
  };
}
