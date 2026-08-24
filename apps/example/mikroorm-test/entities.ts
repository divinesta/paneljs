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
    customers: { kind: "1:m", entity: "Customer", mappedBy: "tenant" },
    categories: { kind: "1:m", entity: "Category", mappedBy: "tenant" },
    products: { kind: "1:m", entity: "Product", mappedBy: "tenant" },
    orders: { kind: "1:m", entity: "Order", mappedBy: "tenant" },
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
    orders: { kind: "1:m", entity: "Order", mappedBy: "owner" },
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

export const Customer = new EntitySchema({
  name: "Customer",
  tableName: "customers",
  properties: {
    id: { type: "uuid", primary: true, defaultRaw: "gen_random_uuid()" },
    email: { type: "string", unique: true },
    fullName: { type: "string" },
    company: { type: "string", nullable: true },
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
      inversedBy: "customers",
      fieldName: "tenantId",
      deleteRule: "cascade",
    },
    orders: { kind: "1:m", entity: "Order", mappedBy: "customer" },
  },
});

export const Category = new EntitySchema<Record<string, any>>({
  name: "Category",
  tableName: "categories",
  properties: {
    id: { type: "uuid", primary: true, defaultRaw: "gen_random_uuid()" },
    name: { type: "string" },
    description: { type: "text", nullable: true },
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
      inversedBy: "categories",
      fieldName: "tenantId",
      deleteRule: "cascade",
    },
    products: { kind: "1:m", entity: "Product", mappedBy: "category" },
  },
  uniques: [{ properties: ["tenant", "name"] }],
});

export const Product = new EntitySchema({
  name: "Product",
  tableName: "products",
  properties: {
    id: { type: "uuid", primary: true, defaultRaw: "gen_random_uuid()" },
    sku: { type: "string", unique: true },
    name: { type: "string" },
    description: { type: "text", nullable: true },
    price: { type: "decimal", precision: 10, scale: 2 },
    stock: { type: "number", default: 0 },
    status: {
      enum: true,
      items: () => ["DRAFT", "ACTIVE", "ARCHIVED"],
      nativeEnumName: "product_status",
      default: "DRAFT",
    },
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
    category: {
      kind: "m:1",
      entity: "Category",
      inversedBy: "products",
      fieldName: "categoryId",
      deleteRule: "restrict",
    },
    tenant: {
      kind: "m:1",
      entity: "Tenant",
      inversedBy: "products",
      fieldName: "tenantId",
      deleteRule: "cascade",
    },
    orderItems: { kind: "1:m", entity: "OrderItem", mappedBy: "product" },
  },
});

export const Order = new EntitySchema({
  name: "Order",
  tableName: "orders",
  properties: {
    id: { type: "uuid", primary: true, defaultRaw: "gen_random_uuid()" },
    reference: { type: "string", unique: true },
    status: {
      enum: true,
      items: () => ["PENDING", "PAID", "FULFILLED", "CANCELLED", "REFUNDED"],
      nativeEnumName: "order_status",
      default: "PENDING",
    },
    total: { type: "decimal", precision: 10, scale: 2 },
    placedAt: {
      type: "datetime",
      columnType: "timestamptz",
      onCreate: () => new Date(),
    },
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
    customer: {
      kind: "m:1",
      entity: "Customer",
      inversedBy: "orders",
      fieldName: "customerId",
      deleteRule: "restrict",
    },
    owner: {
      kind: "m:1",
      entity: "User",
      inversedBy: "orders",
      fieldName: "ownerId",
      deleteRule: "restrict",
    },
    tenant: {
      kind: "m:1",
      entity: "Tenant",
      inversedBy: "orders",
      fieldName: "tenantId",
      deleteRule: "cascade",
    },
    items: { kind: "1:m", entity: "OrderItem", mappedBy: "order" },
  },
});

export const OrderItem = new EntitySchema<Record<string, any>>({
  name: "OrderItem",
  tableName: "order_items",
  properties: {
    id: { type: "uuid", primary: true, defaultRaw: "gen_random_uuid()" },
    quantity: { type: "number" },
    unitPrice: { type: "decimal", precision: 10, scale: 2 },
    createdAt: {
      type: "datetime",
      columnType: "timestamptz",
      onCreate: () => new Date(),
    },
    order: {
      kind: "m:1",
      entity: "Order",
      inversedBy: "items",
      fieldName: "orderId",
      deleteRule: "cascade",
    },
    product: {
      kind: "m:1",
      entity: "Product",
      inversedBy: "orderItems",
      fieldName: "productId",
      deleteRule: "restrict",
    },
  },
  uniques: [{ properties: ["order", "product"] }],
});

export const entities = [
  Tenant,
  User,
  Post,
  Customer,
  Category,
  Product,
  Order,
  OrderItem,
  ...builtInAuthEntities({ identifier: "email" }),
];
