---
title: PanelJS now supports MikroORM
date: 2026-08-24
description: Live MikroORM entity metadata can now drive the same guarded PanelJS admin UI.
---

PanelJS now has a third data adapter. `@paneljs/mikroorm` turns the metadata from an initialized MikroORM instance into the same schema JSON used by the Prisma and TypeORM adapters.

The result is intentionally familiar: Express remains the HTTP layer, `register("User")` still decides what operators can access, and the React admin and guarded API do not change.

## Mount an initialized ORM

Pass the result of `await MikroORM.init()` to the adapter:

```ts
import { MikroORM } from "@mikro-orm/postgresql";
import { createAdmin } from "paneljs";
import { mount } from "@paneljs/express";
import { mikroormAdapter } from "@paneljs/mikroorm";

const orm = await MikroORM.init({
  clientUrl: process.env.DATABASE_URL,
  entities: appEntities,
});

const admin = createAdmin({
  adapter: mikroormAdapter({ orm }),
  auth: { getCurrentUser },
});

admin.register("User");
admin.register("Post");
await mount(app, admin);
```

Entity class names and `EntitySchema` names are the register names. The adapter reads live metadata, so there is no second schema file to ship.

## Writes do not wait for flush

PanelJS forks an entity manager for each operation. It reads with `find` and `findOne`, then writes immediately with `insert`, `nativeUpdate`, and `nativeDelete`. Admin requests do not depend on a host request context eventually calling `flush()`.

Lists, search, filters, relation display fields, forms, permissions, tenant scope, lifecycle hooks, audit events, and bulk actions all use the same core behavior as the other adapters.

## Built-in login

Built-in `/admin/login` is supported. Add the auth entities to the ORM configuration and use built-in auth mode:

```ts
import { builtInAuthEntities, mikroormAdapter } from "@paneljs/mikroorm";

const orm = await MikroORM.init({
  clientUrl: process.env.DATABASE_URL,
  entities: [...appEntities, ...builtInAuthEntities({ identifier: "email" })],
});

const admin = createAdmin({
  adapter: mikroormAdapter({ orm }),
  auth: { mode: "built-in", identifier: "email" },
});
```

Create the first operator with the ORM-neutral `createsuperuser` command. The config exports the initialized adapter and matching auth settings.

## Install

From an existing Express + MikroORM app:

```sh
npx paneljs@latest init --framework express --orm mikroorm --yes
```

That adds `paneljs`, `@paneljs/express`, `@paneljs/mikroorm`, and `@mikro-orm/core` `^6.4.0` when it is missing. Your app still supplies its matching v6 database driver.

Full install: [Express + MikroORM](/docs/guide/installation/express/mikroorm). Adapter details: [MikroORM adapter](/docs/adapters/mikroorm).
