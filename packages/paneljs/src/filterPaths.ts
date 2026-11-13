import { hasModelPermission } from "./permissions.js";
import {
  FILTER_OPS,
  type FilterNode,
  type FilterOp,
  type FilterScalar,
  type FilterValue,
  type RelationStep,
  type ResolvedFilter,
  type SearchField,
  type SearchMode,
} from "./query.js";
import type { FullRegisteredModel } from "./registry.js";
import type { AdminFieldMeta, AdminUser } from "./types.js";
import { isFieldVisible, RequestValidationError } from "./validation.js";

/** Registered models keyed by model name (`meta.name`). */
export type ModelLookup = ReadonlyMap<string, FullRegisteredModel>;

/** Relations a path may cross: `a__b__c__field` is the deepest allowed. */
export const MAX_RELATION_DEPTH = 3;
const MAX_FILTER_CONDITIONS = 50;
const MAX_IN_VALUES = 100;
const MAX_TEXT_LENGTH = 200;

/** URL and config separator: `author__country` = `["author", "country"]`. */
export const PATH_SEPARATOR = "__";

export function splitPath(path: string): string[] {
  return path.split(PATH_SEPARATOR);
}

export function joinPath(path: string[]): string {
  return path.join(PATH_SEPARATOR);
}

export type ResolvedPath = {
  relations: RelationStep[];
  /** The field the path ends at, on `model`. */
  field: AdminFieldMeta;
  model: FullRegisteredModel;
};

/**
 * Walk `path` from `root`, one relation at a time. Every hop must be a visible
 * relation to a registered model, and the final field must be visible. With
 * `adminUser`, every model crossed must also allow that user to list it, so a
 * filter can't reveal data from a model they can't see.
 */
export type ResolvePathOptions = {
  /** Also require "list" permission on every model crossed. */
  adminUser?: AdminUser;
  /** Relations already crossed by an enclosing some/every/none filter. */
  relationDepth?: number;
  /**
   * Skip the field-visibility check. Used at startup, where config may name
   * a field that is hidden; it is then left out per request instead.
   */
  ignoreVisibility?: boolean;
};

export function resolvePath(
  root: FullRegisteredModel,
  path: string[],
  models: ModelLookup,
  options: ResolvePathOptions = {},
): ResolvedPath {
  const { adminUser, relationDepth = 0, ignoreVisibility = false } = options;
  const label = joinPath(path);
  if (path.length === 0 || path.some((segment) => segment === ""))
    throw new RequestValidationError(`Field path "${label}" is invalid.`);
  if (relationDepth + path.length - 1 > MAX_RELATION_DEPTH)
    throw new RequestValidationError(
      `Field path "${label}" crosses more than ${MAX_RELATION_DEPTH} relations.`,
    );

  const relations: RelationStep[] = [];
  let model = root;
  for (const [index, name] of path.entries()) {
    const field = model.meta.fields.find(
      (candidate) => candidate.name === name,
    );
    if (!field || (!ignoreVisibility && !isFieldVisible(field, model.raw)))
      throw new RequestValidationError(
        `Field path "${label}": "${name}" is not a field on ${model.meta.name}.`,
      );
    if (index === path.length - 1) return { relations, field, model };

    const target = field.relation
      ? models.get(field.relation.model)
      : undefined;
    if (field.type !== "relation" || !field.relation || !target)
      throw new RequestValidationError(
        `Field path "${label}": "${name}" is not a relation to a registered model.`,
      );
    if (
      adminUser &&
      !hasModelPermission(adminUser, target.resolved.permissions, "list")
    )
      throw new RequestValidationError(
        `Field path "${label}" is not available.`,
      );
    relations.push({ field: name, many: field.isList });
    model = target;
  }
  // Unreachable: the loop returns on the last segment.
  throw new RequestValidationError(`Field path "${label}" is invalid.`);
}

