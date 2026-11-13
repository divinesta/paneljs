import { isFilterOp, joinPath, splitPath } from "./filterPaths.js";
import type { FullRegisteredModel } from "./registry.js";
import type {
  FilterCondition,
  FilterNode,
  FilterOp,
  FilterValue,
} from "./query.js";
import type { AdminModelMeta } from "./types.js";
import { isFieldVisible, RequestValidationError } from "./validation.js";

export type QueryValue = string | string[] | undefined;
export type QueryMap = Record<string, QueryValue>;

export type ParsedListQuery = {
  page: number;
  sort: string;
  dir: "asc" | "desc";
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
 * Parse list-page query parameters. Filters are limited to the paths in the
 * model's `listFilter` (like Django's `lookup_allowed`), so a URL can't probe
 * fields the developer didn't offer as filters. Types, visibility and
 * permissions are checked later by `AdminService.list`.
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

  const sort = getQueryValue(query, "sort") ?? model.resolved.defaultSort.field;
  const dir =
    getQueryValue(query, "dir") ?? model.resolved.defaultSort.direction;
  const sortableFields = new Set(
    meta.fields
      .filter(
        (field) =>
          field.type !== "relation" && isFieldVisible(field, model.raw),
      )
      .map((field) => field.name),
  );
  if (!sortableFields.has(sort))
    throw new RequestValidationError(
      `Field "${sort}" cannot be used for sorting.`,
    );
  if (dir !== "asc" && dir !== "desc")
    throw new RequestValidationError(
      'Query parameter "dir" must be either "asc" or "desc".',
    );

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
    dir,
    filter: conditions.length > 0 ? { and: conditions } : undefined,
    search,
  };
}
