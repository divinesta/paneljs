import { describe, expect, it } from "vitest";

import { RequestValidationError, parseRecordId } from "../src/index.js";
import { field, userMeta } from "./fixtures.js";

describe("record id parsing", () => {
  it("keeps string ids unchanged", () => {
    expect(parseRecordId(userMeta, "user-001")).toBe("user-001");
  });

  it.each([
    ["0", 0],
    ["42", 42],
    ["-12", -12],
  ])("parses integer id %s", (raw, expected) => {
    const meta = {
      ...userMeta,
      fields: [field("id", { type: "number", nativeType: "Int", isId: true })],
    };
    expect(parseRecordId(meta, raw)).toBe(expected);
  });

  it.each(["01", "1.5", "1e3", "+1", "Infinity", "abc"])(
    "rejects invalid integer id %s",
    (raw) => {
      const meta = {
        ...userMeta,
        fields: [
          field("id", { type: "number", nativeType: "Int", isId: true }),
        ],
      };
      expect(() => parseRecordId(meta, raw)).toThrow(RequestValidationError);
    },
  );

  it("rejects unsafe integers", () => {
    const meta = {
      ...userMeta,
      fields: [field("id", { type: "number", nativeType: "Int", isId: true })],
    };
    expect(() => parseRecordId(meta, "9007199254740992")).toThrow(
      "safe integer",
    );
  });
});