/** Operators that make sense for a field, by type. */
export function operatorsForField(field: AdminFieldMeta): readonly FilterOp[] {
  if (field.type === "relation") return ["isNull"];
  if (field.isList) return [];
  switch (field.type) {
    case "string":
      return [
        "equals",
        "ne",
        "in",
        "notIn",
        "contains",
        "startsWith",
        "isNull",
      ];
    case "number":
    case "datetime":
      return [
        "equals",
        "ne",
        "in",
        "notIn",
        "gt",
        "gte",
        "lt",
        "lte",
        "isNull",
      ];
    case "boolean":
      return ["equals", "ne", "isNull"];
    case "enum":
      return ["equals", "ne", "in", "notIn", "isNull"];
    case "json":
    case "bytes":
      return [];
  }
}

export function isFilterOp(value: string): value is FilterOp {
  return (FILTER_OPS as readonly string[]).includes(value);
}

function invalid(label: string, message: string): RequestValidationError {
  return new RequestValidationError(`Filter "${label}" ${message}`, label);
}

/** Accepts booleans, and "true"/"false" as they arrive from a URL. */
function coerceBoolean(value: unknown, label: string): boolean {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  throw invalid(label, 'must be "true" or "false".');
}

function coerceScalar(
  field: AdminFieldMeta,
  value: unknown,
  label: string,
): FilterScalar {
  switch (field.type) {
    case "string":
      if (typeof value !== "string") throw invalid(label, "must be text.");
      if (value.length > MAX_TEXT_LENGTH)
        throw invalid(label, `must be ${MAX_TEXT_LENGTH} characters or fewer.`);
      return value;
    case "number": {
      const number = typeof value === "string" ? Number(value) : value;
      if (typeof number !== "number" || !Number.isFinite(number))
        throw invalid(label, "must be a finite number.");
      return number;
    }
    case "boolean":
      return coerceBoolean(value, label);
    case "datetime": {
      const date =
        value instanceof Date
          ? value
          : typeof value === "string"
            ? new Date(value)
            : null;
      if (!date || Number.isNaN(date.getTime()))
        throw invalid(label, "must be an ISO date-time value.");
      return date;
    }
    case "enum":
      if (typeof value !== "string" || !field.enumValues?.includes(value))
        throw invalid(label, `must be a valid ${field.nativeType} value.`);
      return value;
    default:
      throw invalid(label, "is not supported.");
  }
}

/** Check `value` fits `op` on `field`, converting date strings to Dates. */
export function coerceFilterValue(
  field: AdminFieldMeta,
  op: FilterOp,
  value: unknown,
  label: string,
): FilterValue {
  if (!operatorsForField(field).includes(op))
    throw invalid(label, `does not support "${op}" on this field.`);
  if (op === "isNull") return coerceBoolean(value, label);
  if (op === "in" || op === "notIn") {
    if (!Array.isArray(value) || value.length === 0)
      throw invalid(label, "needs at least one value.");
    if (value.length > MAX_IN_VALUES)
      throw invalid(label, `accepts at most ${MAX_IN_VALUES} values.`);
    return value.map((entry) => coerceScalar(field, entry, label));
  }
  if (value === null || value === undefined)
    throw invalid(label, 'needs a value. Use "isNull" to match empty fields.');
  return coerceScalar(field, value, label);
}

type ResolveState = { conditions: number };

