import { describe, expect, it } from "vitest";

import {
  CascadeChildEntity,
  ExpressAdminSessionEntity,
  NullableChildEntity,
  ProtectedChildEntity,
  contractEntities,
} from "./entities.js";

describe("MikroORM contract fixture", () => {
  it("exports every canonical and built-in auth entity", () => {
    expect(contractEntities.map((entity) => entity.meta.className)).toEqual([
      "Tenant",
      "User",
      "Post",
      "CascadeChild",
      "NullableChild",
      "ProtectedChild",
      "ExpressAdminUser",
      "ExpressAdminSession",
    ]);
  });

  it("defines the three required referential actions", () => {
    expect(CascadeChildEntity.meta.properties.tenant?.deleteRule).toBe(
      "cascade",
    );
    expect(NullableChildEntity.meta.properties.tenant?.deleteRule).toBe(
      "set null",
    );
    expect(ProtectedChildEntity.meta.properties.tenant?.deleteRule).toBe(
      "restrict",
    );
  });

  it("cascades sessions when an auth user is removed", () => {
    expect(ExpressAdminSessionEntity.meta.properties.user?.deleteRule).toBe(
      "cascade",
    );
  });
});
