import { describe, expect, it } from "vitest";

import {
  RequestValidationError,
  applyCreateScope,
  assertScopeFieldsUnchanged,
  buildScopedRecordWhere,
  collectScopeFieldNames,
  resolveScope,
} from "../src/index.js";
import { adminUser } from "./fixtures.js";

describe("scope resolution", () => {
  it("returns an empty scope when none is configured", async () => {
    await expect(resolveScope({}, adminUser)).resolves.toEqual({});
  });

  it("passes the administrator to the configured scope", async () => {
    await expect(
      resolveScope(
        { scope: async (user) => ({ tenantId: user.tenantId }) },
        adminUser,
      ),
    ).resolves.toEqual({ tenantId: "tenant-a" });
  });

  it("rejects undefined values at any depth", async () => {
    await expect(
      resolveScope(
        {
          scope: async () => ({
            AND: [{ tenantId: "tenant-a" }, { owner: { id: undefined } }],
          }),
        },
        adminUser,
      ),
    ).rejects.toThrow('Scope field "AND.1.owner.id" resolved to undefined');
  });
});

describe("scoped writes", () => {
  it("combines scope and id without overwriting either", () => {
    expect(
      buildScopedRecordWhere({ id: "scope-id" }, "id", "record-id"),
    ).toEqual({
      AND: [{ id: "scope-id" }, { id: "record-id" }],
    });
  });

  it("injects simple scope values into a new record", () => {
    expect(
      applyCreateScope(
        { title: "Hello" },
        { tenantId: "tenant-a", active: true },
      ),
    ).toEqual({ title: "Hello", tenantId: "tenant-a", active: true });
  });

  it("accepts an identical caller-provided scope value", () => {
    expect(
      applyCreateScope(
        { title: "Hello", tenantId: "tenant-a" },
        { tenantId: "tenant-a" },
      ),
    ).toEqual({ title: "Hello", tenantId: "tenant-a" });
  });

  it("rejects a conflicting create value", () => {
    expect(() =>
      applyCreateScope({ tenantId: "tenant-b" }, { tenantId: "tenant-a" }),
    ).toThrow(RequestValidationError);
  });

  it("rejects complex scope injection", () => {
    expect(() => applyCreateScope({}, { tenant: { id: "tenant-a" } })).toThrow(
      'Cannot apply complex scope field "tenant"',
    );
  });

  it("collects scalar fields from logical and nested scope trees", () => {
    expect([
      ...collectScopeFieldNames({
        AND: [
          { tenantId: "tenant-a" },
          { OR: [{ status: "ACTIVE" }, { owner: { id: "admin-1" } }] },
        ],
      }),
    ]).toEqual(["tenantId", "status", "owner", "id"]);
  });

  it("rejects updates to every field used by the scope", () => {
    expect(() =>
      assertScopeFieldsUnchanged(
        { owner: "another-owner" },
        { order: { owner: "admin-1" } },
      ),
    ).toThrow('Field "owner" is controlled by the configured scope');
  });

  it("allows updates unrelated to the scope", () => {
    expect(() =>
      assertScopeFieldsUnchanged(
        { title: "Updated" },
        { tenantId: "tenant-a" },
      ),
    ).not.toThrow();
  });
});
