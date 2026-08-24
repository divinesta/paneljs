import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";

import {
  createAuthStoreSeed,
  createAdminServiceBehaviorDriver,
  createContractAdminService,
  createContractSeedData,
  createReferentialBehaviorDriver,
  type AdapterContractEnvironment,
  type AdminBehaviorEnvironment,
  type AuthStoreContractEnvironment,
  type ContractAdminService,
  type ContractId,
  type ReferentialBehaviorEnvironment,
} from "@paneljs/testkit";
import { wrap, type MikroORM as CoreMikroORM } from "@mikro-orm/core";
import { MikroORM, PostgreSqlDriver } from "@mikro-orm/postgresql";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import type { AdminAuthStore, AuthStoreOptions, DataAdapter } from "paneljs";

import { mikroormAdapter, mikroormAuthStore } from "../../src/index.js";
import { contractEntities } from "../fixture/entities.js";

const execFileAsync = promisify(execFile);

const BELONGS_TO: Record<string, string[]> = {
  User: ["tenant"],
  Post: ["author", "tenant"],
  CascadeChild: ["tenant"],
  NullableChild: ["tenant"],
  ProtectedChild: ["tenant"],
  ExpressAdminSession: ["user"],
};

function configureRootlessPodman(): void {
  if (process.env.DOCKER_HOST || process.platform !== "linux") return;
  const userId = process.getuid?.();
  if (userId === undefined) return;

  const socketPath = `/run/user/${userId}/podman/podman.sock`;
  if (!existsSync(socketPath)) return;

  process.env.DOCKER_HOST = `unix://${socketPath}`;
  process.env.TESTCONTAINERS_RYUK_DISABLED ??= "true";
}

function relationPk(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value !== "object") return value;
  const record = value as { id?: unknown };
  return record.id !== undefined ? record.id : value;
}

function serializeRecord(
  modelName: string,
  entity: object,
): Record<string, unknown> {
  const record = wrap(entity).toObject() as Record<string, unknown>;
  for (const relation of BELONGS_TO[modelName] ?? []) {
    const value = (entity as Record<string, unknown>)[relation];
    record[`${relation}Id`] = relationPk(value);
  }
  return record;
}

async function resetAdapterData(orm: CoreMikroORM) {
  const em = orm.em.fork();
  await em.nativeDelete("CascadeChild", {});
  await em.nativeDelete("NullableChild", {});
  await em.nativeDelete("ProtectedChild", {});
  await em.nativeDelete("Post", {});
  await em.nativeDelete("User", {});
  await em.nativeDelete("Tenant", {});

  const data = createContractSeedData();
  await em.insertMany("Tenant", data.tenants);
  await em.insertMany(
    "User",
    data.users.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      tenant: user.tenantId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })),
  );
  await em.insertMany(
    "Post",
    data.posts.map((post) => ({
      id: post.id,
      title: post.title,
      content: post.content,
      published: post.published,
      author: post.authorId,
      tenant: post.tenantId,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    })),
  );
  await em.insertMany(
    "CascadeChild",
    data.cascadeChildren.map((child) => ({
      id: child.id,
      label: child.label,
      tenant: child.tenantId,
    })),
  );
  await em.insertMany(
    "NullableChild",
    data.nullableChildren.map((child) => ({
      id: child.id,
      label: child.label,
      tenant: child.tenantId,
    })),
  );
  await em.insertMany(
    "ProtectedChild",
    data.protectedChildren.map((child) => ({
      id: child.id,
      label: child.label,
      tenant: child.tenantId,
    })),
  );

  return data.references;
}

async function readRecord(
  orm: CoreMikroORM,
  modelName: string,
  id: ContractId,
): Promise<Record<string, unknown> | null> {
  const entity = await orm.em.fork().findOne(modelName, { id: String(id) });
  return entity ? serializeRecord(modelName, entity as object) : null;
}

async function resetAuthData(
  orm: CoreMikroORM,
  identifier: "email" | "username",
) {
  const em = orm.em.fork();
  await em.nativeDelete("ExpressAdminSession", {});
  await em.nativeDelete("ExpressAdminUser", {});

  const seed = createAuthStoreSeed(identifier);
  await em.insert("ExpressAdminUser", {
    id: seed.user.id,
    email: seed.user.email ?? null,
    username: seed.user.username ?? null,
    passwordHash: seed.user.passwordHash,
    role: seed.user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN",
    isActive: seed.user.isActive,
    tenantId: seed.user.tenantId ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return seed;
}

async function stopContainer(
  container: StartedPostgreSqlContainer,
): Promise<void> {
  try {
    await container.stop();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isRootlessPodmanCleanupFailure =
      process.env.DOCKER_HOST?.includes("podman.sock") === true &&
      message.includes("rootless netns") &&
      message.includes("permission denied");
    if (!isRootlessPodmanCleanupFailure) throw error;
    const podmanEnvironment = { ...process.env };
    delete podmanEnvironment.XDG_DATA_HOME;
    await execFileAsync("podman", ["rm", "-f", container.getId()], {
      env: podmanEnvironment,
    });
  }
}

export class MikroormContractDatabase {
  private constructor(
    private readonly container: StartedPostgreSqlContainer,
    readonly orm: CoreMikroORM,
    readonly adapter: DataAdapter,
    private readonly admin: ContractAdminService,
  ) {}

  static async start(): Promise<MikroormContractDatabase> {
    configureRootlessPodman();
    const container = await new PostgreSqlContainer("postgres:16-alpine")
      .withDatabase("paneljs_contract")
      .withUsername("paneljs")
      .withPassword("paneljs")
      .start();

    try {
      const orm = await MikroORM.init({
        driver: PostgreSqlDriver,
        clientUrl: container.getConnectionUri(),
        entities: [...contractEntities],
        allowGlobalContext: true,
      });
      await orm.schema.refreshDatabase();
      const adapter = mikroormAdapter({ orm: orm as unknown as CoreMikroORM });
      const admin = await createContractAdminService(adapter);
      return new MikroormContractDatabase(
        container,
        orm as unknown as CoreMikroORM,
        adapter,
        admin,
      );
    } catch (error) {
      await stopContainer(container).catch(() => undefined);
      throw error;
    }
  }

  adapterEnvironment(): AdapterContractEnvironment {
    return {
      adapter: this.adapter,
      reset: () => resetAdapterData(this.orm),
      readRecord: (modelName, id) => readRecord(this.orm, modelName, id),
      dispose: async () => undefined,
    };
  }

  authEnvironment(): AuthStoreContractEnvironment {
    return {
      reset: (identifier) => resetAuthData(this.orm, identifier),
      createStore: (options: AuthStoreOptions): AdminAuthStore =>
        mikroormAuthStore(this.orm, options),
      dispose: async () => undefined,
    };
  }

  adminBehaviorEnvironment(): AdminBehaviorEnvironment {
    return {
      driver: createAdminServiceBehaviorDriver(
        this.admin.service,
        this.admin.postModel,
      ),
      reset: () => resetAdapterData(this.orm),
      readPost: (id) => readRecord(this.orm, "Post", id),
      dispose: async () => undefined,
    };
  }

  referentialBehaviorEnvironment(): ReferentialBehaviorEnvironment {
    return {
      driver: createReferentialBehaviorDriver(this.admin),
      reset: () => resetAdapterData(this.orm),
      readRecord: (modelName, id) => readRecord(this.orm, modelName, id),
      dispose: async () => undefined,
    };
  }

  async stop(): Promise<void> {
    await this.orm.close(true);
    await stopContainer(this.container);
  }
}
