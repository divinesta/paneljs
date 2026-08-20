# Changelog

## [0.1.0] - 2026-08-19

### Added

- Package scaffold: `typeormAdapter({ dataSource })`.
- Requires an initialized TypeORM `DataSource`.
- `client` is the `DataSource` (for custom actions).
- `introspect(dataSource)` maps TypeORM `entityMetadatas` to `AdminModelMeta`.
- Skips junction tables and composite / missing primary keys.
- Same display / searchable / filterable guesses as the Prisma adapter.
- `resource()` is not implemented yet.
