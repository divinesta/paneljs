import { describe, expect, it } from "vitest";

import {
  RequestValidationError,
  assertRequiredCreateFields,
  isFieldVisible,
  isFieldWritable,
  isSensitiveFieldName,
  validateHookPayload,
  validateWritePayload,
  type AdminModelMeta,
  type ModelConfig,
} from "../src/index.js";
import { field, adminUser, superAdminUser, userMeta } from "./fixtures.js";

const valueMeta: AdminModelMeta = {
  ...userMeta,
  fields: [
    field("id", { isId: true, isReadOnly: true }),
    field("name"),
    field("optional", { isRequired: false }),
    field("count", { type: "number", nativeType: "Int", isSearchable: false }),
    field("amount", {
      type: "number",
      nativeType: "Decimal",
      isSearchable: false,
    }),
    field("big", { type: "number", nativeType: "BigInt", isSearchable: false }),
    field("active", {
      type: "boolean",
      nativeType: "Boolean",
      isSearchable: false,
    }),
    field("happenedAt", {
      type: "datetime",
      nativeType: "DateTime",
      isSearchable: false,
    }),
    field("status", {
      type: "enum",
      nativeType: "Status",
      enumValues: ["DRAFT", "ACTIVE"],
      isSearchable: false,
    }),
    field("settings", {
      type: "json",
      nativeType: "Json",
      isSearchable: false,
    }),
    field("blob", { type: "bytes", nativeType: "Bytes", isSearchable: false }),
    field("generated", { isReadOnly: true, defaultValue: "generated" }),
    field("relation", {
      type: "relation",
      nativeType: "Other",
      isReadOnly: true,
      isSearchable: false,
    }),
  ],
};

describe("field visibility and write access", () => {
  it.each([
    "password",
    "passwordHash",
    "sessionToken",
    "api_key",
    "client-secret",
    "credentialData",
    "privateKey",
  ])("detects sensitive field name %s", (name) => {
    expect(isSensitiveFieldName(name)).toBe(true);
  });

  it("does not classify ordinary fields as sensitive", () => {
    expect(isSensitiveFieldName("displayName")).toBe(false);
  });

  it("hides excluded and sensitive fields unless explicitly exposed", () => {
    const password = field("passwordHash");
    const email = field("email");

    expect(isFieldVisible(password, {})).toBe(false);
    expect(
      isFieldVisible(password, { fields: { passwordHash: { expose: true } } }),
    ).toBe(true);
    expect(
      isFieldVisible(email, { fields: { email: { exclude: true } } }),
    ).toBe(false);
  });

  it("rejects relation, list, read-only, configured read-only, and hidden writes", () => {
    expect(
      isFieldWritable(field("relation", { type: "relation" }), {}, adminUser),
    ).toBe(false);
    expect(
      isFieldWritable(field("tags", { isList: true }), {}, adminUser),
    ).toBe(false);
    expect(
      isFieldWritable(field("createdAt", { isReadOnly: true }), {}, adminUser),
    ).toBe(false);
    expect(
      isFieldWritable(
        field("email"),
        { fields: { email: { readOnly: true } } },
        adminUser,
      ),
    ).toBe(false);
    expect(isFieldWritable(field("passwordHash"), {}, adminUser)).toBe(false);
  });

  it("enforces field write roles with a super-admin bypass", () => {
    const config: ModelConfig = {
      fields: { email: { writeRoles: ["EDITOR"] } },
    };
    expect(isFieldWritable(field("email"), config, adminUser)).toBe(false);
    expect(isFieldWritable(field("email"), config, superAdminUser)).toBe(true);
  });

  it.each(["role", "isActive", "isSuperAdmin"])(
    "protects %s from ordinary administrators by default",
    (name) => {
      expect(isFieldWritable(field(name), {}, adminUser)).toBe(false);
      expect(isFieldWritable(field(name), {}, superAdminUser)).toBe(true);
    },
  );
});

