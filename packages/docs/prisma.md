# How Prisma makes PanelJS work

Prisma first. TypeORM answers the same two questions with different gifts — see [typeorm.md](./typeorm.md).

---

## What PanelJS is doing

PanelJS is an admin panel for an app that already has a database.

It needs two answers from that database layer:

1. **What exists?** Which models, which fields, which ids, which relations.
2. **How do I read and write rows?** List users, open one user, create, update, delete.

Prisma is the first adapter that answers both. The UI never talks to Prisma. It only calls `/admin/api/...`.

---

## Three packages

Think of three rooms:

| Room | Package | Job |
| --- | --- | --- |
| Core | `@paneljs/paneljs` | Remembers which models you registered. Stores field info. Checks permissions. Builds list/search objects. Does **not** talk to Prisma. |
| HTTP | `@paneljs/express` | Puts the admin on your Express app at `/admin`. Serves the UI and the API. |
| Prisma room | `@paneljs/prisma` | Reads `schema.prisma`. Translates PanelJS queries into Prisma `find` / `create` / `update` / `delete`. |

---

## Words

- **Model** — one kind of thing in the database, like `User` or `Post`.
- **Field** — one column on that thing, like `email` or `createdAt`.
- **Schema file** — Prisma’s text file, usually `schema.prisma`, where you write models.
- **Prisma Client** — the generated object in your app, usually called `prisma`. You call `prisma.user.findMany()`.
- **DMMF** — Prisma’s compiled description of the schema. Prisma reads the text file and turns it into a structured object in memory (models, fields, enums, relations). PanelJS does not parse `.prisma` by hand. It asks Prisma for this object.
- **Introspect** — look at that description and copy the useful bits into PanelJS’s own format (`AdminModelMeta`).
- **Adapter** — a small object with `introspect()` (what exists), `resource()` (how to read/write one model), and optionally `createAuthStore()` (built-in login tables).
- **Mount** — attach the admin to Express: `await mount(app, admin)`. This is when boot work runs.
- **Registry** — the list of models you called `register("User")` on, plus filled-in defaults (columns, search, sort).

---

## Block 1 — Prisma’s three gifts

Prisma is not one blob. PanelJS uses three different Prisma things.

### Gift 1: the schema file

```prisma
model User {
  id    String @id @default(uuid())
  email String @unique
  name  String
}
```

This is the source of truth. You do not describe `User` a second time for the admin.

### Gift 2: DMMF (the compiled map)

At mount, `@paneljs/prisma` calls `getDMMF()` from `@prisma/internals`. That function reads `schema.prisma` and returns a big object. That object is DMMF.

DMMF can tell PanelJS, for each model:

- name (`User`)
- fields (`id`, `email`, `name`)
- types (`String`, `Int`, `DateTime`, …)
- which field is the id
- which fields are required, unique, generated
- relations (`Post.author` points at `User`)
- enums (`Role.ADMIN`)

It does **not** load rows from the database. It only describes the shape.

### Gift 3: the Prisma Client (the worker)

After you generate the client, you have:

```ts
prisma.user.findMany()
prisma.user.create({ data: { email: "a@b.com" } })
```

`user` is lowercase. Prisma always exposes `User` as `prisma.user`. PanelJS stores that lowercase name as `clientKey`.

Gift 2 answers “what exists.” Gift 3 answers “read and write rows.” The Prisma adapter is a translator: PanelJS query in, Prisma Client out.

---

## Block 2 — Boot time (mount)

Nothing talks to the database yet for listing users. This is setup.

```ts
const admin = createAdmin({
  adapter: prismaAdapter({ prisma, schemaPath }),
  auth: { getCurrentUser },
})

admin.register("User")
await mount(app, admin)
```

What that actually does, in order:

1. `register("User")` only saves the name `"User"` and any options you passed. It does **not** read Prisma yet.
2. `mount` calls `admin.initialize()`.
3. `initialize` calls `adapter.introspect()`.
4. For Prisma, that means: read `schema.prisma` → `getDMMF()` → turn each Prisma model into `AdminModelMeta`.
5. The registry checks that `"User"` really exists in that map. If you registered `"Users"` and the model is `"User"`, it throws now, not when someone clicks.
6. Missing options are filled in: which column to show as the title, which fields are searchable, sort order, page size.
7. Express gets a router at `/admin` (or your `basePath`):
   - `/admin/api/schema` — JSON the UI uses to draw screens
   - `/admin/api/users` — list/create/update/delete
   - everything else — the React app

`AdminModelMeta` is PanelJS’s own description of a model. After this point, core and Express should not need DMMF.

A short picture of one model after introspection:

- `name`: `"User"`
- `pluralName`: `"users"` (used in the URL `/admin/api/users`)
- `clientKey`: `"user"` (used as `prisma.user` inside the Prisma adapter)
- `idField`: `"id"`
- `displayField`: usually `name` or `email` or `title` (a guess from field names)
- `fields`: each field’s type, required, unique, searchable, relation, …

