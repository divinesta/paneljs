import { describe, expect, it } from "vitest";

import {
  AdminRegistry,
  buildSchemaResponse,
  type AdminAction,
  type ModelConfig,
} from "../src/index.js";
import { adminUser, modelMeta, superAdminUser } from "./fixtures.js";

const action = (allowedRoles?: string[]): AdminAction => ({
  name: "activate_selected",
  label: "Activate selected",
  allowedRoles,
  async handler() {
    return { message: "Activated" };
  },
});

async function registryWith(
  userConfig: ModelConfig,
  tenantConfig: ModelConfig = {},
) {
  const registry = new AdminRegistry();
  registry.register("User", userConfig);
  registry.register("Tenant", tenantConfig);
  await registry.initialize(modelMeta);
  return registry;
}

describe("schema response", () => {
  it("includes identity and site context", async () => {
    const registry = await registryWith({});
    const schema = buildSchemaResponse(registry, {
      adminUser,
      siteName: "Operations",
      basePath: "/control",
      authMode: "external",
    });

    expect(schema).toMatchObject({
      identity: {
        id: "admin-1",
        email: "ada@example.test",
        role: "ADMIN",
        isSuperAdmin: false,
      },
      siteName: "Operations",
      basePath: "/control",
      authMode: "external",
    });
  });

  it("removes models without list permission", async () => {
    const registry = await registryWith(
      { permissions: { list: ["SUPER_ADMIN"] } },
      {},
    );
    const schema = buildSchemaResponse(registry, {
      adminUser,
      siteName: "PanelJS",
      basePath: "/admin",
      authMode: "built-in",
    });

    expect(schema.models.map((model) => model.meta.name)).toEqual(["Tenant"]);
  });

  it("filters sensitive and excluded fields from all resolved lists", async () => {
    const registry = await registryWith({
      listDisplay: ["email", "passwordHash", "fullName"],
      searchFields: ["email", "fullName"],
      listFilter: ["role"],
      fields: {
        fullName: { exclude: true },
      },
    });
    const schema = buildSchemaResponse(registry, {
      adminUser,
      siteName: "PanelJS",
      basePath: "/admin",
      authMode: "external",
    });
    const user = schema.models.find((model) => model.meta.name === "User")!;

    expect(user.meta.fields.map((candidate) => candidate.name)).not.toContain(
      "passwordHash",
    );
    expect(user.meta.fields.map((candidate) => candidate.name)).not.toContain(
      "fullName",
    );
    expect(user.config.listDisplay).toEqual(["email"]);
    expect(user.config.searchFields).toEqual(["email"]);
  });

  it("marks fields read-only for the current administrator", async () => {
    const registry = await registryWith({
      fields: { email: { writeRoles: ["SUPER_ADMIN"] } },
    });
    const schema = buildSchemaResponse(registry, {
      adminUser,
      siteName: "PanelJS",
      basePath: "/admin",
      authMode: "external",
    });
    const email = schema.models
      .find((model) => model.meta.name === "User")!
      .meta.fields.find((candidate) => candidate.name === "email")!;
    expect(email.isReadOnly).toBe(true);
  });

  it("returns operation booleans and only authorized actions", async () => {
    const registry = await registryWith({
      permissions: {
        create: ["ADMIN"],
        update: ["SUPER_ADMIN"],
        delete: ["ADMIN"],
        actions: { activate_selected: ["ADMIN"] },
      },
      actions: [action(["ADMIN"])],
    });
    const schema = buildSchemaResponse(registry, {
      adminUser,
      siteName: "PanelJS",
      basePath: "/admin",
      authMode: "external",
    });
    const config = schema.models.find(
      (model) => model.meta.name === "User",
    )!.config;

    expect(config.permissions).toEqual({
      list: true,
      view: true,
      create: true,
      update: false,
      delete: true,
      actions: { delete_selected: true, activate_selected: true },
    });
    expect(config.actions).toEqual([
      { name: "delete_selected", label: "Delete selected" },
      { name: "activate_selected", label: "Activate selected" },
    ]);
  });

  it("gives a super-admin every operation and registered action", async () => {
    const registry = await registryWith({
      permissions: { list: [], view: [], create: [], update: [], delete: [] },
      actions: [action([])],
    });
    const schema = buildSchemaResponse(registry, {
      adminUser: superAdminUser,
      siteName: "PanelJS",
      basePath: "/admin",
      authMode: "external",
    });
    const permissions = schema.models.find(
      (model) => model.meta.name === "User",
    )!.config.permissions;

    expect(permissions).toMatchObject({
      list: true,
      view: true,
      create: true,
      update: true,
      delete: true,
      actions: { delete_selected: true, activate_selected: true },
    });
  });
});
