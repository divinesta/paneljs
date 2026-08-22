import { describe, expect, it } from "vitest";

import { idSelect, withSelectFields } from "../src/query.js";

describe("field selections", () => {
  it("creates a primary-key-only selection", () => {
    expect(idSelect("userId")).toEqual({
      fields: ["userId"],
      relations: [],
    });
  });

  it("adds scalar fields without duplicates or relation changes", () => {
    const original = {
      fields: ["id", "email"],
      relations: [{ field: "tenant", displayField: "name" }],
    };

    expect(
      withSelectFields(original, ["createdAt", "id", "createdAt"]),
    ).toEqual({
      fields: ["id", "email", "createdAt"],
      relations: [{ field: "tenant", displayField: "name" }],
    });
    expect(original.fields).toEqual(["id", "email"]);
  });
});
