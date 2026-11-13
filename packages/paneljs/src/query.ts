/** Field equality used by `scope()` and as the base of every query. */
export type EqualityFilter = Record<string, unknown>;

// ============================================================
// FILTERS
// ============================================================

export const FILTER_OPS = [
  "equals",
  "ne",
  "in",
  "notIn",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "startsWith",
  "isNull",
] as const;

export type FilterOp = (typeof FILTER_OPS)[number];

export type FilterScalar = string | number | boolean | Date;

/** `in`/`notIn` take a list, `isNull` takes a boolean, the rest one scalar. */
export type FilterValue = FilterScalar | FilterScalar[];

/** `some`/`every`/`none` of a list relation's records must match `where`. */
export type RelationQuantifier = "some" | "every" | "none";

/**
 * A filter written by a caller: the URL parser or your own server code.
 * `path` walks relations by field name: `["author", "country"]` is the
 * author's country. Core checks every path against the registered models
 * before anything reaches the adapter. Not a Prisma `where` object.
 */
export type FilterNode =
  | { and: FilterNode[] }
  | { or: FilterNode[] }
  | { not: FilterNode }
  | FilterCondition
  | RelationFilter;

export type FilterCondition = {
  path: string[];
  op: FilterOp;
  value: FilterValue;
};

/** `path` must end at a list relation; `where` is relative to its model. */
export type RelationFilter = {
  path: string[];
  quantifier: RelationQuantifier;
  where: FilterNode;
};

/** One relation crossed on the way to a field. `many` = list relation. */
export type RelationStep = { field: string; many: boolean };

/**
 * What adapters receive: a FilterNode after core validated it, with every
 * relation hop annotated so the adapter doesn't need other models' metadata.
 * A path through a list relation means "some related record matches".
 */
export type ResolvedFilter =
  | { kind: "and"; nodes: ResolvedFilter[] }
  | { kind: "or"; nodes: ResolvedFilter[] }
  | { kind: "not"; node: ResolvedFilter }
  | ResolvedCondition
  | ResolvedRelationFilter;

export type ResolvedCondition = {
  kind: "condition";
  relations: RelationStep[];
  /** Field on the last model. A relation field only with `op: "isNull"`. */
  field: string;
  target: "scalar" | "toOne" | "toMany";
  op: FilterOp;
  value: FilterValue;
};

export type ResolvedRelationFilter = {
  kind: "relation";
  relations: RelationStep[];
  /** A list relation on the last model. */
  field: string;
  quantifier: RelationQuantifier;
  where: ResolvedFilter;
};

/** A condition on one of the model's own scalar fields. */
export function fieldCondition(
  field: string,
  op: FilterOp,
  value: FilterValue,
): ResolvedCondition {
  return {
    kind: "condition",
    relations: [],
    field,
    op,
    value,
    target: "scalar",
  };
}

// ============================================================
// SEARCH
// ============================================================

/** `contains` by default; `^field` = startsWith, `=field` = equals. */
export type SearchMode = "contains" | "startsWith" | "equals";

export type SearchField = {
  relations: RelationStep[];
  field: string;
  mode: SearchMode;
};

export type SearchQuery = {
  text: string;
  fields: SearchField[];
};

export type RelationSelect = {
  field: string;
  displayField: string;
};

export type FieldSelect = {
  fields: string[];
  relations: RelationSelect[];
};

export type FindManyQuery = {
  scope: EqualityFilter;
  filter?: ResolvedFilter;
  search?: SearchQuery;
  ids?: Array<string | number>;
  sort?: { field: string; direction: "asc" | "desc" };
  skip?: number;
  take?: number;
  select: FieldSelect;
};

export type CountQuery = Pick<
  FindManyQuery,
  "scope" | "filter" | "search" | "ids"
>;

export type FindFirstQuery = {
  scope: EqualityFilter;
  id: string | number;
  select: FieldSelect;
};

export type CreateQuery = {
  data: Record<string, unknown>;
  select: FieldSelect;
};

export type UpdateManyQuery = {
  scope: EqualityFilter;
  id?: string | number;
  ids?: Array<string | number>;
  data: Record<string, unknown>;
};

export type DeleteManyQuery = {
  scope: EqualityFilter;
  id?: string | number;
  ids?: Array<string | number>;
};

/** Custom action `where`: scope plus the selected row ids. Not a Prisma `where`. */
export type ActionWhere = {
  scope: EqualityFilter;
  ids: Array<string | number>;
};

export function idSelect(idField: string): FieldSelect {
  return { fields: [idField], relations: [] };
}

export function withSelectFields(
  select: FieldSelect,
  fieldNames: string[],
): FieldSelect {
  const fields = [...select.fields];
  for (const name of fieldNames) {
    if (!fields.includes(name)) fields.push(name);
  }
  return { fields, relations: select.relations };
}
