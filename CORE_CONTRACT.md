# Core contract

Make PanelJS ORM-agnostic in **core** and **Express** before any second ORM.

**Status:** Slices 1–2 done (CRUD language + Prisma-owned search). Built-in auth is still Prisma-shaped (slice 3). Do not start TypeORM, Drizzle, or another HTTP framework until this contract is implemented and that path is stable.

**Related:** `MULTI_ORM.md`, `packages/paneljs/src/adapter.ts`, `packages/paneljs/src/listQuery.ts`, `packages/express/src/crudRouter.ts`, `packages/express/src/builtIn.ts`, `packages/prisma/src/index.ts`

**Replaces this advice in `MULTI_ORM.md`:** “translate Prisma-shaped args inside the first extra adapter.” That was a shortcut. We will change the language in core first, then add ORMs.

---

## Bottom line

Two rules:

1. Every ORM talks to **core** in one language. Same shape for “what models exist.” Same shape for “list / get / create / update / delete.”
2. Express (and later Fastify / Next) must **not** care which ORM that was. They only talk to core.

The UI already follows rule 2. It only sees HTTP JSON. Leave the public HTTP JSON the same so existing installs keep working.

Uniqueness of Prisma, TypeORM, and the rest belongs **inside adapter packages**, not in Express routes.

---

## Design rules

| Layer | May it know Prisma vs TypeORM? |
| --- | --- |
| UI | No. HTTP JSON only. |
| Express / future HTTP packages | No. Core + adapter only. |
| `packages/paneljs` (core) | No. `AdminModelMeta` + the query/result types in this file. |
| `@paneljs/prisma`, later `@paneljs/typeorm`, … | **Yes.** Translate the core language to that ORM and back. |
| Auth store package / adapter helper | **Yes** for *how* rows are stored. **No** for the login HTTP shape. |

Do not put `if (orm === "prisma")` in Express.

Setup is allowed to be ORM-specific (Prisma schema snippet vs TypeORM entity). Runtime is not.

---

## What is already true

- Core types are mostly ORM-neutral: `AdminModelMeta`, `AdminFieldMeta`, `nativeType`, `clientKey`.
- `DataAdapter` already has two jobs: `introspect()` and `resource()`.
- `@paneljs/prisma` is a separate package. Core does not import Prisma.
- The UI never calls `resource()`. It calls `/admin/api/schema` and `/admin/api/:model`.
- External auth (`getCurrentUser`) already takes `AdminHttpRequest`, not an Express type.
- Permissions and `AdminUser` do not need an ORM.

## What is still Prisma-shaped (the cleanup)

Express almost never *imports* Prisma. It still *speaks* Prisma when it asks for rows.

| Place | Prisma habit |
| --- | --- |
| `listQuery.ts` | Builds `{ AND }`, `{ OR }`, `{ contains, mode: "insensitive" }` |
| `scope.ts` | Comment and `AND` wrapper assume a Prisma `where` |
| `recordSelection.ts` | Prisma `select` / nested `{ author: { select: { name: true } } }` |
| `crudRouter.ts` / `actionRouter.ts` | Pass those objects into `resource().findMany` etc. |
| `AdminConfig.databaseProvider` | Deprecated / ignored. Prisma adapter reads the schema datasource. |
| `builtIn.ts` | `adapter.client` treated as Prisma: `findUnique`, `include: { user: true }`, camelCase delegates |
| Prisma adapter | Not a translator. `resource()` returns `prisma.user` unchanged |
| Custom actions | Receive `client` (the real ORM object) and a Prisma-like `where` |

The HTTP responses (list payload, one record, schema JSON) stay as they are. This plan changes the **objects core/Express send into the adapter**, not the JSON the browser gets.

---

## Spec 1 — Common CRUD language

This is not a new product. It is a typed version of what Express already asks for.

Keep the six operations. Change the **arguments**.

### Resource interface (target)

Names can be refined in code review. The meaning must not.

