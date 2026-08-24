import { createHash, randomBytes } from "node:crypto";
import type { AdminAuthStore, BuiltInUserRecord } from "./authStore.js";
import type {
  AdminHttpRequest,
  AdminUser,
  BuiltInAuthConfig,
} from "./types.js";
import type { DataAdapter } from "./adapter.js";
import { verifyLoginPassword } from "./passwords.js";

export const SESSION_COOKIE_NAME = "paneljs_session";
export const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SessionCookie = {
  name: string;
  value: string;
  path: string;
  httpOnly: true;
  sameSite: "Lax";
  maxAge: number;
  expires: Date;
  secure: boolean;
};

export type BuiltInLoginFailure = {
  ok: false;
  status: 401;
  body: { error: string; code: string };
};

export type BuiltInLoginSuccess = {
  ok: true;
  status: 200;
  body: { ok: true };
  cookie: SessionCookie;
};

export type BuiltInLoginResult = BuiltInLoginFailure | BuiltInLoginSuccess;

export type BuiltInLogoutResult = {
  status: 204;
  cookie: SessionCookie;
};

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function readSessionToken(req: AdminHttpRequest): string | null {
  const header = req.headers.cookie;
  if (typeof header !== "string") return null;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === SESSION_COOKIE_NAME) {
      try {
        return decodeURIComponent(value.join("="));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function cookieSecure(config: BuiltInAuthConfig): boolean {
  return config.secureCookies ?? process.env.NODE_ENV === "production";
}

export function sessionCookie(
  token: string,
  config: BuiltInAuthConfig,
  basePath: string,
  expires: Date,
): SessionCookie {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    path: basePath,
    httpOnly: true,
    sameSite: "Lax",
    maxAge: Math.max(0, Math.floor((expires.getTime() - Date.now()) / 1000)),
    expires,
    secure: cookieSecure(config),
  };
}

export function clearedSessionCookie(
  config: BuiltInAuthConfig,
  basePath: string,
): SessionCookie {
  return {
    name: SESSION_COOKIE_NAME,
    value: "",
    path: basePath,
    httpOnly: true,
    sameSite: "Lax",
    maxAge: 0,
    expires: new Date(0),
    secure: cookieSecure(config),
  };
}

export function builtInUserToAdminUser(
  user: BuiltInUserRecord,
): AdminUser | null {
  if (!user.isActive || !["ADMIN", "SUPER_ADMIN"].includes(user.role))
    return null;
  return {
    id: user.id,
    email: user.email ?? user.username ?? user.id,
    ...(user.username ? { username: user.username } : {}),
    ...(user.tenantId ? { tenantId: user.tenantId } : {}),
    role: user.role,
    isSuperAdmin: user.role === "SUPER_ADMIN",
  };
}

export function resolveAuthStore(
  adapter: DataAdapter,
  auth: BuiltInAuthConfig,
): AdminAuthStore {
  if (auth.store) return auth.store;
  if (adapter.createAuthStore) return adapter.createAuthStore(auth);
  throw new Error(
    "[paneljs] Built-in auth requires auth.store or an adapter that implements createAuthStore().",
  );
}

export async function authenticateSession(
  store: AdminAuthStore,
  token: string | null,
): Promise<AdminUser | null> {
  if (!token) return null;
  const session = await store.findSessionWithUser(hashSessionToken(token));
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  return builtInUserToAdminUser(session.user);
}

export async function authenticateBuiltInRequest(
  req: AdminHttpRequest,
  store: AdminAuthStore,
): Promise<AdminUser | null> {
  return authenticateSession(store, readSessionToken(req));
}

const invalidCredentials: BuiltInLoginFailure = {
  ok: false,
  status: 401,
  body: { error: "Invalid credentials.", code: "INVALID_CREDENTIALS" },
};

export async function loginWithPassword(
  store: AdminAuthStore,
  config: BuiltInAuthConfig,
  credentials: { identifier: string; password: string },
  basePath: string,
): Promise<BuiltInLoginResult> {
  const identifier = credentials.identifier.trim();
  const password = credentials.password;
  if (
    !identifier ||
    !password ||
    identifier.length > 254 ||
    password.length > 1_024
  ) {
    return invalidCredentials;
  }

  const user = await store.findUserByIdentifier(identifier);
  const passwordMatches = await verifyLoginPassword(
    password,
    user?.passwordHash,
  );
  const adminUser =
    user && passwordMatches ? builtInUserToAdminUser(user) : null;
  if (!user || !adminUser) return invalidCredentials;

  const token = randomBytes(32).toString("base64url");
  const ttlSeconds = config.sessionTtlSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1_000);
  await store.createSession({
    tokenHash: hashSessionToken(token),
    userId: user.id,
    expiresAt,
  });
  return {
    ok: true,
    status: 200,
    body: { ok: true },
    cookie: sessionCookie(token, config, basePath, expiresAt),
  };
}

export async function logoutBuiltIn(
  store: AdminAuthStore,
  req: AdminHttpRequest,
  config: BuiltInAuthConfig,
  basePath: string,
): Promise<BuiltInLogoutResult> {
  const token = readSessionToken(req);
  if (token) await store.deleteSessionByTokenHash(hashSessionToken(token));
  return { status: 204, cookie: clearedSessionCookie(config, basePath) };
}
