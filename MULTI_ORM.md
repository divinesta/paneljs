# Multi-ORM plan

How PanelJS adds TypeORM, Drizzle, Sequelize, MikroORM, and similar data layers.

**Status:** Prisma is the shipped adapter (`@paneljs/prisma`). Do not start a second ORM until **core + Express speak the ORM-agnostic contract** in `CORE_CONTRACT.md` and that path is stable. Do not teach the first extra adapter to fake Prisma queries.

**Related:** `CORE_CONTRACT.md`, `packages/paneljs/src/adapter.ts`, `packages/prisma/src/introspector.ts`, `packages/express/src/crudRouter.ts`

---

## Bottom line

Expansion is possible. You do **not** need a clone of `@prisma/internals` for each ORM. Prisma is the odd one out because its schema lives in a separate DSL that has to be compiled. TypeORM, Drizzle, Sequelize, and MikroORM already expose **public runtime metadata**.

What you build is a thin package that:

1. Maps that metadata into `AdminModelMeta` / `AdminFieldMeta`
2. Implements `DataAdapter` (`introspect` + `resource`)

The UI never sees the ORM. It only sees schema JSON.

| Question | Answer |
| --- | --- |
| Can we support TypeORM / Drizzle later? | Yes, via adapters — not a flag. |
| Do they have `@prisma/internals`? | **No.** They expose public runtime metadata (often better for tooling). |
| What is the contract today? | `DataAdapter` in `packages/paneljs/src/adapter.ts` |
| What should we do next? | Implement `CORE_CONTRACT.md` (common CRUD language + auth store). Then TypeORM. |

---

## What already exists (do not redo this)

The split is already in the monorepo:

```text
paneljs                 core: registry, UI, AdminModelMeta, DataAdapter
@paneljs/express        HTTP: mount(app, admin), cookies, static UI
@paneljs/prisma         getDMMF + Prisma delegates
```

Shared types are already ORM-neutral:

- `nativeType` (was `prismaType`)
- `clientKey` (was `prismaClientKey`)
- custom actions receive `client`, not `prisma`

```ts
export interface ModelResource {
  findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>
  findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>
  count(args: Record<string, unknown>): Promise<number>
  create(args: Record<string, unknown>): Promise<Record<string, unknown>>
  updateMany(args: Record<string, unknown>): Promise<{ count: number }>
  deleteMany(args: Record<string, unknown>): Promise<{ count: number }>
}

export interface DataAdapter {
  readonly client: unknown
  introspect(): Promise<Map<string, AdminModelMeta>>
  resource(meta: AdminModelMeta): ModelResource
}
```

A new ORM is a new package that implements that interface. Core and Express should not import it.

Consumer shape stays:

```ts
import { createAdmin } from "@paneljs/paneljs"
import { prismaAdapter } from "@paneljs/prisma" // or typeormAdapter, drizzleAdapter
import { mount } from "@paneljs/express"

const admin = createAdmin({
  adapter: prismaAdapter({ prisma }),
  auth: { getCurrentUser },
})
admin.register("User")
await mount(app, admin)
```

---

## What `@prisma/internals` is actually doing

In `packages/prisma/src/introspector.ts` we are not talking to the database. We compile `schema.prisma` with `getDMMF()` into DMMF, then normalize it:

- models, fields, enums
- PK / unique / required / generated
- relation kind + FK fields
- searchable / filterable / display field

The rest of the product (`registry`, schema endpoint, React UI) never sees DMMF. It sees `AdminFieldMeta` / `AdminModelMeta`. That is why multi-ORM is feasible.

Prisma is the only major JS ORM that typically **needs** an internals-style compiler. `@prisma/internals` has no SemVer guarantee, which is why Prisma is pinned to 7.5.x. Other ORMs skip that layer.

---

## Do the others have an equivalent?

