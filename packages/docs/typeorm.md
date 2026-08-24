# How TypeORM makes PanelJS work

Same two questions as [Prisma](./prisma.md). Different gifts. Express still talks only to core.

`@paneljs/typeorm` is a separate package. Do not add `if (typeorm)` in Express. Do not reopen the query language unless TypeORM proves a hole.

---

## What’s happening here

PanelJS still needs two answers from any ORM:

1. **What exists?** models, fields, ids, relations
2. **How do I read and write rows?** list, get, create, update, delete

Prisma answered those with a schema file, DMMF, and `prisma.user`. TypeORM answers them with **entity classes** (or `EntitySchema`), **metadata after connect**, and **repositories**.

---

## Words

- **Entity** — a TypeORM class (or schema) that is one table, like `User`.
- **Decorator** — a label on a class (`@Entity()`, `@Column()`, `@ManyToOne()`). TypeORM reads those labels. `EntitySchema` is the same idea without decorators.
- **DataSource** — the live connection plus the list of entities. After `initialize()`, TypeORM is ready.
- **EntityMetadata** — TypeORM’s description of one entity (columns, ids, relations). This is TypeORM’s DMMF.
- **Repository** — the worker for one entity: `dataSource.getRepository(User)`. This is TypeORM’s `prisma.user`.

---

## Block 1 — TypeORM’s three gifts

### Gift 1: entities (replaces `schema.prisma`)

```ts
@Entity()
class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;
}
```

There is usually **no** one schema file. The “schema” is the entities you register on the `DataSource`.

### Gift 2: `EntityMetadata` (replaces DMMF)

After `dataSource.initialize()`, TypeORM gives you `dataSource.entityMetadatas`.

Each item can tell PanelJS:

- class / table name (`User`)
- columns (`id`, `email`, `name`)
- types, required, unique, generated
- which column is the id
- relations (`Post.author` → `User`)
- enums, if you defined them

It still does **not** load rows. It only describes shape.

### Gift 3: repositories (replaces `prisma.user`)

```ts
const users = dataSource.getRepository(User);
await users.find({ where: { email: "a@b.com" } });
await users.save({ email: "a@b.com", name: "Ada" });
```

Different method names. Different `where` shape. No Prisma `contains` + `mode: "insensitive"`. You use `Like` or `ILike`.

Gift 2 fills `introspect()`. Gift 3 fills `resource()`. Auth store (if you want `/admin/login`) is a small extra repository pair, not a fourth gift.

---

## Block 2 — Boot time (mount)

Same PanelJS steps as Prisma. Only gift 2 changes.

```ts
await dataSource.initialize();

const admin = createAdmin({
  adapter: typeormAdapter({ dataSource }),
  auth: { getCurrentUser }, // or built-in, if auth entities are on the DataSource
});

admin.register("User");
await mount(app, admin);
```

What happens:

1. `register("User")` still only saves the name.
2. `mount` → `initialize` → `adapter.introspect()`.
3. TypeORM introspect: loop `dataSource.entityMetadatas` → same `AdminModelMeta` Prisma already builds.
4. Registry checks `"User"` exists, fills list columns, search, sort.
5. Express mounts `/admin` the same as today.

No `getDMMF()`. No `schema.prisma` on disk at boot. The host must pass an **already initialized** `DataSource`. If entities are not registered yet, the sidebar will be empty or mount will fail — same idea as a missing Prisma model.

`clientKey` for Prisma was `prisma.user`. TypeORM does not use that string the same way. The adapter looks up the repository from the entity name. Express never sees that.

Skip composite primary keys and entities with no id, same v1 limit as Prisma. Skip junction tables.

---

## Block 3 — Request time (a click)

The UI and Express do **not** change.

```
GET /admin/api/users?page=1&search=ada
```

Pipeline is still:

```
who are you? → allowed? → which rows? → payload safe? → adapter.resource() → maybe audit
```

The TypeORM-specific moment is only **resource**.

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

The TypeORM adapter turns that into TypeORM’s world:

- equality → `where: { tenantId: "northwind", published: true }`
- search → `ILike("%ada%")` on Postgres, `Like` on others
- `skip` / `take` / `order` → TypeORM `skip`, `take`, `order`
- `select` → columns to return; belongs-to display loads the relation and keeps the display field
- create / update / delete → `save` / `update` / `delete`

