import type {
  AdminAuthStore,
  AuthStoreOptions,
  BuiltInSessionRecord,
  BuiltInUserRecord,
} from "paneljs";
import { DEFAULT_AUTH_SESSION_MODEL, DEFAULT_AUTH_USER_MODEL } from "paneljs";
import {
  MoreThan,
  type DataSource,
  type ObjectLiteral,
  type Repository,
} from "typeorm";

function asUser(value: unknown): BuiltInUserRecord | null {
  if (!value || typeof value !== "object") return null;
  const user = value as Record<string, unknown>;
  if (
    typeof user.id !== "string" ||
    typeof user.passwordHash !== "string" ||
    typeof user.role !== "string" ||
    typeof user.isActive !== "boolean"
  ) {
    return null;
  }
  return {
    id: user.id,
    passwordHash: user.passwordHash,
    role: user.role,
    isActive: user.isActive,
    ...(typeof user.email === "string" ? { email: user.email } : {}),
    ...(typeof user.username === "string" ? { username: user.username } : {}),
    ...(typeof user.tenantId === "string" ? { tenantId: user.tenantId } : {}),
  };
}

function asSession(value: unknown): BuiltInSessionRecord | null {
  if (!value || typeof value !== "object") return null;
  const session = value as Record<string, unknown>;
  const user = asUser(session.user);
  if (typeof session.tokenHash !== "string" || !user) return null;
  const expiresAt =
    session.expiresAt instanceof Date
      ? session.expiresAt
      : typeof session.expiresAt === "string" ||
          typeof session.expiresAt === "number"
        ? new Date(session.expiresAt)
        : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) return null;
  return { tokenHash: session.tokenHash, expiresAt, user };
}

function getRepository(
  dataSource: DataSource,
  modelName: string,
): Repository<ObjectLiteral> {
  const entity = dataSource.entityMetadatas.find(
    (candidate) => candidate.name === modelName,
  );
  if (!entity) {
    throw new Error(
      `[paneljs] Built-in auth requires TypeORM entity "${modelName}". Add builtInAuthEntities() to your DataSource entities.`,
    );
  }
  return dataSource.getRepository(entity.target);
}

export function typeormAuthStore(
  dataSource: DataSource,
  options: AuthStoreOptions,
): AdminAuthStore {
  const userModel = options.userModel ?? DEFAULT_AUTH_USER_MODEL;
  const sessionModel = options.sessionModel ?? DEFAULT_AUTH_SESSION_MODEL;
  const users = getRepository(dataSource, userModel);
  const sessions = getRepository(dataSource, sessionModel);

  return {
    async findUserByIdentifier(identifier) {
      return asUser(
        await users.findOne({
          where: { [options.identifier]: identifier },
        }),
      );
    },
    async findSessionWithUser(tokenHash) {
      return asSession(
        await sessions.findOne({
          where: {
            tokenHash,
            expiresAt: MoreThan(new Date()),
          },
          relations: ["user"],
        }),
      );
    },
    async createSession(input) {
      await sessions.save({
        tokenHash: input.tokenHash,
        userId: input.userId,
        expiresAt: input.expiresAt,
      });
    },
    async deleteSessionByTokenHash(tokenHash) {
      await sessions.delete({ tokenHash });
    },
  };
}
