# PanelJS MikroORM example

Express dogfood host using `@paneljs/mikroorm`. Proves list, search, filters,
relations, create, edit, delete, bulk publish, tenant scoping, and built-in
`/admin/login`.

## Run

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

The seed and app load `apps/example/mikroorm-test/.env` automatically.

Open `http://localhost:3002/admin/login`.

Sign in with the superuser credentials you created.

The seed matches the Prisma example: three tenants (Northwind, Contoso, and
Fabrikam), plus 72 users, 60 customers, 36 categories, 120 products, 120 posts,
90 orders, and 270 order items. Re-running it replaces the example business
data without deleting built-in admin users.

Uses its own Postgres on port **5437** so it does not collide with the Prisma example (5435 / 3000) or the TypeORM example (5436 / 3001).