function resolveNode(
  node: FilterNode,
  model: FullRegisteredModel,
  models: ModelLookup,
  adminUser: AdminUser | undefined,
  relationDepth: number,
  state: ResolveState,
): ResolvedFilter {
  if (typeof node !== "object" || node === null)
    throw new RequestValidationError("Filter must be an object.");

  if ("and" in node || "or" in node) {
    const kind = "and" in node ? "and" : "or";
    const children = "and" in node ? node.and : (node as { or: unknown }).or;
    if (!Array.isArray(children))
      throw new RequestValidationError(`Filter "${kind}" must be a list.`);
    return {
      kind,
      nodes: children.map((child: FilterNode) =>
        resolveNode(child, model, models, adminUser, relationDepth, state),
      ),
    };
  }
  if ("not" in node) {
    return {
      kind: "not",
      node: resolveNode(
        node.not,
        model,
        models,
        adminUser,
        relationDepth,
        state,
      ),
    };
  }

  if (!("path" in node) || !Array.isArray(node.path))
    throw new RequestValidationError(
      "Filter must be and, or, not, or have a path.",
    );
  state.conditions += 1;
  if (state.conditions > MAX_FILTER_CONDITIONS)
    throw new RequestValidationError(
      `Filters may have at most ${MAX_FILTER_CONDITIONS} conditions.`,
    );

  const label = joinPath(node.path);
  const resolved = resolvePath(model, node.path, models, {
    adminUser,
    relationDepth,
  });

  if ("quantifier" in node) {
    const target = resolved.field.relation
      ? models.get(resolved.field.relation.model)
      : undefined;
    if (!resolved.field.isList || !target)
      throw invalid(
        label,
        "must end at a list relation to use some/every/none.",
      );
    if (!["some", "every", "none"].includes(node.quantifier))
      throw invalid(label, 'quantifier must be "some", "every" or "none".');
    if (
      adminUser &&
      !hasModelPermission(adminUser, target.resolved.permissions, "list")
    )
      throw new RequestValidationError(
        `Field path "${label}" is not available.`,
      );
    return {
      kind: "relation",
      relations: resolved.relations,
      field: resolved.field.name,
      quantifier: node.quantifier,
      where: resolveNode(
        node.where,
        target,
        models,
        adminUser,
        relationDepth + node.path.length,
        state,
      ),
    };
  }

  if (!("op" in node) || typeof node.op !== "string" || !isFilterOp(node.op))
    throw invalid(label, "has an unknown operator.");
  return {
    kind: "condition",
    relations: resolved.relations,
    field: resolved.field.name,
    target:
      resolved.field.type !== "relation"
        ? "scalar"
        : resolved.field.isList
          ? "toMany"
          : "toOne",
    op: node.op,
    value: coerceFilterValue(resolved.field, node.op, node.value, label),
  };
}

/**
 * Validate a caller's filter and turn it into the adapter-facing form.
 * Throws RequestValidationError on any unknown field, hidden field, forbidden
 * model, bad operator, or bad value.
 */
export function resolveFilter(
  node: FilterNode,
  root: FullRegisteredModel,
  models: ModelLookup,
  adminUser?: AdminUser,
): ResolvedFilter {
  return resolveNode(node, root, models, adminUser, 0, { conditions: 0 });
}

/** `"^author__email"` → `{ mode: "startsWith", path: ["author", "email"] }`. */
export function parseSearchFieldSpec(spec: string): {
  mode: SearchMode;
  path: string[];
} {
  if (spec.startsWith("^"))
    return { mode: "startsWith", path: splitPath(spec.slice(1)) };
  if (spec.startsWith("="))
    return { mode: "equals", path: splitPath(spec.slice(1)) };
  return { mode: "contains", path: splitPath(spec) };
}

/**
 * Turn configured search specs into adapter search fields. Fields this
 * administrator can't see (hidden, or across a model they can't list) are
 * left out rather than failing the whole search.
 */
export function resolveSearchFields(
  root: FullRegisteredModel,
  specs: string[],
  models: ModelLookup,
  adminUser?: AdminUser,
): SearchField[] {
  const fields: SearchField[] = [];
  for (const spec of specs) {
    const { mode, path } = parseSearchFieldSpec(spec);
    let resolved: ResolvedPath;
    try {
      resolved = resolvePath(root, path, models, { adminUser });
    } catch (error) {
      if (error instanceof RequestValidationError) continue;
      throw error;
    }
    if (resolved.field.type !== "string" || resolved.field.isList) continue;
    fields.push({
      relations: resolved.relations,
      field: resolved.field.name,
      mode,
    });
  }
  return fields;
}
