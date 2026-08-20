# PanelJS TypeORM example

Small Express host using `@paneljs/typeorm`. Proves list, search, filters, create, edit, delete, bulk publish, and built-in `/admin/login`.

## Run

From the repository root:

```bash
pnpm install
pnpm --filter @paneljs/paneljs build
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

Uses its own Postgres on port **5436** so it does not collide with the Prisma example (5435 / 3000).
