# @paneljs/typeorm

TypeORM adapter for [PanelJS](https://www.npmjs.com/package/paneljs).

```bash
npx paneljs@latest init --framework express --orm typeorm
```

```ts
import { createAdmin } from "paneljs";
import { mount } from "@paneljs/express";
import { DataSource } from "typeorm";

import { builtInAuthEntities, typeormAdapter } from "@paneljs/typeorm";

const dataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [...appEntities, ...builtInAuthEntities({ identifier: "email" })],
});
await dataSource.initialize();

const admin = createAdmin({
  adapter: typeormAdapter({ dataSource }),
  auth: { mode: "built-in", identifier: "email" },
});

admin.register("User");
await mount(app, admin);
```

Peer dependency: `typeorm` ^0.3.20.

The `DataSource` must already be initialized. Introspection reads live entity metadata. CRUD uses PanelJS query types.

For built-in login, add `builtInAuthEntities()` to the DataSource and set `auth: { mode: "built-in", identifier: "email" }`. `typeormAdapter` supplies `createAuthStore`. External `getCurrentUser` still works if you skip those entities.

Do not `register("ExpressAdminUser")`.

Create an operator with the shared CLI. The config exports an initialized adapter and built-in auth settings:

```bash
npx paneljs createsuperuser --config ./paneljs.config.mjs
```
