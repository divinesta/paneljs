# TypeORM adapter

`@paneljs/typeorm` answers two questions for PanelJS: what entities exist, and how to read and write rows. The UI never talks to TypeORM. Express never imports it.

```ts
import { typeormAdapter } from "@paneljs/typeorm";

await dataSource.initialize();

const admin = createAdmin({
  adapter: typeormAdapter({ dataSource }),
  auth: { getCurrentUser },
});
```

Peer dependency: `typeorm` `^0.3.20`.

## Discovery

There is no schema file step. After `dataSource.initialize()`, the adapter reads `entityMetadatas` (columns, ids, uniques, generated flags, relations) and maps them into PanelJS metadata.

`typeormAdapter` throws if the `DataSource` is not initialized. Call `await dataSource.initialize()` first.

Register names are entity names (`@Entity()` class name or `EntitySchema` `name`), PascalCase, exact.

## CRUD

List, get, create, update, and delete go through TypeORM repositories. Search is case-insensitive on PostgreSQL drivers (`postgres`, `cockroachdb`, `aurora-postgres`); other drivers use `Like`.

## Built-in auth

Add the auth entities to the `DataSource`:

```ts
import { builtInAuthEntities, typeormAdapter } from "@paneljs/typeorm";

const dataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [...appEntities, ...builtInAuthEntities({ identifier: "email" })],
});
```

Then `auth: { mode: "built-in", identifier: "email" }`. Do not `register("ExpressAdminUser")`.

Create the first operator with the shared CLI after initializing a `typeormAdapter` in `paneljs.config.mjs`:

```sh
npx paneljs createsuperuser --config ./paneljs.config.mjs
```

Full walkthrough: [Authentication](/guide/auth).

## Custom actions

The action handler receives `client` (the `DataSource`) and `where: { scope, ids }`. Use the helper for repository criteria:

```ts
import { typeormActionWhere } from "@paneljs/typeorm";
import type { DataSource } from "typeorm";

handler: async ({ client, where }) => {
  const result = await (client as DataSource)
    .getRepository("Post")
    .update(typeormActionWhere("id", where), { published: true });
  const count = result.affected ?? 0;
  return { message: `Published ${count} posts.` };
};
```

## What this adapter does not do

- Nested relation writes beyond a `belongsTo` foreign key
- Composite primary keys — skipped
- Uninitialized `DataSource` — hard error at adapter construction

See [TypeORM notes](/limits/typeorm). Install: [Express + TypeORM](/guide/installation/express/typeorm).
