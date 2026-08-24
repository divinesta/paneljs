# Express + MikroORM example

`apps/example/mikroorm-test/` is the MikroORM dogfood app in this repository. It runs the same multi-tenant operations story as the Prisma and TypeORM examples using MikroORM `EntitySchema` metadata.

To add PanelJS to **your** server, follow [Wire it into your app](/guide/in-your-app) and [Express + MikroORM](/guide/installation/express/mikroorm).

## What is in it

Entities include `Tenant`, `User`, `Post`, `Customer`, `Category`, `Product`, `Order`, and `OrderItem`, plus the built-in auth entities.

The example proves list, search, filters, relation fields, create, edit, delete, bulk publish, permissions, tenant scope, and built-in `/admin/login`. Auth entities are never registered in the operations UI.

## Run it

From the repository root:

```bash
pnpm install
pnpm --filter paneljs build
pnpm --filter @paneljs/express build
pnpm --filter @paneljs/mikroorm build

pnpm --filter @paneljs/example-mikroorm db:up
pnpm --filter @paneljs/example-mikroorm db:seed
pnpm --filter @paneljs/example-mikroorm admin:createsuperuser
pnpm --filter @paneljs/example-mikroorm dev
```

Open `http://localhost:3002/admin/login` and sign in with the superuser credentials you created.

The app uses Postgres on port **5437** and HTTP port **3002**, so it can run beside the Prisma (5435 / 3000) and TypeORM (5436 / 3001) examples.

## What the host actually configures

```ts
const orm = await MikroORM.init({
  clientUrl: process.env.DATABASE_URL,
  entities: [...appEntities, ...builtInAuthEntities({ identifier: "email" })],
});

const admin = createAdmin({
  adapter: mikroormAdapter({ orm }),
  siteName: "PanelJS MikroORM",
  auth: { mode: "built-in", identifier: "email" },
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

The registry options and guarded HTTP API are the same across all three ORMs. Only adapter construction and ORM bootstrap differ.

## Source

[apps/example/mikroorm-test](https://github.com/divinesta/paneljs/tree/main/apps/example/mikroorm-test) on GitHub.
