import { describe, expect, it } from "vitest";

import {
  CONTRACT_SEED_TIME,
  createAuthStoreSeed,
  createContractSeedData,
} from "../src/index.js";

describe("canonical contract seed", () => {
  it("contains both tenants, three posts, and every referential action", () => {
    const data = createContractSeedData();

    expect(data.tenants).toHaveLength(2);
    expect(data.users).toHaveLength(2);
    expect(data.posts).toHaveLength(3);
    expect(data.cascadeChildren).toHaveLength(1);
    expect(data.nullableChildren).toHaveLength(1);
    expect(data.protectedChildren).toHaveLength(1);
    expect(data.users[0]?.createdAt).toEqual(CONTRACT_SEED_TIME);
    expect(data.references.userA).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("returns independent mutable copies", () => {
    const first = createContractSeedData();
    const second = createContractSeedData();

    first.tenants[0]!.name = "Changed";
    first.users[0]!.createdAt.setUTCFullYear(2030);

    expect(second.tenants[0]?.name).toBe("Tenant A");
    expect(second.users[0]?.createdAt).toEqual(CONTRACT_SEED_TIME);
  });

  it.each(["email", "username"] as const)(
    "creates a built-in auth seed for %s login",
    (identifier) => {
      const seed = createAuthStoreSeed(identifier);

      expect(seed.user[identifier]).toBe(seed.identifierValue);
      expect(seed.user.isActive).toBe(true);
      expect(seed.missingIdentifier).not.toBe(seed.identifierValue);
    },
  );
});
