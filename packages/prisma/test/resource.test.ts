import type { AdminModelMeta } from "paneljs";
import { describe, expect, it, vi } from "vitest";

import { prismaResource, type PrismaDelegate } from "../src/index.js";

function createResource() {
  const delegate = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  } as unknown as PrismaDelegate;
  const meta = { idField: "id" } as AdminModelMeta;
  return { delegate, resource: prismaResource(delegate, meta) };
}

describe("Prisma write targeting", () => {
  it("rejects an update without id or ids", async () => {
    const { delegate, resource } = createResource();

    await expect(
      resource.updateMany({ scope: { tenantId: "tenant-a" }, data: {} }),
    ).rejects.toThrow("id or ids selection");
    expect(delegate.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a delete without id or ids", async () => {
    const { delegate, resource } = createResource();

    await expect(
      resource.deleteMany({ scope: { tenantId: "tenant-a" } }),
    ).rejects.toThrow("id or ids selection");
    expect(delegate.deleteMany).not.toHaveBeenCalled();
  });
});

// Error shapes below are copied from real Prisma 7.5 + PrismaPg errors
// (driver adapter), plus the classic `meta.target` shape.
function prismaError(code: string, meta?: Record<string, unknown>) {
  return Object.assign(new Error(`Prisma ${code}`), { code, meta });
}

function adapterConstraint(constraint: Record<string, unknown>) {
  return { driverAdapterError: { cause: { constraint } } };
}

const postMeta = {
  name: "Post",
  idField: "id",
  fields: [
    { name: "id", relation: null },
    { name: "title", relation: null },
    { name: "authorId", relation: null },
    {
      name: "author",
      relation: { kind: "belongsTo", foreignKeyFields: ["authorId"] },
    },
  ],
} as unknown as AdminModelMeta;

function failingResource(error: unknown) {
  const reject = vi.fn().mockRejectedValue(error);
  const delegate = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: reject,
    updateMany: reject,
    deleteMany: reject,
  } as unknown as PrismaDelegate;
  return prismaResource(delegate, postMeta);
}

const select = { fields: ["id"], relations: [] };
const create = (error: unknown) =>
  failingResource(error).create({ data: {}, select });
const update = (error: unknown) =>
  failingResource(error).updateMany({ scope: {}, id: "p1", data: {} });
const remove = (error: unknown) =>
  failingResource(error).deleteMany({ scope: {}, id: "p1" });

describe("Prisma write error mapping", () => {
  it("names the field of a unique violation (driver adapter shape)", async () => {
    await expect(
      create(prismaError("P2002", adapterConstraint({ fields: ["title"] }))),
    ).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
      field: "title",
      message: expect.stringContaining("must be unique"),
    });
  });

  it("names the field of a unique violation (classic meta.target)", async () => {
    await expect(
      update(prismaError("P2002", { target: ["title"] })),
    ).rejects.toMatchObject({ field: "title" });
  });

  it("falls back to a generic message for a multi-field or unnamed unique", async () => {
    const error = await create(
      prismaError("P2002", { target: "Post_title_tenantId_key" }),
    ).catch((caught: unknown) => caught);
    expect(error).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "A record with the same unique value already exists.",
    });
    expect((error as { field?: string }).field).toBeUndefined();
  });

  it("reports a missing related record on create and update, with the field", async () => {
    const fk = () =>
      prismaError("P2003", adapterConstraint({ index: "Post_authorId_fkey" }));
    for (const write of [create, update]) {
      await expect(write(fk())).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        field: "authorId",
        message: expect.stringContaining("does not exist"),
      });
    }
  });

  it("reports still-referenced on delete", async () => {
    await expect(
      remove(
        prismaError(
          "P2003",
          adapterConstraint({ index: "Post_authorId_fkey" }),
        ),
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: expect.stringContaining("Cannot delete"),
    });
  });

  it("maps a NOT NULL violation to the field", async () => {
    await expect(
      create(prismaError("P2011", { constraint: ["title"] })),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", field: "title" });
  });

  it("maps a missing record to 404", async () => {
    await expect(update(prismaError("P2025"))).rejects.toMatchObject({
      status: 404,
      code: "RECORD_NOT_FOUND",
    });
  });

  it("rethrows unknown errors unchanged", async () => {
    const unknown = prismaError("P1001");
    await expect(create(unknown)).rejects.toBe(unknown);
  });
});

describe("Prisma search wildcards", () => {
  function searchWhere(escapeSearchWildcards: boolean) {
    const findMany = vi.fn().mockResolvedValue([]);
    const delegate = { findMany } as unknown as PrismaDelegate;
    void prismaResource(delegate, postMeta, { escapeSearchWildcards }).findMany(
      {
        scope: {},
        search: {
          text: "100%_\\",
          fields: [{ relations: [], field: "title", mode: "contains" }],
        },
        select,
      },
    );
    return findMany.mock.calls[0]?.[0].where;
  }

  it("escapes %, _ and backslash when the provider supports it", () => {
    expect(searchWhere(true)).toEqual({
      OR: [{ title: { contains: "100\\%\\_\\\\" } }],
    });
  });

  it("leaves text alone otherwise", () => {
    expect(searchWhere(false)).toEqual({
      OR: [{ title: { contains: "100%_\\" } }],
    });
  });
});

