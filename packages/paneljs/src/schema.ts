import { hasModelPermission, hasRegisteredActionPermission } from "./permissions.js";
import { DELETE_SELECTED_ACTION } from "./defaultActions.js";
import type { AdminUser, SchemaResponse } from "./types.js";
import type { AdminRegistry } from "./registry.js";
import { isFieldVisible, isFieldWritable } from "./validation.js";

export function buildSchemaResponse(
   registry: AdminRegistry,
   options: { adminUser: AdminUser; siteName: string; basePath: string; authMode: "built-in" | "external" },
): SchemaResponse {
   const { adminUser, siteName, basePath, authMode } = options;

   return {
      identity: {
         id: adminUser.id,
         email: adminUser.email,
         role: adminUser.role,
         isSuperAdmin: adminUser.isSuperAdmin,
      },
      authMode,
      siteName,
      basePath,
      models: registry
         .getAll()
         .filter(({ resolved }) => hasModelPermission(adminUser, resolved.permissions, "list"))
         .map(({ meta, resolved, raw }) => {
            const visibleFields = meta.fields
               .filter((field) => isFieldVisible(field, raw))
               .map((field) => ({ ...field, isReadOnly: field.isReadOnly || !isFieldWritable(field, raw, adminUser) }));
            const visibleFieldNames = new Set(visibleFields.map((field) => field.name));
            const canDelete = hasModelPermission(adminUser, resolved.permissions, "delete");
            const customActions = (raw.actions ?? [])
               .filter((action) => hasRegisteredActionPermission(adminUser, resolved.permissions, action))
               .map(({ name, label }) => ({ name, label }));
            const actions = canDelete ? [DELETE_SELECTED_ACTION, ...customActions] : customActions;

            return {
               meta: {
                  ...meta,
                  fields: visibleFields,
                  searchableFields: meta.searchableFields.filter((fieldName) => visibleFieldNames.has(fieldName)),
                  filterableFields: meta.filterableFields.filter((fieldName) => visibleFieldNames.has(fieldName)),
               },
               config: {
                  listDisplay: resolved.listDisplay.filter((fieldName) => visibleFieldNames.has(fieldName)),
                  listFilter: resolved.listFilter.filter((fieldName) => visibleFieldNames.has(fieldName)),
                  searchFields: resolved.searchFields.filter((fieldName) => visibleFieldNames.has(fieldName)),
                  defaultSort: resolved.defaultSort,
                  perPage: resolved.perPage,
                  permissions: {
                     list: hasModelPermission(adminUser, resolved.permissions, "list"),
                     view: hasModelPermission(adminUser, resolved.permissions, "view"),
                     create: hasModelPermission(adminUser, resolved.permissions, "create"),
                     update: hasModelPermission(adminUser, resolved.permissions, "update"),
                     delete: canDelete,
                     actions: {
                        [DELETE_SELECTED_ACTION.name]: canDelete,
                        ...Object.fromEntries((raw.actions ?? []).map((action) => [action.name, hasRegisteredActionPermission(adminUser, resolved.permissions, action)])),
                     },
                  },
                  actions,
               },
            };
         }),
   };
}
