import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  SESSION_COOKIE_NAME,
  authenticateBuiltInRequest,
  authenticateSession,
  clearedSessionCookie,
  hashAdminPassword,
  isBuiltInAuth,
  loginWithPassword,
  logoutBuiltIn,
  readSessionToken,
  resolveAuthStore,
  sessionCookie,
  verifyAdminPassword,
  verifyLoginPassword,
  type AdminAuthStore,
  type BuiltInUserRecord,
} from "../src/index.js";
import {
  builtInUserToAdminUser,
  hashSessionToken,
} from "../src/builtInAuth.js";
import { adapterFor } from "./fixtures.js";

const activeUser: BuiltInUserRecord = {
  id: "admin-1",
  email: "ada@example.test",
  passwordHash: "",
  role: "ADMIN",
  isActive: true,
  tenantId: "tenant-a",
};

function store(overrides: Partial<AdminAuthStore> = {}): AdminAuthStore {
  return {
    findUserByIdentifier: vi.fn().mockResolvedValue(null),
    createUser: vi.fn().mockResolvedValue(undefined),
    findSessionWithUser: vi.fn().mockResolvedValue(null),
    createSession: vi.fn().mockResolvedValue(undefined),
    deleteSessionByTokenHash: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hashAdminPassword("correct horse battery staple");
}, 20_000);

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("passwords", () => {
  it("hashes with bounded scrypt parameters", () => {
    const [prefix, cost, blockSize, parallelism, salt, derived] =
      passwordHash.split("$");
    expect({ prefix, cost, blockSize, parallelism }).toEqual({
      prefix: "scrypt",
      cost: "131072",
      blockSize: "8",
      parallelism: "1",
    });
    expect(salt).toBeTruthy();
    expect(derived).toBeTruthy();
  });

  it("accepts the correct password and rejects another", async () => {
    await expect(
      verifyAdminPassword("correct horse battery staple", passwordHash),
    ).resolves.toBe(true);
    await expect(verifyAdminPassword("wrong", passwordHash)).resolves.toBe(
      false,
    );
  });

  it.each([
    "",
    "sha256$1$2$3$salt$value",
    "scrypt$3$8$1$salt$value",
    "scrypt$131072$99$1$salt$value",
    "scrypt$131072$8$1$salt$short",
  ])("rejects malformed or unsafe hash %s", async (storedHash) => {
    await expect(verifyAdminPassword("password", storedHash)).resolves.toBe(
      false,
    );
  });

  it("performs safe login verification when no stored account hash exists", async () => {
    await expect(verifyLoginPassword("password")).resolves.toBe(false);
  });
});

describe("built-in user normalization", () => {
  it("normalizes an active administrator", () => {
    expect(builtInUserToAdminUser(activeUser)).toEqual({
      id: "admin-1",
      email: "ada@example.test",
      role: "ADMIN",
      isSuperAdmin: false,
      tenantId: "tenant-a",
    });
  });

  it("supports username administrators", () => {
    expect(
      builtInUserToAdminUser({
        ...activeUser,
        email: undefined,
        username: "ada",
        role: "SUPER_ADMIN",
      }),
    ).toMatchObject({
      email: "ada",
      username: "ada",
      role: "SUPER_ADMIN",
      isSuperAdmin: true,
    });
  });

  it.each([
    [{ ...activeUser, isActive: false }],
    [{ ...activeUser, role: "USER" }],
  ])("rejects inactive or unsupported administrators", (user) => {
    expect(builtInUserToAdminUser(user)).toBeNull();
  });
});

