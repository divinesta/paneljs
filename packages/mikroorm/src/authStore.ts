import type { FilterQuery, MikroORM } from "@mikro-orm/core";
import type {
  AdminAuthStore,
  AuthStoreOptions,
  BuiltInSessionRecord,
  BuiltInUserRecord,
} from "paneljs";
import { DEFAULT_AUTH_SESSION_MODEL, DEFAULT_AUTH_USER_MODEL } from "paneljs";

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

export function mikroormAuthStore(
  orm: MikroORM,
  options: AuthStoreOptions,
): AdminAuthStore {
  const userModel = options.userModel ?? DEFAULT_AUTH_USER_MODEL;
  const sessionModel = options.sessionModel ?? DEFAULT_AUTH_SESSION_MODEL;

  return {
    async findUserByIdentifier(identifier) {
      const em = orm.em.fork();
      return asUser(
        await em.findOne(userModel, {
          [options.identifier]: identifier,
        } as FilterQuery<object>),
      );
    },
    async findSessionWithUser(tokenHash) {
      const em = orm.em.fork();
      return asSession(
        await em.findOne(
          sessionModel,
          {
            tokenHash,
            expiresAt: { $gt: new Date() },
          } as FilterQuery<object>,
          { populate: ["user"] as never },
        ),
      );
    },
    async createSession(input) {
      const em = orm.em.fork();
      const data: Record<string, unknown> = {
        tokenHash: input.tokenHash,
        user: input.userId,
        expiresAt: input.expiresAt,
      };
      const entity = orm.getMetadata().get(sessionModel);
      for (const prop of Object.values(entity.properties)) {
        if (data[prop.name] !== undefined) continue;
        if (typeof prop.onCreate === "function") {
          data[prop.name] = prop.onCreate(data, em);
        }
      }
      await em.insert(sessionModel, data);
    },
    async deleteSessionByTokenHash(tokenHash) {
      const em = orm.em.fork();
      await em.nativeDelete(sessionModel, { tokenHash } as FilterQuery<object>);
    },
  };
}
