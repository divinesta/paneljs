import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";

import {
  createAuthStoreSeed,
  createContractSeedData,
  type AdapterContractEnvironment,
  type AuthStoreContractEnvironment,
  type ContractId,
} from "@paneljs/testkit";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import type { AdminAuthStore, AuthStoreOptions, DataAdapter } from "paneljs";
import { DataSource, type EntityTarget, type ObjectLiteral } from "typeorm";

import { typeormAdapter, typeormAuthStore } from "../../src/index.js";
import {
  CascadeChildEntity,
  ExpressAdminSessionEntity,
  ExpressAdminUserEntity,
  NullableChildEntity,
  PostEntity,
  ProtectedChildEntity,
  TenantEntity,
  UserEntity,
  contractEntities,
} from "../fixture/entities.js";

const execFileAsync = promisify(execFile);

function configureRootlessPodman(): void {
  if (process.env.DOCKER_HOST || process.platform !== "linux") return;
  const userId = process.getuid?.();
  if (userId === undefined) return;

  const socketPath = `/run/user/${userId}/podman/podman.sock`;
  if (!existsSync(socketPath)) return;

  process.env.DOCKER_HOST = `unix://${socketPath}`;
  process.env.TESTCONTAINERS_RYUK_DISABLED ??= "true";
}

async function deleteAll(
  dataSource: DataSource,
  entity: EntityTarget<ObjectLiteral>,
): Promise<void> {
  await dataSource
    .getRepository(entity)
    .createQueryBuilder()
    .delete()
    .execute();
}

async function resetAdapterData(dataSource: DataSource) {
  await deleteAll(dataSource, CascadeChildEntity);
  await deleteAll(dataSource, NullableChildEntity);
  await deleteAll(dataSource, ProtectedChildEntity);
  await deleteAll(dataSource, PostEntity);
  await deleteAll(dataSource, UserEntity);
  await deleteAll(dataSource, TenantEntity);

  const data = createContractSeedData();
  await dataSource.transaction(async (manager) => {
    await manager.getRepository(TenantEntity).insert(data.tenants);
    await manager.getRepository(UserEntity).insert(data.users);
    await manager.getRepository(PostEntity).insert(data.posts);
    await manager
      .getRepository(CascadeChildEntity)
      .insert(data.cascadeChildren);
    await manager
      .getRepository(NullableChildEntity)
      .insert(data.nullableChildren);
    await manager
      .getRepository(ProtectedChildEntity)
      .insert(data.protectedChildren);
  });

  return data.references;
}

async function readRecord(
  dataSource: DataSource,
  modelName: string,
  id: ContractId,
): Promise<Record<string, unknown> | null> {
  const entities: Record<string, EntityTarget<ObjectLiteral>> = {
    Tenant: TenantEntity,
    User: UserEntity,
    Post: PostEntity,
    CascadeChild: CascadeChildEntity,
    NullableChild: NullableChildEntity,
    ProtectedChild: ProtectedChildEntity,
  };
  const entity = entities[modelName];
  if (!entity) throw new Error(`Unknown TypeORM contract model: ${modelName}`);

  return dataSource.getRepository(entity).findOne({
    where: { id: String(id) },
  });
}

async function resetAuthData(
  dataSource: DataSource,
  identifier: "email" | "username",
) {
  await deleteAll(dataSource, ExpressAdminSessionEntity);
  await deleteAll(dataSource, ExpressAdminUserEntity);

  const seed = createAuthStoreSeed(identifier);
  await dataSource.getRepository(ExpressAdminUserEntity).insert({
    id: seed.user.id,
    email: seed.user.email ?? null,
    username: seed.user.username ?? null,
    passwordHash: seed.user.passwordHash,
    role: seed.user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN",
    isActive: seed.user.isActive,
    tenantId: seed.user.tenantId ?? null,
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
    await execFileAsync("podman", ["rm", "-f", container.getId()]);
  }
}

export class TypeormContractDatabase {
  readonly adapter: DataAdapter;

  private constructor(
    private readonly container: StartedPostgreSqlContainer,
    readonly dataSource: DataSource,
  ) {
    this.adapter = typeormAdapter({ dataSource });
  }

  static async start(): Promise<TypeormContractDatabase> {
    configureRootlessPodman();
    const container = await new PostgreSqlContainer("postgres:16-alpine")
      .withDatabase("paneljs_contract")
      .withUsername("paneljs")
      .withPassword("paneljs")
      .start();

    try {
      const dataSource = new DataSource({
        type: "postgres",
        url: container.getConnectionUri(),
        entities: [...contractEntities],
        synchronize: true,
        dropSchema: true,
        logging: false,
      });
      await dataSource.initialize();
      return new TypeormContractDatabase(container, dataSource);
    } catch (error) {
      await stopContainer(container).catch(() => undefined);
      throw error;
    }
  }

  adapterEnvironment(): AdapterContractEnvironment {
    return {
      adapter: this.adapter,
      reset: () => resetAdapterData(this.dataSource),
      readRecord: (modelName, id) => readRecord(this.dataSource, modelName, id),
      dispose: async () => undefined,
    };
  }

  authEnvironment(): AuthStoreContractEnvironment {
    return {
      reset: (identifier) => resetAuthData(this.dataSource, identifier),
      createStore: (options: AuthStoreOptions): AdminAuthStore =>
        typeormAuthStore(this.dataSource, options),
      dispose: async () => undefined,
    };
  }

  async stop(): Promise<void> {
    if (this.dataSource.isInitialized) await this.dataSource.destroy();
    await stopContainer(this.container);
  }
}
