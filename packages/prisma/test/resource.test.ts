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
        filters: {},
        search: { text: "100%_\\", fields: ["title"] },
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
