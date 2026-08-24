import express from "express";
import { createAdmin } from "paneljs";
import { mount } from "@paneljs/express";
import { typeormActionWhere, typeormAdapter } from "@paneljs/typeorm";
import type { DataSource } from "typeorm";
import { dataSource } from "./data-source.js";

const port = Number(process.env.PORT ?? 3001);

await dataSource.initialize();

const app = express();

const admin = createAdmin({
  adapter: typeormAdapter({ dataSource }),
  siteName: "PanelJS TypeORM",
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
        const result = await (client as DataSource)
          .getRepository("Post")
          .update(typeormActionWhere("id", where), { published: true });
        const count = result.affected ?? 0;
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
        const result = await (client as DataSource)
          .getRepository("Post")
          .update(typeormActionWhere("id", where), { published: false });
        const count = result.affected ?? 0;
        return {
          message: `Moved ${count} ${count === 1 ? "post" : "posts"} to draft.`,
        };
      },
    },
  ],
});

await mount(app, admin);

const server = app.listen(port, () => {
  console.log(
    `[paneljs] TypeORM example running at http://localhost:${port}/admin`,
  );
});

const shutdown = async () => {
  server.close();
  await dataSource.destroy();
};

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
