import { isFilterOp, joinPath, splitPath } from "./filterPaths.js";
import type { FullRegisteredModel } from "./registry.js";
import type {
  FilterCondition,
  FilterNode,
  FilterOp,
  FilterValue,
  SortKey,
} from "./query.js";
import { allowedSortKeys, parseSortList } from "./sorting.js";
import type { AdminModelMeta } from "./types.js";
import { RequestValidationError } from "./validation.js";

export type QueryValue = string | string[] | undefined;
export type QueryMap = Record<string, QueryValue>;

export type ParsedListQuery = {
  page: number;
  /** Undefined means "use the model's defaultSort". */
  sort?: SortKey[];
  /** AND of every filter parameter. Values are still strings here. */
  filter?: FilterNode;
  search?: string;
};

function getQueryValue(query: QueryMap, name: string): string | undefined {
  const value = query[name];
  if (value === undefined) return undefined;
  if (typeof value !== "string")
    throw new RequestValidationError(
      `Query parameter "${name}" must be a single string value.`,
    );
  return value;
}

/**
 * `author__name__contains` → path `["author", "name"]`, op `contains`.
 * Without an operator suffix the op is `equals`. The old `createdAt_gte` /
 * `createdAt_lte` spelling still works.
 */
function parseFilterParameter(
  parameterName: string,
  allowed: ReadonlySet<string>,
): { path: string[]; op: FilterOp } {
  const segments = splitPath(parameterName);
  const last = segments.at(-1) ?? "";
  if (segments.length > 1 && isFilterOp(last)) {
    const path = segments.slice(0, -1);
    if (allowed.has(joinPath(path))) return { path, op: last };
  }
  if (allowed.has(parameterName)) return { path: segments, op: "equals" };

  const legacyRange = /^(.+)_(gte|lte)$/.exec(parameterName);
  if (legacyRange?.[1] && allowed.has(legacyRange[1]))
    return {
      path: splitPath(legacyRange[1]),
      op: legacyRange[2] as FilterOp,
    };

  throw new RequestValidationError(
    `Filter "${parameterName}" is not allowed for this model.`,
  );
}

function parseFilterValue(op: FilterOp, raw: string): FilterValue {
  if (op === "in" || op === "notIn")
    return raw
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry !== "");
  return raw;
}

/**
 * `?sort=published,-createdAt` (a leading `-` means descending). The old
 * `?sort=title&dir=desc` form still works. Keys must be in
 * `allowedSortKeys`: the model's visible plain fields, its table columns
 * (a relation column sorts by its display field) and its `defaultSort`.
 */
function parseSort(
  query: QueryMap,
  model: FullRegisteredModel,
): SortKey[] | undefined {
  const sortParam = getQueryValue(query, "sort");
  const dir = getQueryValue(query, "dir");
  if (dir !== undefined && dir !== "asc" && dir !== "desc")
    throw new RequestValidationError(
      'Query parameter "dir" must be either "asc" or "desc".',
    );

  let sort: SortKey[] | undefined;
  if (sortParam !== undefined) {
    sort = parseSortList(sortParam);
    const [only] = sort;
    if (dir && only && sort.length === 1 && !sortParam.trim().startsWith("-"))
      sort = [{ field: only.field, direction: dir }];
  } else if (dir) {
    const [first, ...rest] = model.resolved.defaultSort;
    if (first) sort = [{ field: first.field, direction: dir }, ...rest];
  }
  if (!sort) return undefined;

  const allowed = allowedSortKeys(model);
  for (const key of sort)
    if (!allowed.has(key.field))
      throw new RequestValidationError(
        `Field "${key.field}" cannot be used for sorting.`,
      );
  return sort;
}

/**
 * Parse list-page query parameters. Filters are limited to the paths in the
 * model's `listFilter` (like Django's `lookup_allowed`), so a URL can't probe
 * fields the developer didn't offer as filters; sorting is limited the same
 * way. Types, visibility and permissions are checked later by
 * `AdminService.list`.
 */
export function parseListQuery(
  query: QueryMap,
  meta: AdminModelMeta,
  model: FullRegisteredModel,
): ParsedListQuery {
  const pageValue = Number(getQueryValue(query, "page") ?? 1);
  if (!Number.isInteger(pageValue) || pageValue < 1)
    throw new RequestValidationError(
      'Query parameter "page" must be a positive integer.',
    );
  if (pageValue > 10_000)
    throw new RequestValidationError(
      'Query parameter "page" must be 10,000 or fewer.',
    );

  const sort = parseSort(query, model);

  const allowed = new Set(model.resolved.listFilter);
  const conditions: FilterCondition[] = [];
  const knownQueryParameters = new Set(["page", "sort", "dir", "search"]);

  for (const [parameterName, rawValue] of Object.entries(query)) {
    if (knownQueryParameters.has(parameterName)) continue;
    if (typeof rawValue !== "string")
      throw new RequestValidationError(
        `Query parameter "${parameterName}" must be a single string value.`,
      );
    const { path, op } = parseFilterParameter(parameterName, allowed);
    conditions.push({ path, op, value: parseFilterValue(op, rawValue) });
  }

  const search = getQueryValue(query, "search")?.trim() || undefined;

  return {
    page: pageValue,
    sort,
    filter: conditions.length > 0 ? { and: conditions } : undefined,
    search,
  };
}
