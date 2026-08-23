import { builtInAuthEntities } from "@paneljs/mikroorm";
import { EntitySchema } from "@mikro-orm/core";

export const Tenant = new EntitySchema({
  name: "Tenant",
  tableName: "tenants",
  properties: {
    id: { type: "string", primary: true },
    name: { type: "string", unique: true },
    createdAt: {
      type: "datetime",
      columnType: "timestamptz",
      onCreate: () => new Date(),
    },
    users: { kind: "1:m", entity: "User", mappedBy: "tenant" },
    posts: { kind: "1:m", entity: "Post", mappedBy: "tenant" },
  },
});

export const User = new EntitySchema({
  name: "User",
  tableName: "users",
  properties: {
    id: { type: "uuid", primary: true, defaultRaw: "gen_random_uuid()" },
    email: { type: "string", unique: true },
    fullName: { type: "string" },
    role: {
      enum: true,
      items: () => ["SUPER_ADMIN", "ADMIN", "USER"],
      nativeEnumName: "user_role",
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
    },
    posts: { kind: "1:m", entity: "Post", mappedBy: "author" },
  },
});

export const Post = new EntitySchema({
  name: "Post",
  tableName: "posts",
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
      deleteRule: "cascade",
    },
    tenant: {
      kind: "m:1",
      entity: "Tenant",
      inversedBy: "posts",
      fieldName: "tenantId",
    },
  },
});

export const entities = [
  Tenant,
  User,
  Post,
  ...builtInAuthEntities({ identifier: "email" }),
];
