import type { BuiltInUserRecord } from "paneljs";

import type {
  AdapterContractSeed,
  AuthStoreContractSeed,
  ContractId,
} from "./fixtures.js";

export const CONTRACT_SEED_TIME = new Date("2025-01-15T12:00:00.000Z");

export type ReferentialContractSeed = {
  cascadeChild: ContractId;
  nullableChild: ContractId;
  protectedChild: ContractId;
};

export type ContractTenantSeed = {
  id: string;
  name: string;
};

export type ContractUserSeed = {
  id: string;
  email: string;
  fullName: string;
  role: "USER" | "ADMIN";
  isActive: boolean;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ContractPostSeed = {
  id: string;
  title: string;
  content: string | null;
  published: boolean;
  authorId: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ContractChildSeed = {
  id: string;
  label: string;
  tenantId: string;
};

export type ContractSeedData = {
  references: AdapterContractSeed & ReferentialContractSeed;
  tenants: ContractTenantSeed[];
  users: ContractUserSeed[];
  posts: ContractPostSeed[];
  cascadeChildren: ContractChildSeed[];
  nullableChildren: ContractChildSeed[];
  protectedChildren: ContractChildSeed[];
};

/**
 * Returns fresh objects on every call so a test can safely mutate its copy.
 */
export function createContractSeedData(): ContractSeedData {
  const references = {
    tenantA: "tenant-a",
    tenantB: "tenant-b",
    userA: "00000000-0000-4000-8000-000000000101",
    userB: "00000000-0000-4000-8000-000000000102",
    postA1: "00000000-0000-4000-8000-000000000201",
    postA2: "00000000-0000-4000-8000-000000000202",
    postB1: "00000000-0000-4000-8000-000000000203",
    cascadeChild: "00000000-0000-4000-8000-000000000301",
    nullableChild: "00000000-0000-4000-8000-000000000302",
    protectedChild: "00000000-0000-4000-8000-000000000303",
  } satisfies AdapterContractSeed & ReferentialContractSeed;

  return {
    references,
    tenants: [
      { id: references.tenantA, name: "Tenant A" },
      { id: references.tenantB, name: "Tenant B" },
    ],
    users: [
      {
        id: references.userA,
        email: "ada@paneljs.test",
        fullName: "Ada Lovelace",
        role: "ADMIN",
        isActive: true,
        tenantId: references.tenantA,
        createdAt: new Date(CONTRACT_SEED_TIME),
        updatedAt: new Date(CONTRACT_SEED_TIME),
      },
      {
        id: references.userB,
        email: "grace@paneljs.test",
        fullName: "Grace Hopper",
        role: "USER",
        isActive: true,
        tenantId: references.tenantB,
        createdAt: new Date(CONTRACT_SEED_TIME),
        updatedAt: new Date(CONTRACT_SEED_TIME),
      },
    ],
    posts: [
      {
        id: references.postA1,
        title: "Quarterly Report",
        content: "Tenant A public report",
        published: true,
        authorId: references.userA,
        tenantId: references.tenantA,
        createdAt: new Date(CONTRACT_SEED_TIME),
        updatedAt: new Date(CONTRACT_SEED_TIME),
      },
      {
        id: references.postA2,
        title: "Launch Notes",
        content: null,
        published: false,
        authorId: references.userA,
        tenantId: references.tenantA,
        createdAt: new Date(CONTRACT_SEED_TIME),
        updatedAt: new Date(CONTRACT_SEED_TIME),
      },
      {
        id: references.postB1,
        title: "Quarterly Secret",
        content: "Tenant B private report",
        published: true,
        authorId: references.userB,
        tenantId: references.tenantB,
        createdAt: new Date(CONTRACT_SEED_TIME),
        updatedAt: new Date(CONTRACT_SEED_TIME),
      },
    ],
    cascadeChildren: [
      {
        id: references.cascadeChild,
        label: "Deleted with Tenant A",
        tenantId: references.tenantA,
      },
    ],
    nullableChildren: [
      {
        id: references.nullableChild,
        label: "Detached from Tenant A",
        tenantId: references.tenantA,
      },
    ],
    protectedChildren: [
      {
        id: references.protectedChild,
        label: "Protects Tenant A",
        tenantId: references.tenantA,
      },
    ],
  };
}

export type AuthIdentifier = "email" | "username";

export function createAuthStoreSeed(
  identifier: AuthIdentifier,
): AuthStoreContractSeed {
  const identifierValue =
    identifier === "email" ? "admin@paneljs.test" : "contract-admin";
  const user: BuiltInUserRecord = {
    id:
      identifier === "email"
        ? "00000000-0000-4000-8000-000000000401"
        : "00000000-0000-4000-8000-000000000402",
    passwordHash: "$2b$12$contract.fixture.hash",
    role: "ADMIN",
    isActive: true,
    tenantId: "tenant-a",
    email: identifier === "email" ? identifierValue : undefined,
    username: identifier === "username" ? identifierValue : undefined,
  };

  return {
    user,
    identifierValue,
    missingIdentifier:
      identifier === "email" ? "missing@paneljs.test" : "missing-admin",
  };
}
