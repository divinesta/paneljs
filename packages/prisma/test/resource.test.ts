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
