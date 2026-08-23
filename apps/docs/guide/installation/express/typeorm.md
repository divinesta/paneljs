# Express + TypeORM

Install `paneljs`, `@paneljs/express`, and `@paneljs/typeorm` into **your** Express + TypeORM app and open `/admin`.

## Requirements

- Node.js `^20.19 || ^22.12 || >=24` or Bun `>=1.3`
- Express 4 or 5
- `typeorm` `^0.3.20`
- An initialized TypeORM `DataSource` with your entities registered

Introspection reads **live** entity metadata. The `DataSource` must already be `initialize()`d before you pass it to the adapter.

## Install

CLI, from the root of this app (does not rewrite source):

```sh
npx paneljs@latest init --framework express --orm typeorm --yes
```

Or add the packages yourself:

::: code-group

```sh [npm]
$ npm install paneljs @paneljs/express @paneljs/typeorm
```

```sh [pnpm]
$ pnpm add paneljs @paneljs/express @paneljs/typeorm
```

```sh [yarn]
$ yarn add paneljs @paneljs/express @paneljs/typeorm
```

```sh [bun]
$ bun add paneljs @paneljs/express @paneljs/typeorm
```

:::

Express and TypeORM are **peers**. If this app does not have them yet:

::: code-group

```sh [npm]
$ npm install express typeorm
```

```sh [pnpm]
$ pnpm add express typeorm
```

```sh [yarn]
$ yarn add express typeorm
```

```sh [bun]
$ bun add express typeorm
```

:::

## Add it to your server

Initialize the `DataSource` first, then create the admin:

```ts
import express from "express";
import { createAdmin } from "paneljs";
import { mount } from "@paneljs/express";
import { typeormAdapter } from "@paneljs/typeorm";
import { dataSource } from "./data-source.js";

await dataSource.initialize();

const app = express();

const admin = createAdmin({
  adapter: typeormAdapter({ dataSource }),
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

Replace `"User"` / `"Post"` with **entity names** registered on the `DataSource` (`@Entity()` class name or `EntitySchema` `name`), PascalCase, exact.

`typeormAdapter` throws if the `DataSource` is not initialized.

## Built-in login

If you want `/admin/login` instead of `getCurrentUser`, add the auth entities to the `DataSource` and switch auth mode:

```ts
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
```

Do not `register("ExpressAdminUser")`. See [Authentication](/guide/auth).

The Prisma `createsuperuser` CLI does not read a TypeORM `DataSource`. Create the first operator with `hashAdminPassword` from `paneljs` and your auth-user repository — the [TypeORM example](/example/typeorm) does this in its seed.

## Open the admin

Start your server and visit:

```
http://localhost:3000/admin
```

You should see a sidebar with every entity you registered. `register("User")` with no second argument is enough for a list and a form. Defaults come from entity metadata.

## What to do next

- [Wire it into your app](/guide/in-your-app) — `listDisplay`, `searchFields`, `listFilter`, `scope`, actions, audit
- [Authentication](/guide/auth) — built-in login or an existing session
- [TypeORM adapter](/adapters/typeorm) — `DataSource`, `builtInAuthEntities`, `typeormActionWhere`
- [How it works](/guide/how-it-works) — why `mount` is async
