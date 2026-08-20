import type {
  AdminFieldMeta,
  AdminFieldType,
  AdminModelMeta,
  RelationKind,
} from "@paneljs/paneljs";
import type { DataSource, EntityMetadata } from "typeorm";

type TypeormColumn = EntityMetadata["columns"][number];
type TypeormRelation = EntityMetadata["relations"][number];

const PREFERRED_DISPLAY_NAMES = [
  "name",
  "title",
  "label",
  "username",
  "slug",
  "email",
];

const STRING_TYPES = new Set([
  "varchar",
  "character varying",
  "character",
  "char",
  "text",
  "citext",
  "uuid",
  "nvarchar",
  "nchar",
  "ntext",
  "string",
  "uniqueidentifier",
  "tinytext",
  "mediumtext",
  "longtext",
]);

const NUMBER_TYPES = new Set([
  "int",
  "int2",
  "int4",
  "int8",
  "int64",
  "integer",
  "smallint",
  "bigint",
  "tinyint",
  "mediumint",
  "float",
  "float4",
  "float8",
  "float64",
  "double",
  "double precision",
  "decimal",
  "numeric",
  "real",
  "money",
  "smallmoney",
  "number",
]);

const DATETIME_TYPES = new Set([
  "datetime",
  "datetime2",
  "datetimeoffset",
  "date",
  "time",
  "timestamp",
  "timestamptz",
  "timetz",
  "smalldatetime",
  "timestamp without time zone",
  "timestamp with time zone",
  "timestamp with local time zone",
  "time without time zone",
  "time with time zone",
]);

const JSON_TYPES = new Set(["json", "jsonb", "simple-json", "simple-array"]);

const BYTES_TYPES = new Set([
  "bytea",
  "bytes",
  "blob",
  "tinyblob",
  "mediumblob",
  "longblob",
  "varbinary",
  "binary",
]);

function nativeTypeName(type: TypeormColumn["type"]): string {
  if (typeof type === "function") return type.name;
  return String(type);
}

function mapColumnType(column: TypeormColumn): AdminFieldType {
  if (
    column.enum !== undefined ||
    column.enumName ||
    nativeTypeName(column.type).toLowerCase() === "enum" ||
    nativeTypeName(column.type).toLowerCase() === "simple-enum"
  ) {
    return "enum";
  }

  const type = column.type;
  if (type === String) return "string";
  if (type === Number) return "number";
  if (type === Boolean) return "boolean";
  if (type === Date) return "datetime";

  const native = nativeTypeName(type).toLowerCase();
  if (STRING_TYPES.has(native)) return "string";
  if (NUMBER_TYPES.has(native)) return "number";
  if (native === "boolean" || native === "bool") return "boolean";
  if (DATETIME_TYPES.has(native)) return "datetime";
  if (JSON_TYPES.has(native)) return "json";
  if (BYTES_TYPES.has(native)) return "bytes";
  return "string";
}

function enumValues(column: TypeormColumn): string[] | undefined {
  if (!column.enum || column.enum.length === 0) return undefined;
  return column.enum.map((value: string | number) => String(value));
}

function uniqueColumnNames(entity: EntityMetadata): Set<string> {
  const names = new Set<string>();
  for (const unique of entity.uniques) {
    if (unique.columns.length === 1 && unique.columns[0]) {
      names.add(unique.columns[0].propertyName);
    }
  }
  for (const index of entity.indices) {
    if (
      index.isUnique &&
      index.columns.length === 1 &&
      index.columns[0]
    ) {
      names.add(index.columns[0].propertyName);
    }
  }
  return names;
}

function simplePlural(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith("y")) return lower.slice(0, -1) + "ies";
  if (lower.endsWith("s") || lower.endsWith("x") || lower.endsWith("z"))
    return lower + "es";
  if (lower.endsWith("ch") || lower.endsWith("sh")) return lower + "es";
  return lower + "s";
}

/** Map TypeORM FK actions to Prisma-style names used by delete preview. */
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

function relationKind(relation: TypeormRelation): RelationKind {
  if (relation.isManyToMany) return "manyToMany";
  if (relation.isOneToMany) return "hasMany";
  if (relation.isManyToOne) return "belongsTo";
  if (relation.isOneToOneOwner || relation.isWithJoinColumn) return "belongsTo";
  return "hasOne";
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
    (field) =>
      field.type === "string" && field.isUnique && !field.isId,
  );
  if (uniqueString) return uniqueString.name;

  const anyString = fields.find(
    (field) => field.type === "string" && !field.isId,
  );
  if (anyString) return anyString.name;

  return idField;
}

