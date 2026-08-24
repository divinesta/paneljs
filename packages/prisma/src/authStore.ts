import type {
  AdminAuthStore,
  AuthStoreOptions,
  BuiltInSessionRecord,
  BuiltInUserRecord,
} from "paneljs";
import { DEFAULT_AUTH_SESSION_MODEL, DEFAULT_AUTH_USER_MODEL } from "paneljs";
type PrismaClientLike = object;

type UserDelegate = {
  findUnique(args: unknown): Promise<unknown>;
  create(args: unknown): Promise<unknown>;
};

type SessionDelegate = {
  findFirst(args: unknown): Promise<unknown>;
  create(args: unknown): Promise<unknown>;
  deleteMany(args: unknown): Promise<unknown>;
};

function modelKey(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

function delegateFor<T extends object>(
  prisma: PrismaClientLike,
  modelName: string,
): T {
  const delegate = (prisma as Record<string, unknown>)[modelKey(modelName)];
  if (!delegate || typeof delegate !== "object") {
    throw new Error(
      `[paneljs] Built-in auth requires a Prisma delegate for model "${modelName}".`,
    );
  }
  return delegate as T;
}

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

export function prismaAuthStore(
  prisma: PrismaClientLike,
  options: AuthStoreOptions,
): AdminAuthStore {
  const users = delegateFor<UserDelegate>(
    prisma,
    options.userModel ?? DEFAULT_AUTH_USER_MODEL,
  );
  const sessions = delegateFor<SessionDelegate>(
    prisma,
    options.sessionModel ?? DEFAULT_AUTH_SESSION_MODEL,
  );

  return {
    async findUserByIdentifier(identifier) {
      return asUser(
        await users.findUnique({
          where: { [options.identifier]: identifier },
        }),
      );
    },
    async createUser(input) {
      await users.create({
        data: {
          [options.identifier]: input.identifier,
          passwordHash: input.passwordHash,
          role: input.role,
          isActive: input.isActive,
          ...(input.tenantId ? { tenantId: input.tenantId } : {}),
        },
      });
    },
    async findSessionWithUser(tokenHash) {
      return asSession(
        await sessions.findFirst({
          where: { tokenHash, expiresAt: { gt: new Date() } },
          include: { user: true },
        }),
      );
    },
    async createSession(input) {
      await sessions.create({
        data: {
          tokenHash: input.tokenHash,
          userId: input.userId,
          expiresAt: input.expiresAt,
        },
      });
    },
    async deleteSessionByTokenHash(tokenHash) {
      await sessions.deleteMany({ where: { tokenHash } });
    },
  };
}
