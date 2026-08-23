# Express + Prisma

Install `paneljs`, `@paneljs/express`, and `@paneljs/prisma` into **your** Express + Prisma app and open `/admin`.

## Requirements

- Node.js `^20.19 || ^22.12 || >=24` or Bun `>=1.3`
- Express 4 or 5
- `prisma` and `@prisma/client` **7.5.x**
- Your `schema.prisma` on disk at runtime (default `prisma/schema.prisma`)

Keep `prisma`, `@prisma/client`, and `@paneljs/prisma` on the same 7.5 line. See [Prisma versions](/limits/prisma).

## Install

CLI, from the root of this app (does not rewrite source):

```sh
npx paneljs@latest init --framework express --orm prisma --yes
```

Or add the packages yourself:

::: code-group

```sh [npm]
$ npm install paneljs @paneljs/express @paneljs/prisma
```

```sh [pnpm]
$ pnpm add paneljs @paneljs/express @paneljs/prisma
```

```sh [yarn]
$ yarn add paneljs @paneljs/express @paneljs/prisma
```

```sh [bun]
$ bun add paneljs @paneljs/express @paneljs/prisma
```

:::

Express, `prisma`, and `@prisma/client` are **peers**. If this app does not have them yet:

::: code-group

```sh [npm]
$ npm install express @prisma/client
$ npm install -D prisma
```

```sh [pnpm]
$ pnpm add express @prisma/client
$ pnpm add -D prisma
```

```sh [yarn]
$ yarn add express @prisma/client
$ yarn add -D prisma
```

```sh [bun]
$ bun add express @prisma/client
$ bun add -d prisma
```

:::

Pin Prisma to 7.5.x (`~7.5.0`). Generate **your** client the way you already do:

::: code-group

```sh [npm]
$ npx prisma generate
```

```sh [pnpm]
$ pnpm exec prisma generate
```

```sh [yarn]
$ yarn prisma generate
```

```sh [bun]
$ bunx prisma generate
```

:::

The library never uses a Prisma client from this repository. Pass the client your app generated.

## Add it to your server

In the same file where you create the Express app (or a module it imports):

```ts
import express from "express";
import { createAdmin } from "paneljs";
import { prismaAdapter } from "@paneljs/prisma";
import { mount } from "@paneljs/express";
import { prisma } from "./prisma.js";

const app = express();

const admin = createAdmin({
  adapter: prismaAdapter({ prisma }),
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

Replace `"User"` / `"Post"` with model names from **your** `schema.prisma`, PascalCase, exact.

`getCurrentUser` must return `{ id, email, role, isSuperAdmin }` or `null` when you use external auth. A partial object is 401. For built-in admin-only login, sessions, and superuser creation, see [Authentication](/guide/auth).

## Open the admin

Start your server and visit:

```
http://localhost:3000/admin
```

You should see a sidebar with every model you registered. `register("User")` with no second argument is enough for a list and a form. Defaults come from the schema.

## Schema path

At mount the adapter reads `prisma/schema.prisma` relative to `process.cwd()`. If your schema lives elsewhere:

```ts
prismaAdapter({
  prisma,
  schemaPath: "db/schema.prisma",
});
```

Include that file in the deploy artifact. Mount fails with a clear error if it cannot read or compile the schema.

`schemaPath` is an option on `prismaAdapter()`, not on `createAdmin()`.

## What to do next

Zero-config is a start. In a real app you set columns, search, filters, auth, and often `scope`.

- [Wire it into your app](/guide/in-your-app) — `listDisplay`, `searchFields`, `listFilter`, `scope`, actions, audit
- [Authentication](/guide/auth) — built-in login or an existing session
- [Prisma adapter](/adapters/prisma) — DMMF, version pin, `prismaActionWhere`
- [How it works](/guide/how-it-works) — why `mount` is async
