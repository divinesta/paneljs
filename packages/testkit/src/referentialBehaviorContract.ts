import type {
  AdminService,
  AdminUser,
  DeletePreview,
  FullRegisteredModel,
} from "paneljs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  contractAdminUser,
  type AdapterContractSeed,
  type ContractId,
} from "./fixtures.js";
import type { ContractAdminService } from "./adminHarness.js";
import type { ReferentialContractSeed } from "./seed.js";

export interface ReferentialBehaviorDriver {
  previewTenant(adminUser: AdminUser, id: ContractId): Promise<DeletePreview>;
  deleteTenant(adminUser: AdminUser, id: ContractId): Promise<void>;
  deleteProtectedChild(adminUser: AdminUser, id: ContractId): Promise<void>;
}

export interface ReferentialBehaviorEnvironment {
  readonly driver: ReferentialBehaviorDriver;
  reset(): Promise<AdapterContractSeed & ReferentialContractSeed>;
  readRecord(
    modelName: string,
    id: ContractId,
  ): Promise<Record<string, unknown> | null>;
  dispose(): Promise<void>;
}

export interface ReferentialBehaviorHarness {
  readonly name: string;
  create(): Promise<ReferentialBehaviorEnvironment>;
}

function requiredModel(
  models: Map<string, FullRegisteredModel>,
  name: string,
): FullRegisteredModel {
  const model = models.get(name);
  if (!model) throw new Error(`Canonical ${name} model was not registered.`);
  return model;
}

export function createReferentialBehaviorDriver(
  admin: ContractAdminService,
): ReferentialBehaviorDriver {
  const tenant = requiredModel(admin.models, "Tenant");
  const protectedChild = requiredModel(admin.models, "ProtectedChild");
  const service: AdminService = admin.service;
  return {
    previewTenant: (adminUser, id) =>
      service.deletePreview(tenant, adminUser, [id]),
    deleteTenant: (adminUser, id) => service.delete(tenant, adminUser, id),
    deleteProtectedChild: (adminUser, id) =>
      service.delete(protectedChild, adminUser, id),
  };
}

/** Register portable database referential behavior through the core service. */
export function defineReferentialBehaviorContract(
  harness: ReferentialBehaviorHarness,
): void {
  describe(`${harness.name} referential behavior contract`, () => {
    let environment: ReferentialBehaviorEnvironment;
    let seed: AdapterContractSeed & ReferentialContractSeed;

    beforeAll(async () => {
      environment = await harness.create();
    });
    beforeEach(async () => {
      seed = await environment.reset();
    });
    afterAll(async () => {
      await environment?.dispose();
    });

    it("DEL-005/DEL-006/DEL-007 previews Cascade, SetNull, and Restrict rows", async () => {
      const preview = await environment.driver.previewTenant(
        contractAdminUser,
        seed.tenantA,
      );
      const byField = new Map(
        preview.relations.map((relation) => [relation.fieldName, relation]),
      );
      const parent = String(seed.tenantA);

      expect(byField.get("cascadeChildren")).toMatchObject({
        onDelete: "Cascade",
      });
      expect(
        byField.get("cascadeChildren")?.recordsByParentId[parent],
      ).toHaveLength(1);
      expect(byField.get("nullableChildren")).toMatchObject({
        onDelete: "SetNull",
      });
      expect(
        byField.get("nullableChildren")?.recordsByParentId[parent],
      ).toHaveLength(1);
      expect(byField.get("protectedChildren")).toMatchObject({
        onDelete: "Restrict",
      });
      expect(
        byField.get("protectedChildren")?.recordsByParentId[parent],
      ).toHaveLength(1);
    });

    it("DEL-011 keeps a parent when a Restrict child exists", async () => {
      await expect(
        environment.driver.deleteTenant(contractAdminUser, seed.tenantA),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
      await expect(
        environment.readRecord("Tenant", seed.tenantA),
      ).resolves.not.toBeNull();
    });

    it("DEL-009/DEL-010 cascades one child and nulls another", async () => {
      await environment.driver.deleteProtectedChild(
        contractAdminUser,
        seed.protectedChild,
      );
      await environment.driver.deleteTenant(contractAdminUser, seed.tenantA);

      await expect(
        environment.readRecord("Tenant", seed.tenantA),
      ).resolves.toBeNull();
      await expect(
        environment.readRecord("CascadeChild", seed.cascadeChild),
      ).resolves.toBeNull();
      await expect(
        environment.readRecord("NullableChild", seed.nullableChild),
      ).resolves.toMatchObject({ tenantId: null });
    });
  });
}
