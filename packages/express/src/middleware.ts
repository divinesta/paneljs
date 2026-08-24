import type { RequestHandler } from "express";
import { AuthenticationError, type AdminUser, type AuthConfig } from "paneljs";
import { sendApiError } from "./httpErrors.js";

function isAdminUser(value: unknown): value is AdminUser {
  if (typeof value !== "object" || value === null) return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === "string" &&
    typeof user.email === "string" &&
    typeof user.role === "string" &&
    typeof user.isSuperAdmin === "boolean"
  );
}

export function createAuthenticationMiddleware(
  auth: AuthConfig,
): RequestHandler {
  return async (req, res, next) => {
    try {
      if (!("getCurrentUser" in auth)) {
        sendApiError(res, new AuthenticationError());
        return;
      }
      const adminUser = await auth.getCurrentUser(req);

      if (!isAdminUser(adminUser)) {
        sendApiError(res, new AuthenticationError());
        return;
      }

      req.adminUser = adminUser;
      next();
    } catch {
      sendApiError(res, new AuthenticationError());
    }
  };
}
