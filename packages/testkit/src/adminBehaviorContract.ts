import type {
  AdminService,
  AdminUser,
  FullRegisteredModel,
  PaginatedResponse,
} from "paneljs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  contractAdminUser,
  contractSuperAdminUser,
  contractViewerUser,
  type AdminBehaviorSeed,
  type ContractId,
} from "./fixtures.js";

export type AdminListInput = {
  adminUser: AdminUser;
  page: number;
  perPage: number;
  search?: string;
};

/**
 * Transport-neutral operations that the future core AdminService will expose.
 * Harnesses may adapt their concrete service API to this small test driver.
 */
export interface AdminBehaviorDriver {
  listPosts(
    input: AdminListInput,
  ): Promise<PaginatedResponse<Record<string, unknown>>>;
  getPost(
    adminUser: AdminUser,
    id: ContractId,
  ): Promise<Record<string, unknown>>;
  createPost(
    adminUser: AdminUser,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  updatePost(
    adminUser: AdminUser,
    id: ContractId,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  deletePost(adminUser: AdminUser, id: ContractId): Promise<void>;
  deletePosts(adminUser: AdminUser, ids: ContractId[]): Promise<ContractId[]>;
}

export interface AdminBehaviorEnvironment {
  readonly driver: AdminBehaviorDriver;
  reset(): Promise<AdminBehaviorSeed>;
  readPost(id: ContractId): Promise<Record<string, unknown> | null>;
  dispose(): Promise<void>;
}

export interface AdminBehaviorHarness {
  readonly name: string;
  create(): Promise<AdminBehaviorEnvironment>;
}

/** Adapt the real core AdminService to the contract's canonical Post driver. */
export function createAdminServiceBehaviorDriver(
  service: AdminService,
  postModel: FullRegisteredModel,
): AdminBehaviorDriver {
  return {
    listPosts: (input) =>
      service.list(postModel, input.adminUser, {
        page: input.page,
        perPage: input.perPage,
        search: input.search
          ? { text: input.search, fields: postModel.resolved.searchFields }
          : undefined,
      }),
    getPost: (adminUser, id) => service.get(postModel, adminUser, id),
    createPost: (adminUser, data) => service.create(postModel, adminUser, data),
    updatePost: (adminUser, id, data) =>
      service.update(postModel, adminUser, id, data),
    deletePost: (adminUser, id) => service.delete(postModel, adminUser, id),
    deletePosts: async (adminUser, ids) =>
      (await service.deleteSelected(postModel, adminUser, ids)).deletedIds,
  };
}

/** Register the first framework-neutral admin-operation behavior contract. */
export function defineAdminBehaviorContract(
  harness: AdminBehaviorHarness,
): void {
  describe(`${harness.name} admin behavior contract`, () => {
    let environment: AdminBehaviorEnvironment;
    let seed: AdminBehaviorSeed;

    beforeAll(async () => {
      environment = await harness.create();
    });

    beforeEach(async () => {
      seed = await environment.reset();
    });

    afterAll(async () => {
      await environment?.dispose();
    });

    it("CRUD-001/SEC-012 lists only rows inside the administrator scope", async () => {
      const result = await environment.driver.listPosts({
        adminUser: contractAdminUser,
        page: 1,
        perPage: 50,
      });
      expect(result.records.map((record) => record.id)).toEqual([
        seed.postA1,
        seed.postA2,
      ]);
      expect(result).toMatchObject({
        total: 2,
        page: 1,
        perPage: 50,
        totalPages: 1,
      });
    });

    it("QUERY-002/QUERY-024 paginates scoped rows with correct totals", async () => {
      const result = await environment.driver.listPosts({
        adminUser: contractAdminUser,
        page: 2,
        perPage: 1,
      });
      expect(result.records).toHaveLength(1);
      expect(result).toMatchObject({
        total: 2,
        page: 2,
        perPage: 1,
        totalPages: 2,
      });
    });

    it("SEC-006 lets configured super-admin scope expose every tenant", async () => {
      const result = await environment.driver.listPosts({
        adminUser: contractSuperAdminUser,
        page: 1,
        perPage: 50,
      });
      expect(result.records.map((record) => record.id)).toEqual([
        seed.postA1,
        seed.postA2,
        seed.postB1,
      ]);
    });

    it("CRUD-002/SEC-019 hides an out-of-scope id as not found", async () => {
      await expect(
        environment.driver.getPost(contractAdminUser, seed.postA1),
      ).resolves.toMatchObject({ id: seed.postA1 });
      await expect(
        environment.driver.getPost(contractAdminUser, seed.postB1),
      ).rejects.toMatchObject({ code: "RECORD_NOT_FOUND", status: 404 });
    });

    it("CRUD-004/SEC-014 injects scope during create", async () => {
      const created = await environment.driver.createPost(contractAdminUser, {
        title: "Created through admin",
        content: null,
        published: false,
        authorId: seed.userA,
      });
      expect(created).toMatchObject({
        id: expect.anything(),
        tenantId: seed.tenantA,
        title: "Created through admin",
      });
      await expect(
        environment.readPost(created.id as ContractId),
      ).resolves.toMatchObject({ tenantId: seed.tenantA });
    });

    it("SEC-015 rejects a create payload that conflicts with scope", async () => {
      await expect(
        environment.driver.createPost(contractAdminUser, {
          title: "Wrong tenant",
          content: null,
          published: false,
          authorId: seed.userA,
          tenantId: seed.tenantB,
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    });

    it("SEC-002 denies writes without role permission", async () => {
      await expect(
        environment.driver.createPost(contractViewerUser, {
          title: "Forbidden",
          published: false,
          authorId: seed.userA,
        }),
      ).rejects.toMatchObject({ code: "PERMISSION_DENIED", status: 403 });
    });

    it("CRUD-010/SEC-017 updates an owned row but protects scope fields", async () => {
      await expect(
        environment.driver.updatePost(contractAdminUser, seed.postA1, {
          title: "Updated title",
        }),
      ).resolves.toMatchObject({ title: "Updated title" });
      await expect(
        environment.driver.updatePost(contractAdminUser, seed.postA1, {
          tenantId: seed.tenantB,
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
      await expect(
        environment.driver.updatePost(contractAdminUser, seed.postB1, {
          title: "Forbidden",
        }),
      ).rejects.toMatchObject({ code: "RECORD_NOT_FOUND", status: 404 });
    });

    it("DEL-001/DEL-003 deletes an owned row but not another tenant's row", async () => {
      await expect(
        environment.driver.deletePost(contractAdminUser, seed.postA1),
      ).resolves.toBeUndefined();
      await expect(environment.readPost(seed.postA1)).resolves.toBeNull();
      await expect(
        environment.driver.deletePost(contractAdminUser, seed.postB1),
      ).rejects.toMatchObject({ code: "RECORD_NOT_FOUND", status: 404 });
    });

    it("DEL-014/SEC-020 bulk-deletes scoped rows atomically", async () => {
      await expect(
        environment.driver.deletePosts(contractAdminUser, [
          seed.postA1,
          seed.postA2,
        ]),
      ).resolves.toEqual([seed.postA1, seed.postA2]);
      await expect(environment.readPost(seed.postA1)).resolves.toBeNull();
      await expect(environment.readPost(seed.postA2)).resolves.toBeNull();

      seed = await environment.reset();
      await expect(
        environment.driver.deletePosts(contractAdminUser, [
          seed.postA1,
          seed.postB1,
        ]),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
      await expect(environment.readPost(seed.postA1)).resolves.not.toBeNull();
    });
  });
}
