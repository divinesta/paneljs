# Express + TypeORM example

`apps/example/typeorm-test/` is the TypeORM dogfood app in this repository. It is not the library. It is the same Northwind / Contoso story as the [Prisma example](/example/basic), on a TypeORM `DataSource`.

To copy the same `createAdmin` / `register` options into **your** server, follow [Wire it into your app](/guide/in-your-app) and [Express + TypeORM](/guide/installation/express/typeorm).

## What is in it

Entities: `User`, `Post`, `Tenant`, plus built-in `ExpressAdminUser` / `ExpressAdminSession`.

**User** and **Post** are registered for operators. `Tenant` is registered for super-admins only. Auth tables are not registered.

The seed creates application users, posts, and administrator accounts (including a superuser).

## Run it

From the repository root (this is for people cloning the repo, not `npm install` consumers):

```bash
pnpm install
pnpm --filter paneljs build
pnpm --filter @paneljs/express build
pnpm --filter @paneljs/typeorm build

pnpm --filter @paneljs/example-typeorm db:up

export DATABASE_URL=postgresql://postgres:postgres@localhost:5436/paneljs_typeorm_example

pnpm --filter @paneljs/example-typeorm db:seed
pnpm --filter @paneljs/example-typeorm dev
```

Open `http://localhost:3001/admin/login`.

Default seed login:

- email: `ada@example.test` (super admin, all tenants)
- password: `changeme-now`

Also seeded: `northwind@example.test` / `changeme-now` (`ADMIN`, Northwind only).

Uses Postgres on port **5436** and the app on **3001** so it does not collide with the Prisma example (5435 / 3000).

## What the host actually configures

```ts
await dataSource.initialize();

const admin = createAdmin({
  adapter: typeormAdapter({ dataSource }),
  siteName: "PanelJS TypeORM",
  auth: {
    mode: "built-in",
    identifier: "email",
  },
});

admin.register("User", {
  listDisplay: ["email", "fullName", "role", "isActive"],
  listFilter: ["role", "isActive"],
  searchFields: ["email", "fullName"],
  scope: tenantScope,
});

admin.register("Post", {
  listDisplay: ["title", "author", "published", "createdAt"],
  listFilter: ["published", "createdAt"],
  searchFields: ["title", "content"],
  scope: tenantScope,
  actions: [
    /* publish_selected, unpublish_selected */
  ],
});

await mount(app, admin);
```

`register` options are the same as Prisma. The adapter and `DataSource` bootstrap are the difference.

## Source

[apps/example/typeorm-test](https://github.com/divinesta/paneljs/tree/main/apps/example/typeorm-test) on GitHub.
