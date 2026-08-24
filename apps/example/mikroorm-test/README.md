# PanelJS MikroORM example

Small Express host using `@paneljs/mikroorm`. Proves list, search, filters, create, edit, delete, bulk publish, and built-in `/admin/login`.

## Run

From the repository root:

```bash
pnpm install
pnpm --filter paneljs build
pnpm --filter @paneljs/express build
pnpm --filter @paneljs/mikroorm build

pnpm --filter @paneljs/example-mikroorm db:up
pnpm --filter @paneljs/example-mikroorm db:seed
pnpm --filter @paneljs/example-mikroorm dev
```

The seed and app load `apps/example/mikroorm-test/.env` automatically.

Open `http://localhost:3002/admin/login`.

Default seed login:

- email: `ada@example.test` (super admin, all tenants)
- password: `changeme-now`

Also seeded: `northwind@example.test` / `changeme-now` (`ADMIN`, Northwind only).

Uses its own Postgres on port **5437** so it does not collide with the Prisma example (5435 / 3000) or the TypeORM example (5436 / 3001).
