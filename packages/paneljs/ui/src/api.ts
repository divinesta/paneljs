import type { RecordData, Schema } from "./types";
import { adminBasePath, joinAdminPath } from "./config";

export const apiBase = joinAdminPath(adminBasePath, "/api");

export type ApiErrorDetails = {
  message: string;
  /** The input the error belongs to, when the server knows it. */
  field?: string;
};

export const readApiErrorDetails = async (
  response: Response,
): Promise<ApiErrorDetails> => {
  const fallback = `Request failed (${response.status}).`;
  try {
    const body = (await response.json()) as { error?: string; field?: string };
    return {
      message: body.error ?? fallback,
      ...(typeof body.field === "string" ? { field: body.field } : {}),
    };
  } catch {
    return { message: fallback };
  }
};

export const readApiError = async (response: Response): Promise<string> =>
  (await readApiErrorDetails(response)).message;

export const fetchSchema = async (): Promise<Schema> => {
  const response = await fetch(`${apiBase}/schema`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (response.status === 401 || response.status === 403)
    throw new Error("UNAUTHORIZED");
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json() as Promise<Schema>;
};

export const fetchRecord = async (
  model: string,
  id: string,
): Promise<RecordData> => {
  const response = await fetch(
    `${apiBase}/${model}/${encodeURIComponent(id)}`,
    { credentials: "include", headers: { Accept: "application/json" } },
  );
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json() as Promise<RecordData>;
};
