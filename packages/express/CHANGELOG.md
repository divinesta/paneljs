# Changelog

## [0.2.0] - 2026-08-19

Express talks only to core: PanelJS queries and `AdminAuthStore`. It does not build Prisma `where` / `select` or call model delegates on `adapter.client`.

### Breaking

- CRUD and actions send PanelJS query objects to `adapter.resource()`.
- Built-in login uses `resolveAuthStore` (adapter `createAuthStore` or `auth.store`). It no longer treats `adapter.client` as Prisma.
- `createCrudRouter` no longer takes `databaseProvider`.
- Custom action handlers receive `where: { scope, ids }`. HTTP JSON for lists and forms is unchanged.

### Changed

- List/search/create/update/delete and bulk delete go through the core query contract.
- Built-in auth routes only handle HTTP (cookie header, same-origin, rate limit). Login and session rules live in `@paneljs/paneljs`.

## [0.1.1]

Patch release on the Prisma-shaped Express mount.

## [0.1.0]

Initial public release.
