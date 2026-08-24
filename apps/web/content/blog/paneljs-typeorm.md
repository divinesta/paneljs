---
title: PanelJS now mounts on TypeORM
date: 2026-08-20
description: Prisma is no longer the only data adapter. TypeORM entities can drive the same admin UI.
image: /images/blog/paneljs-x-typeorm.jpg
---

PanelJS was built so the UI never talks to an ORM. It talks to schema JSON. That split is why a second adapter could ship without a second admin.

`@paneljs/typeorm` is that adapter. Express is still the HTTP layer. `register("User")` is still the product.

## What you pass in

TypeORM has no `schema.prisma` file to compile. After `dataSource.initialize()`, the adapter reads live `entityMetadatas` and maps them into the same field model Prisma already produces.

```ts
import { createAdmin } from "paneljs";
import { mount } from "@paneljs/express";
import { typeormAdapter } from "@paneljs/typeorm";

await dataSource.initialize();

const admin = createAdmin({
  adapter: typeormAdapter({ dataSource }),
  auth: { getCurrentUser },
});

admin.register("User");
admin.register("Post");
await mount(app, admin);
```

Register names are entity names: the `@Entity()` class name or `EntitySchema` `name`. Table names do not matter. The `DataSource` must already be initialized; the adapter throws if it is not.

## Built-in login

If you want `/admin/login` instead of `getCurrentUser`, add the auth entities to the same `DataSource`:

```ts
import { builtInAuthEntities, typeormAdapter } from "@paneljs/typeorm";

const dataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [...appEntities, ...builtInAuthEntities({ identifier: "email" })],
});
```

Then `auth: { mode: "built-in", identifier: "email" }`. Do not `register("ExpressAdminUser")`.

Create the first operator with the shared CLI after exporting the initialized adapter and built-in auth settings from `paneljs.config.mjs`:

```sh
npx paneljs createsuperuser --config ./paneljs.config.mjs
```

## Install

From an existing Express + TypeORM app:

```sh
npx paneljs@latest init --framework express --orm typeorm --yes
```

That adds `paneljs`, `@paneljs/express`, and `@paneljs/typeorm`. It does not rewrite your source. Peer: `typeorm` `^0.3.20`.

## What did not change

Lists, forms, permissions, `scope()`, hooks, and the HTTP API are the same. Custom actions receive `client` as the `DataSource`. Use `typeormActionWhere("id", where)` from `@paneljs/typeorm` instead of spreading `where` into a repository call.

Full install: [Express + TypeORM](/docs/guide/installation/express/typeorm). Adapter notes: [TypeORM adapter](/docs/adapters/typeorm).
