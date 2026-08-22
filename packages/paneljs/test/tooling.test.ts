import { describe, expect, it } from "vitest";

import { idSelect, withSelectFields } from "../src/query.js";

describe("test tooling", () => {
  it("runs TypeScript tests against PanelJS source", () => {
    const select = withSelectFields(idSelect("id"), ["createdAt", "id"]);

    expect(select).toEqual({
      fields: ["id", "createdAt"],
      relations: [],
    });
  });
});
