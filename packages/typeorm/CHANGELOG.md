# Changelog

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
