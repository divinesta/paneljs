import type { DataAdapter } from "paneljs";
import type { MikroORM } from "@mikro-orm/core";
import { mikroormAuthStore } from "./authStore.js";
import { introspect } from "./introspector.js";
import { mikroormResource } from "./resource.js";

export interface MikroormAdapterOptions {
  orm: MikroORM;
}

function assertReady(orm: MikroORM): void {
  if (typeof orm.getMetadata !== "function" || orm.em === undefined) {
    throw new Error(
      "[paneljs] mikroormAdapter requires an initialized MikroORM instance. Call await MikroORM.init() first.",
    );
  }
}

/**
 * PanelJS adapter for MikroORM.
 * The ORM must already be initialized (entities discovered, connection open).
 */
export function mikroormAdapter(options: MikroormAdapterOptions): DataAdapter {
  const { orm } = options;
  assertReady(orm);

  return {
    client: orm,
    async introspect() {
      return introspect(orm);
    },
    resource(meta) {
      return mikroormResource(orm, meta);
    },
    createAuthStore: (auth) => mikroormAuthStore(orm, auth),
    async dispose() {
      await orm.close(true);
    },
  };
}

export { introspect, usesInsensitiveSearch } from "./introspector.js";
export { mikroormActionWhere, mikroormResource } from "./resource.js";
export { mikroormAuthStore } from "./authStore.js";
export { builtInAuthEntities } from "./authEntities.js";
export type { BuiltInAuthEntityOptions } from "./authEntities.js";
