import {
  RecordNotFoundError,
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

type WriteOperation = "create" | "update" | "delete";

type PrismaKnownError = {
  code: string;
  meta?: Record<string, unknown>;
};

function asPrismaKnownError(error: unknown): PrismaKnownError | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  if (typeof code !== "string") return null;
  const meta = (error as { meta?: unknown }).meta;
  return {
    code,
    meta:
      typeof meta === "object" && meta !== null
        ? (meta as Record<string, unknown>)
        : undefined,
  };
}

/**
 * Prisma 7 with a driver adapter (e.g. PrismaPg) reports constraint details
 * under `meta.driverAdapterError.cause.constraint` instead of the classic
 * `meta.target` / `meta.field_name`. Read both shapes.
 */
function driverConstraint(
  meta: Record<string, unknown> | undefined,
): { fields?: unknown; index?: unknown } | undefined {
  const adapterError = meta?.driverAdapterError as
    | { cause?: { constraint?: { fields?: unknown; index?: unknown } } }
    | undefined;
  return adapterError?.cause?.constraint;
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter((entry): entry is string => typeof entry === "string");
  return typeof value === "string" ? [value] : [];
}

/** Columns named by a unique (P2002) or NOT NULL (P2011) error. */
function constraintFields(
  meta: Record<string, unknown> | undefined,
  modelMeta: AdminModelMeta,
): string[] {
  const candidates = [
    ...stringList(meta?.target),
    ...stringList(meta?.constraint),
    ...stringList(driverConstraint(meta)?.fields),
  ];
  // Only report names that are real fields; a constraint name such as
  // "User_email_key" is useless to the form.
  return candidates.filter((name) =>
    modelMeta.fields.some((field) => field.name === name),
  );
}

/**
 * The foreign key column behind a P2003 error. Prisma gives the constraint
 * name ("Post_authorId_fkey") rather than the column, so match it against
 * this model's foreign key fields.
 */
function foreignKeyField(
  meta: Record<string, unknown> | undefined,
  modelMeta: AdminModelMeta,
): string | undefined {
  const names = [
    ...stringList(meta?.field_name),
    ...stringList(driverConstraint(meta)?.index),
  ];
  const foreignKeys = modelMeta.fields.flatMap(
    (field) => field.relation?.foreignKeyFields ?? [],
  );
  return foreignKeys
    .filter((fk) =>
      names.some((name) => name === fk || name.includes(`_${fk}_fkey`)),
    )
    .sort((a, b) => b.length - a.length)[0];
}

function rethrowWriteError(
  error: unknown,
  operation: WriteOperation,
  modelMeta: AdminModelMeta,
): never {
  const known = asPrismaKnownError(error);
  if (!known) throw error;

  switch (known.code) {
    case "P2002": {
      const fields = constraintFields(known.meta, modelMeta);
      if (fields.length === 1) {
        throw new RequestValidationError(
          `Field "${fields[0]}" must be unique. Another record already uses this value.`,
          fields[0],
        );
      }
      throw new RequestValidationError(
        "A record with the same unique value already exists.",
      );
    }
    case "P2003":
    case "P2014": {
      if (operation === "delete") {
        throw new RequestValidationError(
          "Cannot delete this record because other records still reference it.",
        );
      }
      const field = foreignKeyField(known.meta, modelMeta);
      if (field) {
        throw new RequestValidationError(
          `Field "${field}" points to a related record that does not exist.`,
          field,
        );
      }
      throw new RequestValidationError(
        "A related record this record points to does not exist.",
      );
    }
    case "P2011": {
      const [field] = constraintFields(known.meta, modelMeta);
      if (field) {
        throw new RequestValidationError(
          `Field "${field}" cannot be null.`,
          field,
        );
      }
      throw new RequestValidationError("A required value is missing.");
    }
    case "P2025":
      throw new RecordNotFoundError();
    default:
      throw error;
  }
}

