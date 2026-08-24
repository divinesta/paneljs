import express from "express";
import { createAdmin } from "paneljs";
import { mount } from "@paneljs/express";
import { mikroormActionWhere, mikroormAdapter } from "@paneljs/mikroorm";
import type { MikroORM } from "@mikro-orm/core";
import { orm } from "./orm.js";

const port = Number(process.env.PORT ?? 3002);

await orm.schema.updateSchema();

const app = express();

const admin = createAdmin({
  adapter: mikroormAdapter({ orm }),
  siteName: "PanelJS MikroORM",
  auth: {
    mode: "built-in",
    identifier: "email",
    secureCookies: process.env.PANELJS_SECURE_COOKIES === "true",
  },
});

const tenantScope = async (adminUser: {
  isSuperAdmin: boolean;
  tenantId?: string;
}) =>
  adminUser.isSuperAdmin
    ? {}
    : { tenantId: adminUser.tenantId ?? "__no_tenant__" };

const editorPermissions = {
  list: ["SUPER_ADMIN", "ADMIN"],
  view: ["SUPER_ADMIN", "ADMIN"],
  create: ["SUPER_ADMIN", "ADMIN"],
  update: ["SUPER_ADMIN", "ADMIN"],
  delete: ["SUPER_ADMIN"],
};

admin.register("Tenant", {
  listDisplay: ["name", "createdAt"],
  searchFields: ["name"],
  permissions: {
    list: ["SUPER_ADMIN"],
    view: ["SUPER_ADMIN"],
    create: ["SUPER_ADMIN"],
    update: ["SUPER_ADMIN"],
    delete: ["SUPER_ADMIN"],
  },
});

admin.register("User", {
  listDisplay: ["email", "fullName", "role", "isActive"],
  listFilter: ["role", "isActive"],
  searchFields: ["email", "fullName"],
  permissions: editorPermissions,
  fields: {
    role: { writeRoles: ["SUPER_ADMIN"] },
    isActive: { writeRoles: ["SUPER_ADMIN"] },
  },
  scope: tenantScope,
});

admin.register("Post", {
  listDisplay: ["title", "author", "published", "createdAt"],
  listFilter: ["published", "createdAt"],
  searchFields: ["title", "content"],
  permissions: {
    ...editorPermissions,
    actions: {
      publish_selected: ["SUPER_ADMIN", "ADMIN"],
      unpublish_selected: ["SUPER_ADMIN", "ADMIN"],
    },
  },
  scope: tenantScope,
  actions: [
    {
      name: "publish_selected",
      label: "Publish selected posts",
      allowedRoles: ["SUPER_ADMIN", "ADMIN"],
      handler: async ({ client, where }) => {
        const count = await (client as MikroORM).em
          .fork()
          .nativeUpdate(
            "Post",
            mikroormActionWhere(client as MikroORM, "Post", where),
            { published: true },
          );
        return {
          message: `Published ${count} ${count === 1 ? "post" : "posts"}.`,
        };
      },
    },
    {
      name: "unpublish_selected",
      label: "Move selected posts to draft",
      allowedRoles: ["SUPER_ADMIN", "ADMIN"],
      handler: async ({ client, where }) => {
        const count = await (client as MikroORM).em
          .fork()
          .nativeUpdate(
            "Post",
            mikroormActionWhere(client as MikroORM, "Post", where),
            { published: false },
          );
        return {
          message: `Moved ${count} ${count === 1 ? "post" : "posts"} to draft.`,
        };
      },
    },
  ],
});

admin.register("Customer", {
  listDisplay: ["email", "fullName", "company", "isActive", "createdAt"],
  listFilter: ["isActive", "createdAt"],
  searchFields: ["email", "fullName", "company"],
  permissions: editorPermissions,
  scope: tenantScope,
});

admin.register("Category", {
  listDisplay: ["name", "description", "createdAt"],
  searchFields: ["name", "description"],
  permissions: editorPermissions,
  scope: tenantScope,
});

admin.register("Product", {
  listDisplay: ["sku", "name", "category", "price", "stock", "status"],
  listFilter: ["status", "createdAt"],
  searchFields: ["sku", "name", "description"],
  permissions: editorPermissions,
  scope: tenantScope,
});

admin.register("Order", {
  listDisplay: [
    "reference",
    "customer",
    "owner",
    "status",
    "total",
    "placedAt",
  ],
  listFilter: ["status", "placedAt"],
  searchFields: ["reference"],
  permissions: editorPermissions,
  scope: tenantScope,
});

admin.register("OrderItem", {
  listDisplay: ["order", "product", "quantity", "unitPrice", "createdAt"],
  searchFields: [],
  permissions: editorPermissions,
  scope: async (adminUser) =>
    adminUser.isSuperAdmin
      ? {}
      : { order: { tenantId: adminUser.tenantId ?? "__no_tenant__" } },
});

await mount(app, admin);

const server = app.listen(port, () => {
  console.log(
    `[paneljs] MikroORM example running at http://localhost:${port}/admin`,
  );
});

const shutdown = async () => {
  server.close();
  await orm.close(true);
};

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
