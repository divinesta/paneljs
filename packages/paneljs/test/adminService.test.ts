import { describe, expect, it } from "vitest";

import {
  AdminService,
  createAdmin,
  validateSelectedIds,
  type DataAdapter,
} from "../src/index.js";

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
