# @paneljs/mikroorm

MikroORM adapter for [PanelJS](https://www.npmjs.com/package/paneljs).

```ts
import { MikroORM } from "@mikro-orm/postgresql";
import { createAdmin } from "paneljs";
import { mount } from "@paneljs/express";
import { builtInAuthEntities, mikroormAdapter } from "@paneljs/mikroorm";

const orm = await MikroORM.init({
  clientUrl: process.env.DATABASE_URL,
  entities: [...appEntities, ...builtInAuthEntities({ identifier: "email" })],
});

const admin = createAdmin({
  adapter: mikroormAdapter({ orm }),
  auth: { mode: "built-in", identifier: "email" },
});

admin.register("User");
await mount(app, admin);
```

Peer dependency: `@mikro-orm/core` ^6.4.0. The host supplies the driver package (`@mikro-orm/postgresql`, `@mikro-orm/mysql`, …).

The ORM must already be initialized. Introspection reads live entity metadata. CRUD uses PanelJS query types and writes immediately (`insert` / `nativeUpdate` / `nativeDelete`) so admin requests do not depend on Unit of Work `flush()`.

For built-in login, add `builtInAuthEntities()` to the ORM entities and set `auth: { mode: "built-in", identifier: "email" }`. `mikroormAdapter` supplies `createAuthStore`. External `getCurrentUser` still works if you skip those entities.

Do not `register("ExpressAdminUser")`.

Create an operator with the shared CLI. The config exports an initialized adapter and built-in auth settings:

```bash
npx paneljs createsuperuser --config ./paneljs.config.mjs
```
