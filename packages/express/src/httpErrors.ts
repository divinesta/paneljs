import type { ErrorRequestHandler, Response } from "express";
import { AdminApiError } from "paneljs";

export function sendApiError(res: Response, error: AdminApiError): void {
  res.status(error.status).json({ error: error.message, code: error.code });
}

export const createApiErrorHandler =
  (): ErrorRequestHandler => (error, _req, res, _next) => {
    if (res.headersSent) return;
    if (error instanceof AdminApiError) {
      sendApiError(res, error);
      return;
    }

    console.error("[paneljs] Unexpected API error", error);
    res
      .status(500)
      .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  };
