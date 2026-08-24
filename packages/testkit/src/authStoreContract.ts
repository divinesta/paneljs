import type { AdminAuthStore, AuthStoreOptions } from "paneljs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthStoreContractSeed } from "./fixtures.js";

export interface AuthStoreContractEnvironment {
  reset(identifier: "email" | "username"): Promise<AuthStoreContractSeed>;
  createStore(options: AuthStoreOptions): AdminAuthStore;
  dispose(): Promise<void>;
}

export interface AuthStoreContractHarness {
  readonly name: string;
  create(): Promise<AuthStoreContractEnvironment>;
}

/** Register the portable AdminAuthStore contract against one ORM harness. */
export function defineAuthStoreContract(
  harness: AuthStoreContractHarness,
): void {
  describe(`${harness.name} auth-store contract`, () => {
    let environment: AuthStoreContractEnvironment;
    let seed: AuthStoreContractSeed;
    let store: AdminAuthStore;

    beforeAll(async () => {
      environment = await harness.create();
    });

    beforeEach(async () => {
      seed = await environment.reset("email");
      store = environment.createStore({ identifier: "email" });
    });

    afterAll(async () => {
      await environment?.dispose();
    });

    it("AUTH-010 finds an administrator by email", async () => {
      await expect(
        store.findUserByIdentifier(seed.identifierValue),
      ).resolves.toEqual(seed.user);
    });

    it("AUTH-011 finds an administrator by username", async () => {
      seed = await environment.reset("username");
      store = environment.createStore({ identifier: "username" });
      await expect(
        store.findUserByIdentifier(seed.identifierValue),
      ).resolves.toEqual(seed.user);
    });

    it("AUTH-012 returns null for a missing administrator", async () => {
      await expect(
        store.findUserByIdentifier(seed.missingIdentifier),
      ).resolves.toBeNull();
    });

    it("AUTH-030 creates an administrator identified by email", async () => {
      await store.createUser({
        identifier: seed.missingIdentifier,
        passwordHash: "created-password-hash",
        role: "SUPER_ADMIN",
        isActive: true,
      });

      await expect(
        store.findUserByIdentifier(seed.missingIdentifier),
      ).resolves.toEqual(
        expect.objectContaining({
          email: seed.missingIdentifier,
          passwordHash: "created-password-hash",
          role: "SUPER_ADMIN",
          isActive: true,
        }),
      );
    });

    it("AUTH-031 creates an administrator identified by username", async () => {
      seed = await environment.reset("username");
      store = environment.createStore({ identifier: "username" });

      await store.createUser({
        identifier: seed.missingIdentifier,
        passwordHash: "created-password-hash",
        role: "ADMIN",
        isActive: true,
      });

      await expect(
        store.findUserByIdentifier(seed.missingIdentifier),
      ).resolves.toEqual(
        expect.objectContaining({
          username: seed.missingIdentifier,
          passwordHash: "created-password-hash",
          role: "ADMIN",
          isActive: true,
        }),
      );
    });

    it("AUTH-032 rejects a duplicate administrator identifier", async () => {
      await expect(
        store.createUser({
          identifier: seed.identifierValue,
          passwordHash: "another-password-hash",
          role: "SUPER_ADMIN",
          isActive: true,
        }),
      ).rejects.toBeDefined();
    });

    it("AUTH-013/AUTH-014 creates and retrieves a session with its user", async () => {
      const expiresAt = new Date(Date.now() + 60_000);
      await store.createSession({
        tokenHash: "valid-token-hash",
        userId: seed.user.id,
        expiresAt,
      });

      await expect(
        store.findSessionWithUser("valid-token-hash"),
      ).resolves.toEqual({
        tokenHash: "valid-token-hash",
        expiresAt,
        user: seed.user,
      });
    });

    it("AUTH-014 returns null for a missing session", async () => {
      await expect(
        store.findSessionWithUser("missing-token-hash"),
      ).resolves.toBeNull();
    });

    it("AUTH-015 does not return an expired session", async () => {
      await store.createSession({
        tokenHash: "expired-token-hash",
        userId: seed.user.id,
        expiresAt: new Date(Date.now() - 1),
      });
      await expect(
        store.findSessionWithUser("expired-token-hash"),
      ).resolves.toBeNull();
    });

    it("AUTH-016 deletes a session and tolerates a missing session", async () => {
      await store.createSession({
        tokenHash: "delete-token-hash",
        userId: seed.user.id,
        expiresAt: new Date(Date.now() + 60_000),
      });
      await store.deleteSessionByTokenHash("delete-token-hash");
      await expect(
        store.findSessionWithUser("delete-token-hash"),
      ).resolves.toBeNull();
      await expect(
        store.deleteSessionByTokenHash("missing-token-hash"),
      ).resolves.toBeUndefined();
    });
  });
}
