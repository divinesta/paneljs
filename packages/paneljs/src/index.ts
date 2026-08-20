import type { AdminConfig, ModelConfig } from "./types.js";
import { AdminRegistry } from "./registry.js";

export interface Admin {
   register(modelName: string, modelConfig?: ModelConfig): Admin;
   initialize(): Promise<void>;
   readonly registry: AdminRegistry;
   readonly config: AdminConfig;
}

export function createAdmin(config: AdminConfig): Admin {
   const registry = new AdminRegistry();
   let initialized = false;

   const admin: Admin = {
      register(modelName: string, modelConfig: ModelConfig = {}) {
         registry.register(modelName, modelConfig);
         return admin;
      },
      async initialize() {
         if (initialized) return;
         const models = await config.adapter.introspect();
         await registry.initialize(models);
         initialized = true;
      },
      get registry() {
         return registry;
      },
      get config() {
         return config;
      },
   };

   return admin;
}

export type {
   AdminConfig,
   ModelConfig,
   AdminUser,
   AuthConfig,
   BuiltInAuthConfig,
   ExternalAuthConfig,
   AdminHttpRequest,
   AuditConfig,
   AdminAuditEvent,
   AdminFieldMeta,
   AdminModelMeta,
   AdminFieldType,
   RelationKind,
   ModelPermissions,
   AdminAction,
   AdminFieldOverride,
   PaginatedResponse,
   SchemaResponse,
} from "./types.js";
export type { DataAdapter, ModelResource } from "./adapter.js";
export type {
   ActionWhere,
   CountQuery,
   CreateQuery,
   DeleteManyQuery,
   EqualityFilter,
   FieldFilter,
   FieldFilters,
   FieldSelect,
   FindFirstQuery,
   FindManyQuery,
   RelationSelect,
   SearchQuery,
   UpdateManyQuery,
} from "./query.js";
export { idSelect, withSelectFields } from "./query.js";
export type { ResolvedModelConfig, FullRegisteredModel } from "./registry.js";
export { AdminRegistry } from "./registry.js";
export { hashAdminPassword, verifyAdminPassword, verifyLoginPassword } from "./passwords.js";
export { AdminApiError, AuthenticationError, PermissionDeniedError, ModelNotFoundError, RecordNotFoundError } from "./errors.js";
export { RequestValidationError, isFieldVisible, isFieldWritable, isSensitiveFieldName, validateWritePayload, validateHookPayload, assertRequiredCreateFields } from "./validation.js";
export { hasModelPermission, hasActionPermission, hasRegisteredActionPermission } from "./permissions.js";
export type { AdminOperation } from "./permissions.js";
export { DELETE_SELECTED_ACTION } from "./defaultActions.js";
export { writeAuditEvent } from "./audit.js";
export { buildSchemaResponse } from "./schema.js";
export { parseListQuery } from "./listQuery.js";
export type { ParsedListQuery } from "./listQuery.js";
export { parseRecordId } from "./ids.js";
export { buildRecordSelect, buildListRecordSelect, assertSelectedRelationsAreVisible } from "./recordSelection.js";
export { applyCreateScope, assertScopeFieldsUnchanged, buildScopedRecordWhere, collectScopeFieldNames, resolveScope } from "./scope.js";
export { getAdminUiDist } from "./uiPath.js";
export { isBuiltInAuth } from "./authMode.js";
export type { AdminAuthStore, AuthStoreOptions, BuiltInSessionRecord, BuiltInUserRecord } from "./authStore.js";
export { DEFAULT_AUTH_SESSION_MODEL, DEFAULT_AUTH_USER_MODEL } from "./authStore.js";
export {
   SESSION_COOKIE_NAME,
   authenticateBuiltInRequest,
   authenticateSession,
   clearedSessionCookie,
   loginWithPassword,
   logoutBuiltIn,
   readSessionToken,
   resolveAuthStore,
   sessionCookie,
} from "./builtInAuth.js";
export type { BuiltInLoginResult, BuiltInLogoutResult, SessionCookie } from "./builtInAuth.js";
