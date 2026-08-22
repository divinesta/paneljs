import type { ErrorRequestHandler, Response } from "express";
import { AdminApiError } from "paneljs";

type BodyParserError = {
  type?: unknown;
};

function getBodyParserError(error: unknown): {
  status: number;
  message: string;
  code: string;
} | null {
  if (typeof error !== "object" || error === null) return null;

  const { type } = error as BodyParserError;
  if (type === "entity.parse.failed") {
    return {
      status: 400,
      message: "Request body must contain valid JSON",
      code: "INVALID_JSON",
    };
  }
  if (type === "entity.too.large") {
    return {
      status: 413,
      message: "Request body is too large",
      code: "BODY_TOO_LARGE",
    };
  }

  return null;
}

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

    const bodyParserError = getBodyParserError(error);
    if (bodyParserError) {
      res.status(bodyParserError.status).json({
        error: bodyParserError.message,
        code: bodyParserError.code,
      });
      return;
    }

    console.error("[paneljs] Unexpected API error", error);
    res
      .status(500)
      .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  };
