import {
  defineAdapterContract,
  defineAdminBehaviorContract,
  defineAuthStoreContract,
  defineReferentialBehaviorContract,
} from "@paneljs/testkit";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaContractDatabase } from "./environment.js";

describe.sequential("Prisma PostgreSQL integration", () => {
  let database: PrismaContractDatabase;

  beforeAll(async () => {
    database = await PrismaContractDatabase.start();
  }, 120_000);

  afterAll(async () => {
    await database?.stop();
  }, 30_000);

  defineAdapterContract({
    name: "Prisma PostgreSQL",
    async create() {
      return database.adapterEnvironment();
    },
  });

  defineAuthStoreContract({
    name: "Prisma PostgreSQL",
    async create() {
      return database.authEnvironment();
    },
  });

  defineAdminBehaviorContract({
    name: "Prisma PostgreSQL core service",
    async create() {
      return database.adminBehaviorEnvironment();
    },
  });

  defineReferentialBehaviorContract({
    name: "Prisma PostgreSQL core service",
    async create() {
      return database.referentialBehaviorEnvironment();
    },
  });

  // Prisma-specific: these pin down behaviour of Prisma itself (LIKE escaping,
  // driver-adapter error shapes), so they live here rather than in testkit.
  describe("Prisma PostgreSQL search and write errors", () => {
    const select = { fields: ["id", "title"], relations: [] };
    let author: { id: string; tenantId: string };

    async function postResource() {
      const models = await database.adapter.introspect();
      return database.adapter.resource(models.get("Post")!);
    }

    beforeEach(async () => {
      await database.adapterEnvironment().reset();
      author = (await database.prisma.user.findFirstOrThrow({
        select: { id: true, tenantId: true },
      })) as { id: string; tenantId: string };
      await database.prisma.post.deleteMany();
      await database.prisma.post.createMany({
        data: [
          "100% done",
          "100 done",
          "a_b",
          "axb",
          "back\\slash",
          "backxslash",
        ].map((title) => ({
          title,
          authorId: author.id,
          tenantId: author.tenantId,
        })),
      });
    });

    async function search(text: string) {
      const resource = await postResource();
      const rows = await resource.findMany({
        scope: {},
        search: {
          text,
          fields: [{ relations: [], field: "title", mode: "contains" }],
        },
        sort: { field: "title", direction: "asc" },
        select,
      });
      return rows.map((row) => row.title);
    }

    it("matches %, _ and backslash in search text literally", async () => {
      expect(await search("%")).toEqual(["100% done"]);
      expect(await search("100%")).toEqual(["100% done"]);
      expect(await search("_")).toEqual(["a_b"]);
      expect(await search("a_b")).toEqual(["a_b"]);
      expect(await search("\\")).toEqual(["back\\slash"]);
    });

    it("names the foreign key when create points at a missing record", async () => {
      const resource = await postResource();
      await expect(
        resource.create({
          data: { title: "t", authorId: "missing", tenantId: author.tenantId },
          select,
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", field: "authorId" });
    });

    it("says still-referenced when deleting a referenced record", async () => {
      const models = await database.adapter.introspect();
      const users = database.adapter.resource(models.get("User")!);
      await expect(
        users.deleteMany({ scope: {}, id: author.id }),
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        message: expect.stringContaining("Cannot delete"),
      });
    });

    it("names the field of a unique violation", async () => {
      const models = await database.adapter.introspect();
      const users = database.adapter.resource(models.get("User")!);
      const existing = await database.prisma.user.findFirstOrThrow({
        where: { NOT: { id: author.id } },
      });
      await expect(
        users.updateMany({
          scope: {},
          id: author.id,
          data: { email: existing.email },
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", field: "email" });
    });
  });

  // Step 3: the filter tree and relation paths, on a real database.
  describe("Prisma PostgreSQL relation filters", () => {
    const select = { fields: ["id", "title"], relations: [] };
    let ada: { id: string; email: string; tenantId: string };
    let grace: { id: string; email: string };

    async function resource(model: string) {
      const models = await database.adapter.introspect();
      return database.adapter.resource(models.get(model)!);
    }

    beforeEach(async () => {
      await database.adapterEnvironment().reset();
      await database.prisma.post.deleteMany();
      const users = await database.prisma.user.findMany({
        orderBy: { email: "asc" },
      });
      ada = users[0]!;
      grace = users[1]!;
      await database.prisma.post.createMany({
        data: [
          { title: "Ada one", authorId: ada.id, tenantId: ada.tenantId },
          { title: "Ada 50% two", authorId: ada.id, tenantId: ada.tenantId },
          { title: "Grace one", authorId: grace.id, tenantId: ada.tenantId },
        ],
      });
    });

    const authorEmail = (op: "equals" | "startsWith", value: string) => ({
      kind: "condition" as const,
      relations: [{ field: "author", many: false }],
      field: "email",
      target: "scalar" as const,
      op,
      value,
    });

    async function postTitles(query: Record<string, unknown>) {
      const posts = await resource("Post");
      const rows = await posts.findMany({
        scope: {},
        sort: { field: "title", direction: "asc" },
        select,
        ...query,
      });
      return rows.map((row) => row.title);
    }

    it("filters through a to-one relation", async () => {
      expect(
        await postTitles({ filter: authorEmail("equals", ada.email) }),
      ).toEqual(["Ada 50% two", "Ada one"]);
    });

    it("combines or and not", async () => {
      expect(
        await postTitles({
          filter: {
            kind: "or",
            nodes: [
              { kind: "not", node: authorEmail("equals", ada.email) },
              {
                kind: "condition",
                relations: [],
                field: "title",
                target: "scalar",
                op: "contains",
                value: "50%",
              },
            ],
          },
        }),
      ).toEqual(["Ada 50% two", "Grace one"]);
    });

    it("matches some / none across a list relation", async () => {
      const users = await resource("User");
      const emails = async (quantifier: "some" | "none") =>
        (
          await users.findMany({
            scope: { tenantId: ada.tenantId },
            filter: {
              kind: "relation",
              relations: [],
              field: "posts",
              quantifier,
              where: {
                kind: "condition",
                relations: [],
                field: "title",
                target: "scalar",
                op: "startsWith",
                value: "ada",
              },
            },
            sort: { field: "email", direction: "asc" },
            select: { fields: ["email"], relations: [] },
          })
        ).map((row) => row.email);
      expect(await emails("some")).toEqual([ada.email]);
      expect(await emails("none")).not.toContain(ada.email);
    });

    it("searches across a relation", async () => {
      const posts = await resource("Post");
      const rows = await posts.findMany({
        scope: {},
        search: {
          text: grace.email.slice(0, 4),
          fields: [
            {
              relations: [{ field: "author", many: false }],
              field: "email",
              mode: "startsWith",
            },
          ],
        },
        select,
      });
      expect(rows.map((row) => row.title)).toEqual(["Grace one"]);
    });
  });
});
