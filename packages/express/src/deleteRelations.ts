import {
  RequestValidationError,
  buildListRecordSelect,
  hasModelPermission,
  resolveScope,
  withSelectFields,
  type AdminUser,
  type DataAdapter,
  type FullRegisteredModel,
} from "@paneljs/paneljs";

export type DeleteReferentialAction = "Cascade" | "SetNull" | "Restrict";

export type DeletePreviewRelation = {
  fieldName: string;
  modelName: string;
  pluralName: string;
  idField: string;
  displayField: string;
  onDelete: DeleteReferentialAction;
  recordsByParentId: Record<string, Record<string, unknown>[]>;
};

function referentialAction(onDelete: string | null | undefined): DeleteReferentialAction {
  if (onDelete === "Cascade") return "Cascade";
  if (onDelete === "SetNull") return "SetNull";
  return "Restrict";
}

function findChildBelongsTo(
  parent: FullRegisteredModel,
  child: FullRegisteredModel,
  parentHasManyRelationName: string,
) {
  return child.meta.fields.find((field) => {
    const relation = field.relation;
    return (
      field.type === "relation" &&
      relation?.kind === "belongsTo" &&
      relation.model === parent.meta.name &&
      relation.foreignKeyFields.length === 1 &&
      (relation.relationName === parentHasManyRelationName ||
        field.name === parentHasManyRelationName)
    );
  });
}

type ChildRelation = {
  parentFieldName: string;
  childModel: FullRegisteredModel;
  foreignKey: string;
  onDelete: DeleteReferentialAction;
};

function listChildRelations(
  parent: FullRegisteredModel,
  models: Map<string, FullRegisteredModel>,
): ChildRelation[] {
  const modelsByName = new Map(
    [...models.values()].map((entry) => [entry.meta.name, entry]),
  );
  const children: ChildRelation[] = [];

  for (const relationField of parent.meta.fields) {
    const relation = relationField.relation;
    if (relationField.type !== "relation" || relation?.kind !== "hasMany")
      continue;
    const childModel = modelsByName.get(relation.model);
    if (!childModel) continue;
    const childRelationField = findChildBelongsTo(
      parent,
      childModel,
      relation.relationName,
    );
    const foreignKey = childRelationField?.relation?.foreignKeyFields[0];
    if (!childRelationField || !foreignKey) continue;
    children.push({
      parentFieldName: relationField.name,
      childModel,
      foreignKey,
      onDelete: referentialAction(childRelationField.relation?.onDelete),
    });
  }

  return children;
}

/** Related rows shown on the delete confirmation page. */
export async function loadDeletePreviewRelations(
  parent: FullRegisteredModel,
  models: Map<string, FullRegisteredModel>,
  adapter: DataAdapter,
  adminUser: AdminUser,
  ids: Array<string | number>,
): Promise<DeletePreviewRelation[]> {
  const relations: DeletePreviewRelation[] = [];

  for (const child of listChildRelations(parent, models)) {
    if (
      !hasModelPermission(adminUser, child.childModel.resolved.permissions, "list")
    ) {
      continue;
    }

    const childScope = await resolveScope(child.childModel.raw, adminUser);
    const childSelect = withSelectFields(
      buildListRecordSelect(child.childModel.meta, child.childModel),
      [child.foreignKey],
    );
    const childRecords = await adapter.resource(child.childModel.meta).findMany({
      scope: childScope,
      filters: { [child.foreignKey]: { in: ids } },
      select: childSelect,
    });
    const recordsByParentId: Record<string, Record<string, unknown>[]> = {};
    for (const record of childRecords) {
      const parentId = record[child.foreignKey];
      if (typeof parentId !== "string" && typeof parentId !== "number") continue;
      const key = String(parentId);
      recordsByParentId[key] = [...(recordsByParentId[key] ?? []), record];
    }
    relations.push({
      fieldName: child.parentFieldName,
      modelName: child.childModel.meta.name,
      pluralName: child.childModel.meta.pluralName,
      idField: child.childModel.meta.idField,
      displayField: child.childModel.meta.displayField,
      onDelete: child.onDelete,
      recordsByParentId,
    });
  }

  return relations;
}

/** Reject deletes that would violate Restrict / Protect relations. */
export async function assertNoRestrictedRelations(
  parent: FullRegisteredModel,
  models: Map<string, FullRegisteredModel>,
  adapter: DataAdapter,
  adminUser: AdminUser,
  ids: Array<string | number>,
): Promise<void> {
  for (const child of listChildRelations(parent, models)) {
    if (child.onDelete !== "Restrict") continue;
    const childScope = await resolveScope(child.childModel.raw, adminUser);
    const count = await adapter.resource(child.childModel.meta).count({
      scope: childScope,
      filters: { [child.foreignKey]: { in: ids } },
    });
    if (count === 0) continue;
    throw new RequestValidationError(
      `Cannot delete this ${parent.meta.name} because related ${child.childModel.meta.name} records still reference it.`,
    );
  }
}