| ORM | Internals package? | What you actually use |
| --- | --- | --- |
| **Prisma** | Yes: `@prisma/internals` → `getDMMF` (or generated `Prisma.dmmf`) | Compile `schema.prisma` |
| **TypeORM** | No | Live `DataSource.getMetadata()` / `repository.metadata` → `EntityMetadata` |
| **MikroORM** | No | `MetadataStorage.getAll()` → `EntityMetadata` after init |
| **Drizzle** | No | Host-supplied tables + `getTableConfig` / `getColumns`; relations from `defineRelations` |
| **Sequelize** | No | `model.rawAttributes` + `model.associations` |
| **Kysely / Knex** | No useful entity graph | Types or DB introspection; poor Django-admin fit |

You would **not** build “TypeORM internals.” You would build **`@paneljs/typeorm`**.

Discovery differs:

1. **Compile a schema file** — Prisma (`schemaPath` + `getDMMF`).
2. **Read live registered entities** — TypeORM `DataSource`, MikroORM after `init()`, Sequelize after `define`.
3. **Host passes schema objects** — Drizzle. `drizzle()` does not auto-scan a single schema file. The consumer passes tables (and usually relations).

TypeORM / MikroORM are closer to Django’s “models already exist, introspect them.” Drizzle is “here are my table objects, wrap them.”

---

## How to implement one adapter

Each new package (`packages/typeorm`, `packages/drizzle`, …) does two jobs.

### 1. `introspect()` → `Map<string, AdminModelMeta>`

Reuse the same heuristics already in the Prisma introspector (copy them into a shared helper later if they drift):

- display field: `name` / `title` / `label` / `username` / `slug` / `email`, then unique string, then any string, then id
- searchable: non-id, non-FK strings
- filterable: enums, booleans, datetimes, FK scalars
- skip composite PKs and models with no id (same v1 limit as Prisma)

TypeORM (conceptual):

```ts
export function typeormAdapter(dataSource: DataSource): DataAdapter {
  return {
    client: dataSource,
    async introspect() {
      const result = new Map<string, AdminModelMeta>()
      for (const meta of dataSource.entityMetadatas) {
        const adminMeta = fromEntityMetadata(meta) // EntityMetadata → AdminModelMeta
        if (adminMeta) result.set(adminMeta.name, adminMeta)
      }
      return result
    },
    resource(meta) {
      return typeormResource(dataSource, meta)
    },
  }
}
```

Drizzle (conceptual):

```ts
export function drizzleAdapter(options: {
  db: unknown
  tables: Record<string, AnyTable>
  relations?: unknown
}): DataAdapter {
  return {
    client: options.db,
    async introspect() {
      const result = new Map<string, AdminModelMeta>()
      for (const [key, table] of Object.entries(options.tables)) {
        const { columns, foreignKeys, primaryKeys, name } = getTableConfig(table)
        result.set(/* model name */, fromTableConfig({ key, columns, foreignKeys, primaryKeys, name }))
      }
      // patch relation kinds from options.relations
      return result
    },
    resource(meta) {
      return drizzleResource(options.db, options.tables, meta)
    },
  }
}
```

What those APIs do **not** give you the way DMMF does (adapter work):

- Display-field heuristics — already invented; reuse
- Searchable / filterable defaults — reuse
- Relation kind (`belongsTo` / `hasMany` / `hasOne` / `manyToMany`) — each ORM encodes this differently
- Drizzle many-to-many — explicit junction tables, not a first-class `@relation`

### 2. `resource(meta)` → `ModelResource`

This is the hard half. Express CRUD (`packages/express/src/crudRouter.ts`) already calls:

- `findMany` / `findFirst` / `count` / `create` / `updateMany` / `deleteMany`
- Prisma-shaped `where` (`AND`, `contains`, `mode: "insensitive"`, `{ in: ids }`)
- Prisma-shaped `select` / `orderBy` / `skip` / `take`