describe("session tokens and cookies", () => {
  it("hashes session tokens deterministically without retaining the token", () => {
    expect(hashSessionToken("secret-session-token")).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSessionToken("secret-session-token")).toBe(
      hashSessionToken("secret-session-token"),
    );
    expect(hashSessionToken("secret-session-token")).not.toContain("secret");
  });

  it("reads the named cookie among other cookies", () => {
    expect(
      readSessionToken({
        headers: {
          cookie: `theme=dark; ${SESSION_COOKIE_NAME}=token%3Dvalue; other=yes`,
        },
      }),
    ).toBe("token=value");
  });

  it("returns null for missing or malformed cookies", () => {
    expect(readSessionToken({ headers: {} })).toBeNull();
    expect(
      readSessionToken({
        headers: { cookie: `${SESSION_COOKIE_NAME}=%E0%A4%A` },
      }),
    ).toBeNull();
  });

  it("creates a base-path-scoped cookie with a matching lifetime", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-22T12:00:00.000Z"));
    const expires = new Date("2026-08-22T13:00:00.000Z");

    expect(
      sessionCookie(
        "raw-token",
        { mode: "built-in", identifier: "email", secureCookies: true },
        "/control",
        expires,
      ),
    ).toEqual({
      name: SESSION_COOKIE_NAME,
      value: "raw-token",
      path: "/control",
      httpOnly: true,
      sameSite: "Lax",
      maxAge: 3600,
      expires,
      secure: true,
    });
  });

  it("defaults secure cookies by environment and allows explicit override", () => {
    const expires = new Date(Date.now() + 60_000);
    vi.stubEnv("NODE_ENV", "production");
    expect(
      sessionCookie(
        "token",
        { mode: "built-in", identifier: "email" },
        "/admin",
        expires,
      ).secure,
    ).toBe(true);
    expect(
      sessionCookie(
        "token",
        { mode: "built-in", identifier: "email", secureCookies: false },
        "/admin",
        expires,
      ).secure,
    ).toBe(false);
  });

  it("creates an immediately expired clearing cookie", () => {
    expect(
      clearedSessionCookie(
        { mode: "built-in", identifier: "email", secureCookies: false },
        "/admin",
      ),
    ).toMatchObject({
      name: SESSION_COOKIE_NAME,
      value: "",
      path: "/admin",
      maxAge: 0,
      expires: new Date(0),
    });
  });
});

describe("authentication store resolution", () => {
  it("prefers an explicitly configured store", () => {
    const explicit = store();
    const adapter = adapterFor();
    adapter.createAuthStore = vi.fn(() => store());

    expect(
      resolveAuthStore(adapter, {
        mode: "built-in",
        identifier: "email",
        store: explicit,
      }),
    ).toBe(explicit);
    expect(adapter.createAuthStore).not.toHaveBeenCalled();
  });

  it("asks the adapter to create the store", () => {
    const created = store();
    const adapter = adapterFor();
    adapter.createAuthStore = vi.fn(() => created);

    expect(
      resolveAuthStore(adapter, { mode: "built-in", identifier: "username" }),
    ).toBe(created);
    expect(adapter.createAuthStore).toHaveBeenCalledWith({
      mode: "built-in",
      identifier: "username",
    });
  });

  it("fails clearly when no store is available", () => {
    expect(() =>
      resolveAuthStore(adapterFor(), { mode: "built-in", identifier: "email" }),
    ).toThrow("Built-in auth requires auth.store");
  });

  it("distinguishes built-in and external auth configurations", () => {
    expect(isBuiltInAuth({ mode: "built-in", identifier: "email" })).toBe(true);
    expect(isBuiltInAuth({ getCurrentUser: async () => null })).toBe(false);
  });
});

describe("session authentication", () => {
  it("authenticates a valid unexpired session", async () => {
    const findSessionWithUser = vi.fn().mockResolvedValue({
      tokenHash: hashSessionToken("raw-token"),
      expiresAt: new Date(Date.now() + 60_000),
      user: activeUser,
    });
    const authStore = store({ findSessionWithUser });

    await expect(
      authenticateSession(authStore, "raw-token"),
    ).resolves.toMatchObject({
      id: "admin-1",
      role: "ADMIN",
    });
    expect(findSessionWithUser).toHaveBeenCalledWith(
      hashSessionToken("raw-token"),
    );
  });

  it("rejects missing, absent, expired, inactive, and unsupported sessions", async () => {
    await expect(authenticateSession(store(), null)).resolves.toBeNull();
    await expect(authenticateSession(store(), "missing")).resolves.toBeNull();

    await expect(
      authenticateSession(
        store({
          findSessionWithUser: vi.fn().mockResolvedValue({
            tokenHash: "hash",
            expiresAt: new Date(Date.now() - 1),
            user: activeUser,
          }),
        }),
        "expired",
      ),
    ).resolves.toBeNull();

    await expect(
      authenticateSession(
        store({
          findSessionWithUser: vi.fn().mockResolvedValue({
            tokenHash: "hash",
            expiresAt: new Date(Date.now() + 60_000),
            user: { ...activeUser, isActive: false },
          }),
        }),
        "inactive",
      ),
    ).resolves.toBeNull();
  });

  it("authenticates directly from the request cookie", async () => {
    const authStore = store({
      findSessionWithUser: vi.fn().mockResolvedValue({
        tokenHash: hashSessionToken("raw-token"),
        expiresAt: new Date(Date.now() + 60_000),
        user: activeUser,
      }),
    });
    await expect(
      authenticateBuiltInRequest(
        { headers: { cookie: `${SESSION_COOKIE_NAME}=raw-token` } },
        authStore,
      ),
    ).resolves.toMatchObject({ id: "admin-1" });
  });
});

