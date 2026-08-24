# What this is

PanelJS is an operations panel for a Node app that already has a data model.

You register the models you want to operate on. At mount, the library asks your **data adapter** what exists, builds metadata, and serves:

- a React admin UI at `/admin`
- a guarded JSON API at `/admin/api/*`

You do not describe your tables twice. Prisma’s `schema.prisma`, TypeORM entities, or MikroORM metadata are the source of truth. `admin.register("User")` with no extra config still produces a list, search, filters, and a create/edit form.

## Two choices, then the same product

| You pick       | Package                                                       | Job                                           |
| -------------- | ------------------------------------------------------------- | --------------------------------------------- |
| HTTP framework | `@paneljs/express` today                                      | `mount(app, admin)`                           |
| ORM            | `@paneljs/prisma`, `@paneljs/typeorm`, or `@paneljs/mikroorm` | Introspect models, run CRUD                   |
| Core           | `paneljs`                                                     | Registry, schema JSON, UI, permissions, scope |

Express is how the admin hangs off the server today. Prisma, TypeORM, and MikroORM are how rows are discovered and written. After `mount`, `register("User")` is the same.

[Installation](/guide/installation/) is the chooser for those two. The rest of this guide is shared.

## The whole public API

```ts
const admin = createAdmin({
  adapter: prismaAdapter({ prisma }), // or a TypeORM / MikroORM adapter
  auth: { getCurrentUser },
});

admin
  .register("User")
  .register("Post", { listDisplay: ["title", "author", "published"] });

await mount(app, admin);
```

Three calls. Everything else is optional configuration on those calls.

## What you bring

| You own                                                | The library owns                              |
| ------------------------------------------------------ | --------------------------------------------- |
| HTTP app (Express today)                               | Admin routes under `basePath`                 |
| ORM client or initialized ORM instance                 | Introspection through the adapter             |
| Built-in admin credentials, or external authentication | Creating an `AdminUser` request context       |
| Tenancy rules, via `scope()`                           | Applying that scope on every record operation |
| Optional audit destination                             | Emitting safe, append-only events             |

Built-in mode provides an admin-only login screen, `ExpressAdminUser` table, and
session store. External mode still lets you map an existing identity onto an
`AdminUser`. See [Authentication](/guide/auth).

## What this is not

- Not a replacement for your public API
- Not a CMS with nested document editing
- Not AdminJS with an adapter bolted on — PanelJS metadata is the contract
- Not a new project generator — it mounts on the app you already have

Current writes are **scalar** plus a single `belongsTo` foreign key. Nested creates, many-to-many editors, inlines, and uploads are [not included](/limits/not-included).

## The people in these docs

The [Prisma](/example/basic), [TypeORM](/example/typeorm), and [MikroORM](/example/mikroorm) examples run the same tenant and operator story. The Trust and Extend guides reuse it so the rules stay concrete.

| Person         | Role          | Tenant    | What they see                      |
| -------------- | ------------- | --------- | ---------------------------------- |
| Ada Lovelace   | `ADMIN`       | Northwind | Northwind users and posts          |
| Grace Hopper   | `ADMIN`       | Contoso   | Contoso users and posts            |
| Linus Torvalds | `SUPER_ADMIN` | Northwind | Both, because `scope` returns `{}` |

Same role does not mean same rows. That distinction — **permissions vs scope** — is the point of this library.

## Next

1. [Installation](/guide/installation/) — pick framework, then ORM, then mount
2. [Wire it into your app](/guide/in-your-app) — `listDisplay`, `searchFields`, `listFilter`, `scope`