The UI is dumb on purpose. After mount it asks `GET /admin/api/schema` and builds lists and forms from that JSON.

---

## Block 3 — Request time (a click in the UI)

Someone opens `/admin/users`.

There is no `users.html`. Express serves the same React page. React then calls the API.

```
GET /admin/api/users?page=1&search=ada
```

Every API call goes through the same pipeline:

```
who are you? → are you allowed? → which rows? → is the payload safe? → adapter.resource() → maybe write an audit line
```

| Step | Meaning | Does this need Prisma? |
| --- | --- | --- |
| Auth | Turn the request into an admin user, or 401 | Built-in login uses the **auth store** (Prisma implements it). Your own `getCurrentUser` does not need Prisma. |
| Permissions | May this role list / edit this model? | No |
| Scope | Only this tenant’s rows? | No (it only adds extra equality fields) |
| Validate | Only known, writable fields | No |
| Resource | `findMany` / `create` / … | **Yes** — inside `@paneljs/prisma` |
| Audit | Log that it happened | No |

The Prisma-specific moment is the **resource** step.

Express sends a **PanelJS** query, not a Prisma `where`:

```ts
const resource = adapter.resource(model.meta)
await resource.findMany({
  scope,
  filters,
  search: { text: "ada", fields: ["email", "name"] },
  sort: { field: "createdAt", direction: "desc" },
  skip: 0,
  take: 50,
  select,
})
```

`@paneljs/prisma` turns that into Prisma’s shape (`contains`, `mode: "insensitive"` on PostgreSQL, `skip` / `take`, and so on). Express does not.

---

## Block 4 — Auth and permissions

These are two different locks, plus a third for “who is this.”

**Permissions** = “may this role do this action on this model?”

Example: `ADMIN` can list users, only `SUPER_ADMIN` can delete. This does not need Prisma.

**Scope** = “which rows?”

Example: Ada is `ADMIN` but only sees Northwind’s users. Same role, fewer rows. Scope becomes extra equality, e.g. `{ tenantId: "northwind" }`. Still not Prisma-specific. The Prisma adapter applies it as Prisma `where`.

**Auth** = “who is this person?”

Two modes:

1. **External** — you pass `getCurrentUser`. PanelJS calls it. If you return a user, they are in. Prisma is not required.
2. **Built-in** — PanelJS owns `/admin/login`. It expects tables like `ExpressAdminUser` and `ExpressAdminSession`. Login goes through `AdminAuthStore`. Prisma implements that store (`prismaAuthStore` / `createAuthStore`). Express only sets cookies and routes. Those table names start with “Express” because the product started as an Express admin, not because they belong to the HTTP framework.

---

## Block 5 — Prisma habits the adapter relies on

1. **One place that lists all models** — `schema.prisma`.
2. **A compiled map of those models** — DMMF (types, ids, uniques, relations, enums).
3. **One id field per model** — composite ids (`@@id([a, b])`) are skipped.
4. **A lowercase key on the client** — `prisma.user` (`clientKey`).
5. **The same six methods on every model** — `findMany`, `findFirst`, `count`, `create`, `updateMany`, `deleteMany` (called by the adapter, not by Express).
6. **Search folding** — PostgreSQL gets `mode: "insensitive"` inside the Prisma adapter, from the schema `provider`. Express does not pass `databaseProvider` for this.
7. **Relation kinds** — belongs-to vs has-many, plus which field is the foreign key (`authorId`).
8. **Writes stay simple** — v1 writes normal fields plus a belongs-to foreign key. No nested `connect` / `create` trees in the admin.

---

## Putting Prisma together

At boot: schema file → DMMF → `AdminModelMeta` → registry → Express routes.

At click: UI → `/admin/api` → auth → permission → scope → validate → Prisma adapter → `prisma.user.findMany(...)`.

Core never imports Prisma. Express never builds Prisma `where` / `select`. Only `@paneljs/prisma` speaks Prisma.

---

## Check

Why can the UI draw a User form **before** it has loaded any users from the database?

Gift 2 (DMMF → `AdminModelMeta` → `/admin/api/schema`) describes the shape. Gift 3 (rows) is a later click.

---

## Resources

- [How it works](../../apps/docs/guide/how-it-works.md) — boot vs request in the product docs
- [Prisma schema vs client](https://www.prisma.io/docs/orm/prisma-schema/overview) — search “DMMF” in Prisma docs for the compiler object
- [`packages/prisma/src/introspector.ts`](../prisma/src/introspector.ts) — DMMF → `AdminModelMeta`
- [`packages/prisma/src/resource.ts`](../prisma/src/resource.ts) — PanelJS query → Prisma Client
