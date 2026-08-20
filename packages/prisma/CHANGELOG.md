# Changelog

## [0.2.0] - 2026-08-19

Prisma is a translator: PanelJS queries in, Prisma Client calls out. Built-in auth is an `AdminAuthStore`, not Express reaching into delegates.

### Breaking

- `prismaAdapter().resource()` no longer returns a Prisma model delegate. It returns a `ModelResource` that translates PanelJS queries to Prisma.
- `getDelegate` still returns the raw Prisma delegate if you need it; do not use it as a `ModelResource`.

### Added

- `prismaResource` — CRUD translator (`findMany` / `findFirst` / `count` / `create` / `updateMany` / `deleteMany`).
- `prismaActionWhere` — turn custom-action `{ scope, ids }` into a Prisma `where`.
- `prismaAuthStore` and `prismaAdapter().createAuthStore` for built-in login tables.
- Datasource `provider` is read from `schema.prisma`. PostgreSQL search uses `mode: "insensitive"` without `createAdmin({ databaseProvider })`.

### Changed

- Introspection is unchanged in spirit (`getDMMF` → `AdminModelMeta`).
- CLI `createsuperuser` / `auth:schema` remain Prisma setup tools.

## [0.1.0]

Initial public release.
