# Changelog

## [0.1.7] - 2026-08-24

### Added

- The auth store implements administrator creation for the shared `createsuperuser` command.
- `typeormAdapter` disposes its initialized `DataSource` when a short-lived CLI command finishes.

## [0.1.6] - 2026-08-23

### Fixed

- The published `paneljs` dependency is `^0.3.1`, not `workspace:^`. npm consumers could not install 0.1.5 because of that protocol.

## [0.1.5] - 2026-08-21

### Breaking

- The core dependency is now `paneljs`, replacing `@paneljs/paneljs`. Update core imports to `from "paneljs"` when upgrading.

## [0.1.4] - 2026-08-20

### Changed

- Foreign-key scalars (`tenantId`, `authorId`, …) are writable, matching Prisma `belongsTo` selects.
- Non-generated primary keys are writable on create. Generated ids stay read-only.
- `create` fills uuid-generated ids when the payload omits them, and maps NOT NULL violations to `VALIDATION_ERROR`.

## [0.1.3] - 2026-08-20

### Changed

- Introspection maps TypeORM `onDelete` (`CASCADE`, `SET NULL`, …) to Prisma-style names (`Cascade`, `SetNull`, …).
- `belongsTo` relations with no `onDelete` default to `Restrict`.
- `deleteMany` maps foreign-key violations to `VALIDATION_ERROR` instead of a 500.

## [0.1.0] - 2026-08-19

### Added

- Package scaffold: `typeormAdapter({ dataSource })`.
- Requires an initialized TypeORM `DataSource`.
- `client` is the `DataSource` (for custom actions).
- `introspect(dataSource)` maps TypeORM `entityMetadatas` to `AdminModelMeta`.
- Skips junction tables and composite / missing primary keys.
- Same display / searchable / filterable guesses as the Prisma adapter.
- `typeormResource` implements list/get/create/update/delete from PanelJS queries.
- Search uses `ILike` on Postgres (and Cockroach), `Like` otherwise.
- `typeormActionWhere` builds TypeORM criteria from custom-action `{ scope, ids }`.
- `builtInAuthEntities()` — TypeORM tables for built-in login.
- `typeormAuthStore` / `createAuthStore` — same auth-store contract as Prisma.
