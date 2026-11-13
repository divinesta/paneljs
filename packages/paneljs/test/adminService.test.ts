import { describe, expect, it, vi } from "vitest";

import {
  AdminService,
  createAdmin,
  validateSelectedIds,
  type DataAdapter,
  type FindManyQuery,
  type ModelConfig,
} from "../src/index.js";
import { adapterFor, adminUser, emptyResource, modelMeta } from "./fixtures.js";

describe("AdminService selected IDs", () => {
  it("accepts a non-empty unique selection", () => {
    expect(() => validateSelectedIds(["one", "two"])).not.toThrow();
  });

  it("rejects empty, duplicate, and oversized selections", () => {
    expect(() => validateSelectedIds([])).toThrow("at least one");
    expect(() => validateSelectedIds(["one", "one"])).toThrow("unique");
    expect(() =>
      validateSelectedIds(Array.from({ length: 101 }, (_, index) => index)),
    ).toThrow("at most 100");
  });
});

describe("Admin service lifecycle", () => {
  it("is owned by Admin and becomes available after initialization", async () => {
    const adapter: DataAdapter = {
      client: {},
      introspect: async () => new Map(),
      resource: () => {
        throw new Error("No models are registered in this lifecycle test.");
      },
    };
    const admin = createAdmin({
      adapter,
      auth: { getCurrentUser: async () => null },
    });

    expect(() => admin.service).toThrow("before admin.initialize");
    await admin.initialize();
    expect(admin.service).toBeInstanceOf(AdminService);
  });
});

describe("AdminService list filters and search", () => {
  async function listWith(
    input: Parameters<AdminService["list"]>[2],
    config: ModelConfig = {},
  ) {
    const findMany = vi.fn().mockResolvedValue([]);
    const admin = createAdmin({
      adapter: adapterFor(modelMeta, emptyResource({ findMany })),
      auth: { getCurrentUser: async () => null },
    });
    admin.register("User", config);
    admin.register("Tenant");
    await admin.initialize();
    const model = admin.registry.get("User")!;
    await admin.service.list(model, adminUser, input);
    return findMany.mock.calls[0]?.[0] as FindManyQuery;
  }

  it("resolves a relation filter before it reaches the adapter", async () => {
    const query = await listWith({
      filter: { path: ["tenant", "name"], op: "equals", value: "Acme" },
    });
    expect(query.filter).toEqual({
      kind: "condition",
      relations: [{ field: "tenant", many: false }],
      field: "name",
      target: "scalar",
      op: "equals",
      value: "Acme",
    });
  });

  it("resolves search text against the configured fields", async () => {
    const query = await listWith(
      { search: "  ada " },
      { searchFields: ["email", "^tenant__name"] },
    );
    expect(query.search).toEqual({
      text: "ada",
      fields: [
        { relations: [], field: "email", mode: "contains" },
        {
          relations: [{ field: "tenant", many: false }],
          field: "name",
          mode: "startsWith",
        },
      ],
    });
  });

  it("rejects over-long search and models with nothing to search", async () => {
    await expect(listWith({ search: "x".repeat(201) })).rejects.toThrow(
      "200 characters or fewer",
    );
    await expect(
      listWith({ search: "ada" }, { searchFields: [] }),
    ).rejects.toThrow('Model "User" has no searchable fields');
  });
});
