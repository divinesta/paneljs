import {
  defineAdapterContract,
  defineAdminBehaviorContract,
  defineAuthStoreContract,
  defineReferentialBehaviorContract,
} from "@paneljs/testkit";
import { afterAll, beforeAll, describe } from "vitest";

import { TypeormContractDatabase } from "./environment.js";

describe.sequential("TypeORM PostgreSQL integration", () => {
  let database: TypeormContractDatabase;

  beforeAll(async () => {
    database = await TypeormContractDatabase.start();
  }, 120_000);

  afterAll(async () => {
    await database?.stop();
  }, 30_000);

  defineAdapterContract({
    name: "TypeORM PostgreSQL",
    async create() {
      return database.adapterEnvironment();
    },
  });

  defineAuthStoreContract({
    name: "TypeORM PostgreSQL",
    async create() {
      return database.authEnvironment();
    },
  });

  defineAdminBehaviorContract({
    name: "TypeORM PostgreSQL core service",
    async create() {
      return database.adminBehaviorEnvironment();
    },
  });

  defineReferentialBehaviorContract({
    name: "TypeORM PostgreSQL core service",
    async create() {
      return database.referentialBehaviorEnvironment();
    },
  });
});