describe("write payload validation", () => {
  it("accepts and preserves supported scalar values", () => {
    const data = validateWritePayload(valueMeta, {}, adminUser, {
      name: "PanelJS",
      optional: null,
      count: 2,
      amount: "12.50",
      big: "9007199254740993",
      active: true,
      happenedAt: "2026-08-22T12:00:00.000Z",
      status: "ACTIVE",
      settings: { theme: "dark", flags: [true, null] },
      blob: "YWJj",
    });

    expect(data).toEqual({
      name: "PanelJS",
      optional: null,
      count: 2,
      amount: "12.50",
      big: "9007199254740993",
      active: true,
      happenedAt: "2026-08-22T12:00:00.000Z",
      status: "ACTIVE",
      settings: { theme: "dark", flags: [true, null] },
      blob: "YWJj",
    });
  });

  it.each([
    [null, "Request body must be a JSON object"],
    [[], "Request body must be a JSON object"],
    ["text", "Request body must be a JSON object"],
  ])("rejects non-object body %#", (body, message) => {
    expect(() => validateWritePayload(valueMeta, {}, adminUser, body)).toThrow(
      message,
    );
  });

  it.each([
    [{ missing: "value" }, 'Field "missing" cannot be written'],
    [{ id: "new-id" }, 'Field "id" cannot be written'],
    [{ generated: "value" }, 'Field "generated" cannot be written'],
    [{ relation: {} }, 'Field "relation" cannot be written'],
  ])("rejects an unwritable property %#", (body, message) => {
    expect(() => validateWritePayload(valueMeta, {}, adminUser, body)).toThrow(
      message,
    );
  });

  it.each([
    ["name", 1, "must be a string"],
    ["name", null, "cannot be null"],
    ["count", "2", "must be a finite number"],
    ["count", Number.NaN, "must be a finite number"],
    ["amount", 12.5, "must be a decimal string"],
    ["amount", "1e5", "must be a decimal string"],
    ["active", "true", "must be a boolean"],
    ["happenedAt", "not-a-date", "must be an ISO date-time string"],
    ["status", "ARCHIVED", "must be a valid Status value"],
    ["settings", undefined, "must be valid JSON data"],
    ["settings", Number.POSITIVE_INFINITY, "must be valid JSON data"],
    ["blob", 123, "must be a string"],
  ])("rejects invalid %s value", (name, value, message) => {
    expect(() =>
      validateWritePayload(valueMeta, {}, adminUser, { [name]: value }),
    ).toThrow(message);
  });

  it("rejects excessively deep JSON", () => {
    let value: Record<string, unknown> = {};
    for (let index = 0; index < 22; index += 1) value = { child: value };
    expect(() =>
      validateWritePayload(valueMeta, {}, adminUser, { settings: value }),
    ).toThrow("must be valid JSON data");
  });

  it("applies current-user field permissions", () => {
    const config: ModelConfig = {
      fields: { name: { writeRoles: ["SUPER_ADMIN"] } },
    };
    expect(() =>
      validateWritePayload(valueMeta, config, adminUser, { name: "No" }),
    ).toThrow('Field "name" cannot be written');
    expect(
      validateWritePayload(valueMeta, config, superAdminUser, { name: "Yes" }),
    ).toEqual({
      name: "Yes",
    });
  });
});

describe("hook payload and required fields", () => {
  it("allows hooks to write scalar fields without caller role checks", () => {
    expect(
      validateHookPayload(valueMeta, { name: "Hook", active: false }),
    ).toEqual({
      name: "Hook",
      active: false,
    });
  });

  it("still rejects invalid hook output", () => {
    expect(() => validateHookPayload(valueMeta, [])).toThrow(
      "Hook output must be a JSON object",
    );
    expect(() => validateHookPayload(valueMeta, { id: "changed" })).toThrow(
      'Hook output field "id" cannot be written',
    );
    expect(() => validateHookPayload(valueMeta, { active: "no" })).toThrow(
      'Field "active" must be a boolean',
    );
  });

  it("identifies required create fields without defaults", () => {
    expect(() =>
      assertRequiredCreateFields(valueMeta, {}, adminUser, {}),
    ).toThrow('Field "name" is required');
  });

  it("ignores optional, generated, read-only, and relation fields", () => {
    const meta: AdminModelMeta = {
      ...valueMeta,
      fields: valueMeta.fields.filter((candidate) => candidate.name !== "name"),
    };
    expect(() =>
      assertRequiredCreateFields(meta, {}, adminUser, {
        count: 1,
        amount: "1.00",
        big: "1",
        active: true,
        happenedAt: "2026-08-22T00:00:00.000Z",
        status: "DRAFT",
        settings: {},
        blob: "",
      }),
    ).not.toThrow();
  });
});
