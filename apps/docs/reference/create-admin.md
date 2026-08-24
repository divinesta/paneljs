# `createAdmin()`

```ts
import { createAdmin } from "paneljs";
import { prismaAdapter } from "@paneljs/prisma"; // or typeormAdapter from @paneljs/typeorm
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

| Option             | Type                                                              | Default   | Role                                                                  |
| ------------------ | ----------------------------------------------------------------- | --------- | --------------------------------------------------------------------- |
| `adapter`          | `DataAdapter`                                                     | required  | Prisma, TypeORM, or MikroORM adapter.                                 |
| `auth`             | built-in or external auth config                                  | required  | Built-in admin credentials/sessions, or an external identity adapter. |
| `basePath`         | `string`                                                          | `/admin`  | Where UI and API are mounted.                                         |
| `siteName`         | `string`                                                          | `PanelJS` | Header label in the UI.                                               |
| `databaseProvider` | `"postgresql" \| "mysql" \| "sqlite" \| "sqlserver" \| "mongodb"` | unset     | **Deprecated, ignored.** Each adapter decides search sensitivity.     |
| `audit.write`      | `(event) => Promise<void>`                                        | unset     | Called after successful mutations.                                    |

Prisma `schemaPath` is passed to `prismaAdapter()`, not to `createAdmin()`. TypeORM and MikroORM read live metadata from an initialized instance instead of a schema path.

## `mount(app, admin)`

Must run after every `register`. Must be awaited. Throws if:

- the adapter cannot introspect (missing Prisma schema, uninitialized TypeORM `DataSource`, version mismatch)
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
} from "paneljs";
```
