# PanelJS TypeORM example

Small Express host using `@paneljs/typeorm`. Proves list, search, filters, create, edit, delete, bulk publish, and built-in `/admin/login`.

## Run

From the repository root:

```bash
pnpm install
pnpm --filter paneljs build
pnpm --filter @paneljs/express build
pnpm --filter @paneljs/typeorm build

pnpm --filter @paneljs/example-typeorm db:up
pnpm --filter @paneljs/example-typeorm db:seed
pnpm --filter @paneljs/example-typeorm dev
```

The seed and app load `apps/example/typeorm-test/.env` automatically.

Open `http://localhost:3001/admin/login`.

Default seed login:

- email: `ada@example.test` (super admin, all tenants)
- password: `changeme-now`

Also seeded: `northwind@example.test` / `changeme-now` (`ADMIN`, Northwind only).

Uses its own Postgres on port **5436** so it does not collide with the Prisma example (5435 / 3000).
