import type { AdminModelMeta } from "./types.js";
import { RequestValidationError } from "./validation.js";

/** Parse a path or action id into the model's primary-key type. */
export function parseRecordId(
  meta: AdminModelMeta,
  rawId: string,
): string | number {
  const idField = meta.fields.find((field) => field.name === meta.idField);
  if (idField?.type !== "number") return rawId;

  if (!/^-?(?:0|[1-9]\d*)$/.test(rawId))
    throw new RequestValidationError(
      `Record ID for "${meta.name}" must be an integer.`,
    );
  const id = Number(rawId);
  if (!Number.isSafeInteger(id))
    throw new RequestValidationError(
      `Record ID for "${meta.name}" must be a safe integer.`,
    );
  return id;
}
