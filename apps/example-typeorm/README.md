# PanelJS TypeORM example

Small Express host using `@paneljs/typeorm`. Proves list, search, filters, create, edit, delete, and bulk publish — without built-in `/admin/login`.

Identity is a demo `getCurrentUser` (Ada, `SUPER_ADMIN`) so the UI opens with no login screen.

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

Open `http://localhost:3001/admin`.

Uses its own Postgres on port **5436** so it does not collide with the Prisma example (5435 / 3000).

## Scope as a tenant admin

```bash
EXAMPLE_ROLE=ADMIN EXAMPLE_TENANT_ID=northwind pnpm --filter @paneljs/example-typeorm dev
```
