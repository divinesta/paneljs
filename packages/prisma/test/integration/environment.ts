import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
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
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import type { AdminAuthStore, AuthStoreOptions, DataAdapter } from "paneljs";

import { prismaAdapter, prismaAuthStore } from "../../src/index.js";
import { PrismaClient } from "../generated/client/client.js";

const execFileAsync = promisify(execFile);
const packageDirectory = fileURLToPath(new URL("../..", import.meta.url));
const schemaPath = fileURLToPath(
  new URL("../fixture/schema.prisma", import.meta.url),
);

function configureRootlessPodman(): void {
  if (process.env.DOCKER_HOST || process.platform !== "linux") return;
  const userId = process.getuid?.();
  if (userId === undefined) return;

  const socketPath = `/run/user/${userId}/podman/podman.sock`;
  if (!existsSync(socketPath)) return;

  process.env.DOCKER_HOST = `unix://${socketPath}`;
  process.env.TESTCONTAINERS_RYUK_DISABLED ??= "true";
}

async function applyFixtureSchema(databaseUrl: string): Promise<void> {
  await execFileAsync(
    "pnpm",
    [
      "exec",
      "prisma",
      "db",
      "push",
      "--config",
      "test/fixture/prisma.config.ts",
    ],
    {
      cwd: packageDirectory,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      maxBuffer: 10 * 1024 * 1024,
    },
  );
}

async function resetAdapterData(prisma: PrismaClient) {
  const data = createContractSeedData();

  await prisma.$transaction([
    prisma.cascadeChild.deleteMany(),
    prisma.nullableChild.deleteMany(),
    prisma.protectedChild.deleteMany(),
    prisma.post.deleteMany(),
    prisma.user.deleteMany(),
    prisma.tenant.deleteMany(),
  ]);

  await prisma.$transaction([
    prisma.tenant.createMany({ data: data.tenants }),
    prisma.user.createMany({ data: data.users }),
    prisma.post.createMany({ data: data.posts }),
    prisma.cascadeChild.createMany({ data: data.cascadeChildren }),
    prisma.nullableChild.createMany({ data: data.nullableChildren }),
    prisma.protectedChild.createMany({ data: data.protectedChildren }),
  ]);

  return data.references;
}

async function readRecord(
  prisma: PrismaClient,
  modelName: string,
  id: ContractId,
): Promise<Record<string, unknown> | null> {
  const where = { id: String(id) };
  switch (modelName) {
    case "Tenant":
      return prisma.tenant.findUnique({ where });
    case "User":
      return prisma.user.findUnique({ where });
    case "Post":
      return prisma.post.findUnique({ where });
    case "CascadeChild":
      return prisma.cascadeChild.findUnique({ where });
    case "NullableChild":
      return prisma.nullableChild.findUnique({ where });
    case "ProtectedChild":
      return prisma.protectedChild.findUnique({ where });
    default:
      throw new Error(`Unknown Prisma contract model: ${modelName}`);
  }
}

async function resetAuthData(
  prisma: PrismaClient,
  identifier: "email" | "username",
) {
  const seed = createAuthStoreSeed(identifier);

  await prisma.$transaction([
    prisma.expressAdminSession.deleteMany(),
    prisma.expressAdminUser.deleteMany(),
  ]);
  await prisma.expressAdminUser.create({
    data: {
      id: seed.user.id,
      email: seed.user.email ?? null,
      username: seed.user.username ?? null,
      passwordHash: seed.user.passwordHash,
      role: seed.user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN",
      isActive: seed.user.isActive,
      tenantId: seed.user.tenantId ?? null,
    },
  });

  return seed;
}

export class PrismaContractDatabase {
  private constructor(
    private readonly container: StartedPostgreSqlContainer,
    readonly prisma: PrismaClient,
    readonly adapter: DataAdapter,
    private readonly admin: ContractAdminService,
  ) {}

  static async start(): Promise<PrismaContractDatabase> {
    configureRootlessPodman();
    const container = await new PostgreSqlContainer("postgres:16-alpine")
      .withDatabase("paneljs_contract")
      .withUsername("paneljs")
      .withPassword("paneljs")
      .start();

    try {
      const databaseUrl = container.getConnectionUri();
      await applyFixtureSchema(databaseUrl);
      const prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: databaseUrl }),
      });
      await prisma.$connect();
      const adapter = prismaAdapter({ prisma, schemaPath });
      const admin = await createContractAdminService(adapter);
      return new PrismaContractDatabase(container, prisma, adapter, admin);
    } catch (error) {
      await stopContainer(container).catch(() => undefined);
      throw error;
    }
  }

  adapterEnvironment(): AdapterContractEnvironment {
    return {
      adapter: this.adapter,
      reset: () => resetAdapterData(this.prisma),
      readRecord: (modelName, id) => readRecord(this.prisma, modelName, id),
      dispose: async () => undefined,
    };
  }

  authEnvironment(): AuthStoreContractEnvironment {
    return {
      reset: (identifier) => resetAuthData(this.prisma, identifier),
      createStore: (options: AuthStoreOptions): AdminAuthStore =>
        prismaAuthStore(this.prisma, options),
      dispose: async () => undefined,
    };
  }

  adminBehaviorEnvironment(): AdminBehaviorEnvironment {
    return {
      driver: createAdminServiceBehaviorDriver(
        this.admin.service,
        this.admin.postModel,
      ),
      reset: () => resetAdapterData(this.prisma),
      readPost: (id) => readRecord(this.prisma, "Post", id),
      dispose: async () => undefined,
    };
  }

  referentialBehaviorEnvironment(): ReferentialBehaviorEnvironment {
    return {
      driver: createReferentialBehaviorDriver(this.admin),
      reset: () => resetAdapterData(this.prisma),
      readRecord: (modelName, id) => readRecord(this.prisma, modelName, id),
      dispose: async () => undefined,
    };
  }

  async stop(): Promise<void> {
    await this.prisma.$disconnect();
    await stopContainer(this.container);
  }
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

    // Podman's Docker-compatible API can stop the container successfully but
    // fail while removing its rootless network namespace. Native removal
    // completes that cleanup. Docker environments never enter this branch.
    await execFileAsync("podman", ["rm", "-f", container.getId()]);
  }
}
