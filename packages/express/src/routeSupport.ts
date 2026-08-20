import type { NextFunction, Request, RequestHandler, Response } from "express";
import {
  AdminApiError,
  AuthenticationError,
  ModelNotFoundError,
  PermissionDeniedError,
  RequestValidationError,
  hasModelPermission,
  parseRecordId,
  type AdminOperation,
  type AdminUser,
  type FullRegisteredModel,
  type AdminModelMeta,
} from "paneljs";
import { sendApiError } from "./httpErrors.js";

export function route(
  handler: (req: Request, res: Response) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void handler(req, res).catch((error: unknown) =>
      sendRouteError(error, res, next),
    );
  };
}

export function sendRouteError(
  error: unknown,
  res: Response,
  next: NextFunction,
): void {
  if (error instanceof AdminApiError) {
    sendApiError(res, error);
    return;
  }
  next(error);
}

export function getAdminUser(req: Request, res: Response): AdminUser | null {
  if (!req.adminUser) {
    sendApiError(res, new AuthenticationError());
    return null;
  }
  return req.adminUser;
}

export function getRegisteredModel(
  req: Request,
  res: Response,
  models: Map<string, FullRegisteredModel>,
): FullRegisteredModel | null {
  const modelName = req.params.model;
  const model =
    typeof modelName === "string" ? models.get(modelName) : undefined;
  if (!model) {
    sendApiError(res, new ModelNotFoundError());
    return null;
  }
  return model;
}

export function authorizeModelOperation(
  req: Request,
  res: Response,
  model: FullRegisteredModel,
  operation: AdminOperation,
): AdminUser | null {
  const adminUser = getAdminUser(req, res);
  if (!adminUser) return null;
  if (!hasModelPermission(adminUser, model.resolved.permissions, operation)) {
    sendApiError(res, new PermissionDeniedError());
    return null;
  }
  return adminUser;
}

export function getRecordId(
  req: Request,
  meta: AdminModelMeta,
): string | number {
  const rawId = req.params.id;
  if (typeof rawId !== "string")
    throw new RequestValidationError(
      "Record ID must be a single path parameter.",
    );
  return parseRecordId(meta, rawId);
}

export { parseRecordId };
