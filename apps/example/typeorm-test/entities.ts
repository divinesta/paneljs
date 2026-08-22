import { builtInAuthEntities } from "@paneljs/typeorm";
import { EntitySchema } from "typeorm";

export const Tenant = new EntitySchema<Record<string, unknown>>({
  name: "Tenant",
  tableName: "tenants",
  columns: {
    id: { type: "varchar", primary: true },
    name: { type: "varchar", unique: true },
    createdAt: { type: "timestamptz", createDate: true },
  },
  relations: {
    users: { type: "one-to-many", target: "User", inverseSide: "tenant" },
    posts: { type: "one-to-many", target: "Post", inverseSide: "tenant" },
  },
});

export const User = new EntitySchema<Record<string, unknown>>({
  name: "User",
  tableName: "users",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    email: { type: "varchar", unique: true },
    fullName: { type: "varchar" },
    role: {
      type: "enum",
      enum: ["SUPER_ADMIN", "ADMIN", "USER"],
      default: "USER",
      enumName: "user_role",
    },
    isActive: { type: "boolean", default: true },
    tenantId: { type: "varchar" },
    createdAt: { type: "timestamptz", createDate: true },
    updatedAt: { type: "timestamptz", updateDate: true },
  },
  relations: {
    tenant: {
      type: "many-to-one",
      target: "Tenant",
      joinColumn: { name: "tenantId" },
      inverseSide: "users",
    },
    posts: { type: "one-to-many", target: "Post", inverseSide: "author" },
  },
});

export const Post = new EntitySchema<Record<string, unknown>>({
  name: "Post",
  tableName: "posts",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    title: { type: "varchar" },
    content: { type: "text", nullable: true },
    published: { type: "boolean", default: false },
    authorId: { type: "uuid" },
    tenantId: { type: "varchar" },
    createdAt: { type: "timestamptz", createDate: true },
    updatedAt: { type: "timestamptz", updateDate: true },
  },
  relations: {
    author: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "authorId" },
      inverseSide: "posts",
      onDelete: "CASCADE",
    },
    tenant: {
      type: "many-to-one",
      target: "Tenant",
      joinColumn: { name: "tenantId" },
      inverseSide: "posts",
    },
  },
});

export const entities = [
  Tenant,
  User,
  Post,
  ...builtInAuthEntities({ identifier: "email" }),
];
