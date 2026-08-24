# How MikroORM makes PanelJS work

Same two questions as [Prisma](./prisma.md) and [TypeORM](./typeorm.md). Different gifts. Express still talks only to core.

`@paneljs/mikroorm` is a separate package. Do not add `if (mikroorm)` in Express. Do not reopen the query language unless MikroORM proves a hole.

---

## What’s happening here

PanelJS still needs two answers from any ORM:

1. **What exists?** models, fields, ids, relations
2. **How do I read and write rows?** list, get, create, update, delete

Prisma answered those with a schema file, DMMF, and `prisma.user`. TypeORM answered with entity classes, metadata after connect, and repositories. MikroORM answers them with **entity classes** (or `EntitySchema`), **metadata after `init()`**, and an **EntityManager**.

---

## Words

- **Entity** — a MikroORM class (or schema) that is one table, like `User`.
- **Decorator** — a label on a class (`@Entity()`, `@Property()`, `@ManyToOne()`). MikroORM reads those labels. `EntitySchema` is the same idea without decorators.
- **ORM instance** — the live connection plus the list of entities. After `MikroORM.init()`, MikroORM is ready. This is TypeORM’s `DataSource`.
- **EntityMetadata** — MikroORM’s description of one entity (columns, ids, relations). This is MikroORM’s DMMF.
- **EntityManager (`em`)** — the worker: `em.find(User, …)`. This is MikroORM’s `prisma.user` / TypeORM repository.
- **Fork** — a fresh manager for one request, so requests do not share leftover row-memory.
- **Flush** — MikroORM’s “now actually write.” Prisma/TypeORM usually write on `create`/`save`. MikroORM can delay with `persist` then `flush`. **The adapter does not use that delay.** Admin CRUD uses `insert` / `nativeUpdate` / `nativeDelete`.

---

## Block 1 — MikroORM’s three gifts

### Gift 1: entities (replaces `schema.prisma`)

```ts
@Entity()
class User {
  @PrimaryKey()
  id!: string;

  @Property({ unique: true })
  email!: string;

  @Property()
  name!: string;
}
```

There is usually **no** one schema file. The “schema” is the entities you register on `MikroORM.init()`.

### Gift 2: metadata after init (replaces DMMF)

After `MikroORM.init()`, MikroORM gives you `orm.getMetadata().getAll()`.

Each item can tell PanelJS:

- class / table name (`User`)
- columns (`id`, `email`, `name`)
- types, required, unique, generated
- which column is the id
- relations (`Post.author` → `User`)
- enums, if you defined them

It still does **not** load rows. It only describes shape.

### Gift 3: EntityManager (replaces `prisma.user`)

```ts
const em = orm.em.fork();
await em.find(User, { email: "a@b.com" });
await em.insert(User, { email: "a@b.com", name: "Ada" });
```

Different method names. Different `where` shape. No Prisma `contains` + `mode: "insensitive"`. You use `$ilike` or `$like`.

Gift 2 fills `introspect()`. Gift 3 fills `resource()`. Auth store (if you want `/admin/login`) is a small extra entity pair, not a fourth gift.

The extra habit: MikroORM has a **to-do list** for writes (`persist` then `flush`). TypeORM `save` is “do it now.” For PanelJS the adapter uses the “do it now” methods so the admin behaves like Prisma/TypeORM: call it, database changes.

---

## Block 2 — Boot time (mount)

Same PanelJS steps as Prisma. Only gift 2 changes.

```ts
const orm = await MikroORM.init({
  /* entities, db */
});

const admin = createAdmin({
  adapter: mikroormAdapter({ orm }),
  auth: { getCurrentUser }, // or built-in, if auth entities are on the ORM
});

admin.register("User");
await mount(app, admin);
```

What happens:

1. `register("User")` still only saves the name.
2. `mount` → `initialize` → `adapter.introspect()`.
3. MikroORM introspect: loop `orm.getMetadata().getAll()` → same `AdminModelMeta` Prisma already builds.
4. Registry checks `"User"` exists, fills list columns, search, sort.
5. Express mounts `/admin` the same as today.

No `getDMMF()`. No `schema.prisma` on disk at boot. The host must pass an **already initialized** ORM. If entities are not registered yet, the sidebar will be empty or mount will fail — same idea as a missing Prisma model.

`clientKey` for Prisma was `prisma.user`. MikroORM looks up the entity by name. Express never sees that.

Skip composite primary keys and entities with no id, same v1 limit as Prisma. Skip pivot tables.

---

## Block 3 — Request time (a click)

The UI and Express do **not** change.

```txt
GET /admin/api/users?page=1&search=ada
```

Pipeline is still:

```txt
who are you? → allowed? → which rows? → payload safe? → adapter.resource() → maybe audit
```

The MikroORM-specific moment is only **resource**.

Express sends a PanelJS query:

```ts
{
  scope: { tenantId: "northwind" },
  filters: { published: { equals: true } },
  search: { text: "ada", fields: ["email", "name"] },
  sort: { field: "createdAt", direction: "desc" },
  skip: 0,
  take: 50,
  select: { fields: ["id", "email", "name"], relations: [{ field: "author", displayField: "name" }] }
}
```

