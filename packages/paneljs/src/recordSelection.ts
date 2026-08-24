import type { DataAdapter } from "./adapter.js";
import { hasModelPermission } from "./permissions.js";
import type { FullRegisteredModel } from "./registry.js";
import type { FieldSelect } from "./query.js";
import { idSelect } from "./query.js";
import type { AdminModelMeta, AdminUser } from "./types.js";
import { resolveScope } from "./scope.js";
import { parseRecordId } from "./ids.js";
import {
  isFieldVisible,
  isSensitiveFieldName,
  RequestValidationError,
} from "./validation.js";
import { PermissionDeniedError } from "./errors.js";

function relationSelects(
  meta: AdminModelMeta,
  model: FullRegisteredModel,
  allowedNames?: Set<string>,
): FieldSelect["relations"] {
  const relations: FieldSelect["relations"] = [];
  for (const fieldName of model.resolved.listDisplay) {
    if (allowedNames && !allowedNames.has(fieldName)) continue;
    const field = meta.fields.find((candidate) => candidate.name === fieldName);
    if (!field?.relation || !isFieldVisible(field, model.raw)) continue;
    if (field.relation.kind !== "belongsTo" && field.relation.kind !== "hasOne")
      continue;
    if (isSensitiveFieldName(field.relation.displayField)) continue;
    relations.push({
      field: field.name,
      displayField: field.relation.displayField,
    });
  }
  return relations;
}

/** Build the safe select used by detail and edit endpoints. */
export function buildRecordSelect(
  meta: AdminModelMeta,
  model: FullRegisteredModel,
): FieldSelect {
  const fields = meta.fields
    .filter(
      (field) => field.type !== "relation" && isFieldVisible(field, model.raw),
    )
    .map((field) => field.name);
  if (!fields.includes(meta.idField)) fields.unshift(meta.idField);
  return { fields, relations: relationSelects(meta, model) };
}

/** Only return columns the list is configured to display, plus the primary key. */
export function buildListRecordSelect(
  meta: AdminModelMeta,
  model: FullRegisteredModel,
): FieldSelect {
  const allowed = new Set([meta.idField, ...model.resolved.listDisplay]);
  const fields = meta.fields
    .filter(
      (field) =>
        field.type !== "relation" &&
        allowed.has(field.name) &&
        isFieldVisible(field, model.raw),
    )
    .map((field) => field.name);
  if (!fields.includes(meta.idField)) fields.unshift(meta.idField);
  return { fields, relations: relationSelects(meta, model, allowed) };
}

/** Verify submitted belongs-to IDs are visible under the related model's own access rules. */
export async function assertSelectedRelationsAreVisible(
  data: Record<string, unknown>,
  model: FullRegisteredModel,
  models: Map<string, FullRegisteredModel>,
  adapter: DataAdapter,
  adminUser: AdminUser,
): Promise<void> {
  const modelsByName = new Map(
    [...models.values()].map((candidate) => [candidate.meta.name, candidate]),
  );

  for (const relationField of model.meta.fields) {
    const relation = relationField.relation;
    if (
      relationField.type !== "relation" ||
      relation?.kind !== "belongsTo" ||
      relation.foreignKeyFields.length !== 1
    )
      continue;

    const foreignKeyField = relation.foreignKeyFields[0];
    if (!foreignKeyField || !(foreignKeyField in data)) continue;
    const selectedId = data[foreignKeyField];
    if (selectedId === null) continue;

    const relatedModel = modelsByName.get(relation.model);
    if (!relatedModel) {
      throw new RequestValidationError(
        `Relation "${relationField.name}" cannot be changed because related model "${relation.model}" is not registered.`,
      );
    }
    if (
      !hasModelPermission(adminUser, relatedModel.resolved.permissions, "list")
    )
      throw new PermissionDeniedError();

    const relatedScope = await resolveScope(relatedModel.raw, adminUser);
    const relatedRecord = await adapter.resource(relatedModel.meta).findFirst({
      scope: relatedScope,
      id: parseRecordId(relatedModel.meta, String(selectedId)),
      select: idSelect(relatedModel.meta.idField),
    });
    if (!relatedRecord)
      throw new RequestValidationError(
        `The selected ${relation.model} record is unavailable.`,
      );
  }
}
