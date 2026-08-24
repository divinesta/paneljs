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
    customers: {
      type: "one-to-many",
      target: "Customer",
      inverseSide: "tenant",
    },
    categories: {
      type: "one-to-many",
      target: "Category",
      inverseSide: "tenant",
    },
    products: {
      type: "one-to-many",
      target: "Product",
      inverseSide: "tenant",
    },
    orders: { type: "one-to-many", target: "Order", inverseSide: "tenant" },
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
    orders: { type: "one-to-many", target: "Order", inverseSide: "owner" },
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

export const Customer = new EntitySchema<Record<string, unknown>>({
  name: "Customer",
  tableName: "customers",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    email: { type: "varchar", unique: true },
    fullName: { type: "varchar" },
    company: { type: "varchar", nullable: true },
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
      inverseSide: "customers",
      onDelete: "CASCADE",
    },
    orders: { type: "one-to-many", target: "Order", inverseSide: "customer" },
  },
});

export const Category = new EntitySchema<Record<string, unknown>>({
  name: "Category",
  tableName: "categories",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    name: { type: "varchar" },
    description: { type: "text", nullable: true },
    tenantId: { type: "varchar" },
    createdAt: { type: "timestamptz", createDate: true },
    updatedAt: { type: "timestamptz", updateDate: true },
  },
  relations: {
    tenant: {
      type: "many-to-one",
      target: "Tenant",
      joinColumn: { name: "tenantId" },
      inverseSide: "categories",
      onDelete: "CASCADE",
    },
    products: {
      type: "one-to-many",
      target: "Product",
      inverseSide: "category",
    },
  },
  uniques: [{ columns: ["tenantId", "name"] }],
});

export const Product = new EntitySchema<Record<string, unknown>>({
  name: "Product",
  tableName: "products",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    sku: { type: "varchar", unique: true },
    name: { type: "varchar" },
    description: { type: "text", nullable: true },
    price: { type: "numeric", precision: 10, scale: 2 },
    stock: { type: "integer", default: 0 },
    status: {
      type: "enum",
      enum: ["DRAFT", "ACTIVE", "ARCHIVED"],
      default: "DRAFT",
      enumName: "product_status",
    },
    categoryId: { type: "uuid" },
    tenantId: { type: "varchar" },
    createdAt: { type: "timestamptz", createDate: true },
    updatedAt: { type: "timestamptz", updateDate: true },
  },
  relations: {
    category: {
      type: "many-to-one",
      target: "Category",
      joinColumn: { name: "categoryId" },
      inverseSide: "products",
      onDelete: "RESTRICT",
    },
    tenant: {
      type: "many-to-one",
      target: "Tenant",
      joinColumn: { name: "tenantId" },
      inverseSide: "products",
      onDelete: "CASCADE",
    },
    orderItems: {
      type: "one-to-many",
      target: "OrderItem",
      inverseSide: "product",
    },
  },
});

export const Order = new EntitySchema<Record<string, unknown>>({
  name: "Order",
  tableName: "orders",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    reference: { type: "varchar", unique: true },
    status: {
      type: "enum",
      enum: ["PENDING", "PAID", "FULFILLED", "CANCELLED", "REFUNDED"],
      default: "PENDING",
      enumName: "order_status",
    },
    total: { type: "numeric", precision: 10, scale: 2 },
    customerId: { type: "uuid" },
    ownerId: { type: "uuid" },
    tenantId: { type: "varchar" },
    placedAt: { type: "timestamptz", createDate: true },
    createdAt: { type: "timestamptz", createDate: true },
    updatedAt: { type: "timestamptz", updateDate: true },
  },
  relations: {
    customer: {
      type: "many-to-one",
      target: "Customer",
      joinColumn: { name: "customerId" },
      inverseSide: "orders",
      onDelete: "RESTRICT",
    },
    owner: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "ownerId" },
      inverseSide: "orders",
      onDelete: "RESTRICT",
    },
    tenant: {
      type: "many-to-one",
      target: "Tenant",
      joinColumn: { name: "tenantId" },
      inverseSide: "orders",
      onDelete: "CASCADE",
    },
    items: { type: "one-to-many", target: "OrderItem", inverseSide: "order" },
  },
});

export const OrderItem = new EntitySchema<Record<string, unknown>>({
  name: "OrderItem",
  tableName: "order_items",
  columns: {
    id: { type: "uuid", primary: true, generated: "uuid" },
    quantity: { type: "integer" },
    unitPrice: { type: "numeric", precision: 10, scale: 2 },
    orderId: { type: "uuid" },
    productId: { type: "uuid" },
    createdAt: { type: "timestamptz", createDate: true },
  },
  relations: {
    order: {
      type: "many-to-one",
      target: "Order",
      joinColumn: { name: "orderId" },
      inverseSide: "items",
      onDelete: "CASCADE",
    },
    product: {
      type: "many-to-one",
      target: "Product",
      joinColumn: { name: "productId" },
      inverseSide: "orderItems",
      onDelete: "RESTRICT",
    },
  },
  uniques: [{ columns: ["orderId", "productId"] }],
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
