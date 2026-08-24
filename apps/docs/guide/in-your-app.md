# Wire it into your app

This is the implementation path: one module in **your** codebase.

Snippets below use **Express + Prisma**. `register` options are the same on TypeORM and MikroORM. Adapter construction is on [Installation](/guide/installation/).

You already [installed](/guide/installation/) PanelJS and can mount with `register("User")`. This page is what you add next so the panel matches how you operate.

## 1. One place to configure the admin

Keep `createAdmin`, every `register`, and `mount` together — `admin.ts` next to your ORM client, or the bottom of `src/index.ts`.

::: code-group

```ts [Prisma]
import express from "express";
import { createAdmin } from "paneljs";
import { prismaAdapter } from "@paneljs/prisma";
import { mount } from "@paneljs/express";
import { prisma } from "./prisma.js";

const app = express();

const admin = createAdmin({
  adapter: prismaAdapter({ prisma }),
  /* ... */
});

admin.register("User", {
  /* ... */
});
admin.register("Post", {
  /* ... */
});

await mount(app, admin);
```

```ts [TypeORM]
import express from "express";
import { createAdmin } from "paneljs";
import { typeormAdapter } from "@paneljs/typeorm";
import { mount } from "@paneljs/express";
import { dataSource } from "./data-source.js";

await dataSource.initialize();

const app = express();

const admin = createAdmin({
  adapter: typeormAdapter({ dataSource }),
  /* ... */
});

admin.register("User", {
  /* ... */
});
admin.register("Post", {
  /* ... */
});

await mount(app, admin);
```

```ts [MikroORM]
import express from "express";
import { createAdmin } from "paneljs";
import { mikroormAdapter } from "@paneljs/mikroorm";
import { mount } from "@paneljs/express";
import { orm } from "./orm.js";

const app = express();

const admin = createAdmin({
  adapter: mikroormAdapter({ orm }),
  /* ... */
});

admin.register("User", {
  /* ... */
});
admin.register("Post", {
  /* ... */
});

await mount(app, admin);
```

:::

`register` is synchronous. `mount` is async and must run **after** every `register`. Model names are the names in your ORM (`User`, not `users`).

## 2. `createAdmin` — host options

These belong on `createAdmin`, not on each model.

::: code-group

```ts [Prisma]
const admin = createAdmin({
  adapter: prismaAdapter({ prisma, schemaPath: "prisma/schema.prisma" }),
  siteName: "Express Admin",
  auth: {
    getCurrentUser: async (req) => {
      const user = await getOperatorFromYourAuth(req);
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        isSuperAdmin: user.role === "SUPER_ADMIN",
        tenantId: user.tenantId,
      };
    },
  },
  audit: {
    write: async (event) => {
      await prisma.adminAuditLog.create({
        data: {
          eventType: event.type,
          modelName: event.modelName,
          recordIds: event.recordIds.map(String),
          actorId: event.actor.id,
          actorEmail: event.actor.email,
          actorRole: event.actor.role,
          metadata: event.metadata,
          createdAt: event.timestamp,
        },
      });
    },
  },
});
```

```ts [TypeORM]
const admin = createAdmin({
  adapter: typeormAdapter({ dataSource }),
  siteName: "Express Admin",
  auth: {
    getCurrentUser: async (req) => {
      const user = await getOperatorFromYourAuth(req);
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        isSuperAdmin: user.role === "SUPER_ADMIN",
        tenantId: user.tenantId,
      };
    },
  },
  audit: {
    write: async (event) => {
      await dataSource.getRepository("AdminAuditLog").save({
        eventType: event.type,
        modelName: event.modelName,
        recordIds: event.recordIds.map(String),
        actorId: event.actor.id,
        actorEmail: event.actor.email,
        actorRole: event.actor.role,
        metadata: event.metadata,
        createdAt: event.timestamp,
      });
    },
  },
});
```

:::

