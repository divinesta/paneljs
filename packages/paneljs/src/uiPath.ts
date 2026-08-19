import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path to the pre-built admin SPA (`ui/dist`). */
export function getAdminUiDist(): string {
   return resolve(dirname(fileURLToPath(import.meta.url)), "../ui/dist");
}
