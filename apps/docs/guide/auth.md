# Authentication

PanelJS has a built-in, admin-only authentication mode. It owns a separate `ExpressAdminUser` table, a separate `ExpressAdminSession` table, and a login page at `/admin/login`.

Your application's own users and authentication are not read or changed.

```text
Application User + application session     ExpressAdminUser + admin session
             /app/login                              /admin/login
```

How those two tables are created depends on the ORM. Login HTTP, cookies, and roles do not.

## Built-in authentication

Choose whether administrators sign in with an email address or a username. Create the matching tables, then configure the admin with the same choice:

```ts
const admin = createAdmin({
  adapter, // prismaAdapter, typeormAdapter, or mikroormAdapter
  auth: {
    mode: "built-in",
    identifier: "email",
  },
});
```

The user model is `ExpressAdminUser` and the session model is `ExpressAdminSession` by default. You may rename either with `userModel` or `sessionModel` if your tables use a different name.

The data adapter supplies the auth store (how those tables are read). Express only handles the login HTTP and cookie. You can pass `auth.store` to override that.

### Create the tables

::: code-group

```sh [Prisma]
npx paneljs auth:schema --identifier email
```

```ts [TypeORM]
import { builtInAuthEntities } from "@paneljs/typeorm";

const dataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [...appEntities, ...builtInAuthEntities({ identifier: "email" })],
});
```

```ts [MikroORM]
import { builtInAuthEntities } from "@paneljs/mikroorm";

const orm = await MikroORM.init({
  clientUrl: process.env.DATABASE_URL,
  entities: [...appEntities, ...builtInAuthEntities({ identifier: "email" })],
});
```

:::

**Prisma:** paste the printed models into `schema.prisma`, then run your normal Prisma migration and client generation commands.

**TypeORM and MikroORM:** put `builtInAuthEntities()` on the ORM's `entities` list, then sync or migrate with that ORM. There is no schema-file paste step.

Use `--identifier username` / `{ identifier: "username" }` if operators sign in with a username.

## Create the first superuser

```sh
npx paneljs createsuperuser --config ./paneljs.config.mjs
```

The command is ORM-neutral. Its config exports the initialized adapter and the matching built-in auth settings:

::: code-group

```js [Prisma]
import { prismaAdapter } from "@paneljs/prisma";
import { prisma } from "./src/prisma.js";

export default {
  adapter: prismaAdapter({ prisma }),
  auth: { mode: "built-in", identifier: "email" },
};
```

```js [TypeORM]
import { typeormAdapter } from "@paneljs/typeorm";
import { dataSource } from "./src/data-source.js";

await dataSource.initialize();

export default {
  adapter: typeormAdapter({ dataSource }),
  auth: { mode: "built-in", identifier: "email" },
};
```

```js [MikroORM]
import { mikroormAdapter } from "@paneljs/mikroorm";
import { orm } from "./src/orm.js";

export default {
  adapter: mikroormAdapter({ orm }),
  auth: { mode: "built-in", identifier: "email" },
};
```

:::

The command asks for the selected identifier and password, rejects an existing identifier, hashes the password, and creates an active `SUPER_ADMIN`. In CI, provide `--email` or `--username` plus `EXPRESS_ADMIN_PASSWORD` instead of interactive input.

Open `/admin/login` after starting the server. Built-in auth creates a secure, `HttpOnly`, `SameSite=Lax` cookie scoped to your configured `basePath`. It does not create an application session. The login page and API routes use that same path automatically.

## Administrator roles

Only active accounts with `ADMIN` or `SUPER_ADMIN` can sign in. `SUPER_ADMIN` bypasses model role allowlists. `ADMIN` is still subject to configured permissions and `scope()`.

`ExpressAdminUser` and `ExpressAdminSession` cannot be registered as admin models in built-in mode. This prevents credential or session records from being exposed through the panel.

## Login throttling

Built-in authentication throttles sign-in attempts per IP address and identifier: ten attempts per minute by default. Configure a different limit for a single-process deployment, or disable it only when your application already enforces an equivalent shared rate limit:

```ts
auth: {
  mode: "built-in",
  identifier: "email",
  loginRateLimit: { maxAttempts: 5, windowMs: 60_000 },
}
```

The built-in limiter is in-memory and therefore applies independently to each server process. Use an edge, reverse-proxy, or shared-store limiter as well when running multiple instances.

## External authentication

Teams that already have an identity provider can keep the existing adapter mode:

```ts
auth: {
  mode: "external",
  getCurrentUser: async (req) => {
    const user = await readUserFromYourAuth(req);
    return user ? {
      id: user.id,
      email: user.email,
      role: user.role,
      isSuperAdmin: user.role === "SUPER_ADMIN",
    } : null;
  },
}
```

External mode has no built-in login page because the external system owns the login flow. You do not add `ExpressAdminUser` tables.
