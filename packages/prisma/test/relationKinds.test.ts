import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import type { AdminModelMeta } from "paneljs";

import { clearIntrospectionCache, introspect } from "../src/index.js";

const schemaPath = fileURLToPath(
  new URL("./fixture-relations/schema.prisma", import.meta.url),
);

let metadata: Map<string, AdminModelMeta>;

function kindOf(model: string, field: string) {
  return metadata
    .get(model)
    ?.fields.find((candidate) => candidate.name === field)?.relation?.kind;
}

describe("Prisma relation kinds", () => {
  beforeAll(async () => {
    clearIntrospectionCache();
    metadata = await introspect({ schemaPath });
  });

  it("labels the side that holds the foreign key as belongsTo", () => {
    expect(kindOf("Post", "author")).toBe("belongsTo");
    expect(kindOf("Profile", "user")).toBe("belongsTo");
  });

  it("labels a single back-reference as hasOne", () => {
    expect(kindOf("User", "profile")).toBe("hasOne");
  });

  it("labels a list whose opposite side is single as hasMany", () => {
    expect(kindOf("User", "posts")).toBe("hasMany");
  });

  it("labels a list whose opposite side is also a list as manyToMany", () => {
    expect(kindOf("Post", "tags")).toBe("manyToMany");
    expect(kindOf("Tag", "posts")).toBe("manyToMany");
  });

  it("handles self-relations on the same model", () => {
    expect(kindOf("User", "followers")).toBe("manyToMany");
    expect(kindOf("User", "following")).toBe("manyToMany");
    expect(kindOf("User", "mentor")).toBe("belongsTo");
    expect(kindOf("User", "mentees")).toBe("hasMany");
  });
});
