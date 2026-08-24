import type { AdminAuthStore, AuthStoreOptions } from "./authStore.js";
import type { AdminModelMeta } from "./types.js";
import type {
  CountQuery,
  CreateQuery,
  DeleteManyQuery,
  FindFirstQuery,
  FindManyQuery,
  UpdateManyQuery,
} from "./query.js";

/** The subset of CRUD a host ORM must implement for one model. */
export interface ModelResource {
  findMany(query: FindManyQuery): Promise<Record<string, unknown>[]>;
  findFirst(query: FindFirstQuery): Promise<Record<string, unknown> | null>;
  count(query: CountQuery): Promise<number>;
  create(query: CreateQuery): Promise<Record<string, unknown>>;
  updateMany(query: UpdateManyQuery): Promise<{ count: number }>;
  deleteMany(query: DeleteManyQuery): Promise<{ count: number }>;
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
  /** Optional. Built-in login uses this when `auth.store` is not set. */
  createAuthStore?(options: AuthStoreOptions): AdminAuthStore;
}