Do **not** translate Prisma-shaped args as the long-term contract. Express and core must send a PanelJS query (see `CORE_CONTRACT.md`). The first extra ORM implements that query, not Prisma’s `where` / `select`. Until `CORE_CONTRACT.md` lands, Express still builds Prisma-shaped args — that is debt, not the target.

`client` on `DataAdapter` is the opaque handle custom actions receive (`handler({ client, where, ids })`). For TypeORM that is the `DataSource` or `EntityManager`; for Drizzle it is the `db` instance.

---

## What will not translate 1:1

1. **Relation writes** — Prisma `connect` / `disconnect` vs TypeORM relation setters vs Drizzle insert/update + junction rows. v1 only writes belongs-to FK scalars. Keep that limit in every adapter until relation editors exist.
2. **Filter / search dialects** — Prisma `contains` + `mode: "insensitive"` is Postgres-oriented; TypeORM `ILike` / `Like`; Drizzle `ilike()`.
3. **Composite primary keys** — already skipped in Prisma v1; skip them everywhere.
4. **Zero-config story** — Prisma: point at `schema.prisma`. TypeORM: pass an initialized `DataSource`. Drizzle: pass tables + relations.
5. **Built-in auth tables** — today login still expects Prisma-like `findUnique` on user/session delegates. Target is `AdminAuthStore` in `CORE_CONTRACT.md` (Prisma implements the first store). External `getCurrentUser` already works with any adapter.

---

## Package layout when a second ORM ships

```text
packages/paneljs          npm: paneljs
packages/express          npm: @paneljs/express
packages/prisma           npm: @paneljs/prisma
packages/typeorm          npm: @paneljs/typeorm     ← add when real
packages/drizzle          npm: @paneljs/drizzle
packages/sequelize        npm: @paneljs/sequelize
packages/mikroorm         npm: @paneljs/mikroorm
```

Each ORM is a **peerDependency** of its adapter package. Do not pre-create empty folders.

```ts
import { typeormAdapter } from "@paneljs/typeorm"
import { drizzleAdapter } from "@paneljs/drizzle"
```

---

## Order of work

| Step | Work |
| --- | --- |
| **Now** | Implement `CORE_CONTRACT.md` on Prisma + Express (common CRUD language + auth store). |
| **A** | Keep `DataAdapter` / `ModelResource` as the contract; replace Prisma-shaped args with the PanelJS query types. |
| **B** | Second adapter: **TypeORM** or **MikroORM** (richest public metadata, closest to “entities exist”). Plus an example app. Only after A. |
| **C** | **Drizzle** (popular; host-supplied schema). |
| **D** | Sequelize if demand exists. |
| **E** | Kysely / Knex last or never (no entity graph). |

Suggested first extra adapter: TypeORM.

Concrete TypeORM checklist:

1. `packages/typeorm` with `typeormAdapter(dataSource)`
2. `fromEntityMetadata` → `AdminModelMeta` (columns, PKs, uniques, generated, relations)
3. `typeormResource` implementing `ModelResource` (PanelJS query types from `CORE_CONTRACT.md`, not Prisma `where`)
4. Example under `apps/example-typeorm`
5. Peer `typeorm`; depend on `@paneljs/paneljs` with `workspace:^`
6. Docs: one page “TypeORM adapter”, same register/mount story

---

## What not to do

- Do not import TypeORM or Drizzle from `packages/paneljs` or `packages/express`
- Do not add empty ORM packages “for later”
- Do not copy `@prisma/internals` usage into other adapters
- Do not promise composite PKs or nested relation writes as part of the first extra ORM
- Do not block Prisma releases on TypeORM work

---

## Bottom line

Other ORMs do not have `@prisma/internals`. They have something more stable: public metadata. You still need **PanelJS adapters**, because mapping into `AdminModelMeta` and request-time CRUD is product-specific.

The UI does not care which ORM produced the schema JSON. That is the design advantage of `DataAdapter`. A second ORM is a new package that implements the same two methods Prisma already implements.
