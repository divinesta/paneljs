import type { AdminModelMeta } from "./types.js";

/** The subset of CRUD a host ORM must implement for one model. */
export interface ModelResource {
   findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
   findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
   count(args: Record<string, unknown>): Promise<number>;
   create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
   updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
   deleteMany(args: Record<string, unknown>): Promise<{ count: number }>;
}

/**
 * Host-supplied data layer. Core never imports an ORM.
 * Prisma, TypeORM, and Drizzle each implement this.
 */
export interface DataAdapter {
   /** Opaque client handed to custom action handlers. */
   readonly client: unknown;
   introspect(): Promise<Map<string, AdminModelMeta>>;
   resource(meta: AdminModelMeta): ModelResource;
}
