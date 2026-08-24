import type { Request, RequestHandler } from "express";
import type {
  AdminAuthStore,
  AdminUser,
  BuiltInAuthConfig,
  SessionCookie,
} from "paneljs";
import {
  authenticateBuiltInRequest,
  hashAdminPassword,
  isBuiltInAuth as isBuiltInAuthMode,
  loginWithPassword,
  logoutBuiltIn,
  verifyAdminPassword,
} from "paneljs";
import { createLoginRateLimiter } from "./loginRateLimit.js";

export { hashAdminPassword, verifyAdminPassword };
export const isBuiltInAuth = isBuiltInAuthMode;

function pathAtBase(basePath: string, path: string): string {
  return `${basePath === "/" ? "" : basePath}${path}`;
}

function serializeCookie(cookie: SessionCookie): string {
  return [
    `${cookie.name}=${encodeURIComponent(cookie.value)}`,
    `Path=${cookie.path}`,
    cookie.httpOnly ? "HttpOnly" : "",
    `SameSite=${cookie.sameSite}`,
    `Max-Age=${cookie.maxAge}`,
    `Expires=${cookie.expires.toUTCString()}`,
    cookie.secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function hasSameOrigin(req: Request): boolean {
  const origin = req.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === req.get("host");
  } catch {
    return false;
  }
}

export const getBuiltInAdminUser = async (
  req: Request,
  store: AdminAuthStore,
): Promise<AdminUser | null> => authenticateBuiltInRequest(req, store);

export const createBuiltInAuthRouter = (
  store: AdminAuthStore,
  config: BuiltInAuthConfig,
  basePath = "/admin",
): RequestHandler => {
  const consumeLoginAttempt = createLoginRateLimiter(config);

  return async (req, res, next) => {
    if (req.method === "GET" && req.path === "/config") {
      res.json({ identifier: config.identifier });
      return;
    }

    if (req.method === "POST" && req.path === "/login") {
      try {
        if (!hasSameOrigin(req)) {
          res.status(403).json({
            error: "Cross-origin authentication requests are not allowed.",
            code: "ORIGIN_FORBIDDEN",
          });
          return;
        }
        const body = req.body as { identifier?: unknown; password?: unknown };
        const identifier =
          typeof body?.identifier === "string" ? body.identifier.trim() : "";
        const password =
          typeof body?.password === "string" ? body.password : "";
        if (
          !identifier ||
          !password ||
          identifier.length > 254 ||
          password.length > 1_024
        ) {
          res.status(401).json({
            error: "Invalid credentials.",
            code: "INVALID_CREDENTIALS",
          });
          return;
        }
        const retryAfter = consumeLoginAttempt(req, identifier);
        if (retryAfter !== null) {
          res.setHeader("Retry-After", String(retryAfter));
          res.status(429).json({
            error: "Too many sign-in attempts. Please try again later.",
            code: "LOGIN_RATE_LIMITED",
          });
          return;
        }

        const result = await loginWithPassword(
          store,
          config,
          { identifier, password },
          basePath,
        );
        if (result.ok)
          res.setHeader("Set-Cookie", serializeCookie(result.cookie));
        res.status(result.status).json(result.body);
        return;
      } catch (error) {
        next(error);
        return;
      }
    }

    if (req.method === "POST" && req.path === "/logout") {
      try {
        if (!hasSameOrigin(req)) {
          res.status(403).json({
            error: "Cross-origin authentication requests are not allowed.",
            code: "ORIGIN_FORBIDDEN",
          });
          return;
        }
        const result = await logoutBuiltIn(store, req, config, basePath);
        res.setHeader("Set-Cookie", serializeCookie(result.cookie));
        res.status(result.status).end();
        return;
      } catch (error) {
        next(error);
        return;
      }
    }

    next();
  };
};

export const createBuiltInAuthenticationMiddleware =
  (store: AdminAuthStore): RequestHandler =>
  async (req, res, next) => {
    try {
      const adminUser = await getBuiltInAdminUser(req, store);
      if (!adminUser) {
        res.status(401).json({
          error: "Authentication required",
          code: "AUTHENTICATION_REQUIRED",
        });
        return;
      }
      req.adminUser = adminUser;
      next();
    } catch {
      res.status(401).json({
        error: "Authentication required",
        code: "AUTHENTICATION_REQUIRED",
      });
    }
  };

export const enforceBuiltInAdminPage =
  (store: AdminAuthStore, basePath: string): RequestHandler =>
  async (req, res, next) => {
    if (
      req.path === "/login" ||
      req.path.startsWith("/api/") ||
      req.path.startsWith("/assets/")
    ) {
      next();
      return;
    }
    const adminUser = await getBuiltInAdminUser(req, store);
    if (!adminUser) {
      res.redirect(pathAtBase(basePath, "/login"));
      return;
    }
    next();
  };
