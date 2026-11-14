import {
  joinPath,
  resolvePath,
  splitPath,
  type ModelLookup,
  type ResolvePathOptions,
} from "./filterPaths.js";
import type { ResolvedSort, SortDirection, SortKey } from "./query.js";
import type { FullRegisteredModel } from "./registry.js";
import type { AdminFieldMeta, ModelConfig } from "./types.js";
import { isFieldVisible, RequestValidationError } from "./validation.js";

/** Most sort columns one request or config may ask for (the id comes on top). */
export const MAX_SORT_KEYS = 5;

/** `"-createdAt"` → `{ field: "createdAt", direction: "desc" }`. */
export function parseSortKey(spec: string): SortKey {
  const trimmed = spec.trim();
  return trimmed.startsWith("-")
    ? { field: trimmed.slice(1), direction: "desc" }
    : { field: trimmed, direction: "asc" };
}

/** `{ field: "createdAt", direction: "desc" }` → `"-createdAt"`. */
export function formatSortKey(key: SortKey): string {
  return key.direction === "desc" ? `-${key.field}` : key.field;
}

/** `"published,-createdAt"` → two keys. Throws on empty entries. */
export function parseSortList(text: string): SortKey[] {
  const keys = text.split(",").map(parseSortKey);
  if (keys.some((key) => key.field === ""))
    throw new RequestValidationError(
      'Query parameter "sort" must be a comma-separated list of fields.',
    );
  return keys;
}

/**
 * Turn the `defaultSort` config (object, string or string list) into keys.
 * Throws a plain Error with the reason; the registry adds the model prefix.
 */
export function normalizeSortConfig(
  config: ModelConfig["defaultSort"],
): SortKey[] | undefined {
  if (config === undefined) return undefined;
  let keys: SortKey[];
  if (typeof config === "string") keys = [parseSortKey(config)];
  else if (Array.isArray(config)) {
    if (config.some((entry) => typeof entry !== "string"))
      throw new Error("must be a list of field names.");
    keys = config.map(parseSortKey);
  } else {
    if (config.direction !== "asc" && config.direction !== "desc")
      throw new Error('direction must be "asc" or "desc".');
    keys = [{ field: config.field, direction: config.direction }];
  }
  if (keys.length === 0) throw new Error("must name at least one field.");
  if (keys.length > MAX_SORT_KEYS)
    throw new Error(`may name at most ${MAX_SORT_KEYS} fields.`);
  if (keys.some((key) => !key.field)) throw new Error("has an empty field.");
  return keys;
}

/** Plain values a database can order by. Relations, lists and JSON can't. */
export function isSortableField(field: AdminFieldMeta): boolean {
  if (field.isList) return false;
  return ["string", "number", "datetime", "boolean", "enum"].includes(
    field.type,
  );
}

/**
 * The sort key behind each sortable `listDisplay` column. Own columns sort by
 * themselves; a single-record relation column (`author`) sorts by the related
 * record's display field, which is what the cell shows (`author__name`).
 */
export function columnSortKeys(
  model: FullRegisteredModel,
): Map<string, string> {
  const keys = new Map<string, string>();
  for (const column of model.resolved.listDisplay) {
    const field = model.meta.fields.find(
      (candidate) => candidate.name === column,
    );
    if (!field || !isFieldVisible(field, model.raw)) continue;
    if (isSortableField(field)) keys.set(column, column);
    else if (
      field.type === "relation" &&
      !field.isList &&
      field.relation?.displayField
    )
      keys.set(column, joinPath([column, field.relation.displayField]));
  }
  return keys;
}

/**
 * Sort keys a URL may ask for: any visible plain field of the model, the
 * sort key of every column in the table, and whatever `defaultSort` names.
 * Like `listFilter` for filters, this stops a URL from ordering by related
 * fields the developer never put on screen.
 */
export function allowedSortKeys(model: FullRegisteredModel): Set<string> {
  const allowed = new Set<string>();
  for (const field of model.meta.fields)
    if (isSortableField(field) && isFieldVisible(field, model.raw))
      allowed.add(field.name);
  for (const key of columnSortKeys(model).values()) allowed.add(key);
  for (const key of model.resolved.defaultSort) allowed.add(key.field);
  return allowed;
}

/**
 * Check sort keys and turn them into the adapter-facing form. Every path must
 * resolve (visible fields, registered models, list permission with
 * `adminUser`), cross only single-record relations, and end at a plain value.
 */
export function resolveSort(
  keys: SortKey[],
  root: FullRegisteredModel,
  models: ModelLookup,
  options: Pick<ResolvePathOptions, "adminUser" | "ignoreVisibility"> = {},
): ResolvedSort[] {
  if (keys.length > MAX_SORT_KEYS)
    throw new RequestValidationError(
      `Sort may name at most ${MAX_SORT_KEYS} fields.`,
    );
  const seen = new Set<string>();
  return keys.map(({ field, direction }) => {
    if (direction !== "asc" && direction !== "desc")
      throw new RequestValidationError(
        `Sort direction for "${field}" must be "asc" or "desc".`,
      );
    if (seen.has(field))
      throw new RequestValidationError(
        `Field "${field}" appears in the sort more than once.`,
      );
    seen.add(field);
    const resolved = resolvePath(root, splitPath(field), models, options);
    if (resolved.relations.some((step) => step.many))
      throw new RequestValidationError(
        `Field "${field}" cannot be used for sorting: it goes through a list relation, so there is no single value to sort by.`,
        field,
      );
    if (!isSortableField(resolved.field))
      throw new RequestValidationError(
        `Field "${field}" cannot be used for sorting.`,
        field,
      );
    return {
      relations: resolved.relations,
      field: resolved.field.name,
      direction,
    };
  });
}

/**
 * Append the id as the final sort column, unless the model's own id is
 * already in the list. Ids are unique, so rows that tie on every other
 * column still come back in the same order on every request; without this,
 * paging can show a row twice and skip another.
 */
export function withIdTiebreaker(
  sort: ResolvedSort[],
  idField: string,
): ResolvedSort[] {
  if (sort.some((key) => key.relations.length === 0 && key.field === idField))
    return sort;
  const direction: SortDirection = sort.at(-1)?.direction ?? "desc";
  return [...sort, { relations: [], field: idField, direction }];
}
