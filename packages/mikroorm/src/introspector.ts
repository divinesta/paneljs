import type {
  AdminFieldMeta,
  AdminFieldType,
  AdminModelMeta,
  RelationKind,
} from "paneljs";
import type {
  EntityMetadata,
  EntityProperty,
  MikroORM,
} from "@mikro-orm/core";

const PREFERRED_DISPLAY_NAMES = [
  "name",
  "title",
  "label",
  "username",
  "slug",
  "email",
];

const STRING_TYPES = new Set([
  "string",
  "varchar",
  "text",
  "uuid",
  "guid",
  "character",
  "char",
  "citext",
  "nvarchar",
  "tinytext",
  "mediumtext",
  "longtext",
]);

const NUMBER_TYPES = new Set([
  "number",
  "integer",
  "int",
  "int2",
  "int4",
  "int8",
  "smallint",
  "bigint",
  "tinyint",
  "mediumint",
  "float",
  "float4",
  "float8",
  "double",
  "decimal",
  "numeric",
  "real",
  "money",
]);

const DATETIME_TYPES = new Set([
  "datetime",
  "date",
  "time",
  "timestamp",
  "timestamptz",
  "datetype",
]);

const JSON_TYPES = new Set(["json", "jsonb"]);

const BYTES_TYPES = new Set(["bytes", "blob", "buffer", "uint8array", "bytea"]);

const RELATION_KINDS = new Set(["m:1", "1:m", "1:1", "m:n"]);

function nativeTypeName(prop: EntityProperty): string {
  if (typeof prop.type === "string" && prop.type.length > 0) return prop.type;
  if (typeof prop.runtimeType === "string" && prop.runtimeType.length > 0) {
    return prop.runtimeType;
  }
  return "string";
}

function mapPropertyType(prop: EntityProperty): AdminFieldType {
  if (prop.enum || nativeTypeName(prop).toLowerCase() === "enum") return "enum";
  if (RELATION_KINDS.has(String(prop.kind))) return "relation";

  const native = nativeTypeName(prop).toLowerCase();
  if (STRING_TYPES.has(native)) return "string";
  if (NUMBER_TYPES.has(native)) return "number";
  if (native === "boolean" || native === "bool") return "boolean";
  if (DATETIME_TYPES.has(native) || native === "date") return "datetime";
  if (JSON_TYPES.has(native)) return "json";
  if (BYTES_TYPES.has(native)) return "bytes";
  return "string";
}

function enumValues(prop: EntityProperty): string[] | undefined {
  if (!prop.items || prop.items.length === 0) return undefined;
  return prop.items.map((value) => String(value));
}

function uniquePropertyNames(entity: EntityMetadata): Set<string> {
  const names = new Set<string>();
  for (const unique of entity.uniques ?? []) {
    const properties = Array.isArray(unique.properties)
      ? unique.properties
      : unique.properties
        ? [unique.properties]
        : [];
    if (properties.length === 1 && properties[0]) names.add(properties[0]);
  }
  for (const index of entity.indexes ?? []) {
    if (index.type !== "unique") continue;
    const properties = Array.isArray(index.properties)
      ? index.properties
      : index.properties
        ? [index.properties]
        : [];
    if (properties.length === 1 && properties[0]) names.add(properties[0]);
  }
  return names;
}

function simplePlural(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith("y")) return lower.slice(0, -1) + "ies";
  if (lower.endsWith("s") || lower.endsWith("x") || lower.endsWith("z")) {
    return lower + "es";
  }
  if (lower.endsWith("ch") || lower.endsWith("sh")) return lower + "es";
  return lower + "s";
}

/** Map MikroORM FK actions to Prisma-style names used by delete preview. */
function mapOnDelete(value: string | undefined | null): string | null {
  if (!value) return null;
  switch (value.toUpperCase().replace(/[\s-]+/g, "_")) {
    case "CASCADE":
      return "Cascade";
    case "RESTRICT":
      return "Restrict";
    case "SET_NULL":
      return "SetNull";
    case "NO_ACTION":
      return "NoAction";
    case "SET_DEFAULT":
    case "DEFAULT":
      return "SetDefault";
    default:
      return value;
  }
}

function relationKind(prop: EntityProperty): RelationKind {
  if (prop.kind === "m:n") return "manyToMany";
  if (prop.kind === "1:m") return "hasMany";
  if (prop.kind === "m:1") return "belongsTo";
  if (prop.kind === "1:1") {
    return prop.owner || (prop.fieldNames?.length ?? 0) > 0
      ? "belongsTo"
      : "hasOne";
  }
  return "belongsTo";
}

