import type {
  FilterScalar,
  ResolvedFilter,
  ResolvedSort,
  SearchQuery,
  SortDirection,
} from "./query.js";
import { RequestValidationError } from "./validation.js";

/** The flat filter shape adapters used before the filter tree. */
export type SimpleFieldFilter =
  | { equals: FilterScalar }
  | { in: FilterScalar[] }
  | { gte?: FilterScalar; lte?: FilterScalar };

export type SimpleFieldFilters = Record<string, SimpleFieldFilter>;

function unsupported(
  adapterName: string,
  what: string,
): RequestValidationError {
  return new RequestValidationError(
    `The ${adapterName} adapter does not support ${what} yet.`,
  );
}

/**
 * For adapters that haven't adopted the filter tree: accept only what the old
 * flat shape could express — an AND of `equals`, `in`, `gte` and `lte` on the
 * model's own fields — and reject anything else with a clear 400.
 */
export function simpleFieldFilters(
  filter: ResolvedFilter | undefined,
  adapterName: string,
): SimpleFieldFilters {
  const result: SimpleFieldFilters = {};
  const visit = (node: ResolvedFilter): void => {
    if (node.kind === "and") {
      node.nodes.forEach(visit);
      return;
    }
    if (node.kind !== "condition")
      throw unsupported(adapterName, `"${node.kind}" filters`);
    if (node.relations.length > 0 || node.target !== "scalar")
      throw unsupported(adapterName, "filters across relations");

    const existing = result[node.field];
    if (node.op === "gte" || node.op === "lte") {
      if (existing && ("equals" in existing || "in" in existing))
        throw unsupported(adapterName, "combining these filters on one field");
      result[node.field] = {
        ...existing,
        [node.op]: node.value as FilterScalar,
      };
      return;
    }
    if (existing)
      throw unsupported(adapterName, "combining these filters on one field");
    if (node.op === "equals") {
      result[node.field] = { equals: node.value as FilterScalar };
      return;
    }
    if (node.op === "in") {
      result[node.field] = { in: node.value as FilterScalar[] };
      return;
    }
    throw unsupported(adapterName, `the "${node.op}" filter`);
  };
  if (filter) visit(filter);
  return result;
}

/**
 * For adapters that haven't adopted relation search: the plain field names to
 * search with `contains`, or a 400 if the model's search config needs more.
 */
export function simpleSearchFields(
  search: SearchQuery,
  adapterName: string,
): string[] {
  return search.fields.map((field) => {
    if (field.relations.length > 0)
      throw unsupported(adapterName, "search across relations");
    if (field.mode !== "contains")
      throw unsupported(adapterName, `"${field.mode}" search`);
    return field.field;
  });
}

/**
 * For adapters that haven't adopted relation sorting: the model's own sort
 * columns in order, or a 400 if one goes through a relation.
 */
export function simpleSort(
  sort: ResolvedSort[] | undefined,
  adapterName: string,
): Array<{ field: string; direction: SortDirection }> {
  return (sort ?? []).map((key) => {
    if (key.relations.length > 0)
      throw unsupported(adapterName, "sorting across relations");
    return { field: key.field, direction: key.direction };
  });
}
