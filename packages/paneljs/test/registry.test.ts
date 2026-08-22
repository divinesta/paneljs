import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AdminRegistry,
  createAdmin,
  type AdminAction,
  type ModelConfig,
} from "../src/index.js";
import { adapterFor, modelMeta, userMeta } from "./fixtures.js";

async function initializeUser(config: ModelConfig = {}) {
  const registry = new AdminRegistry();
  registry.register("User", config);
  await registry.initialize(modelMeta);
  return registry;
}

const validAction = (overrides: Partial<AdminAction> = {}): AdminAction => ({
  name: "publish_selected",
  label: "Publish selected",
  async handler() {
    return { message: "Published" };
  },
  ...overrides,
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("admin initialization", () => {
  it("introspects and initializes only once", async () => {
    const adapter = adapterFor();
    const introspect = vi.spyOn(adapter, "introspect");
    const admin = createAdmin({
      adapter,
      auth: { getCurrentUser: async () => null },
    }).register("User");

    await admin.initialize();
    await admin.initialize();

    expect(introspect).toHaveBeenCalledTimes(1);
    expect(admin.registry.get("User")?.meta.name).toBe("User");
  });

  it("does not mark a failed initialization as complete", async () => {
    const adapter = adapterFor(new Map());
    const introspect = vi.spyOn(adapter, "introspect");
    const admin = createAdmin({
      adapter,
      auth: { getCurrentUser: async () => null },
    }).register("User");

    await expect(admin.initialize()).rejects.toThrow('no model named "User"');
    await expect(admin.initialize()).rejects.toThrow('no model named "User"');
    expect(introspect).toHaveBeenCalledTimes(2);
  });
});

describe("registry defaults and lifecycle", () => {
  it("resolves useful defaults", async () => {
    const registry = await initializeUser();
    const model = registry.get("User")!;

    expect(model.resolved).toEqual({
      listDisplay: [
        "email",
        "fullName",
        "role",
        "isActive",
        "tenantId",
        "passwordHash",
        "createdAt",
      ],
      listFilter: [],
      searchFields: ["email", "fullName"],
      defaultSort: { field: "createdAt", direction: "desc" },
      perPage: 50,
      permissions: {},
    });
  });

  it("uses the id for default sort when no created timestamp exists", async () => {
    const registry = new AdminRegistry();
    registry.register("Tenant");
    await registry.initialize(modelMeta);
    expect(registry.get("Tenant")?.resolved.defaultSort).toEqual({
      field: "id",
      direction: "desc",
    });
  });

  it("applies valid overrides", async () => {
    const registry = await initializeUser({
      listDisplay: ["fullName", "email"],
      listFilter: ["role"],
      searchFields: ["fullName"],
      defaultSort: { field: "email", direction: "asc" },
      perPage: 25,
      displayField: "fullName",
      pluralName: "people",
      permissions: { update: ["ADMIN"] },
    });
    const model = registry.getByPluralName("people")!;

    expect(model.meta.displayField).toBe("fullName");
    expect(model.resolved).toMatchObject({
      listDisplay: ["fullName", "email"],
      listFilter: ["role"],
      searchFields: ["fullName"],
      defaultSort: { field: "email", direction: "asc" },
      perPage: 25,
      permissions: { update: ["ADMIN"] },
    });
  });

  it("warns and lets a later registration replace the earlier one", async () => {
    const warning = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const registry = new AdminRegistry();
    registry.register("User", { perPage: 10 });
    registry.register("User", { perPage: 20 });
    await registry.initialize(modelMeta);

    expect(warning).toHaveBeenCalledOnce();
    expect(registry.get("User")?.resolved.perPage).toBe(20);
  });

  it("rejects reads before initialization and registration after it", async () => {
    const registry = new AdminRegistry();
    expect(() => registry.getAll()).toThrow("Registry accessed before");
    registry.register("User");
    await registry.initialize(modelMeta);
    expect(() => registry.register("Tenant")).toThrow("after admin.mount");
  });

  it("rejects a second direct registry initialization", async () => {
    const registry = await initializeUser();
    await expect(registry.initialize(modelMeta)).rejects.toThrow(
      "initialize() called more than once",
    );
  });

  it("reports an unknown registered model", async () => {
    const registry = new AdminRegistry();
    registry.register("Missing");
    await expect(registry.initialize(modelMeta)).rejects.toThrow(
      'no model named "Missing"',
    );
  });
});

describe("registry configuration validation", () => {
  it.each([
    [
      "field override",
      { fields: { missing: { exclude: true } } },
      "does not exist",
    ],
    ["list display", { listDisplay: ["missing"] }, "does not exist"],
    ["search field", { searchFields: ["isActive"] }, "not a String field"],
    ["list filter", { listFilter: ["email"] }, "cannot be used as a filter"],
    ["page size low", { perPage: 0 }, "integer from 1 to 200"],
    ["page size high", { perPage: 201 }, "integer from 1 to 200"],
    [
      "relation sort",
      { defaultSort: { field: "tenant", direction: "asc" } },
      "scalar field",
    ],
    [
      "sort direction",
      { defaultSort: { field: "email", direction: "up" } },
      'must be "asc" or "desc"',
    ],
    [
      "plural name",
      { pluralName: "bad path" },
      "letters, numbers, and hyphens",
    ],
    ["display field", { displayField: "missing" }, "does not exist"],
  ] as Array<[string, ModelConfig, string]>)(
    "rejects invalid %s configuration",
    async (_name, config, message) => {
      await expect(initializeUser(config)).rejects.toThrow(message);
    },
  );

  it("rejects duplicate plural names", async () => {
    const registry = new AdminRegistry();
    registry.register("User", { pluralName: "records" });
    registry.register("Tenant", { pluralName: "records" });
    await expect(registry.initialize(modelMeta)).rejects.toThrow(
      'duplicates the pluralName "records"',
    );
  });

  it("requires explicit production permissions", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(initializeUser()).rejects.toThrow(
      "requires explicit permissions in production",
    );
    await expect(initializeUser({ permissions: {} })).resolves.toBeInstanceOf(
      AdminRegistry,
    );
  });

  it.each([
    [validAction({ name: "delete_selected" }), "reserved"],
    [validAction({ name: "Publish" }), "lowercase letters"],
    [validAction({ label: "   " }), "must have a label"],
    [
      { ...validAction(), handler: undefined } as unknown as AdminAction,
      "must define a handler",
    ],
  ])("rejects an invalid action", async (action, message) => {
    await expect(initializeUser({ actions: [action] })).rejects.toThrow(
      message,
    );
  });

  it("rejects duplicate action names", async () => {
    await expect(
      initializeUser({ actions: [validAction(), validAction()] }),
    ).rejects.toThrow("defines the action");
  });

  it("accepts valid actions", async () => {
    const registry = await initializeUser({ actions: [validAction()] });
    expect(registry.get("User")?.raw.actions).toHaveLength(1);
  });
});
