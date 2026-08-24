import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import type {
  AdminAuthStore,
  BuiltInUserRecord,
  DataAdapter,
} from "../src/index.js";
import {
  createSuperuser,
  loadConfig,
  type CreateSuperuserIo,
  type PaneljsCliConfig,
} from "../src/cli/auth.js";

function harness(existingUser: BuiltInUserRecord | null = null) {
  const store: AdminAuthStore = {
    findUserByIdentifier: vi.fn(async () => existingUser),
    createUser: vi.fn(async () => {}),
    findSessionWithUser: vi.fn(async () => null),
    createSession: vi.fn(async () => {}),
    deleteSessionByTokenHash: vi.fn(async () => {}),
  };
  const dispose = vi.fn(async () => {});
  const adapter: DataAdapter = {
    client: {},
    introspect: async () => new Map(),
    resource: () => {
      throw new Error("resource should not be used");
    },
    createAuthStore: () => store,
    dispose,
  };
  const config: PaneljsCliConfig = {
    adapter,
    auth: {
      mode: "built-in",
      identifier: "email",
      secureCookies: false,
    },
  };
  const log = vi.fn();
  const warn = vi.fn();
  const io: CreateSuperuserIo = {
    loadConfig: vi.fn(async () => config),
    question: vi.fn(async () => {
      throw new Error("question should not be used");
    }),
    hiddenQuestion: vi.fn(async () => {
      throw new Error("hiddenQuestion should not be used");
    }),
    confirm: vi.fn(async () => false),
    log,
    warn,
  };
  return { store, adapter, dispose, config, io, log, warn };
}

describe("createsuperuser", () => {
  it("rejects the removed Prisma-only config contract", async () => {
    const directory = mkdtempSync(join(tmpdir(), "paneljs-cli-auth-"));
    const configPath = join(directory, "paneljs.config.mjs");
    writeFileSync(
      configPath,
      'export default { prisma: {}, auth: { mode: "built-in", identifier: "email" } };',
    );

    await expect(loadConfig(configPath)).rejects.toThrow(
      'default-export { adapter, auth: { mode: "built-in", ... } }',
    );
  });

  it("creates a superuser through the configured adapter auth store", async () => {
    const { store, dispose, io, log } = harness();

    await createSuperuser(
      [
        "createsuperuser",
        "--config",
        "./paneljs.config.ts",
        "--email",
        "admin@example.test",
        "--password",
        "a-secure-password",
      ],
      io,
    );

    expect(store.createUser).toHaveBeenCalledWith({
      identifier: "admin@example.test",
      passwordHash: expect.stringMatching(/^scrypt\$/),
      role: "SUPER_ADMIN",
      isActive: true,
    });
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("Superuser created"),
    );
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("reports an existing administrator before attempting creation", async () => {
    const existing: BuiltInUserRecord = {
      id: "existing-admin",
      email: "admin@example.test",
      passwordHash: "stored-hash",
      role: "SUPER_ADMIN",
      isActive: true,
    };
    const { store, dispose, io } = harness(existing);

    await expect(
      createSuperuser(
        [
          "createsuperuser",
          "--config",
          "./paneljs.config.ts",
          "--email",
          "admin@example.test",
          "--password",
          "a-secure-password",
        ],
        io,
      ),
    ).rejects.toThrow(
      'An administrator with email "admin@example.test" already exists.',
    );
    expect(store.createUser).not.toHaveBeenCalled();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("uses the configured username identifier", async () => {
    const { store, config, io } = harness();
    config.auth.identifier = "username";

    await createSuperuser(
      [
        "createsuperuser",
        "--config",
        "./paneljs.config.ts",
        "--username",
        "paneladmin",
        "--password",
        "a-secure-password",
      ],
      io,
    );

    expect(store.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: "paneladmin" }),
    );
  });
});