| Option                | Why you set it                                                                      |
| --------------------- | ----------------------------------------------------------------------------------- |
| `adapter`             | Required. A Prisma, TypeORM, or MikroORM data adapter.                              |
| `siteName`            | Header label in the UI.                                                             |
| `auth.getCurrentUser` | Required in external mode. Your session/JWT → [`AdminUser`](/reference/admin-user). |
| `audit.write`         | Optional. Called after successful writes. You own the table.                        |

Prisma-only: pass `schemaPath` to `prismaAdapter()` if `schema.prisma` is not at `prisma/schema.prisma`. TypeORM and MikroORM require an initialized ORM instance.

The examples use built-in admin-only authentication. In external mode, read your own cookie or `Authorization` header in `getCurrentUser`. See [Authentication](/guide/auth).

Skip `audit` until you have a place to store events. See [Audit log](/guide/audit).

## 3. `register` — per-model customizations

Second argument to `register` is optional. Every key is optional. This is the object from the example, with each field explained.

### User

```ts
admin.register("User", {
  listDisplay: ["email", "fullName", "role", "isActive"],
  listFilter: ["role", "isActive"],
  searchFields: ["email", "fullName"],
  scope: async (adminUser) =>
    adminUser.isSuperAdmin
      ? {}
      : { tenantId: adminUser.tenantId ?? "__no_tenant__" },
  permissions: {
    list: ["SUPER_ADMIN", "ADMIN"],
    view: ["SUPER_ADMIN", "ADMIN"],
    create: ["SUPER_ADMIN", "ADMIN"],
    update: ["SUPER_ADMIN", "ADMIN"],
    delete: ["SUPER_ADMIN"],
  },
});
```

### Post

```ts
import { prismaActionWhere } from "@paneljs/prisma";

admin.register("Post", {
  listDisplay: ["title", "author", "published", "createdAt"],
  listFilter: ["published", "createdAt"],
  searchFields: ["title", "content"],
  scope: async (adminUser) =>
    adminUser.isSuperAdmin
      ? {}
      : { tenantId: adminUser.tenantId ?? "__no_tenant__" },
  actions: [
    {
      name: "publish_selected",
      label: "Publish selected posts",
      allowedRoles: ["SUPER_ADMIN", "ADMIN"],
      handler: async ({ client, where }) => {
        const result = await client.post.updateMany({
          where: prismaActionWhere("id", where),
          data: { published: true },
        });
        return { message: `Published ${result.count} posts.` };
      },
    },
  ],
});
```

The Post action above is Prisma. TypeORM uses `typeormActionWhere` and `getRepository("Post").update(...)`. See [Custom actions](/guide/actions).

Put **your** field names in those arrays. They must exist on that model or `mount` throws.

## 4. What each `register` option does

### `listDisplay` — table columns

```ts
listDisplay: ["email", "fullName", "role", "isActive"];
```

Left-to-right columns on `/admin/users`.

- Use **scalar** names (`email`, `published`) or a **`belongsTo` relation** name (`author`).
- `"author"` on Post shows the related User’s display field (usually `email` or `name`), not a raw UUID.
- Do not put `hasMany` names (`posts` on User). They are not loaded as columns.
- If you omit this, the library picks the display field, more scalars (up to 6), then `createdAt`.

### `searchFields` — the search box

```ts
searchFields: ["email", "fullName"];
```

The list search box runs `contains` across these **string** fields only. `mount` rejects a non-string here.

- Omit it and every non-id string scalar is searched.
- On PostgreSQL, list search is case-insensitive. Other databases use that engine’s ordinary contains / `LIKE`.

### `listFilter` — filter controls

```ts
listFilter: ["role", "isActive"]; // User
listFilter: ["published", "createdAt"]; // Post
```

Filters are **opt-in**. If you omit `listFilter`, the UI has no filter sidebar and the API accepts no filter query params.

Good filter fields: enums (`role`), booleans (`isActive`, `published`), date-times (`createdAt`). Date-times become a from/to range.

A name that is not filterable, or not on the model, fails at `mount`.

### `defaultSort` and `perPage`

```ts
defaultSort: { field: "createdAt", direction: "desc" },
perPage: 25,
```

Default sort is `createdAt desc` (or the id). Default page size is **50**.