Then it returns **plain records**. Express and the UI already know that JSON.

Case-insensitive search is the adapter’s job, like Prisma reading `provider = "postgresql"`. TypeORM uses `dataSource.options.type === "postgres"`. Express must not know that — putting `ILike` in Express would break “frameworks are ORM-agnostic.”

---

## Block 4 — Auth and permissions

Permissions and scope **do not change**. They never needed Prisma.

- **Permissions** = may this role list/edit this model? Core.
- **Scope** = `{ tenantId: "…" }` extra equality. Core. The TypeORM adapter applies it as `where` fields. Nested Prisma `AND` / `OR` scope is not supported here.

**Auth, two modes:**

1. **External `getCurrentUser`** — already ORM-agnostic. TypeORM + your app login works without auth tables.
2. **Built-in `/admin/login`** — add `builtInAuthEntities()` to the DataSource. `typeormAdapter` supplies `createAuthStore`. Those tables are named `ExpressAdminUser` / `ExpressAdminSession` (same product names as Prisma). Do not `register` them in the admin.

`userId` on a session is a **foreign key**. The value changes per session; the **column type** must match `ExpressAdminUser.id` (both `uuid` in the shipped entities). That is a database rule, not Express.

Custom actions still get `client`. For TypeORM that is the `DataSource`. Host code may call repositories. Express does not. Use `typeormActionWhere("id", where)` when you need TypeORM criteria from `{ scope, ids }`.

---

## Block 5 — How each part fits

| PanelJS slot         | Prisma                                           | TypeORM                                                 |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| `introspect()`       | `schema.prisma` → DMMF → `AdminModelMeta`        | `entityMetadatas` → **same** `AdminModelMeta`           |
| `resource()`         | PanelJS query → Prisma `findMany` / `create` / … | PanelJS query → repository `find` / `update` / `delete` |
| Search folding       | `mode: "insensitive"` if Postgres                | `ILike` if Postgres                                     |
| `createAuthStore()`  | `prismaAuthStore`                                | `typeormAuthStore`                                      |
| `client` for actions | Prisma Client                                    | `DataSource`                                            |
| Express / UI         | Unchanged                                        | Unchanged                                               |

Reuse the display / searchable / filterable guesses (`name`, `title`, `email`, …). Do not copy `getDMMF`.

Relation kinds from TypeORM:

- `many-to-one` → `belongsTo`
- `one-to-many` → `hasMany`
- `one-to-one` with join column here → `belongsTo`; without → `hasOne`
- `many-to-many` → `manyToMany` (v1 still does not write those)

Writes stay **scalars + belongs-to foreign key** (`authorId`), same v1 limit.

**What not to do**

- Do not import TypeORM from `packages/paneljs` or `packages/express`
- Do not teach Express TypeORM queries
- Do not block Prisma fixes on this package

---

## Putting it together

Boot: entities already on `DataSource` → metadata → `AdminModelMeta` → same Express routes.

Click: UI → `/admin/api` → auth → permission → scope → validate → **TypeORM repository**, not Prisma.

The UI never sees TypeORM. Express never sees TypeORM. Only `@paneljs/typeorm` does.

---

## Check

If Express already sends `{ search: { text: "ada", fields: ["email"] } }`, why must the TypeORM adapter know it is Postgres, and why must Express **not** know?

`ILike` vs `Like` is TypeORM/database knowledge. Putting it in Express would mean the HTTP package knows the ORM.

---

## Resources

- [TypeORM DataSource](https://typeorm.io/docs/getting-started/data-source)
- [TypeORM entities](https://typeorm.io/docs/entity)
- [TypeORM relations](https://typeorm.io/docs/relations)
- [TypeORM find options](https://typeorm.io/docs/working-with-entity-manager/find-options)
- [`CORE_CONTRACT.md`](../../CORE_CONTRACT.md) — the language TypeORM speaks
- [`packages/typeorm/src/introspector.ts`](../typeorm/src/introspector.ts)
- [`packages/typeorm/src/resource.ts`](../typeorm/src/resource.ts)
- [`packages/prisma/src/resource.ts`](../prisma/src/resource.ts) — first translator, as a pattern, not code to copy blindly
