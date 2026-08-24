/** Field equality used by `scope()` and as the base of every query. */
export type EqualityFilter = Record<string, unknown>;

/** One list/query constraint on a single field. Not a Prisma `where` object. */
export type FieldFilter =
  | { equals: string | number | boolean | Date | null }
  | { in: Array<string | number> }
  | { gte?: Date | number; lte?: Date | number };

export type FieldFilters = Record<string, FieldFilter>;

export type SearchQuery = {
  text: string;
  fields: string[];
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
  filters: FieldFilters;
  search?: SearchQuery;
  ids?: Array<string | number>;
  sort?: { field: string; direction: "asc" | "desc" };
  skip?: number;
  take?: number;
  select: FieldSelect;
};

export type CountQuery = Pick<
  FindManyQuery,
  "scope" | "filters" | "search" | "ids"
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
