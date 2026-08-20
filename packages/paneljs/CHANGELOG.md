# Changelog

## [0.2.0] - 2026-08-19

ORM-agnostic core contract. Adapters speak PanelJS query types; Express and the UI do not.

### Breaking

- `ModelResource` methods now take typed PanelJS queries (`FindManyQuery`, `FindFirstQuery`, `CreateQuery`, and the rest), not Prisma-shaped `Record<string, unknown>` args.
- Custom action `where` is `{ scope, ids }`, not a Prisma `where` object. Combine it yourself when calling Prisma (or use `prismaActionWhere` from `@paneljs/prisma`).
- `buildListWhere` was removed. List search/filters are fields on `findMany` / `count`.
- `databaseProvider` on `createAdmin` is ignored. Search folding belongs to the data adapter.

### Added

- Query types: `FindManyQuery`, `FindFirstQuery`, `CountQuery`, `CreateQuery`, `UpdateManyQuery`, `DeleteManyQuery`, `FieldSelect`, `FieldFilters`, `SearchQuery`, `ActionWhere`.
- `AdminAuthStore` plus core login helpers (`loginWithPassword`, `authenticateBuiltInRequest`, `resolveAuthStore`, session cookie helpers).
- Optional `DataAdapter.createAuthStore` for built-in login.

### Changed

- List select builders return `FieldSelect` (`fields` + `relations`), not a Prisma `select`.
- `parseListQuery` returns PanelJS filters and `{ text, fields }` search only.

## [0.1.0]

Initial public release.