describe("Prisma filter translation", () => {
  function whereFor(
    query: Partial<
      Parameters<ReturnType<typeof prismaResource>["findMany"]>[0]
    >,
    options = { caseInsensitiveSearch: true, escapeSearchWildcards: true },
  ) {
    const findMany = vi.fn().mockResolvedValue([]);
    const delegate = { findMany } as unknown as PrismaDelegate;
    void prismaResource(delegate, postMeta, options).findMany({
      scope: {},
      select,
      ...query,
    });
    return findMany.mock.calls[0]?.[0].where;
  }

  it("nests relation paths, using some for list relations", () => {
    expect(
      whereFor({
        filter: {
          kind: "condition",
          relations: [
            { field: "author", many: false },
            { field: "tags", many: true },
          ],
          field: "name",
          target: "scalar",
          op: "equals",
          value: "urgent",
        },
      }),
    ).toEqual({
      author: { is: { tags: { some: { name: { equals: "urgent" } } } } },
    });
  });

  it("maps and/or/not and every operator", () => {
    const leaf = (op: string, value: unknown) => ({
      kind: "condition" as const,
      relations: [],
      field: "views",
      target: "scalar" as const,
      op: op as never,
      value: value as never,
    });
    expect(
      whereFor({
        filter: {
          kind: "and",
          nodes: [
            leaf("ne", 1),
            leaf("in", [1, 2]),
            leaf("notIn", [3]),
            leaf("gt", 4),
            leaf("lte", 5),
            leaf("isNull", true),
            leaf("isNull", false),
            { kind: "or", nodes: [{ kind: "not", node: leaf("equals", 6) }] },
          ],
        },
      }),
    ).toEqual({
      AND: [
        { views: { not: 1 } },
        { views: { in: [1, 2] } },
        { views: { notIn: [3] } },
        { views: { gt: 4 } },
        { views: { lte: 5 } },
        { views: null },
        { views: { not: null } },
        { OR: [{ NOT: { views: { equals: 6 } } }] },
      ],
    });
  });

  it("escapes text operators and makes them case-insensitive", () => {
    expect(
      whereFor({
        filter: {
          kind: "condition",
          relations: [],
          field: "title",
          target: "scalar",
          op: "startsWith",
          value: "50%",
        },
      }),
    ).toEqual({ title: { startsWith: "50\\%", mode: "insensitive" } });
  });

  it("maps isNull on relations and some/every/none filters", () => {
    expect(
      whereFor({
        filter: {
          kind: "and",
          nodes: [
            {
              kind: "condition",
              relations: [],
              field: "author",
              target: "toOne",
              op: "isNull",
              value: true,
            },
            {
              kind: "condition",
              relations: [],
              field: "tags",
              target: "toMany",
              op: "isNull",
              value: false,
            },
            {
              kind: "relation",
              relations: [{ field: "author", many: false }],
              field: "posts",
              quantifier: "none",
              where: {
                kind: "condition",
                relations: [],
                field: "published",
                target: "scalar",
                op: "equals",
                value: true,
              },
            },
          ],
        },
      }),
    ).toEqual({
      AND: [
        { author: { is: null } },
        { tags: { some: {} } },
        {
          author: { is: { posts: { none: { published: { equals: true } } } } },
        },
      ],
    });
  });

  it("searches across relations with each mode", () => {
    expect(
      whereFor(
        {
          search: {
            text: "ada",
            fields: [
              { relations: [], field: "title", mode: "contains" },
              {
                relations: [{ field: "author", many: false }],
                field: "email",
                mode: "startsWith",
              },
              { relations: [], field: "slug", mode: "equals" },
            ],
          },
        },
        { caseInsensitiveSearch: false, escapeSearchWildcards: false },
      ),
    ).toEqual({
      OR: [
        { title: { contains: "ada" } },
        { author: { is: { email: { startsWith: "ada" } } } },
        { slug: { equals: "ada" } },
      ],
    });
  });

  it("ANDs scope, filter and search together", () => {
    expect(
      whereFor(
        {
          scope: { tenantId: "t1" },
          filter: {
            kind: "condition",
            relations: [],
            field: "views",
            target: "scalar",
            op: "gt",
            value: 1,
          },
          search: {
            text: "x",
            fields: [{ relations: [], field: "title", mode: "contains" }],
          },
        },
        { caseInsensitiveSearch: false, escapeSearchWildcards: false },
      ),
    ).toEqual({
      AND: [
        { tenantId: "t1" },
        { views: { gt: 1 } },
        { OR: [{ title: { contains: "x" } }] },
      ],
    });
  });
});
