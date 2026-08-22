import { describe, expect, it } from "vitest";

import {
  CascadeChildEntity,
  ExpressAdminSessionEntity,
  NullableChildEntity,
  ProtectedChildEntity,
  contractEntities,
} from "./entities.js";

describe("TypeORM contract fixture", () => {
  it("exports every canonical and built-in auth entity", () => {
    expect(contractEntities.map((entity) => entity.options.name)).toEqual([
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
    expect(CascadeChildEntity.options.relations?.tenant?.onDelete).toBe(
      "CASCADE",
    );
    expect(NullableChildEntity.options.relations?.tenant?.onDelete).toBe(
      "SET NULL",
    );
    expect(ProtectedChildEntity.options.relations?.tenant?.onDelete).toBe(
      "RESTRICT",
    );
  });

  it("cascades sessions when an auth user is removed", () => {
    expect(ExpressAdminSessionEntity.options.relations?.user?.onDelete).toBe(
      "CASCADE",
    );
  });
});
