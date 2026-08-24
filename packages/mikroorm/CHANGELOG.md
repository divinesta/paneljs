# Changelog

## [0.1.0] - 2026-08-24

### Added

- The auth store implements administrator creation for the shared `createsuperuser` command.
- `mikroormAdapter` closes its ORM connection when a short-lived CLI command finishes.
- Package scaffold: `mikroormAdapter({ orm })`.
- Requires an initialized MikroORM instance.
- `client` is the ORM (for custom actions).
- `introspect(orm)` maps MikroORM entity metadata to `AdminModelMeta`.
- Skips pivot tables and composite / missing primary keys.
- Same display / searchable / filterable guesses as the Prisma and TypeORM adapters.
- `mikroormResource` implements list/get/create/update/delete from PanelJS queries.
- Search uses `$ilike` on Postgres (and Cockroach), `$like` otherwise.
- Writes use `insert` / `nativeUpdate` / `nativeDelete` so Unit of Work is not required for admin CRUD.
- `mikroormActionWhere` builds MikroORM criteria from custom-action `{ scope, ids }`.
- `builtInAuthEntities()` — MikroORM tables for built-in login.
- `mikroormAuthStore` / `createAuthStore` — same auth-store contract as Prisma and TypeORM.
