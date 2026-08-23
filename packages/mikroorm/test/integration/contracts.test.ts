import {
  defineAdapterContract,
  defineAdminBehaviorContract,
  defineAuthStoreContract,
  defineReferentialBehaviorContract,
} from "@paneljs/testkit";
import { afterAll, beforeAll, describe } from "vitest";

import { MikroormContractDatabase } from "./environment.js";

describe.sequential("MikroORM PostgreSQL integration", () => {
  let database: MikroormContractDatabase;

  beforeAll(async () => {
    database = await MikroormContractDatabase.start();
  }, 120_000);

  afterAll(async () => {
    await database?.stop();
  }, 30_000);

  defineAdapterContract({
    name: "MikroORM PostgreSQL",
    async create() {
      return database.adapterEnvironment();
    },
  });

  defineAuthStoreContract({
    name: "MikroORM PostgreSQL",
    async create() {
      return database.authEnvironment();
    },
  });

  defineAdminBehaviorContract({
    name: "MikroORM PostgreSQL core service",
    async create() {
      return database.adminBehaviorEnvironment();
    },
  });

  defineReferentialBehaviorContract({
    name: "MikroORM PostgreSQL core service",
    async create() {
      return database.referentialBehaviorEnvironment();
    },
  });
});