function introspectColumn(
  column: TypeormColumn,
  uniqueNames: Set<string>,
): AdminFieldMeta {
  const type = mapColumnType(column);
  const isFk = column.relationMetadata !== undefined;
  const isId = column.isPrimary;
  const isReadOnly =
    column.isGenerated ||
    column.isCreateDate ||
    column.isUpdateDate ||
    column.isDeleteDate ||
    column.isUpdate === false;

  return {
    name: column.propertyName,
    type,
    nativeType: nativeTypeName(column.type),
    isId,
    isRequired: !column.isNullable,
    isUnique: uniqueNames.has(column.propertyName) || isId,
    isReadOnly,
    isList: column.isArray,
    isFilterable:
      type === "enum" ||
      type === "boolean" ||
      type === "datetime" ||
      (isFk && !isId),
    isSearchable: type === "string" && !isId && !isFk && !isReadOnly,
    defaultValue: column.default ?? null,
    enumValues: type === "enum" ? enumValues(column) : undefined,
    relation: null,
  };
}

function introspectRelation(relation: TypeormRelation): AdminFieldMeta {
  const kind = relationKind(relation);
  const isList = kind === "hasMany" || kind === "manyToMany";
  return {
    name: relation.propertyName,
    type: "relation",
    nativeType: relation.relationType,
    isId: false,
    isRequired: !relation.isNullable && !isList,
    isUnique: false,
    isReadOnly: true,
    isList,
    isFilterable: false,
    isSearchable: false,
    defaultValue: null,
    relation: {
      model: relation.inverseEntityMetadata.name,
      kind,
      relationName:
        relation.inverseRelation?.propertyName ??
        `${relation.entityMetadata.name}.${relation.propertyName}`,
      foreignKeyFields: relation.joinColumns.map(
        (column: TypeormColumn) => column.propertyName,
      ),
      onDelete:
        mapOnDelete(relation.onDelete) ??
        (kind === "belongsTo" ? "Restrict" : null),
      displayField: "id",
    },
  };
}

function introspectEntity(entity: EntityMetadata): AdminModelMeta | null {
  if (
    entity.tableType === "junction" ||
    entity.tableType === "closure-junction"
  ) {
    return null;
  }

  if (entity.primaryColumns.length !== 1) {
    console.warn(
      `[paneljs] Skipping entity "${entity.name}": composite or missing primary keys are not supported in v1.`,
    );
    return null;
  }

  const pk = entity.primaryColumns[0];
  if (!pk) {
    console.warn(
      `[paneljs] Skipping entity "${entity.name}": no primary column found.`,
    );
    return null;
  }

  const uniqueNames = uniqueColumnNames(entity);
  const fields: AdminFieldMeta[] = [];
  const seen = new Set<string>();

  for (const column of entity.columns) {
    if (column.isVirtual || column.embeddedMetadata) continue;
    if (seen.has(column.propertyName)) continue;
    seen.add(column.propertyName);
    fields.push(introspectColumn(column, uniqueNames));
  }

  for (const relation of entity.relations) {
    if (relation.embeddedMetadata) continue;
    if (seen.has(relation.propertyName)) continue;
    seen.add(relation.propertyName);
    fields.push(introspectRelation(relation));
  }

  const createdAt =
    entity.createDateColumn?.propertyName ??
    fields.find(
      (field) => field.name === "createdAt" && field.type === "datetime",
    )?.name;
  const updatedAt =
    entity.updateDateColumn?.propertyName ??
    fields.find(
      (field) => field.name === "updatedAt" && field.type === "datetime",
    )?.name;

  return {
    name: entity.name,
    pluralName: simplePlural(entity.name),
    clientKey: entity.name,
    fields,
    idField: pk.propertyName,
    displayField: detectDisplayField(fields, pk.propertyName),
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

/** Map live TypeORM entity metadata into PanelJS model meta. */
export function introspect(dataSource: DataSource): Map<string, AdminModelMeta> {
  if (!dataSource.isInitialized) {
    throw new Error(
      "[paneljs] typeormAdapter requires an initialized DataSource. Call await dataSource.initialize() first.",
    );
  }

  const result = new Map<string, AdminModelMeta>();
  for (const entity of dataSource.entityMetadatas) {
    const meta = introspectEntity(entity);
    if (meta) result.set(meta.name, meta);
  }
  patchRelationDisplayFields(result);
  return result;
}
