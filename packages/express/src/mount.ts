import { json, Router, static as expressStatic } from "express";
import type { Application } from "express";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  DEFAULT_AUTH_SESSION_MODEL,
  DEFAULT_AUTH_USER_MODEL,
  getAdminUiDist,
  isBuiltInAuth,
  resolveAuthStore,
  type Admin,
  type AdminAuthStore,
} from "paneljs";
import { createActionRouter } from "./actionRouter.js";
import {
  createBuiltInAuthenticationMiddleware,
  createBuiltInAuthRouter,
  enforceBuiltInAdminPage,
} from "./builtIn.js";
import { createCrudRouter } from "./crudRouter.js";
import { createApiErrorHandler } from "./httpErrors.js";
import { createAuthenticationMiddleware } from "./middleware.js";
import { createSchemaEndpoint } from "./schemaEndpoint.js";

function normalizeBasePath(basePath = "/admin"): string {
  if (!basePath.startsWith("/"))
    throw new Error("[paneljs] basePath must start with '/'.");
  return basePath.length > 1 ? basePath.replace(/\/+$/, "") : basePath;
}

function isSameOriginMutation(req: import("express").Request): boolean {
  const origin = req.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === req.get("host");
  } catch {
    return false;
  }
}

/** Mount a PanelJS admin onto an Express application. */
export async function mount(app: Application, admin: Admin): Promise<void> {
  await admin.initialize();

  const config = admin.config;
  const basePath = normalizeBasePath(config.basePath);
  let authStore: AdminAuthStore | undefined;

  if (isBuiltInAuth(config.auth)) {
    if (
      process.env.NODE_ENV === "production" &&
      config.auth.secureCookies === false
    ) {
      throw new Error(
        "[paneljs] Built-in auth refuses secureCookies: false in production.",
      );
    }
    authStore = resolveAuthStore(config.adapter, config.auth);
    const protectedModels = new Set([
      config.auth.userModel ?? DEFAULT_AUTH_USER_MODEL,
      config.auth.sessionModel ?? DEFAULT_AUTH_SESSION_MODEL,
    ]);
    const exposedModel = admin.registry
      .getAll()
      .find((model) => protectedModels.has(model.meta.name));
    if (exposedModel)
      throw new Error(
        `[paneljs] Built-in auth model "${exposedModel.meta.name}" cannot be registered in the admin panel.`,
      );
  }

  const router = Router();

  router.use((_req, res, next) => {
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
    next();
  });

  router.use(json());

  if (isBuiltInAuth(config.auth) && authStore) {
    router.use(
      "/api/auth",
      createBuiltInAuthRouter(authStore, config.auth, basePath),
    );
  }

  router.use(
    "/api",
    isBuiltInAuth(config.auth) && authStore
      ? createBuiltInAuthenticationMiddleware(authStore)
      : createAuthenticationMiddleware(config.auth),
  );
  router.use("/api", (req, res, next) => {
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
      !isSameOriginMutation(req)
    ) {
      res.status(403).json({
        error: "Cross-origin requests are not allowed.",
        code: "ORIGIN_FORBIDDEN",
      });
      return;
    }
    next();
  });
  router.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    next();
  });

  router.get("/api/schema", createSchemaEndpoint(admin));

  const modelsByPluralName = new Map(
    admin.registry.getAll().map((model) => [model.meta.pluralName, model]),
  );
  router.use("/api", createActionRouter(modelsByPluralName, admin.service));
  router.use("/api", createCrudRouter(modelsByPluralName, admin.service));
  router.use("/api", createApiErrorHandler());

  const uiDist = getAdminUiDist();
  if (isBuiltInAuth(config.auth) && authStore)
    router.use(enforceBuiltInAdminPage(authStore, basePath));
  router.use(expressStatic(uiDist, { index: false }));
  router.get(/^(?!\/api(?:\/|$)).*/, async (_req, res, next) => {
    try {
      const indexHtml = await readFile(resolve(uiDist, "index.html"), "utf8");
      const safeBasePath = JSON.stringify(basePath).replace(/</g, "\\u003c");
      const assetBasePath = basePath === "/" ? "" : basePath;
      const renderedIndex = indexHtml
        .replaceAll("/__PANELJS_BASE_PATH__", assetBasePath)
        .replace(
          "</head>",
          `<script>window.__PANELJS_BASE_PATH__=${safeBasePath};</script></head>`,
        );
      res.type("html").send(renderedIndex);
    } catch (error) {
      next(error);
    }
  });

  app.use(basePath, router);

  const modelCount = admin.registry.size;
  console.log(
    `[paneljs] Mounted at ${basePath}. ` +
      `${modelCount} model${modelCount !== 1 ? "s" : ""} registered.`,
  );
}
