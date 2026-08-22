import {
  defineAdapterContract,
  defineAdminBehaviorContract,
  defineAuthStoreContract,
  defineReferentialBehaviorContract,
} from "@paneljs/testkit";
import { afterAll, beforeAll, describe } from "vitest";

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
});
