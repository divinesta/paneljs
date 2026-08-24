# MikroORM notes

The MikroORM adapter supports **MikroORM 6.4 and later v6 releases** (`peerDependencies`: `@mikro-orm/core` `^6.4.0`). Keep the core package and database driver on the same major.

## Initialized ORM

Pass the resolved result of `await MikroORM.init()`. Introspection reads live metadata, so every entity you want to register must already be present in the ORM's `entities` configuration.

`register("User")` uses the entity class name or `EntitySchema` `name`, not its table name.

## Unit of Work

PanelJS forks an entity manager per operation. CRUD writes use `insert`, `nativeUpdate`, and `nativeDelete`, which execute immediately; the host application does not need to call `flush()` for admin writes.

## Scope

This release accepts simple equality scope, including foreign-key scalars such as `{ tenantId }`. Logical `AND`, `OR`, and `NOT` scope objects are rejected. Scope is still applied to every list, detail, update, delete, relation lookup, and custom-action target.

## Search

The PostgreSQL and CockroachDB platforms use case-insensitive `$ilike`. Other platforms use `$like` according to the driver's behavior.

## Built-in auth

Add `builtInAuthEntities()` to the ORM's entity list when using built-in login. Skip those entities in external auth mode, and never expose `ExpressAdminUser` or `ExpressAdminSession` with `register()`.

## Composite keys

Entities with composite or missing primary keys are skipped. They cannot be registered in this release.

## Custom actions

`client` is the initialized `MikroORM` instance. Use `mikroormActionWhere(orm, entityName, where)` from `@paneljs/mikroorm` to preserve the selected ids and scope in a bulk write.