function targetModelName(prop: EntityProperty): string {
  if (prop.targetMeta?.className) return prop.targetMeta.className;
  if (typeof prop.type === "string" && prop.type.length > 0) return prop.type;
  const entity = prop.entity;
  if (typeof entity === "function") {
    try {
      const resolved = entity();
      if (typeof resolved === "string") return resolved;
      if (resolved && typeof resolved === "object" && "name" in resolved) {
        return String((resolved as { name?: unknown }).name);
      }
      if (typeof resolved === "function" && resolved.name) return resolved.name;
    } catch {
      // Discovery may not be able to resolve the callback yet.
    }
  }
  return nativeTypeName(prop);
}

function inversePropertyName(prop: EntityProperty): string | undefined {
  if (typeof prop.mappedBy === "string" && prop.mappedBy.length > 0) {
    return prop.mappedBy;
  }
  if (typeof prop.inversedBy === "string" && prop.inversedBy.length > 0) {
    return prop.inversedBy;
  }
  return undefined;
}

function foreignKeyFieldName(prop: EntityProperty): string {
  if (prop.fieldNames?.length === 1 && prop.fieldNames[0]) {
    const column = prop.fieldNames[0];
    if (column === `${prop.name}Id` || column === `${prop.name}_id`) {
      return `${prop.name}Id`;
    }
    if (!column.includes("_") && column !== prop.name) return column;
  }
  return `${prop.name}Id`;
}

function isGenerated(prop: EntityProperty): boolean {
  if (prop.autoincrement) return true;
  if (prop.defaultRaw) return true;
  return false;
}

function isRelation(prop: EntityProperty): boolean {
  return RELATION_KINDS.has(String(prop.kind));
}

function detectDisplayField(
  fields: AdminFieldMeta[],
  idField: string,
): string {
  for (const preferred of PREFERRED_DISPLAY_NAMES) {
    const field = fields.find(
      (candidate) =>
        candidate.name === preferred &&
        candidate.type === "string" &&
        candidate.isUnique &&
        !candidate.isId,
    );
    if (field) return field.name;
  }

  const uniqueString = fields.find(
    (field) => field.type === "string" && field.isUnique && !field.isId,
  );
  if (uniqueString) return uniqueString.name;

  const anyString = fields.find(
    (field) => field.type === "string" && !field.isId,
  );
  if (anyString) return anyString.name;

  return idField;
}

function introspectScalar(
  prop: EntityProperty,
  uniqueNames: Set<string>,
  isFk: boolean,
): AdminFieldMeta {
  const type = mapPropertyType(prop);
  const isId = Boolean(prop.primary);
  const generated = isGenerated(prop);
  const isReadOnly =
    (isId && generated) ||
    Boolean(prop.onUpdate) ||
    (Boolean(prop.onCreate) && type === "datetime") ||
    prop.persist === false;

  return {
    name: prop.name,
    type,
    nativeType: nativeTypeName(prop),
    isId,
    isRequired: !prop.nullable && prop.persist !== false,
    isUnique: uniqueNames.has(prop.name) || Boolean(prop.unique) || isId,
    isReadOnly,
    isList: Boolean(prop.array),
    isFilterable:
      type === "enum" ||
      type === "boolean" ||
      type === "datetime" ||
      (isFk && !isId),
    isSearchable: type === "string" && !isId && !isFk && !isReadOnly,
    defaultValue: prop.default ?? null,
    enumValues: type === "enum" ? enumValues(prop) : undefined,
    relation: null,
  };
}

function introspectRelation(
  prop: EntityProperty,
  entityName: string,
): AdminFieldMeta {
  const kind = relationKind(prop);
  const isList = kind === "hasMany" || kind === "manyToMany";
  const foreignKeyFields =
    kind === "belongsTo" && (prop.fieldNames?.length ?? 0) <= 1
      ? [foreignKeyFieldName(prop)]
      : kind === "belongsTo"
        ? [...(prop.fieldNames ?? [])]
        : [];

  return {
    name: prop.name,
    type: "relation",
    nativeType: String(prop.kind),
    isId: false,
    isRequired: !prop.nullable && !isList,
    isUnique: false,
    isReadOnly: true,
    isList,
    isFilterable: false,
    isSearchable: false,
    defaultValue: null,
    relation: {
      model: targetModelName(prop),
      kind,
      relationName: inversePropertyName(prop) ?? `${entityName}.${prop.name}`,
      foreignKeyFields,
      onDelete:
        mapOnDelete(prop.deleteRule) ??
        (kind === "belongsTo" ? "Restrict" : null),
      displayField: "id",
    },
  };
}

