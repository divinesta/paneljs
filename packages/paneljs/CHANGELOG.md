# Changelog

## Unreleased

### Breaking

- `createsuperuser` config now exports `{ adapter, auth }`; the Prisma-only `{ prisma, auth }` contract was removed.
- `AdminAuthStore` implementations must provide `createUser()`.

### Added

- `createsuperuser` now provisions built-in administrators through Prisma, TypeORM, or MikroORM adapters.
- `DataAdapter.dispose()` lets short-lived CLI commands close ORM connections cleanly.

## [0.3.2] - 2026-08-23

### Added

- CLI output is colored (prompts, package list, success, errors). Honors `NO_COLOR` and non-TTY streams. The mount snippet stays uncolored so it stays copy-pasteable.

### Fixed

- `paneljs init` installs npm-safe version ranges. Published `@paneljs/express`, `@paneljs/prisma`, and `@paneljs/typeorm` had `paneljs: workspace:^`, which npm cannot install. `init` now asks for versions that ship a real semver range, and `npm install` is passed `--no-workspaces`.

## [0.3.1] - 2026-08-23

### Added

- `paneljs` CLI on this package: `npx paneljs init` installs `paneljs`, the HTTP adapter, and the ORM adapter for the stack you pick. It does not rewrite source files.
- `init --framework express --orm prisma|typeorm --yes` for non-interactive use. `--dry-run` prints the plan without installing.
- Fastify, Nest.js, and Drizzle appear in the prompt but cannot be selected yet.
- `auth:schema` and `createsuperuser` now live here (Prisma setup only).

## [0.3.0] - 2026-08-22

Admin operations now live in core. Transports call `AdminService` instead of reimplementing CRUD, actions, and delete rules.

### Added

- `AdminService` with `list`, `get`, `create`, `update`, `delete`, `deletePreview`, `deleteSelected`, and `runAction`.
- `admin.service`, available after `admin.initialize()`.
- `validateSelectedIds` for bulk-action ID rules: non-empty, unique, and at most 100.
- `loadDeletePreviewRelations` and `assertNoRestrictedRelations`, moved out of `@paneljs/express`.

### Changed

- Permission, scope, hook, audit, and referential-delete orchestration run in `AdminService`, so Express no longer owns that behavior.

## [0.2.2] - 2026-08-21

### Breaking

- The package name is now `paneljs`, replacing `@paneljs/paneljs`. Update imports to `from "paneljs"` when upgrading.

## [0.2.1] - 2026-08-20

### Changed

- Delete confirmation lists related rows for Cascade, SetNull, and Restrict, not only Cascade.
- Restrict / Protect relations disable Confirm delete and explain that related records still reference the row.

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
