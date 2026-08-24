# Changelog

## [0.3.1] - 2026-08-23

### Fixed

- The published `paneljs` dependency is `^0.3.1`, not `workspace:^`. npm consumers could not install 0.3.0 because of that protocol.

## [0.3.0] - 2026-08-22

Express now mounts a thin HTTP layer over core `AdminService`.

### Changed

- CRUD and action routers call `admin.service` instead of implementing permissions, scope, hooks, audit, and deletion themselves.
- Invalid JSON request bodies return `400` with code `INVALID_JSON`.
- Request bodies that exceed the parser limit return `413` with code `BODY_TOO_LARGE`.

## [0.2.2] - 2026-08-21

### Breaking

- The core dependency is now `paneljs`, replacing `@paneljs/paneljs`. Update core imports to `from "paneljs"` when upgrading.

## [0.2.1] - 2026-08-20

### Changed

- `delete-preview` includes Cascade, SetNull, and Restrict child relations, with `onDelete` on each group.
- Built-in delete (list action and `DELETE /:model/:id`) rejects Restrict relations with `VALIDATION_ERROR` instead of letting the ORM throw a 500.

## [0.2.0] - 2026-08-19

Express talks only to core: PanelJS queries and `AdminAuthStore`. It does not build Prisma `where` / `select` or call model delegates on `adapter.client`.

### Breaking

- CRUD and actions send PanelJS query objects to `adapter.resource()`.
- Built-in login uses `resolveAuthStore` (adapter `createAuthStore` or `auth.store`). It no longer treats `adapter.client` as Prisma.
- `createCrudRouter` no longer takes `databaseProvider`.
- Custom action handlers receive `where: { scope, ids }`. HTTP JSON for lists and forms is unchanged.

### Changed

- List/search/create/update/delete and bulk delete go through the core query contract.
- Built-in auth routes only handle HTTP (cookie header, same-origin, rate limit). Login and session rules live in `paneljs`.

## [0.1.1]

Patch release on the Prisma-shaped Express mount.

## [0.1.0]

Initial public release.
