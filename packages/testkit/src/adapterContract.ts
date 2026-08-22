import type { AdminModelMeta, DataAdapter } from "paneljs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  CONTRACT_MODELS,
  type AdapterContractSeed,
  type ContractId,
} from "./fixtures.js";

export interface AdapterContractEnvironment {
  readonly adapter: DataAdapter;
  reset(): Promise<AdapterContractSeed>;
  readRecord(
    modelName: string,
    id: ContractId,
  ): Promise<Record<string, unknown> | null>;
  dispose(): Promise<void>;
}

export interface AdapterContractHarness {
  readonly name: string;
  create(): Promise<AdapterContractEnvironment>;
}

function field(meta: AdminModelMeta, name: string) {
  const result = meta.fields.find((candidate) => candidate.name === name);
  expect(result, `${meta.name}.${name} metadata`).toBeDefined();
  return result!;
}

/** Register the portable DataAdapter contract against one ORM harness. */
export function defineAdapterContract(harness: AdapterContractHarness): void {
  describe(`${harness.name} adapter contract`, () => {
    let environment: AdapterContractEnvironment;
    let seed: AdapterContractSeed;
    let metadata: Map<string, AdminModelMeta>;

    beforeAll(async () => {
      environment = await harness.create();
      metadata = await environment.adapter.introspect();
    });

    beforeEach(async () => {
      seed = await environment.reset();
    });

    afterAll(async () => {
      await environment?.dispose();
    });

    describe("normalized metadata", () => {
      it("META-001/META-002 discovers the canonical models and identities", () => {
        expect([...metadata.keys()]).toEqual(
          expect.arrayContaining(Object.values(CONTRACT_MODELS)),
        );

        const user = metadata.get(CONTRACT_MODELS.user)!;
        expect(user).toMatchObject({
          name: "User",
          pluralName: "users",
          idField: "id",
          displayField: "email",
        });
      });

      it("META-003 through META-010 normalizes scalar capabilities", () => {
        const user = metadata.get(CONTRACT_MODELS.user)!;
        expect(field(user, "id")).toMatchObject({
          type: "string",
          isId: true,
          isRequired: true,
          isUnique: true,
          isReadOnly: true,
        });
        expect(field(user, "email")).toMatchObject({
          type: "string",
          isRequired: true,
          isUnique: true,
        });
        expect(field(user, "role")).toMatchObject({
          type: "enum",
          enumValues: expect.arrayContaining(["USER", "ADMIN"]),
        });
        expect(field(user, "isActive")).toMatchObject({
          type: "boolean",
          isRequired: true,
        });
        expect(field(user, "createdAt")).toMatchObject({
          type: "datetime",
          isReadOnly: true,
        });
        expect(user.timestamps.createdAt).toBe("createdAt");
        expect(user.timestamps.updatedAt).toBe("updatedAt");
      });

      it("META-011/META-012 normalizes both sides of relations", () => {
        const user = metadata.get(CONTRACT_MODELS.user)!;
        const post = metadata.get(CONTRACT_MODELS.post)!;

        expect(field(post, "author").relation).toMatchObject({
          model: "User",
          kind: "belongsTo",
          foreignKeyFields: ["authorId"],
          displayField: "email",
        });
        expect(field(user, "posts").relation).toMatchObject({
          model: "Post",
          kind: "hasMany",
        });
      });
    });

    describe("reads and queries", () => {
      it("DATA-002/DATA-014/DATA-015 lists selected scalars and relation displays", async () => {
        const user = metadata.get(CONTRACT_MODELS.user)!;
        const records = await environment.adapter.resource(user).findMany({
          scope: { tenantId: seed.tenantA },
          filters: {},
          sort: { field: "email", direction: "asc" },
          select: {
            fields: ["id", "email", "tenantId"],
            relations: [{ field: "tenant", displayField: "name" }],
          },
        });

        expect(records).toHaveLength(1);
        expect(records[0]).toEqual({
          id: seed.userA,
          email: "ada@paneljs.test",
          tenantId: seed.tenantA,
          tenant: { name: "Tenant A" },
        });
      });

      it("QUERY-008 filters by equality", async () => {
        const post = metadata.get(CONTRACT_MODELS.post)!;
        const records = await environment.adapter.resource(post).findMany({
          scope: { tenantId: seed.tenantA },
          filters: { published: { equals: true } },
          select: { fields: ["id", "published"], relations: [] },
        });
        expect(records).toEqual([{ id: seed.postA1, published: true }]);
      });

      it("QUERY-017/QUERY-023 combines scoped search constraints", async () => {
        const post = metadata.get(CONTRACT_MODELS.post)!;
        const records = await environment.adapter.resource(post).findMany({
          scope: { tenantId: seed.tenantA },
          filters: {},
          search: { text: "Quarterly", fields: ["title", "content"] },
          select: { fields: ["id", "title"], relations: [] },
        });
        expect(records).toEqual([
          { id: seed.postA1, title: "Quarterly Report" },
        ]);
      });

      it("QUERY-004/QUERY-002 applies sorting and pagination", async () => {
        const post = metadata.get(CONTRACT_MODELS.post)!;
        const records = await environment.adapter.resource(post).findMany({
          scope: { tenantId: seed.tenantA },
          filters: {},
          sort: { field: "title", direction: "asc" },
          skip: 1,
          take: 1,
          select: { fields: ["id", "title"], relations: [] },
        });
        expect(records).toEqual([
          { id: seed.postA1, title: "Quarterly Report" },
        ]);
      });

      it("DATA-005 counts with the same constraints", async () => {
        const post = metadata.get(CONTRACT_MODELS.post)!;
        await expect(
          environment.adapter.resource(post).count({
            scope: { tenantId: seed.tenantA },
            filters: { published: { equals: true } },
          }),
        ).resolves.toBe(1);
      });

      it("DATA-003/DATA-004 applies scope when finding one record", async () => {
        const post = metadata.get(CONTRACT_MODELS.post)!;
        await expect(
          environment.adapter.resource(post).findFirst({
            scope: { tenantId: seed.tenantA },
            id: seed.postA1,
            select: { fields: ["id", "title"], relations: [] },
          }),
        ).resolves.toEqual({ id: seed.postA1, title: "Quarterly Report" });
        await expect(
          environment.adapter.resource(post).findFirst({
            scope: { tenantId: seed.tenantA },
            id: seed.postB1,
            select: { fields: ["id"], relations: [] },
          }),
        ).resolves.toBeNull();
      });

      it("QUERY-023 limits records to selected ids without weakening scope", async () => {
        const post = metadata.get(CONTRACT_MODELS.post)!;
        const records = await environment.adapter.resource(post).findMany({
          scope: { tenantId: seed.tenantA },
          filters: {},
          ids: [seed.postA2, seed.postB1],
          select: { fields: ["id"], relations: [] },
        });
        expect(records).toEqual([{ id: seed.postA2 }]);
      });
    });

    describe("writes", () => {
      it("DATA-006/DATA-017 creates and returns the requested projection", async () => {
        const user = metadata.get(CONTRACT_MODELS.user)!;
        const created = await environment.adapter.resource(user).create({
          data: {
            email: "new@paneljs.test",
            fullName: "New User",
            role: "USER",
            isActive: true,
            tenantId: seed.tenantA,
          },
          select: {
            fields: ["id", "email", "tenantId"],
            relations: [{ field: "tenant", displayField: "name" }],
          },
        });

        expect(created).toMatchObject({
          id: expect.anything(),
          email: "new@paneljs.test",
          tenantId: seed.tenantA,
          tenant: { name: "Tenant A" },
        });
        await expect(
          environment.readRecord(
            CONTRACT_MODELS.user,
            created.id as ContractId,
          ),
        ).resolves.toMatchObject({ email: "new@paneljs.test" });
      });

      it("DATA-007/DATA-009 updates only a scoped matching id", async () => {
        const user = metadata.get(CONTRACT_MODELS.user)!;
        await expect(
          environment.adapter.resource(user).updateMany({
            scope: { tenantId: seed.tenantA },
            id: seed.userA,
            data: { fullName: "Ada Updated" },
          }),
        ).resolves.toEqual({ count: 1 });
        await expect(
          environment.adapter.resource(user).updateMany({
            scope: { tenantId: seed.tenantA },
            id: seed.userB,
            data: { fullName: "Forbidden" },
          }),
        ).resolves.toEqual({ count: 0 });
        await expect(
          environment.readRecord(CONTRACT_MODELS.user, seed.userA),
        ).resolves.toMatchObject({ fullName: "Ada Updated" });
        await expect(
          environment.readRecord(CONTRACT_MODELS.user, seed.userB),
        ).resolves.not.toMatchObject({ fullName: "Forbidden" });
      });

      it("DATA-008 updates multiple selected records", async () => {
        const post = metadata.get(CONTRACT_MODELS.post)!;
        await expect(
          environment.adapter.resource(post).updateMany({
            scope: { tenantId: seed.tenantA },
            ids: [seed.postA1, seed.postA2, seed.postB1],
            data: { published: true },
          }),
        ).resolves.toEqual({ count: 2 });
        await expect(
          environment.readRecord(CONTRACT_MODELS.post, seed.postA2),
        ).resolves.toMatchObject({ published: true });
      });

      it("DATA-010/DATA-012 deletes only a scoped matching id", async () => {
        const post = metadata.get(CONTRACT_MODELS.post)!;
        await expect(
          environment.adapter.resource(post).deleteMany({
            scope: { tenantId: seed.tenantA },
            id: seed.postA1,
          }),
        ).resolves.toEqual({ count: 1 });
        await expect(
          environment.adapter.resource(post).deleteMany({
            scope: { tenantId: seed.tenantA },
            id: seed.postB1,
          }),
        ).resolves.toEqual({ count: 0 });
        await expect(
          environment.readRecord(CONTRACT_MODELS.post, seed.postA1),
        ).resolves.toBeNull();
      });

      it("DATA-011 deletes multiple selected records", async () => {
        const post = metadata.get(CONTRACT_MODELS.post)!;
        await expect(
          environment.adapter.resource(post).deleteMany({
            scope: { tenantId: seed.tenantA },
            ids: [seed.postA1, seed.postA2, seed.postB1],
          }),
        ).resolves.toEqual({ count: 2 });
      });

      it("DATA-013 rejects an update or delete without id targets", async () => {
        const post = metadata.get(CONTRACT_MODELS.post)!;
        await expect(
          environment.adapter.resource(post).updateMany({
            scope: { tenantId: seed.tenantA },
            data: { published: true },
          }),
        ).rejects.toThrow();
        await expect(
          environment.adapter.resource(post).deleteMany({
            scope: { tenantId: seed.tenantA },
          }),
        ).rejects.toThrow();
      });
    });

    it("DATA-021 exposes the harness ORM client unchanged", () => {
      expect(environment.adapter.client).toBeDefined();
    });
  });
}