/** Escape LIKE wildcards so search text is matched literally. */
function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function requireWriteTarget(query: {
  id?: string | number;
  ids?: Array<string | number>;
}): void {
  if (query.id === undefined && query.ids === undefined) {
    throw new RequestValidationError(
      "An id or ids selection is required for update and delete operations.",
    );
  }
}

export type PrismaDelegate = {
  findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  findFirst(
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null>;
  count(args: Record<string, unknown>): Promise<number>;
  create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
  deleteMany(args: Record<string, unknown>): Promise<{ count: number }>;
};

function toPrismaSelect(
  select: FieldSelect,
): Record<string, true | { select: Record<string, true> }> {
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

type SearchOptions = {
  caseInsensitive: boolean;
  escapeWildcards: boolean;
};

function toPrismaSearch(
  search: SearchQuery | undefined,
  options: SearchOptions,
): Record<string, unknown> | undefined {
  if (!search || search.fields.length === 0) return undefined;
  // Prisma passes `contains` text into SQL LIKE unescaped, so `%` and `_`
  // would act as wildcards. Escape them where `\\` is the LIKE escape character.
  const text = options.escapeWildcards
    ? escapeLikePattern(search.text)
    : search.text;
  return {
    OR: search.fields.map((field) => ({
      [field]: {
        contains: text,
        ...(options.caseInsensitive ? { mode: "insensitive" } : {}),
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
  search: SearchOptions,
): Record<string, unknown> {
  return combineAnd([
    query.scope,
    query.filters ? toPrismaFilters(query.filters) : undefined,
    toPrismaSearch(query.search, search),
    query.ids !== undefined ? { [meta.idField]: { in: query.ids } } : undefined,
    query.id !== undefined ? { [meta.idField]: query.id } : undefined,
  ]);
}

/** Turn a custom-action `where` into a Prisma `where` for use with `client`. */
export function prismaActionWhere(
  idField: string,
  where: ActionWhere,
): Record<string, unknown> {
  return combineAnd([where.scope, { [idField]: { in: where.ids } }]);
}

export function prismaResource(
  delegate: PrismaDelegate,
  meta: AdminModelMeta,
  options: {
    caseInsensitiveSearch?: boolean;
    escapeSearchWildcards?: boolean;
  } = {},
): ModelResource {
  const search: SearchOptions = {
    caseInsensitive: options.caseInsensitiveSearch === true,
    escapeWildcards: options.escapeSearchWildcards === true,
  };
  return {
    findMany(query: FindManyQuery) {
      const args: Record<string, unknown> = {
        where: toPrismaWhere(meta, query, search),
        select: toPrismaSelect(query.select),
      };
      if (query.sort)
        args.orderBy = { [query.sort.field]: query.sort.direction };
      if (query.skip !== undefined) args.skip = query.skip;
      if (query.take !== undefined) args.take = query.take;
      return delegate.findMany(args);
    },
    findFirst(query: FindFirstQuery) {
      return delegate.findFirst({
        where: toPrismaWhere(meta, query, search),
        select: toPrismaSelect(query.select),
      });
    },
    count(query: CountQuery) {
      return delegate.count({
        where: toPrismaWhere(meta, query, search),
      });
    },
    async create(query: CreateQuery) {
      try {
        return await delegate.create({
          data: query.data,
          select: toPrismaSelect(query.select),
        });
      } catch (error) {
        rethrowWriteError(error, "create", meta);
      }
    },
    async updateMany(query: UpdateManyQuery) {
      requireWriteTarget(query);
      try {
        return await delegate.updateMany({
          where: toPrismaWhere(meta, query, search),
          data: query.data,
        });
      } catch (error) {
        rethrowWriteError(error, "update", meta);
      }
    },
    async deleteMany(query: DeleteManyQuery) {
      requireWriteTarget(query);
      try {
        return await delegate.deleteMany({
          where: toPrismaWhere(meta, query, search),
        });
      } catch (error) {
        rethrowWriteError(error, "delete", meta);
      }
    },
  };
}
