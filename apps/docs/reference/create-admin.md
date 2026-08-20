# `createAdmin()`

```ts
import { createAdmin } from "@paneljs/paneljs";
import { prismaAdapter } from "@paneljs/prisma";
import { mount } from "@paneljs/express";

const admin = createAdmin({
  adapter: prismaAdapter({ prisma }),
  auth: { getCurrentUser },
});
admin.register(modelName, modelConfig?);
await mount(app, admin);
```

`createAdmin` is the core entry. It returns `{ register, initialize, registry, config }`. Express mounting lives in `@paneljs/express`.

## `AdminConfig`

| Option             | Type                                                              | Default   | Role                                                                   |
| ------------------ | ----------------------------------------------------------------- | --------- | ---------------------------------------------------------------------- |
| `adapter`          | `DataAdapter`                                                     | required  | From `prismaAdapter({ prisma, schemaPath })`.                          |
| `auth`             | built-in or external auth config                                  | required  | Built-in admin credentials/sessions, or an external identity adapter.  |
| `basePath`         | `string`                                                          | `/admin`  | Where UI and API are mounted.                                          |
| `siteName`         | `string`                                                          | `PanelJS` | Header label in the UI.                                                |
| `databaseProvider` | `"postgresql" \| "mysql" \| "sqlite" \| "sqlserver" \| "mongodb"` | unset     | **Deprecated, ignored.** PostgreSQL case-insensitive search is read from the Prisma schema `datasource` provider. |
| `audit.write`      | `(event) => Promise<void>`                                        | unset     | Called after successful mutations.                                     |

`schemaPath` is passed to `prismaAdapter()`, not to `createAdmin()`.

## `mount(app, admin)`

Must run after every `register`. Must be awaited. Throws if:

- the schema file cannot be read
- DMMF cannot be built (invalid schema or Prisma version mismatch)
- a registered model or field does not exist

Mounts, in order: JSON body parser, built-in auth endpoints when enabled, auth on `/api`, schema route, action routes, CRUD routes, error handler, static UI, SPA fallback.

## Types

```ts
import type {
  AdminConfig,
  AuthConfig,
  AdminUser,
  AuditConfig,
  AdminAuditEvent,
  ModelConfig,
  DataAdapter,
} from "@paneljs/paneljs";
```