function syntheticFkField(relationField: AdminFieldMeta): AdminFieldMeta | null {
  const relation = relationField.relation;
  if (!relation || relation.kind !== "belongsTo") return null;
  const fk = relation.foreignKeyFields[0];
  if (!fk || fk === relationField.name) return null;

  return {
    name: fk,
    type: "string",
    nativeType: "string",
    isId: false,
    isRequired: relationField.isRequired,
    isUnique: false,
    isReadOnly: false,
    isList: false,
    isFilterable: true,
    isSearchable: false,
    defaultValue: null,
    relation: null,
  };
}

function introspectEntity(entity: EntityMetadata): AdminModelMeta | null {
  if (entity.pivotTable || entity.embeddable || entity.virtual) return null;

  const primaryKeys = entity.primaryKeys ?? [];
  if (primaryKeys.length !== 1) {
    console.warn(
      `[paneljs] Skipping entity "${entity.className}": composite or missing primary keys are not supported in v1.`,
    );
    return null;
  }

  const idField = primaryKeys[0];
  if (!idField) {
    console.warn(
      `[paneljs] Skipping entity "${entity.className}": no primary column found.`,
    );
    return null;
  }

  const uniqueNames = uniquePropertyNames(entity);
  const properties = Object.values(entity.properties ?? {});
  const fkPropertyNames = new Set<string>();
  for (const prop of properties) {
    if (!isRelation(prop)) continue;
    const kind = relationKind(prop);
    if (kind !== "belongsTo") continue;
    fkPropertyNames.add(foreignKeyFieldName(prop));
    for (const column of prop.fieldNames ?? []) fkPropertyNames.add(column);
  }

  const fields: AdminFieldMeta[] = [];
  const seen = new Set<string>();

  for (const prop of properties) {
    if (isRelation(prop)) continue;
    if (prop.persist === false) continue;
    if (prop.kind === "embedded") continue;
    if (seen.has(prop.name)) continue;
    seen.add(prop.name);
    fields.push(
      introspectScalar(prop, uniqueNames, fkPropertyNames.has(prop.name)),
    );
  }

  const relationFields: AdminFieldMeta[] = [];
  for (const prop of properties) {
    if (!isRelation(prop)) continue;
    if (seen.has(prop.name)) continue;
    seen.add(prop.name);
    const relationField = introspectRelation(prop, entity.className);
    relationFields.push(relationField);
    const fk = syntheticFkField(relationField);
    if (fk && !seen.has(fk.name)) {
      seen.add(fk.name);
      fields.push(fk);
    }
  }
  fields.push(...relationFields);

  const createdAt =
    properties.find((prop) => prop.name === "createdAt")?.name ??
    fields.find((field) => field.name === "createdAt" && field.type === "datetime")
      ?.name;
  const updatedAt =
    properties.find((prop) => prop.name === "updatedAt" || Boolean(prop.onUpdate))
      ?.name ??
    fields.find((field) => field.name === "updatedAt" && field.type === "datetime")
      ?.name;

  return {
    name: entity.className,
    pluralName: simplePlural(entity.className),
    clientKey: entity.className,
    fields,
    idField,
    displayField: detectDisplayField(fields, idField),
    searchableFields: fields
      .filter((field) => field.isSearchable)
      .map((field) => field.name),
    filterableFields: fields
      .filter((field) => field.isFilterable)
      .map((field) => field.name),
    timestamps: { createdAt, updatedAt },
  };
}

function patchRelationDisplayFields(
  models: Map<string, AdminModelMeta>,
): void {
  for (const model of models.values()) {
    for (const field of model.fields) {
      if (field.type !== "relation" || !field.relation) continue;
      const related = models.get(field.relation.model);
      if (related) field.relation.displayField = related.displayField;
    }
  }
}

function assertReady(orm: MikroORM): void {
  if (typeof orm.getMetadata !== "function" || orm.em === undefined) {
    throw new Error(
      "[paneljs] mikroormAdapter requires an initialized MikroORM instance. Call await MikroORM.init() first.",
    );
  }
}

/** Map live MikroORM entity metadata into PanelJS model meta. */
export function introspect(orm: MikroORM): Map<string, AdminModelMeta> {
  assertReady(orm);

  const result = new Map<string, AdminModelMeta>();
  const seen = new Set<string>();
  for (const entity of Object.values(orm.getMetadata().getAll())) {
    if (seen.has(entity.className)) continue;
    seen.add(entity.className);
    const meta = introspectEntity(entity);
    if (meta) result.set(meta.name, meta);
  }
  patchRelationDisplayFields(result);
  return result;
}

export function usesInsensitiveSearch(orm: MikroORM): boolean {
  const name = orm.em.getPlatform().constructor.name.toLowerCase();
  return name.includes("postgres") || name.includes("cockroach");
}
