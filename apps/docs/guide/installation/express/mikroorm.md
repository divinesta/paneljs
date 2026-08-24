# Express + MikroORM

Install `paneljs`, `@paneljs/express`, and `@paneljs/mikroorm` into **your** Express + MikroORM app and open `/admin`.

## Requirements

- Node.js `^20.19 || ^22.12 || >=24` or Bun `>=1.3`
- Express 4 or 5
- `@mikro-orm/core` `^6.4.0` and the matching v6 driver for your database
- An initialized `MikroORM` instance with your entities registered

PanelJS reads **live** MikroORM metadata. Call `await MikroORM.init()` before you pass the ORM instance to the adapter.

## Install

CLI, from the root of this app (does not rewrite source):

```sh
npx paneljs@latest init --framework express --orm mikroorm --yes
```

Or add the packages yourself:

::: code-group

```sh [npm]
$ npm install paneljs @paneljs/express @paneljs/mikroorm
```

```sh [pnpm]
$ pnpm add paneljs @paneljs/express @paneljs/mikroorm
```

```sh [yarn]
$ yarn add paneljs @paneljs/express @paneljs/mikroorm
```

```sh [bun]
$ bun add paneljs @paneljs/express @paneljs/mikroorm
```

:::

Express, MikroORM core, and your database driver are **peers**. For PostgreSQL:

::: code-group

```sh [npm]
$ npm install express @mikro-orm/core @mikro-orm/postgresql
```

```sh [pnpm]
$ pnpm add express @mikro-orm/core @mikro-orm/postgresql
```

```sh [yarn]
$ yarn add express @mikro-orm/core @mikro-orm/postgresql
```

```sh [bun]
$ bun add express @mikro-orm/core @mikro-orm/postgresql
```

:::

Use the driver your app already needs (`@mikro-orm/mysql`, `@mikro-orm/sqlite`, and so on), and keep it on the same major as `@mikro-orm/core`.

## Add it to your server

Initialize MikroORM first, then create the admin:

```ts
import express from "express";
import { MikroORM } from "@mikro-orm/postgresql";
import { createAdmin } from "paneljs";
import { mount } from "@paneljs/express";
import { mikroormAdapter } from "@paneljs/mikroorm";
import { entities } from "./entities.js";

const orm = await MikroORM.init({
  clientUrl: process.env.DATABASE_URL,
  entities,
});

const app = express();

const admin = createAdmin({
  adapter: mikroormAdapter({ orm }),
  siteName: "Admin",
  auth: {
    getCurrentUser: async (req) => {
      const user = await getOperatorFromYourAuth(req);
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        isSuperAdmin: user.role === "SUPER_ADMIN",
      };
    },
  },
});

admin.register("User");
admin.register("Post");

await mount(app, admin);
app.listen(3000);
```

Replace `"User"` / `"Post"` with MikroORM entity class names or `EntitySchema` names, PascalCase and exact. Table names do not change the register name.

## Built-in login

Add PanelJS's auth entities to the same MikroORM configuration:

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

Sync or migrate those entities with your normal MikroORM workflow. Do not `register("ExpressAdminUser")`.

Create the first operator with `npx paneljs createsuperuser --config ./paneljs.config.mjs`. The config must export an initialized `mikroormAdapter` and the built-in auth settings. See [Authentication](/guide/auth).

## Open the admin

Start your server and visit:

```
http://localhost:3000/admin
```

## What to do next

- [Wire it into your app](/guide/in-your-app) — lists, search, filters, scope, actions, and audit
- [Authentication](/guide/auth) — built-in login or an existing session
- [MikroORM adapter](/adapters/mikroorm) — metadata, writes, and `mikroormActionWhere`
- [MikroORM notes](/limits/mikroorm) — supported version and current limits
