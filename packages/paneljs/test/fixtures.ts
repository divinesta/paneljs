import type {
  AdminFieldMeta,
  AdminModelMeta,
  AdminUser,
  DataAdapter,
  ModelResource,
} from "../src/index.js";

export const adminUser: AdminUser = {
  id: "admin-1",
  email: "ada@example.test",
  role: "ADMIN",
  isSuperAdmin: false,
  tenantId: "tenant-a",
};

export const superAdminUser: AdminUser = {
  id: "super-1",
  email: "linus@example.test",
  role: "SUPER_ADMIN",
  isSuperAdmin: true,
};

export function field(
  name: string,
  overrides: Partial<AdminFieldMeta> = {},
): AdminFieldMeta {
  return {
    name,
    type: "string",
    nativeType: "String",
    isId: false,
    isRequired: true,
    isUnique: false,
    isReadOnly: false,
    isList: false,
    isFilterable: false,
    isSearchable: true,
    defaultValue: null,
    relation: null,
    ...overrides,
  };
}

export const userMeta: AdminModelMeta = {
  name: "User",
  pluralName: "users",
  clientKey: "user",
  idField: "id",
  displayField: "email",
  searchableFields: ["email", "fullName"],
  filterableFields: ["role", "isActive", "tenantId", "createdAt"],
  timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  fields: [
    field("id", {
      isId: true,
      isUnique: true,
      isReadOnly: true,
      isSearchable: false,
      defaultValue: { name: "cuid", args: [] },
    }),
    field("email", { isUnique: true }),
    field("fullName"),
    field("role", {
      type: "enum",
      nativeType: "Role",
      enumValues: ["USER", "ADMIN", "SUPER_ADMIN"],
      isFilterable: true,
      isSearchable: false,
      defaultValue: "USER",
    }),
    field("isActive", {
      type: "boolean",
      nativeType: "Boolean",
      isFilterable: true,
      isSearchable: false,
      defaultValue: true,
    }),
    field("tenantId", {
      isFilterable: true,
      isSearchable: false,
    }),
    field("passwordHash", { isSearchable: false }),
    field("createdAt", {
      type: "datetime",
      nativeType: "DateTime",
      isReadOnly: true,
      isFilterable: true,
      isSearchable: false,
      defaultValue: { name: "now", args: [] },
    }),
    field("updatedAt", {
      type: "datetime",
      nativeType: "DateTime",
      isReadOnly: true,
      isSearchable: false,
      defaultValue: { name: "updatedAt", args: [] },
    }),
    field("tenant", {
      type: "relation",
      nativeType: "Tenant",
      isReadOnly: true,
      isSearchable: false,
      relation: {
        model: "Tenant",
        kind: "belongsTo",
        relationName: "TenantToUser",
        foreignKeyFields: ["tenantId"],
        onDelete: "Cascade",
        displayField: "name",
      },
    }),
    field("posts", {
      type: "relation",
      nativeType: "Post",
      isRequired: false,
      isReadOnly: true,
      isList: true,
      isSearchable: false,
      relation: {
        model: "Post",
        kind: "hasMany",
        relationName: "UserToPost",
        foreignKeyFields: [],
        displayField: "title",
      },
    }),
  ],
};

export const tenantMeta: AdminModelMeta = {
  name: "Tenant",
  pluralName: "tenants",
  clientKey: "tenant",
  idField: "id",
  displayField: "name",
  searchableFields: ["name"],
  filterableFields: [],
  timestamps: {},
  fields: [
    field("id", {
      isId: true,
      isUnique: true,
      isReadOnly: true,
      isSearchable: false,
    }),
    field("name", { isUnique: true }),
  ],
};

export const modelMeta = new Map([
  [userMeta.name, userMeta],
  [tenantMeta.name, tenantMeta],
]);

export function emptyResource(
  overrides: Partial<ModelResource> = {},
): ModelResource {
  return {
    async findMany() {
      return [];
    },
    async findFirst() {
      return null;
    },
    async count() {
      return 0;
    },
    async create() {
      return {};
    },
    async updateMany() {
      return { count: 0 };
    },
    async deleteMany() {
      return { count: 0 };
    },
    ...overrides,
  };
}

export function adapterFor(
  metadata: Map<string, AdminModelMeta> = modelMeta,
  resource: ModelResource = emptyResource(),
): DataAdapter {
  return {
    client: {},
    async introspect() {
      return metadata;
    },
    resource() {
      return resource;
    },
  };
}
