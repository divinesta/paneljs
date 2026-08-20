import type { DataAdapter } from "@paneljs/paneljs";
import type { DataSource } from "typeorm";
import { introspect } from "./introspector.js";

export interface TypeormAdapterOptions {
  dataSource: DataSource;
}

/**
 * PanelJS adapter for TypeORM.
 * The DataSource must already be initialized (entities registered, connection open).
 */
export function typeormAdapter(options: TypeormAdapterOptions): DataAdapter {
  const { dataSource } = options;
  if (!dataSource.isInitialized) {
    throw new Error(
      "[paneljs] typeormAdapter requires an initialized DataSource. Call await dataSource.initialize() first.",
    );
  }

  return {
    client: dataSource,
    async introspect() {
      return introspect(dataSource);
    },
    resource() {
      throw new Error("[paneljs] TypeORM resource is not implemented yet.");
    },
  };
}

export { introspect };
