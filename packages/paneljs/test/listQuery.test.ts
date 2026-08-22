import { describe, expect, it } from "vitest";

import {
  AdminRegistry,
  RequestValidationError,
  parseListQuery,
  type FullRegisteredModel,
  type ModelConfig,
} from "../src/index.js";
import type { QueryMap } from "../src/listQuery.js";
import { userMeta } from "./fixtures.js";

async function registeredUser(
  config: ModelConfig = {},
): Promise<FullRegisteredModel> {
  const registry = new AdminRegistry();
  registry.register("User", config);
  await registry.initialize(new Map([["User", userMeta]]));
  return registry.get("User")!;
}

async function parse(query: QueryMap, config: ModelConfig = {}) {
  const model = await registeredUser({
    listFilter: ["role", "isActive", "tenantId", "createdAt"],
    ...config,
  });
  return parseListQuery(query, userMeta, model);
}

describe("list query defaults", () => {
  it("uses page one and the resolved model sort", async () => {
    await expect(parse({})).resolves.toEqual({
      page: 1,
      sort: "createdAt",
      dir: "desc",
      filters: {},
      search: undefined,
    });
  });

  it("accepts a valid page and visible scalar sort", async () => {
    await expect(
      parse({ page: "3", sort: "email", dir: "asc" }),
    ).resolves.toMatchObject({ page: 3, sort: "email", dir: "asc" });
  });

  it.each(["0", "-1", "1.5", "nope", "10001"])(
    "rejects invalid page %s",
    async (page) => {
      await expect(parse({ page })).rejects.toThrow(RequestValidationError);
    },
  );

  it("rejects repeated scalar query parameters", async () => {
    await expect(parse({ page: ["1", "2"] })).rejects.toThrow(
      'Query parameter "page" must be a single string value',
    );
  });

  it("rejects relation, hidden, and unknown sort fields", async () => {
    await expect(parse({ sort: "tenant" })).rejects.toThrow(
      "cannot be used for sorting",
    );
    await expect(parse({ sort: "passwordHash" })).rejects.toThrow(
      "cannot be used for sorting",
    );
    await expect(parse({ sort: "missing" })).rejects.toThrow(
      "cannot be used for sorting",
    );
  });

  it("rejects an invalid sort direction", async () => {
    await expect(parse({ dir: "sideways" })).rejects.toThrow(
      'must be either "asc" or "desc"',
    );
  });
});

describe("list filters", () => {
  it("parses configured equality filters by field type", async () => {
    const result = await parse({
      role: "ADMIN",
      isActive: "false",
      tenantId: "tenant-a",
      createdAt: "2026-08-22T12:00:00.000Z",
    });

    expect(result.filters).toEqual({
      role: { equals: "ADMIN" },
      isActive: { equals: false },
      tenantId: { equals: "tenant-a" },
      createdAt: { equals: new Date("2026-08-22T12:00:00.000Z") },
    });
  });

  it("combines datetime range boundaries", async () => {
    const result = await parse({
      createdAt_gte: "2026-01-01T00:00:00.000Z",
      createdAt_lte: "2026-12-31T23:59:59.999Z",
    });

    expect(result.filters.createdAt).toEqual({
      gte: new Date("2026-01-01T00:00:00.000Z"),
      lte: new Date("2026-12-31T23:59:59.999Z"),
    });
  });

  it.each([
    [{ role: "OWNER" }, "valid Role value"],
    [{ isActive: "yes" }, 'must be "true" or "false"'],
    [{ createdAt: "not-a-date" }, "ISO date-time"],
    [{ tenantId_gte: "a" }, "only supported for date-time"],
    [{ email: "ada@example.test" }, "is not allowed"],
    [{ missing: "value" }, "is not allowed"],
  ] as Array<[QueryMap, string]>)(
    "rejects invalid filter %#",
    async (query, message) => {
      await expect(parse(query)).rejects.toThrow(message);
    },
  );

  it("rejects repeated filter parameters", async () => {
    await expect(parse({ role: ["ADMIN", "USER"] })).rejects.toThrow(
      'Query parameter "role" must be a single string value',
    );
  });
});

describe("list search", () => {
  it("trims search and supplies resolved searchable fields", async () => {
    await expect(parse({ search: "  Ada  " })).resolves.toMatchObject({
      search: { text: "Ada", fields: ["email", "fullName"] },
    });
  });

  it("ignores whitespace-only search", async () => {
    await expect(parse({ search: "   " })).resolves.toMatchObject({
      search: undefined,
    });
  });

  it("rejects search longer than 200 characters", async () => {
    await expect(parse({ search: "x".repeat(201) })).rejects.toThrow(
      "200 characters or fewer",
    );
  });

  it("rejects search when no visible searchable fields remain", async () => {
    await expect(
      parse(
        { search: "Ada" },
        {
          searchFields: [],
        },
      ),
    ).rejects.toThrow('Model "User" has no searchable fields');
  });

  it("removes excluded search fields", async () => {
    const result = await parse(
      { search: "Ada" },
      { fields: { email: { exclude: true } } },
    );
    expect(result.search?.fields).toEqual(["fullName"]);
  });
});
