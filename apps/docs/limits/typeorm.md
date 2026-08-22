# TypeORM notes

The TypeORM adapter supports **TypeORM 0.3.x** (`peerDependencies`: `typeorm` `^0.3.20`).

## Initialized DataSource

`typeormAdapter({ dataSource })` throws if `dataSource.isInitialized` is false. Call `await dataSource.initialize()` first. Introspection is live metadata, not a schema file on disk.

Entities must already be registered on that `DataSource`. An entity you never listed in `entities` cannot be `register()`ed.

## Names

`register("User")` uses the entity **name**, not the table name. `@Entity()` class `User` / `EntitySchema({ name: "User" })` → `"User"`. `tableName: "users"` does not change the register name.

## Search

Case-insensitive list search is used when the driver is `postgres`, `cockroachdb`, or `aurora-postgres`. Other drivers use `Like`.

## Built-in auth

`builtInAuthEntities()` must be in `DataSource.entities` if you use `auth: { mode: "built-in" }`. Skip those entities in external auth mode.

Do not `register("ExpressAdminUser")` or `register("ExpressAdminSession")`.

## Composite keys

Entities with composite primary columns are skipped, same as Prisma models with `@@id([a, b])`. They cannot be registered in this release.

## Custom actions

`client` is the `DataSource`. Use `typeormActionWhere("id", where)` from `@paneljs/typeorm` instead of spreading `where` into a repository call.
