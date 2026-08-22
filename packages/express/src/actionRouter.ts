import { Router } from "express";
import {
  RequestValidationError,
  parseRecordId,
  validateSelectedIds,
  type AdminModelMeta,
  type AdminService,
  type FullRegisteredModel,
} from "paneljs";

import { getAdminUser, getRegisteredModel, route } from "./routeSupport.js";

function parseIds(meta: AdminModelMeta, body: unknown): Array<string | number> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new RequestValidationError("Request body must be a JSON object.");
  }
  const ids = (body as Record<string, unknown>).ids;
  if (!Array.isArray(ids)) {
    throw new RequestValidationError(
      "Action requests require at least one record ID.",
    );
  }
  const parsed = ids.map((raw) => {
    if (typeof raw !== "string" && typeof raw !== "number") {
      throw new RequestValidationError(
        "Every action record ID must be a string or number.",
      );
    }
    return parseRecordId(meta, String(raw));
  });
  validateSelectedIds(parsed);
  return parsed;
}

function parseIdsQuery(
  meta: AdminModelMeta,
  rawIds: unknown,
): Array<string | number> {
  const ids = Array.isArray(rawIds)
    ? rawIds.flatMap((value) => String(value).split(","))
    : typeof rawIds === "string"
      ? rawIds.split(",")
      : [];
  return parseIds(meta, {
    ids: ids.map((value) => value.trim()).filter(Boolean),
  });
}

/** Express transport for framework-neutral core actions and delete previews. */
export function createActionRouter(
  models: Map<string, FullRegisteredModel>,
  service: AdminService,
): Router {
  const router = Router();

  router.get(
    "/:model/actions/delete-preview",
    route(async (req, res) => {
      const model = getRegisteredModel(req, res, models);
      const adminUser = getAdminUser(req, res);
      if (!model || !adminUser) return;
      res.json(
        await service.deletePreview(
          model,
          adminUser,
          parseIdsQuery(model.meta, req.query.ids),
        ),
      );
    }),
  );

  router.post(
    "/:model/actions/:action",
    route(async (req, res) => {
      const model = getRegisteredModel(req, res, models);
      const adminUser = getAdminUser(req, res);
      if (!model || !adminUser) return;
      const actionName = req.params.action;
      if (typeof actionName !== "string") {
        throw new RequestValidationError(
          "Action name must be a single path parameter.",
        );
      }
      res.json(
        await service.runAction(
          model,
          adminUser,
          actionName,
          parseIds(model.meta, req.body),
        ),
      );
    }),
  );

  return router;
}
