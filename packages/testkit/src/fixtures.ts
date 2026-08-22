import type { AdminUser, BuiltInUserRecord } from "paneljs";

export type ContractId = string | number;

export const CONTRACT_MODELS = {
  tenant: "Tenant",
  user: "User",
  post: "Post",
} as const;

export type AdapterContractSeed = {
  tenantA: ContractId;
  tenantB: ContractId;
  userA: ContractId;
  userB: ContractId;
  postA1: ContractId;
  postA2: ContractId;
  postB1: ContractId;
};

export type AuthStoreContractSeed = {
  user: BuiltInUserRecord;
  identifierValue: string;
  missingIdentifier: string;
};

export type AdminBehaviorSeed = AdapterContractSeed;

export const contractAdminUser: AdminUser = {
  id: "contract-admin-a",
  email: "admin-a@paneljs.test",
  role: "ADMIN",
  isSuperAdmin: false,
  tenantId: "tenant-a",
};

export const contractViewerUser: AdminUser = {
  id: "contract-viewer-a",
  email: "viewer-a@paneljs.test",
  role: "VIEWER",
  isSuperAdmin: false,
  tenantId: "tenant-a",
};

export const contractSuperAdminUser: AdminUser = {
  id: "contract-super",
  email: "super@paneljs.test",
  role: "SUPER_ADMIN",
  isSuperAdmin: true,
};
