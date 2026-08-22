import { describe, expect, it } from "vitest";

import {
  hasActionPermission,
  hasModelPermission,
  hasRegisteredActionPermission,
  type AdminAction,
  type ModelPermissions,
} from "../src/index.js";
import { adminUser, superAdminUser } from "./fixtures.js";

const action = (allowedRoles?: string[]): AdminAction => ({
  name: "publish_selected",
  label: "Publish selected",
  allowedRoles,
  async handler() {
    return { message: "Published" };
  },
});

describe("model permissions", () => {
  it("allows reads and denies writes by default", () => {
    expect(hasModelPermission(adminUser, {}, "list")).toBe(true);
    expect(hasModelPermission(adminUser, {}, "view")).toBe(true);
    expect(hasModelPermission(adminUser, {}, "create")).toBe(false);
    expect(hasModelPermission(adminUser, {}, "update")).toBe(false);
    expect(hasModelPermission(adminUser, {}, "delete")).toBe(false);
  });

  it("uses role allowlists", () => {
    const permissions: ModelPermissions = {
      create: ["ADMIN"],
      delete: ["SUPER_ADMIN"],
    };

    expect(hasModelPermission(adminUser, permissions, "create")).toBe(true);
    expect(hasModelPermission(adminUser, permissions, "delete")).toBe(false);
  });

  it("treats an empty allowlist as denied", () => {
    expect(hasModelPermission(adminUser, { list: [] }, "list")).toBe(false);
  });

  it("lets a super-admin bypass every model allowlist", () => {
    expect(
      hasModelPermission(superAdminUser, { list: [], delete: [] }, "list"),
    ).toBe(true);
    expect(
      hasModelPermission(superAdminUser, { list: [], delete: [] }, "delete"),
    ).toBe(true);
  });
});

describe("action permissions", () => {
  it("denies an action with no model allowlist", () => {
    expect(hasActionPermission(adminUser, {}, "publish_selected")).toBe(false);
  });

  it("uses the named model action allowlist", () => {
    expect(
      hasActionPermission(
        adminUser,
        { actions: { publish_selected: ["ADMIN"] } },
        "publish_selected",
      ),
    ).toBe(true);
  });

  it("allows either source when only one action allowlist exists", () => {
    expect(
      hasRegisteredActionPermission(adminUser, {}, action(["ADMIN"])),
    ).toBe(true);
    expect(
      hasRegisteredActionPermission(
        adminUser,
        { actions: { publish_selected: ["ADMIN"] } },
        action(),
      ),
    ).toBe(true);
  });

  it("requires both allowlists when both are configured", () => {
    const permissions = { actions: { publish_selected: ["ADMIN"] } };

    expect(
      hasRegisteredActionPermission(adminUser, permissions, action(["ADMIN"])),
    ).toBe(true);
    expect(
      hasRegisteredActionPermission(adminUser, permissions, action(["EDITOR"])),
    ).toBe(false);
  });

  it("lets a super-admin bypass action allowlists", () => {
    expect(hasRegisteredActionPermission(superAdminUser, {}, action([]))).toBe(
      true,
    );
  });
});
