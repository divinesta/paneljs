import { describe, expect, it } from "vitest";

import {
  AdminRegistry,
  RequestValidationError,
  parseListQuery,
  resolveFilter,
  resolveSearchFields,
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
      filter: undefined,
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

/** Parse, then validate the way AdminService.list does. */
async function parseAndResolve(query: QueryMap, config: ModelConfig = {}) {
  const model = await registeredUser({
    listFilter: ["role", "isActive", "tenantId", "createdAt"],
    ...config,
  });
  const parsed = parseListQuery(query, userMeta, model);
  return parsed.filter
    ? resolveFilter(parsed.filter, model, new Map([["User", model]]))
    : undefined;
}

describe("list filters", () => {
  it("parses configured filters into an AND of equality conditions", async () => {
    const result = await parse({ role: "ADMIN", isActive: "false" });

    expect(result.filter).toEqual({
      and: [
        { path: ["role"], op: "equals", value: "ADMIN" },
        { path: ["isActive"], op: "equals", value: "false" },
      ],
    });
  });

  it("converts values by field type when resolved", async () => {
    const resolved = await parseAndResolve({
      role: "ADMIN",
      isActive: "false",
      tenantId: "tenant-a",
      createdAt: "2026-08-22T12:00:00.000Z",
    });

    expect(resolved).toEqual({
      kind: "and",
      nodes: [
        expect.objectContaining({
          field: "role",
          op: "equals",
          value: "ADMIN",
        }),
        expect.objectContaining({ field: "isActive", value: false }),
        expect.objectContaining({ field: "tenantId", value: "tenant-a" }),
        expect.objectContaining({
          field: "createdAt",
          value: new Date("2026-08-22T12:00:00.000Z"),
        }),
      ],
    });
  });

  it("reads an operator suffix and keeps the old _gte/_lte spelling", async () => {
    const result = await parse({
      createdAt__gte: "2026-01-01T00:00:00.000Z",
      createdAt_lte: "2026-12-31T23:59:59.999Z",
      role__in: "ADMIN, USER",
      tenantId__isNull: "true",
    });

    expect(result.filter).toEqual({
      and: [
        { path: ["createdAt"], op: "gte", value: "2026-01-01T00:00:00.000Z" },
        { path: ["createdAt"], op: "lte", value: "2026-12-31T23:59:59.999Z" },
        { path: ["role"], op: "in", value: ["ADMIN", "USER"] },
        { path: ["tenantId"], op: "isNull", value: "true" },
      ],
    });
  });

  it.each([
    [{ role: "OWNER" }, "valid Role value"],
    [{ isActive: "yes" }, 'must be "true" or "false"'],
    [{ createdAt: "not-a-date" }, "ISO date-time"],
    [{ isActive__gt: "true" }, 'does not support "gt"'],
    [{ role__in: " , " }, "at least one value"],
  ] as Array<[QueryMap, string]>)(
    "rejects an invalid value or operator %#",
    async (query, message) => {
      await expect(parseAndResolve(query)).rejects.toThrow(message);
    },
  );

  it.each([
    [{ email: "ada@example.test" }],
    [{ missing: "value" }],
    [{ email__contains: "ada" }],
    [{ tenant__name: "Acme" }],
  ] as Array<[QueryMap]>)(
    "rejects a parameter outside listFilter %#",
    async (query) => {
      await expect(parse(query)).rejects.toThrow("is not allowed");
    },
  );

  it("rejects repeated filter parameters", async () => {
    await expect(parse({ role: ["ADMIN", "USER"] })).rejects.toThrow(
      'Query parameter "role" must be a single string value',
    );
  });
});

describe("list search", () => {
  it("passes trimmed search text through", async () => {
    await expect(parse({ search: "  Ada  " })).resolves.toMatchObject({
      search: "Ada",
    });
  });

  it("ignores whitespace-only search", async () => {
    await expect(parse({ search: "   " })).resolves.toMatchObject({
      search: undefined,
    });
  });

  it("resolves configured search fields, leaving out excluded ones", async () => {
    const model = await registeredUser({
      fields: { email: { exclude: true } },
    });
    expect(
      resolveSearchFields(
        model,
        model.resolved.searchFields,
        new Map([["User", model]]),
      ),
    ).toEqual([{ relations: [], field: "fullName", mode: "contains" }]);
  });

  it("reads ^ and = prefixes as startsWith and equals", async () => {
    const model = await registeredUser({
      searchFields: ["^email", "=fullName"],
    });
    expect(
      resolveSearchFields(
        model,
        model.resolved.searchFields,
        new Map([["User", model]]),
      ),
    ).toEqual([
      { relations: [], field: "email", mode: "startsWith" },
      { relations: [], field: "fullName", mode: "equals" },
    ]);
  });
});
