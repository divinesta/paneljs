# PanelJS example

Local dogfood app: Express host, Prisma schema, seeded tenants, built-in admin login.

## Local (Postgres in Docker, app on the host)

From the repository root:

```bash
pnpm install
pnpm --filter paneljs build
pnpm --filter @paneljs/express build
pnpm --filter @paneljs/prisma build
pnpm --filter @paneljs/example db:up

cp apps/example/prisma-test/.env.example apps/example/prisma-test/.env

pnpm --filter @paneljs/example db:generate
pnpm --filter @paneljs/example db:push
pnpm --filter @paneljs/example db:seed
pnpm --filter @paneljs/example admin:createsuperuser
pnpm --filter @paneljs/example dev
```

Set `DATABASE_URL` once in `apps/example/prisma-test/.env`. The app, seed, and
superuser commands load that file automatically. `db:generate` and `db:push`
also use it through Prisma's configuration.

Open `http://localhost:3000/admin/login`.

The seed creates three tenants (Northwind, Contoso, Fabrikam) plus users, customers, categories, products, posts, and orders. Re-running it replaces only those example tenants.

A created superuser sees every tenant. Create an `ExpressAdminUser` with role `ADMIN` and a `tenantId` matching a seeded tenant to test scope.

## Docker (Postgres + app)

From `apps/example`:

```bash
docker compose up --build
```

From the repository root (works with Docker Compose and podman-compose):

```bash
docker compose up --build
# or
podman-compose up --build
```

Postgres only (app on the host):

```bash
docker compose up -d postgres
```

Default login (override with env):

- email: `admin@example.test`
- password: `changeme-now`

```bash
PANELJS_ADMIN_EMAIL=you@example.test PANELJS_ADMIN_PASSWORD='your-long-password' docker compose up --build
```
