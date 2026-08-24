import type {
  AdminAuthStore,
  AuthStoreOptions,
  BuiltInSessionRecord,
  BuiltInUserRecord,
} from "paneljs";

import type {
  AuthStoreContractEnvironment,
  AuthStoreContractSeed,
} from "../src/index.js";

type StoredSession = {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
};

export class FakeAuthStoreEnvironment implements AuthStoreContractEnvironment {
  private users: BuiltInUserRecord[] = [];
  private sessions: StoredSession[] = [];

  async reset(
    identifier: "email" | "username",
  ): Promise<AuthStoreContractSeed> {
    const user: BuiltInUserRecord = {
      id: "auth-user-1",
      ...(identifier === "email"
        ? { email: "admin@paneljs.test" }
        : { username: "paneladmin" }),
      passwordHash: "test-password-hash",
      role: "ADMIN",
      isActive: true,
      tenantId: "tenant-a",
    };
    this.users = [user];
    this.sessions = [];
    return {
      user: structuredClone(user),
      identifierValue:
        identifier === "email" ? "admin@paneljs.test" : "paneladmin",
      missingIdentifier:
        identifier === "email" ? "missing@paneljs.test" : "missing-user",
    };
  }

  createStore(options: AuthStoreOptions): AdminAuthStore {
    return {
      findUserByIdentifier: async (identifier) => {
        const user = this.users.find(
          (candidate) => candidate[options.identifier] === identifier,
        );
        return user ? structuredClone(user) : null;
      },
      createUser: async (input) => {
        if (
          this.users.some(
            (candidate) => candidate[options.identifier] === input.identifier,
          )
        ) {
          throw new Error("Duplicate administrator identifier.");
        }
        this.users.push({
          id: `auth-user-${this.users.length + 1}`,
          [options.identifier]: input.identifier,
          passwordHash: input.passwordHash,
          role: input.role,
          isActive: input.isActive,
          ...(input.tenantId ? { tenantId: input.tenantId } : {}),
        });
      },
      findSessionWithUser: async (
        tokenHash,
      ): Promise<BuiltInSessionRecord | null> => {
        const session = this.sessions.find(
          (candidate) =>
            candidate.tokenHash === tokenHash &&
            candidate.expiresAt.getTime() > Date.now(),
        );
        if (!session) return null;
        const user = this.users.find(
          (candidate) => candidate.id === session.userId,
        );
        if (!user) return null;
        return {
          tokenHash: session.tokenHash,
          expiresAt: new Date(session.expiresAt),
          user: structuredClone(user),
        };
      },
      createSession: async (input) => {
        this.sessions.push({
          tokenHash: input.tokenHash,
          userId: input.userId,
          expiresAt: new Date(input.expiresAt),
        });
      },
      deleteSessionByTokenHash: async (tokenHash) => {
        this.sessions = this.sessions.filter(
          (candidate) => candidate.tokenHash !== tokenHash,
        );
      },
    };
  }

  async dispose(): Promise<void> {}
}
