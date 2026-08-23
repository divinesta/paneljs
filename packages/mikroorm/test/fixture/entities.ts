import { EntitySchema } from "@mikro-orm/core";

export const TenantEntity = new EntitySchema({
  name: "Tenant",
  tableName: "contract_tenants",
  properties: {
    id: { type: "string", primary: true },
    name: { type: "string", unique: true },
    users: { kind: "1:m", entity: "User", mappedBy: "tenant" },
    posts: { kind: "1:m", entity: "Post", mappedBy: "tenant" },
    cascadeChildren: {
      kind: "1:m",
      entity: "CascadeChild",
      mappedBy: "tenant",
    },
    nullableChildren: {
      kind: "1:m",
      entity: "NullableChild",
      mappedBy: "tenant",
    },
    protectedChildren: {
      kind: "1:m",
      entity: "ProtectedChild",
      mappedBy: "tenant",
    },
  },
});

export const UserEntity = new EntitySchema({
  name: "User",
  tableName: "contract_users",
  properties: {
    id: { type: "uuid", primary: true, defaultRaw: "gen_random_uuid()" },
    email: { type: "string", unique: true },
    fullName: { type: "string" },
    role: {
      enum: true,
      items: () => ["USER", "ADMIN"],
      nativeEnumName: "contract_role",
      default: "USER",
    },
    isActive: { type: "boolean", default: true },
    createdAt: {
      type: "datetime",
      columnType: "timestamptz",
      onCreate: () => new Date(),
    },
    updatedAt: {
      type: "datetime",
      columnType: "timestamptz",
      onCreate: () => new Date(),
      onUpdate: () => new Date(),
    },
    tenant: {
      kind: "m:1",
      entity: "Tenant",
      inversedBy: "users",
      fieldName: "tenantId",
      deleteRule: "cascade",
    },
    posts: { kind: "1:m", entity: "Post", mappedBy: "author" },
  },
});

export const PostEntity = new EntitySchema({
  name: "Post",
  tableName: "contract_posts",
  properties: {
    id: { type: "uuid", primary: true, defaultRaw: "gen_random_uuid()" },
    title: { type: "string" },
    content: { type: "text", nullable: true },
    published: { type: "boolean", default: false },
    createdAt: {
      type: "datetime",
      columnType: "timestamptz",
      onCreate: () => new Date(),
    },
    updatedAt: {
      type: "datetime",
      columnType: "timestamptz",
      onCreate: () => new Date(),
      onUpdate: () => new Date(),
    },
    author: {
      kind: "m:1",
      entity: "User",
      inversedBy: "posts",
      fieldName: "authorId",
      deleteRule: "restrict",
    },
    tenant: {
      kind: "m:1",
      entity: "Tenant",
      inversedBy: "posts",
      fieldName: "tenantId",
      deleteRule: "cascade",
    },
  },
});

export const CascadeChildEntity = new EntitySchema({
  name: "CascadeChild",
  tableName: "contract_cascade_children",
  properties: {
    id: { type: "uuid", primary: true, defaultRaw: "gen_random_uuid()" },
    label: { type: "string" },
    tenant: {
      kind: "m:1",
      entity: "Tenant",
      inversedBy: "cascadeChildren",
      fieldName: "tenantId",
      deleteRule: "cascade",
    },
  },
});

export const NullableChildEntity = new EntitySchema({
  name: "NullableChild",
  tableName: "contract_nullable_children",
  properties: {
    id: { type: "uuid", primary: true, defaultRaw: "gen_random_uuid()" },
    label: { type: "string" },
    tenant: {
      kind: "m:1",
      entity: "Tenant",
      inversedBy: "nullableChildren",
      fieldName: "tenantId",
      nullable: true,
      deleteRule: "set null",
    },
  },
});

export const ProtectedChildEntity = new EntitySchema({
  name: "ProtectedChild",
  tableName: "contract_protected_children",
  properties: {
    id: { type: "uuid", primary: true, defaultRaw: "gen_random_uuid()" },
    label: { type: "string" },
    tenant: {
      kind: "m:1",
      entity: "Tenant",
      inversedBy: "protectedChildren",
      fieldName: "tenantId",
      deleteRule: "restrict",
    },
  },
});

export const ExpressAdminUserEntity = new EntitySchema({
  name: "ExpressAdminUser",
  tableName: "contract_admin_users",
  properties: {
    id: { type: "uuid", primary: true, defaultRaw: "gen_random_uuid()" },
    email: { type: "string", nullable: true, unique: true },
    username: { type: "string", nullable: true, unique: true },
    passwordHash: { type: "string" },
    role: {
      enum: true,
      items: () => ["ADMIN", "SUPER_ADMIN"],
      nativeEnumName: "contract_admin_role",
      default: "ADMIN",
    },
    isActive: { type: "boolean", default: true },
    tenantId: { type: "string", nullable: true },
    createdAt: {
      type: "datetime",
      columnType: "timestamptz",
      onCreate: () => new Date(),
    },
    updatedAt: {
      type: "datetime",
      columnType: "timestamptz",
      onCreate: () => new Date(),
      onUpdate: () => new Date(),
    },
    sessions: {
      kind: "1:m",
      entity: "ExpressAdminSession",
      mappedBy: "user",
    },
  },
});

export const ExpressAdminSessionEntity = new EntitySchema({
  name: "ExpressAdminSession",
  tableName: "contract_admin_sessions",
  properties: {
    id: { type: "uuid", primary: true, defaultRaw: "gen_random_uuid()" },
    tokenHash: { type: "string", unique: true },
    expiresAt: { type: "datetime", columnType: "timestamptz" },
    createdAt: {
      type: "datetime",
      columnType: "timestamptz",
      onCreate: () => new Date(),
    },
    user: {
      kind: "m:1",
      entity: "ExpressAdminUser",
      inversedBy: "sessions",
      fieldName: "userId",
      deleteRule: "cascade",
    },
  },
});

export const contractEntities = [
  TenantEntity,
  UserEntity,
  PostEntity,
  CascadeChildEntity,
  NullableChildEntity,
  ProtectedChildEntity,
  ExpressAdminUserEntity,
  ExpressAdminSessionEntity,
] as const;
