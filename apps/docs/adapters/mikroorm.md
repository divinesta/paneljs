# MikroORM adapter

`@paneljs/mikroorm` maps live MikroORM entity metadata and row operations onto PanelJS. The UI and Express layer never import MikroORM.

```ts
import { mikroormAdapter } from "@paneljs/mikroorm";

const admin = createAdmin({
  adapter: mikroormAdapter({ orm }),
  auth: { getCurrentUser },
});
```

Peer dependency: `@mikro-orm/core` `^6.4.0`. Your app supplies the matching database driver.

## Discovery

There is no separate schema file. After `await MikroORM.init()`, the adapter reads the ORM's live metadata and maps entities, scalar properties, enums, primary keys, generated values, and relations into PanelJS metadata.

Register names are entity class names or `EntitySchema` names (`User`, not the `users` table name), PascalCase and exact.

## CRUD

Each request uses a forked entity manager. Lists and detail views use `find` / `findOne`; writes use `insert`, `nativeUpdate`, and `nativeDelete` immediately. Admin writes therefore do not depend on a request-scoped Unit of Work calling `flush()`.

Search uses PostgreSQL or CockroachDB case-insensitive matching when those platforms are detected. Other drivers use the platform's normal `LIKE` behavior.

## Built-in auth

Add the auth entities to your MikroORM configuration:

```ts
import { builtInAuthEntities, mikroormAdapter } from "@paneljs/mikroorm";

const orm = await MikroORM.init({
  clientUrl: process.env.DATABASE_URL,
  entities: [...appEntities, ...builtInAuthEntities({ identifier: "email" })],
});
```

Then use `auth: { mode: "built-in", identifier: "email" }`. Do not `register("ExpressAdminUser")` or `register("ExpressAdminSession")`.

Create the first operator with the shared CLI after exporting the initialized adapter from `paneljs.config.mjs`:

```sh
npx paneljs createsuperuser --config ./paneljs.config.mjs
```

Full walkthrough: [Authentication](/guide/auth).

## Custom actions

The action handler receives `client` as the initialized `MikroORM` instance and `where: { scope, ids }`. Convert that target to a MikroORM filter before a bulk write:

```ts
import { mikroormActionWhere } from "@paneljs/mikroorm";
import type { MikroORM } from "@mikro-orm/core";

handler: async ({ client, where }) => {
  const orm = client as MikroORM;
  const count = await orm.em
    .fork()
    .nativeUpdate("Post", mikroormActionWhere(orm, "Post", where), {
      published: true,
    });
  return { message: `Published ${count} posts.` };
};
```

## What this adapter does not do

- Nested relation writes beyond a `belongsTo` foreign key
- Composite or missing primary keys — those entities are skipped
- Logical `AND` / `OR` / `NOT` in `scope()`; use simple equality scope in this release
- An uninitialized or metadata-free ORM instance

See [MikroORM notes](/limits/mikroorm). Install: [Express + MikroORM](/guide/installation/express/mikroorm).