```ts
interface ModelResource {
  findMany(query: FindManyQuery): Promise<Record<string, unknown>[]>
  findFirst(query: FindFirstQuery): Promise<Record<string, unknown> | null>
  count(query: CountQuery): Promise<number>
  create(query: CreateQuery): Promise<Record<string, unknown>>
  updateMany(query: UpdateManyQuery): Promise<{ count: number }>
  deleteMany(query: DeleteManyQuery): Promise<{ count: number }>
}
```

`DataAdapter` stays:

```ts
interface DataAdapter {
  readonly client: unknown  // opaque; custom actions only
  introspect(): Promise<Map<string, AdminModelMeta>>
  resource(meta: AdminModelMeta): ModelResource
}
```

### Queries core may send

**Equality filter** (also used by `scope()`):

```ts
// field name → exact value (string | number | boolean | Date | null)
type EqualityFilter = Record<string, unknown>
```

`scope()` already returns this for the common case (`{ tenantId: "…" }`). Keep that public. Do not invent a second scope DSL.

**List / count**

```ts
type FindManyQuery = {
  scope: EqualityFilter          // from scope(); may be {}
  filters: FieldFilters          // from query string: exact, gte, lte
  search?: {
    text: string
    fields: string[]             // searchable string fields already resolved
  }
  sort: { field: string; direction: "asc" | "desc" }
  skip: number
  take: number
  select: FieldSelect
}

type CountQuery = Pick<FindManyQuery, "scope" | "filters" | "search">
```

**Field filters** (what `parseListQuery` already allows):

- exact match on a filterable field
- `field_gte` / `field_lte` on datetime fields only

Do not add Prisma operators (`contains`, `in`, `mode`, `AND`, `OR`) to this type. Search is a first-class field (`search.text` + `search.fields`), not a fake `OR` of `contains`.

**Get / update / delete one**

```ts
type FindFirstQuery = {
  scope: EqualityFilter
  id: string | number
  select: FieldSelect
}

type UpdateManyQuery = {
  scope: EqualityFilter
  id?: string | number           // one row
  ids?: Array<string | number>   // bulk (actions)
  data: Record<string, unknown>  // already validated; scalars + belongs-to FK
}

type DeleteManyQuery = {
  scope: EqualityFilter
  id?: string | number
  ids?: Array<string | number>
}
```

**Create**

```ts
type CreateQuery = {
  data: Record<string, unknown>
  select: FieldSelect
}
```

Create data is already flattened by validation. v1 still does not write nested `connect` / `create` trees.

### Select (what columns come back)

Today Express builds a Prisma `select`. Replace it with a PanelJS select:

```ts
type FieldSelect = {
  fields: string[]               // scalar / enum columns, always include id
  relations: Array<{             // belongsTo / hasOne display only
    field: string                // e.g. "author"
    displayField: string         // e.g. "name"
  }>
}
```

The Prisma adapter turns that into Prisma `select`. TypeORM later turns it into `relations` + selected columns. Express never builds `{ author: { select: { name: true } } }`.

`buildRecordSelect` / `buildListRecordSelect` stay in core. They should return `FieldSelect`, not a Prisma object.

### Search and case folding

Express must stop using `databaseProvider` to inject `mode: "insensitive"`.

Rule: **search is case-insensitive when the adapter can do it.** The Prisma adapter uses `mode: "insensitive"` on PostgreSQL and plain `contains` otherwise. That knowledge lives in `@paneljs/prisma`, not in `mount()`.

`databaseProvider` may remain on config for a deprecation window if removing it is a breaking public type. It must not be required for listing.

### What adapters must guarantee

- Apply `scope` and `filters` as AND.
- Apply `search` as “any of these string fields contain `text`.”
- Never return rows outside `scope`.
- Writes stay scalar + belongs-to foreign keys (same v1 limit as today).
- Skip models with composite primary keys or no id (same as today’s introspector).

### Custom actions

`handler({ ids, adminUser, client, where })` stays. `client` is still the opaque ORM handle. That is intentional: a custom action may need Prisma transactions or TypeORM’s `EntityManager`.