The MikroORM adapter turns that into MikroORM’s world:

- equality → FilterQuery fields (`tenant` for a belongs-to FK named `tenantId`)
- search → `$ilike("%ada%")` on Postgres, `$like` on others
- `skip` / `take` / `order` → MikroORM `offset`, `limit`, `orderBy`
- `select` → columns to return; belongs-to display populates the relation and keeps the display field
- create / update / delete → `insert` / `nativeUpdate` / `nativeDelete`

Then it returns **plain records**. Express and the UI already know that JSON.

Each click uses a **fork** (fresh manager). Express never sees that.

Case-insensitive search is the adapter’s job, like Prisma reading `provider = "postgresql"`. MikroORM uses the platform name. Express must not know that — putting `$ilike` in Express would break “frameworks are ORM-agnostic.”

---

## Block 4 — Auth and permissions

Permissions and scope **do not change**. They never needed Prisma.

- **Permissions** = may this role list/edit this model? Core.
- **Scope** = `{ tenantId: "…" }` extra equality. Core. The MikroORM adapter applies it as `where` fields. Nested Prisma `AND` / `OR` scope is not supported here.

**Auth, two modes:**

1. **External `getCurrentUser`** — already ORM-agnostic. MikroORM + your app login works without auth tables.
2. **Built-in `/admin/login`** — add `builtInAuthEntities()` to the ORM entities. `mikroormAdapter` supplies `createAuthStore`. Those tables are named `ExpressAdminUser` / `ExpressAdminSession` (same product names as Prisma). Do not `register` them in the admin.

`userId` on a session is a **foreign key**. The value changes per session; the **column type** must match `ExpressAdminUser.id` (both `uuid` in the shipped entities). That is a database rule, not Express.

Custom actions still get `client`. For MikroORM that is the ORM. Host code may call `em.fork()`. Express does not. Use `mikroormActionWhere(orm, "Post", where)` when you need MikroORM criteria from `{ scope, ids }`.

---

## Block 5 — How each part fits

| PanelJS slot         | Prisma                            | TypeORM                                 | MikroORM                     |
| -------------------- | --------------------------------- | --------------------------------------- | ---------------------------- |
| `introspect()`       | `schema.prisma` → DMMF            | `entityMetadatas`                       | metadata after `init()`      |
| `resource()`         | Prisma `findMany` / `create` / …  | repository `find` / `update` / `delete` | `em.find` + immediate writes |
| Search folding       | `mode: "insensitive"` if Postgres | `ILike` if Postgres                     | `$ilike` if Postgres         |
| `createAuthStore()`  | `prismaAuthStore`                 | `typeormAuthStore`                      | `mikroormAuthStore`          |
| `client` for actions | Prisma Client                     | `DataSource`                            | ORM / `em`                   |
| Express / UI         | Unchanged                         | Unchanged                               | Unchanged                    |

Reuse the display / searchable / filterable guesses (`name`, `title`, `email`, …). Do not copy `getDMMF`.

Relation kinds from MikroORM:

- `m:1` → `belongsTo`
- `1:m` → `hasMany`
- `1:1` with the FK here → `belongsTo`; without → `hasOne`
- `m:n` → `manyToMany` (v1 still does not write those)

Writes stay **scalars + belongs-to foreign key** (`authorId`), same v1 limit. The adapter maps `authorId` onto MikroORM’s `author` relation property.

**What not to do**-

- Do not import MikroORM from `packages/paneljs` or `packages/express`
- Do not teach Express MikroORM queries
- Do not use `persist` + `flush` for admin CRUD (identity map and missing flushes)
- Do not block Prisma or TypeORM fixes on this package

---

## Putting it together

Boot: entities already on the ORM → metadata → `AdminModelMeta` → same Express routes.

Click: UI → `/admin/api` → auth → permission → scope → validate → **MikroORM EntityManager**, not Prisma, not TypeORM.

The UI never sees MikroORM. Express never sees MikroORM. Only `@paneljs/mikroorm` does.

---

## Check

If Express already sends `{ search: { text: "ada", fields: ["email"] } }`, why must the MikroORM adapter know it is Postgres, and why must Express **not** know?

`$ilike` vs `$like` is MikroORM/database knowledge. Putting it in Express would mean the HTTP package knows the ORM.

---

## Resources

- [MikroORM quick start](https://mikro-orm.io/docs/quick-start)
- [MikroORM EntitySchema](https://mikro-orm.io/docs/entity-schema)
- [MikroORM relationships](https://mikro-orm.io/docs/relationships)
- [MikroORM EntityManager](https://mikro-orm.io/docs/entity-manager)
- [`CORE_CONTRACT.md`](../../CORE_CONTRACT.md) — the language MikroORM speaks
- [`packages/mikroorm/src/introspector.ts`](../mikroorm/src/introspector.ts)
- [`packages/mikroorm/src/resource.ts`](../mikroorm/src/resource.ts)
- [`packages/typeorm/src/resource.ts`](../typeorm/src/resource.ts) — sibling translator, as a pattern
