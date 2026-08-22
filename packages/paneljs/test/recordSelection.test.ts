import { describe, expect, it, vi } from "vitest";

import {
  AdminRegistry,
  PermissionDeniedError,
  RequestValidationError,
  assertSelectedRelationsAreVisible,
  buildListRecordSelect,
  buildRecordSelect,
  type FullRegisteredModel,
  type ModelConfig,
} from "../src/index.js";
import {
  adapterFor,
  adminUser,
  emptyResource,
  modelMeta,
  tenantMeta,
  userMeta,
} from "./fixtures.js";

async function models(
  userConfig: ModelConfig = {},
  tenantConfig: ModelConfig = {},
) {
  const registry = new AdminRegistry();
  registry.register("User", userConfig);
  registry.register("Tenant", tenantConfig);
  await registry.initialize(modelMeta);
  return new Map(
    registry.getAll().map((model) => [model.meta.pluralName, model]),
  );
}

function byName(entries: Map<string, FullRegisteredModel>, name: string) {
  return [...entries.values()].find((model) => model.meta.name === name)!;
}

describe("record projections", () => {
  it("builds a safe detail projection", async () => {
    const entries = await models({ listDisplay: ["email", "tenant"] });
    const select = buildRecordSelect(userMeta, byName(entries, "User"));

    expect(select.fields).toContain("id");
    expect(select.fields).toContain("email");
    expect(select.fields).not.toContain("passwordHash");
    expect(select.relations).toEqual([
      { field: "tenant", displayField: "name" },
    ]);
  });

  it("limits list projection to configured columns plus id", async () => {
    const entries = await models({ listDisplay: ["fullName", "tenant"] });
    expect(buildListRecordSelect(userMeta, byName(entries, "User"))).toEqual({
      fields: ["id", "fullName"],
      relations: [{ field: "tenant", displayField: "name" }],
    });
  });

  it("does not select a sensitive relation display field", async () => {
    const sensitiveMeta = {
      ...userMeta,
      fields: userMeta.fields.map((candidate) =>
        candidate.name === "tenant" && candidate.relation
          ? {
              ...candidate,
              relation: { ...candidate.relation, displayField: "secretToken" },
            }
          : candidate,
      ),
    };
    const registry = new AdminRegistry();
    registry.register("User", { listDisplay: ["tenant"] });
    await registry.initialize(new Map([["User", sensitiveMeta]]));

    expect(
      buildListRecordSelect(sensitiveMeta, registry.get("User")!).relations,
    ).toEqual([]);
  });
});

describe("selected relation safety", () => {
  it("ignores writes that do not include a belongs-to foreign key", async () => {
    const entries = await models();
    const findFirst = vi.fn();
    await expect(
      assertSelectedRelationsAreVisible(
        { email: "new@example.test" },
        byName(entries, "User"),
        entries,
        adapterFor(modelMeta, emptyResource({ findFirst })),
        adminUser,
      ),
    ).resolves.toBeUndefined();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("accepts null for an optional relation without querying", async () => {
    const entries = await models();
    const findFirst = vi.fn();
    await expect(
      assertSelectedRelationsAreVisible(
        { tenantId: null },
        byName(entries, "User"),
        entries,
        adapterFor(modelMeta, emptyResource({ findFirst })),
        adminUser,
      ),
    ).resolves.toBeUndefined();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("loads the related id through its own scope", async () => {
    const entries = await models(
      {},
      {
        scope: async (user) => ({ id: user.tenantId }),
      },
    );
    const findFirst = vi.fn().mockResolvedValue({ id: "tenant-a" });

    await assertSelectedRelationsAreVisible(
      { tenantId: "tenant-a" },
      byName(entries, "User"),
      entries,
      adapterFor(modelMeta, emptyResource({ findFirst })),
      adminUser,
    );

    expect(findFirst).toHaveBeenCalledWith({
      scope: { id: "tenant-a" },
      id: "tenant-a",
      select: { fields: [tenantMeta.idField], relations: [] },
    });
  });

  it("rejects an unavailable related record", async () => {
    const entries = await models();
    await expect(
      assertSelectedRelationsAreVisible(
        { tenantId: "tenant-b" },
        byName(entries, "User"),
        entries,
        adapterFor(),
        adminUser,
      ),
    ).rejects.toThrow("selected Tenant record is unavailable");
  });

  it("requires list permission on the related model", async () => {
    const entries = await models(
      {},
      { permissions: { list: ["SUPER_ADMIN"] } },
    );
    await expect(
      assertSelectedRelationsAreVisible(
        { tenantId: "tenant-a" },
        byName(entries, "User"),
        entries,
        adapterFor(),
        adminUser,
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects a relation to an unregistered model", async () => {
    const registry = new AdminRegistry();
    registry.register("User");
    await registry.initialize(modelMeta);
    const entries = new Map([["users", registry.get("User")!]]);

    await expect(
      assertSelectedRelationsAreVisible(
        { tenantId: "tenant-a" },
        registry.get("User")!,
        entries,
        adapterFor(),
        adminUser,
      ),
    ).rejects.toBeInstanceOf(RequestValidationError);
  });
});