`where` should become a PanelJS object (`scope` + `ids`), not a Prisma `AND`. Document the change. If that is too breaking for v1, keep passing a documented PanelJS object *and* let the adapter expose a helper later. Do not keep generating Prisma `where` in Express.

### Prisma adapter after this spec

`resource()` must **not** return `prisma.user` directly.

It returns a `ModelResource` that:

1. Reads `FindManyQuery` / `CreateQuery` / …
2. Translates to Prisma `findMany` / `create` / …
3. Returns plain records

Introspection (`getDMMF` → `AdminModelMeta`) does not change in this plan.

### Out of scope for Spec 1

- Nested relation writes
- Composite primary keys
- A general-purpose query builder
- Fastify / Next
- TypeORM

---

## Spec 2 — Auth (identity, store, HTTP)

“Universal auth” is three jobs. They are mixed together in `packages/express/src/builtIn.ts` today. Split them.

| Job | Question | Owner |
| --- | --- | --- |
| Identity | Who is this request? | Core. Always an `AdminUser` or `null`. |
| Store | Where are admin users and sessions saved? | Auth store. One implementation per ORM. |
| HTTP | Login route, cookie, logout, redirect | Core describes the result. Express sets headers and paths. |

Keep **two modes**. Do not merge them.

### Mode A — External (already the right shape)

Host app already has login.

```ts
auth: {
  getCurrentUser: (req: AdminHttpRequest) => Promise<AdminUser | null>
}
```

No admin tables. No auth store. Frameworks later pass the same tiny request shape (`headers`, optional `get`, `ip`).

Work in this plan: keep it. Do not pass Prisma into this path. Express middleware already matches this mode.

### Mode B — Built-in (the coupled path)

PanelJS owns `/admin/login`, a cookie, and two tables (user + session). Hosts still create those tables with their ORM (Prisma snippet today, TypeORM entities later). Runtime must not import Prisma from Express.

#### Auth store (core type)

Built-in login in core only calls a store. It never calls `prisma.expressAdminUser`.

```ts
interface AdminAuthStore {
  findUserByIdentifier(identifier: string): Promise<BuiltInUserRecord | null>
  findSessionWithUser(tokenHash: string): Promise<BuiltInSessionRecord | null>
  createSession(input: { tokenHash: string; userId: string; expiresAt: Date }): Promise<void>
  deleteSessionByTokenHash(tokenHash: string): Promise<void>
}
```

`BuiltInUserRecord` is the existing fields: `id`, `email` and/or `username`, `passwordHash`, `role`, `isActive`, optional `tenantId`.

Session lookup must ignore expired sessions (today: `expiresAt > now`). Put that rule in the store (or in core after the store returns the row). Do not use Prisma `gt` in Express.

Password hashing stays in core (`hashAdminPassword` / `verifyLoginPassword`). The store never sees the raw password.

Try **not** to invent a second adapter family if `ModelResource` can express these four calls after Spec 1. If login needs one extra lookup (`find by unique identifier`), add it to the CRUD language instead of a special Prisma path. If `include: { user: true }` is awkward, a small `AdminAuthStore` is better than twisting CRUD. Prefer the store if CRUD would get login-only operators.

`@paneljs/prisma` ships the first store (`prismaAuthStore(prisma)` or built-in auth options on `prismaAdapter`). Express must not look up `expressAdminUser` on `adapter.client`.

External mode must **not** require a store or those tables.

#### HTTP (framework-thin)

Core owns:

- Cookie name (`paneljs_session`), hash (sha256), TTL, `HttpOnly` / `SameSite=Lax` / `Path=basePath` rules
- Login, logout, “who is this” as functions that take `AdminHttpRequest` + body
- Return values like: `{ status, body, cookiesToSet, redirectTo? }`

Express owns:

- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/config`
- Reading `Cookie` / writing `Set-Cookie`
- Same-origin check for browser login (stays in the HTTP package)
- Rate limit (stays in the HTTP package, or core with `ip` from `AdminHttpRequest`)
- Redirect to `/login` for HTML pages

Do not put `express.Router` in core.

CLI `createsuperuser` / `auth:schema` stay Prisma-only until a second ORM exists. They generate Prisma models. That is setup, not runtime. When TypeORM comes, add a TypeORM snippet — do not invent one schema file for every ORM.

#### What “universal” does **not** mean

- Not OAuth, magic links, or replacing the host app’s user table
- Not one physical schema shared by Prisma and TypeORM
- Not showing `ExpressAdminUser` in the admin UI (still forbidden)

---

## Express cleanup (what to change)

`@paneljs/express` after this plan:

1. `mount` still calls `admin.initialize()`, still serves UI + `/api`.
2. CRUD and actions call `adapter.resource()` with Spec 1 queries only.
3. Built-in auth calls core login helpers + `AdminAuthStore`. It does not call `findUnique` on `adapter.client`.
4. No Prisma types, no Prisma `where`, no `databaseProvider` used for search.

Core after this plan:

1. `parseListQuery` returns Spec 1 filters/search/sort/page — not Prisma `OR`.
2. `buildListWhere` / Prisma `AND` either disappear or become adapter-private.
3. Select builders return `FieldSelect`.
4. Built-in identity helpers live in core (or a core auth module), not only in Express.

Prisma after this plan:

1. Translator for Spec 1.
2. First `AdminAuthStore`.
3. Introspector unchanged in spirit.

---

## Order of work

| Step | Work | Done when |
| --- | --- | --- |
| **0** | This document. No TypeORM. | You are here. |
| **1** | Spec 1 types in `packages/paneljs`. Express CRUD + actions use them. Prisma adapter translates. HTTP JSON unchanged. | In progress in this repo. Example app lists, searches, creates, edits, deletes, runs delete-selected. |
| **2** | Move `databaseProvider` search behavior into the Prisma adapter. | Done. Listing is case-insensitive on Postgres from `schema.prisma`. |
| **3** | Spec 2: `AdminAuthStore` + core login/session helpers. Express `builtIn.ts` becomes HTTP-only. Prisma implements the store. | Built-in login, cookie, logout, createsuperuser still work. |
| **4** | Stabilize. Docs: adapter contract, auth store, “Express does not speak Prisma.” | Prisma + Express on this contract is the shipped path. |
| **5** | Only then: TypeORM (`MULTI_ORM.md` checklist). Same Spec 1 resource. Optional TypeORM auth store. Example app. | Second ORM is a new package, not an Express branch. |

Do not parallelize TypeORM with steps 1–4.

Do not add Fastify/Next in this plan. After step 4, a second HTTP package should be able to mount using the same core functions. That is a later plan.

---

## Guardrails (what not to do)

- Do not change the browser API shape (`records`, `total`, `page`, schema endpoint) unless a bug requires it
- Do not add empty `packages/typeorm`
- Do not import TypeORM or Prisma from `packages/paneljs` or `packages/express`
- Do not copy `@prisma/internals` into other adapters
- Do not promise composite PKs or nested relation writes
- Do not block Prisma bugfixes on this work — land contract changes in focused PRs
- Do not design OAuth as part of “universal auth”
- Do not keep Prisma `resource()` as a pass-through once Spec 1 lands

---

## How this meets TypeORM later (do not implement yet)

When step 4 is stable:

1. `typeormAdapter(dataSource)` implements `introspect()` from `entityMetadatas` → `AdminModelMeta`.
2. `typeormResource` implements Spec 1 (`ILike` / `Like` for search, repositories for CRUD).
3. Optional `typeormAuthStore(dataSource)` implements Spec 2 if the host wants built-in login.
4. Express does not change.

Until then, TypeORM is a test of this document, not a workstream.

---

## Success

Prisma + Express follow the design system when:

- Core and Express contain no Prisma query objects
- Built-in auth in Express does not use model delegates on `adapter.client`
- `@paneljs/prisma` is the only package that calls Prisma for CRUD and built-in tables
- The example app and public HTTP JSON still behave as they do today
- A second ORM can be added as a new package that implements Spec 1 (and Spec 2 if it wants built-in login) without editing Express CRUD