describe("login and logout", () => {
  it("creates a hashed session and returns the raw token only in cookie data", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-22T12:00:00.000Z"));
    const createSession = vi.fn().mockResolvedValue(undefined);
    const authStore = store({
      findUserByIdentifier: vi.fn().mockResolvedValue({
        ...activeUser,
        passwordHash,
      }),
      createSession,
    });

    const result = await loginWithPassword(
      authStore,
      {
        mode: "built-in",
        identifier: "email",
        sessionTtlSeconds: 3600,
        secureCookies: false,
      },
      {
        identifier: "  ada@example.test  ",
        password: "correct horse battery staple",
      },
      "/admin",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected login success");
    expect(result.cookie.value).toBeTruthy();
    expect(result.cookie.expires).toEqual(new Date("2026-08-22T13:00:00.000Z"));
    expect(createSession).toHaveBeenCalledWith({
      tokenHash: hashSessionToken(result.cookie.value),
      userId: "admin-1",
      expiresAt: new Date("2026-08-22T13:00:00.000Z"),
    });
    expect(JSON.stringify(createSession.mock.calls)).not.toContain(
      result.cookie.value,
    );
  }, 20_000);

  it.each([
    [null, "password"],
    [{ ...activeUser, passwordHash }, "wrong"],
    [
      { ...activeUser, passwordHash, isActive: false },
      "correct horse battery staple",
    ],
    [
      { ...activeUser, passwordHash, role: "USER" },
      "correct horse battery staple",
    ],
  ])(
    "returns the same invalid-credentials response",
    async (user, password) => {
      const authStore = store({
        findUserByIdentifier: vi.fn().mockResolvedValue(user),
      });
      await expect(
        loginWithPassword(
          authStore,
          { mode: "built-in", identifier: "email" },
          { identifier: "ada@example.test", password },
          "/admin",
        ),
      ).resolves.toEqual({
        ok: false,
        status: 401,
        body: { error: "Invalid credentials.", code: "INVALID_CREDENTIALS" },
      });
    },
    20_000,
  );

  it("rejects invalid input before querying the store", async () => {
    const findUserByIdentifier = vi.fn();
    const authStore = store({ findUserByIdentifier });
    await expect(
      loginWithPassword(
        authStore,
        { mode: "built-in", identifier: "email" },
        { identifier: "", password: "" },
        "/admin",
      ),
    ).resolves.toMatchObject({ ok: false, status: 401 });
    expect(findUserByIdentifier).not.toHaveBeenCalled();
  });

  it("deletes the hashed session and clears the cookie on logout", async () => {
    const deleteSessionByTokenHash = vi.fn().mockResolvedValue(undefined);
    const authStore = store({ deleteSessionByTokenHash });
    const result = await logoutBuiltIn(
      authStore,
      { headers: { cookie: `${SESSION_COOKIE_NAME}=raw-token` } },
      { mode: "built-in", identifier: "email", secureCookies: false },
      "/admin",
    );

    expect(deleteSessionByTokenHash).toHaveBeenCalledWith(
      hashSessionToken("raw-token"),
    );
    expect(result).toMatchObject({
      status: 204,
      cookie: { value: "", path: "/admin", maxAge: 0 },
    });
  });

  it("makes logout without a cookie idempotent", async () => {
    const deleteSessionByTokenHash = vi.fn();
    await logoutBuiltIn(
      store({ deleteSessionByTokenHash }),
      { headers: {} },
      { mode: "built-in", identifier: "email" },
      "/admin",
    );
    expect(deleteSessionByTokenHash).not.toHaveBeenCalled();
  });
});
