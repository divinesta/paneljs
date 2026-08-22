import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { clearIntrospectionCache, introspect } from "../src/index.js";

const schemaPath = fileURLToPath(
  new URL("./fixture/schema.prisma", import.meta.url),
);

describe("Prisma metadata normalization", () => {
  it("reports a primary key as unique even without a separate @unique", async () => {
    clearIntrospectionCache();
    const metadata = await introspect({ schemaPath });
    const id = metadata
      .get("User")
      ?.fields.find((field) => field.name === "id");

    expect(id).toMatchObject({ isId: true, isUnique: true });
  });
});
