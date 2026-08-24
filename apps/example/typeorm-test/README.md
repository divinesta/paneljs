# PanelJS TypeORM example

Express dogfood host using `@paneljs/typeorm`. Proves list, search, filters,
relations, create, edit, delete, bulk publish, tenant scoping, and built-in
`/admin/login`.

## Run

From the repository root:

```bash
pnpm install
pnpm --filter paneljs build
pnpm --filter @paneljs/express build
pnpm --filter @paneljs/typeorm build

pnpm --filter @paneljs/example-typeorm db:up
pnpm --filter @paneljs/example-typeorm db:seed
pnpm --filter @paneljs/example-typeorm admin:createsuperuser
pnpm --filter @paneljs/example-typeorm dev
```

The seed and app load `apps/example/typeorm-test/.env` automatically.

Open `http://localhost:3001/admin/login`.

Sign in with the superuser credentials you created.

The seed matches the Prisma example: three tenants (Northwind, Contoso, and
Fabrikam), plus 72 users, 60 customers, 36 categories, 120 products, 120 posts,
90 orders, and 270 order items. Re-running it replaces the example business
data without deleting built-in admin users.

Uses its own Postgres on port **5436** so it does not collide with the Prisma example (5435 / 3000).
