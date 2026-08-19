import type { RequestHandler } from "express";
import {
  AuthenticationError,
  buildSchemaResponse,
  isBuiltInAuth,
  type Admin,
} from "@paneljs/paneljs";
import { sendApiError } from "./httpErrors.js";

export function createSchemaEndpoint(admin: Admin): RequestHandler {
  const basePath =
    admin.config.basePath && admin.config.basePath.length > 1
      ? admin.config.basePath.replace(/\/+$/, "")
      : (admin.config.basePath ?? "/admin");
  const siteName = admin.config.siteName ?? "PanelJS";

  return (req, res) => {
    const adminUser = req.adminUser;
    if (!adminUser) {
      sendApiError(res, new AuthenticationError());
      return;
    }

    res.json(
      buildSchemaResponse(admin.registry, {
        adminUser,
        siteName,
        basePath,
        authMode: isBuiltInAuth(admin.config.auth) ? "built-in" : "external",
      }),
    );
  };
}
