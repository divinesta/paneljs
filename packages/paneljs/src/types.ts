import type { DataAdapter } from "./adapter.js";
import type { ActionWhere } from "./query.js";
import type { AdminAuthStore } from "./authStore.js";

export type AdminFieldType = "string" | "number" | "boolean" | "datetime" | "json" | "enum" | "relation" | "bytes";

export type RelationKind = "belongsTo" | "hasMany" | "manyToMany" | "hasOne";

export interface AdminFieldMeta {
   name: string;
   type: AdminFieldType;
   /** The ORM's native type name, e.g. Prisma "DateTime". */
   nativeType: string;
   isId: boolean;
   isRequired: boolean;
   isUnique: boolean;
   isReadOnly: boolean;
   isList: boolean;
   isFilterable: boolean;
   isSearchable: boolean;
   defaultValue: unknown;
   enumValues?: string[];
   relation?: {
      model: string;
      kind: RelationKind;
      relationName: string;
      foreignKeyFields: string[];
      onDelete?: string | null;
      displayField: string;
   } | null;
}

export interface AdminModelMeta {
   name: string;
   pluralName: string;
   /** Property used to select this model on the ORM client. */
   clientKey: string;
   fields: AdminFieldMeta[];
   idField: string;
   displayField: string;
   searchableFields: string[];
   filterableFields: string[];
   timestamps: {
      createdAt?: string;
      updatedAt?: string;
   };
}

export interface AdminUser {
   id: string;
   email: string;
   username?: string;
   role: string;
   isSuperAdmin: boolean;
   institutionId?: string;
   tenantId?: string;
   metadata?: Record<string, unknown>;
}

export interface AdminAction {
   name: string;
   label: string;
   handler: (params: { ids: Array<string | number>; adminUser: AdminUser; client: unknown; where: ActionWhere }) => Promise<{ message: string }>;
   allowedRoles?: string[];
}

export interface AdminFieldOverride {
   exclude?: boolean;
   expose?: boolean;
   readOnly?: boolean;
   writeRoles?: string[];
}

export interface ModelPermissions {
   list?: string[];
   view?: string[];
   create?: string[];
   update?: string[];
   delete?: string[];
   actions?: Record<string, string[]>;
}

export interface ModelConfig {
   listDisplay?: string[];
   listFilter?: string[];
   searchFields?: string[];
   defaultSort?: { field: string; direction: "asc" | "desc" };
   perPage?: number;
   fields?: Record<string, AdminFieldOverride>;
   actions?: AdminAction[];
   permissions?: ModelPermissions;
   scope?: (adminUser: AdminUser) => Promise<Record<string, unknown>>;
   beforeCreate?: (data: Record<string, unknown>) => Promise<Record<string, unknown>>;
   afterCreate?: (record: Record<string, unknown>) => Promise<void>;
   beforeUpdate?: (id: string, data: Record<string, unknown>) => Promise<Record<string, unknown>>;
   afterUpdate?: (record: Record<string, unknown>) => Promise<void>;
   beforeDelete?: (id: string) => Promise<void>;
   afterDelete?: (id: string) => Promise<void>;
   displayField?: string;
   pluralName?: string;
}

/** Minimal request shape so core auth types do not import Express. */
export interface AdminHttpRequest {
   headers: Record<string, string | string[] | undefined>;
   get?(name: string): string | undefined;
   ip?: string;
}

export interface ExternalAuthConfig {
   mode?: "external";
   getCurrentUser: (req: AdminHttpRequest) => Promise<AdminUser | null>;
}

export interface BuiltInAuthConfig {
   mode: "built-in";
   identifier: "email" | "username";
   userModel?: string;
   sessionModel?: string;
   sessionTtlSeconds?: number;
   secureCookies?: boolean;
   loginRateLimit?: false | { windowMs?: number; maxAttempts?: number };
   /** Optional override. Prisma adapters supply a store via `createAuthStore`. */
   store?: AdminAuthStore;
}

export type AuthConfig = ExternalAuthConfig | BuiltInAuthConfig;

export interface AdminAuditEvent {
   type: "create" | "update" | "delete" | "action";
   modelName: string;
   recordIds: Array<string | number>;
   actor: { id: string; email: string; role: string };
   timestamp: Date;
   metadata?: Record<string, string | number | boolean | null>;
}

export interface AuditConfig {
   write(event: AdminAuditEvent): Promise<void>;
}

export interface AdminConfig {
   adapter: DataAdapter;
   auth: AuthConfig;
   audit?: AuditConfig;
   basePath?: string;
   siteName?: string;
   /** @deprecated Ignored. The Prisma adapter reads the datasource provider from `schema.prisma`. */
   databaseProvider?: "postgresql" | "mysql" | "sqlite" | "sqlserver" | "mongodb";
}

export interface PaginatedResponse<T> {
   records: T[];
   total: number;
   page: number;
   perPage: number;
   totalPages: number;
}

export interface SchemaResponse {
   identity: {
      id: string;
      email: string;
      role: string;
      isSuperAdmin: boolean;
   };
   authMode: "built-in" | "external";
   models: Array<{
      meta: AdminModelMeta;
      config: {
         listDisplay: string[];
         listFilter: string[];
         searchFields: string[];
         defaultSort: { field: string; direction: "asc" | "desc" };
         perPage: number;
         permissions: {
            list: boolean;
            view: boolean;
            create: boolean;
            update: boolean;
            delete: boolean;
            actions: Record<string, boolean>;
         };
         actions: Array<{ name: string; label: string }>;
      };
   }>;
   siteName: string;
   basePath: string;
}