### `displayField` and `pluralName`

```ts
displayField: "email",  // label in relation dropdowns and titles
pluralName: "people",   // URL becomes /admin/people and /admin/api/people
```

Only set these when the auto-detected values are wrong.

### `fields` — hide, expose, lock

```ts
fields: {
  passwordHash: { exclude: true },
  email: { readOnly: true },
  apiToken: { expose: true, readOnly: true },
},
```

Names matching `password`, `token`, `secret`, `api_key`, `credential`, `private_key` stay hidden until `{ expose: true }`. See [Sensitive fields](/guide/sensitive-fields).

### `scope` — which rows this operator sees

```ts
scope: async (adminUser) =>
  adminUser.isSuperAdmin ? {} : { tenantId: adminUser.tenantId ?? "__no_tenant__" },
```

Applied to list, detail, update, delete, relation dropdowns, and actions. `{}` means no extra filter. Missing `tenantId` should match **nothing**, not everything.

If you are not multi-tenant, omit `scope`. If you are, this is not optional. See [Multi-tenant scope](/guide/scope).

### `permissions` — who may use which verb

```ts
permissions: {
  list: ["SUPER_ADMIN", "ADMIN"],
  view: ["SUPER_ADMIN", "ADMIN"],
  create: ["SUPER_ADMIN", "ADMIN"],
  update: ["SUPER_ADMIN", "ADMIN"],
  delete: ["SUPER_ADMIN"],
},
```

In production, each registration must include `permissions`. Within that object, omitted read keys allow authenticated administrators, while omitted write keys deny access. `delete: []` denies everyone except `isSuperAdmin`. Super-admin skips these lists; it does **not** skip `scope`. See [Permissions](/guide/permissions).

### `actions` — bulk verbs on the list

```ts
import { prismaActionWhere } from "@paneljs/prisma";

actions: [
  {
    name: "publish_selected",
    label: "Publish selected posts",
    allowedRoles: ["SUPER_ADMIN", "ADMIN"],
    handler: async ({ client, where }) => {
      const result = await client.post.updateMany({
        where: prismaActionWhere("id", where),
        data: { published: true },
      });
      return { message: `Published ${result.count} posts.` };
    },
  },
];
```

`name` is the URL segment. `label` is the button. `where` contains the scope and selected IDs; use it for every action mutation. `client` is the ORM handle (Prisma client or TypeORM `DataSource`). See [Custom actions](/guide/actions).

### Hooks — mutate or block a write

```ts
beforeCreate: async (data) => {
  data.tenantId = currentTenant;
  return data;
},
beforeDelete: async (id) => {
  if (id === ROOT_ID) throw new Error("Cannot delete this user.");
},
```

See [Lifecycle hooks](/guide/hooks).

## 5. Models you should not register

The example schema has `Tenant` and `AdminAuditLog`. They are **not** registered (the TypeORM example registers `Tenant` for super-admins only).

- `Tenant` is a join key. Operators should not CRUD companies from this panel unless you want that.
- `AdminAuditLog` is written by `audit.write`. Registering it would make history editable.
- Built-in `ExpressAdminUser` / `ExpressAdminSession` cannot be registered.

Only `register` models operators should see in the sidebar.

## 6. Mount last

```ts
await mount(app, admin);
```

Then listen. Open `/admin`. You should see:

| You set                                | You see                                                  |
| -------------------------------------- | -------------------------------------------------------- |
| `listDisplay` on User                  | Those columns, in that order                             |
| `searchFields`                         | Search box matching email / name                         |
| `listFilter: ["role", "isActive"]`     | Role and active filters                                  |
| `listDisplay: [..., "author"]` on Post | Author email, not `authorId`                             |
| `scope`                                | Ada’s tenant only (if you copied the example identities) |
| `actions`                              | A bulk control on the Post list                          |

If `mount` throws, read the message — it names the bad model or field.

## Full reference

Every key: [`register()`](/reference/register) and [`createAdmin()`](/reference/create-admin).

Copy-paste hosts: [Express + Prisma](/example/basic) and [Express + TypeORM](/example/typeorm).
