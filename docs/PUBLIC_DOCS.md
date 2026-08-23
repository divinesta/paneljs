# Public documentation pattern

How to write and extend `apps/docs` (the VitePress site at `/docs/`). This is a contract. Follow it when you add an ORM, an HTTP framework, or a guide page.

Internal engineering notes stay in this `docs/` folder (`CORE_CONTRACT.md`, `MULTI_ORM.md`, this file). They are not the public site.

**Related:** `apps/docs/.vitepress/config.ts`, `apps/docs/guide/installation/`

---

## Two axes, one product

PanelJS has two independent install choices. They are not flavors of the same page.

| Axis | What the reader already has | Package | Today | Next |
| --- | --- | --- | --- | --- |
| **Framework** | HTTP server | `@paneljs/express` | Express | Fastify, Nest.js |
| **ORM** | Data layer | `@paneljs/prisma`, `@paneljs/typeorm` | Prisma, TypeORM | Drizzle |

Core (`paneljs`) does not change between cells. `register("User")`, lists, forms, permissions, `scope`, hooks, audit, the UI, and the HTTP API are shared.

Do not collapse the axes. The first chooser is **framework**. The second is **ORM**. That matches how people think: “I have an Express app. I use TypeORM.”

Do not write a full getting-started for every pair (`Express+Prisma`, `Express+TypeORM`, `Fastify+Prisma`, …). That is `frameworks × ORMs` copies of the same guide. It will rot.

---

## What to fork vs what to share

Fork **only** what is actually different:

| Shared (write once under `guide/`) | Per framework | Per ORM |
| --- | --- | --- |
| What this is | `mount(...)` signature | Adapter constructor |
| Register, lists, forms, relations | Where the router lives | How models are discovered |
| Permissions, scope, sensitive fields | Request / cookie shape | Built-in auth tables |
| Hooks, actions *contract*, audit *contract* | | Version pin, action `client` type |
| HTTP API, errors | | |

Per-framework pages live in `apps/docs/frameworks/` and `apps/docs/guide/installation/<framework>/`.

Per-ORM pages live in `apps/docs/adapters/` and under each framework’s install folder (`…/express/prisma.md`).

---

## Install is a chooser, then a short page

The public front door is **Installation**, not a Prisma-only getting started.

```text
/guide/installation                  # pick framework (cards)
/guide/installation/express          # pick ORM (cards)
/guide/installation/express/prisma   # packages + first mount snippet
/guide/installation/express/typeorm
/guide/installation/fastify          # coming soon (one paragraph)
/guide/installation/nestjs           # coming soon (one paragraph)
```

Each **live** install page is ~40–80 lines:

1. Requirements and peers
2. `npm install paneljs @paneljs/<framework> @paneljs/<orm>`
3. The 15-line `createAdmin` + `register` + `mount` snippet for **that** pair
4. Open `/admin`
5. Links out to Auth, Wire it into your app, and the adapter page

A TypeORM install page must not mention Prisma version pins. A Prisma install page must not mention `DataSource.initialize()`. That is the point of splitting.

When you add Fastify:

1. Ungrey the Fastify card on `/guide/installation`
2. Add `/guide/installation/fastify/index.md` (ORM chooser — reuse the same cards)
3. Add `/guide/installation/fastify/prisma.md` and `typeorm.md`
4. Replace `frameworks/fastify.md` with the real `mount` docs
5. Leave the shared guide alone

When you add Drizzle: ungrey the ORM card, add `adapters/drizzle.md`, add one install page **per live framework**. Do not copy register / permissions / scope.

---

## Coming soon

Show greyed cards for work that is planned. Do not hide them — Fastify users should see themselves on the chooser.

Rules:

- The card is visible and **not a link** (`comingSoon: true` on `ChooserGrid`)
- A one-paragraph page may exist (`/guide/installation/fastify`, `/frameworks/fastify`) so the sidebar can list “Fastify (coming soon)”
- **Never** publish a fake snippet for a package that does not exist
- Sidebar labels include `(coming soon)` until the package is published

The chooser UI is `apps/docs/.vitepress/theme/ChooserGrid.vue`. Add an `icon` key there when a new stack ships (`express`, `fastify`, `nest`, `prisma`, `typeorm`, `drizzle`).

---

## Default stack in shared pages

Prose needs one default so it can flow. That default is **Express + Prisma**.

- If the snippet is identical across stacks (`listDisplay`, `permissions`, `scope`) — one snippet, no tabs.
- If it actually differs (install, adapter, auth tables, action `client`) — VitePress `code-group` with `[Prisma]` / `[TypeORM]` (and later `[Drizzle]`).
- Say so at the top of a long page when the default is in use (“Snippets below use Express + Prisma”).

Do not build a global “stack switcher.” Code-groups are enough until there are many live combinations.

Do not teach Prisma habits as if they were the product:

| Forbidden in shared pages | Use instead |
| --- | --- |
| `createAdmin({ prisma })` | `createAdmin({ adapter })` |
| `await admin.mount(app)` | `await mount(app, admin)` from `@paneljs/express` |
| Action handler `{ prisma }` | `{ client, where }` |
| “`scope` returns a Prisma `where`” | Equality filter, usually `{ tenantId }` |
| “Not a multi-ORM tool” | Two adapters, same `register` |
| “Mount calls `getDMMF()`” as the whole story | `adapter.introspect()`; Prisma happens to use DMMF |

Prisma-specific facts belong on `/adapters/prisma` and `/limits/prisma`. TypeORM-specific facts belong on `/adapters/typeorm` and `/limits/typeorm`.

---

## Auth is one page

Built-in login is one product story (`ExpressAdminUser`, `/admin/login`, roles, throttling, external mode). Creating the tables is not:

| | Prisma | TypeORM |
| --- | --- | --- |
| Tables | `npx paneljs auth:schema` → paste into `schema.prisma` | `builtInAuthEntities()` on the `DataSource` |
| First user | `createsuperuser --config` | `hashAdminPassword` + repository insert |
| Do not register | `ExpressAdminUser` | same |

Keep **one** `/guide/auth` page. Put table-creation and first-user steps in `code-group`s. Do not write “Authentication (Prisma)” and “Authentication (TypeORM).”

---

## Page inventory

```text
Start          what-this-is, installation (chooser), in-your-app, how-it-works
Shape          register, lists, forms, relations
Trust          auth, permissions, scope, sensitive-fields
Extend         hooks, actions, audit
Example        /example/basic (Express+Prisma), /example/typeorm
Adapters       /adapters/prisma, /adapters/typeorm
Frameworks     /frameworks/express, fastify (soon), nestjs (soon)
Reference      create-admin, register, admin-user, http-api, errors
Limits         not-included, prisma, typeorm
```

`/guide/getting-started` and `/guide/quickstart` are aliases that point at Installation. Keep them so old links do not 404.

Directory index pages (`guide/installation/index.md`, `guide/installation/express/index.md`) must be linked with a trailing slash (`/guide/installation/`, `/guide/installation/express/`). VitePress treats the slash-less path as a dead link.

`apps/docs/MULTI_ORM_NOTES.md` is internal history. It stays in `srcExclude`. Do not add planning docs to the public sidebar.

---

## Voice

Match the pages that already exist:

- Short sentences. No marketing fluff on guide pages.
- Concrete names: Ada, Grace, Linus, Northwind, Contoso.
- Fail at `mount`, not on the first click.
- Security is permissions **and** scope. Say that whenever rows are involved.
- Code samples are the shape the reader pastes into **their** app, not this repo’s internals.

Homepage hero can say “JavaScript ORMs.” Guide pages should still be specific: Express, Prisma, TypeORM — never “your favorite stack” with no names.

---

## CLI

The binary lives on the `paneljs` package (`npx paneljs@latest init`). It must emit the **same packages** as the matching install page:

```text
Express + Prisma   →  paneljs @paneljs/express @paneljs/prisma
Express + TypeORM  →  paneljs @paneljs/express @paneljs/typeorm
```

Rules the CLI must keep:

- Run inside an existing app (`package.json` required). It is not a project generator.
- Add packages only. Do not rewrite `index.ts`, `schema.prisma`, entities, or env files.
- Coming-soon options (Fastify, Nest, Drizzle) are visible and disabled.
- `--framework` / `--orm` / `--yes` / `--dry-run` for non-interactive use.
- Abort on an incompatible peer (Prisma not 7.5.x, TypeORM below 0.3.20, Express below 4.18).
- `auth:schema` and `createsuperuser` stay Prisma-only setup commands.

Document `init` on `/guide/installation/` and the two live Express install pages.

---

## Checklist for a new ORM

1. Live install page under every **shipping** framework (`guide/installation/express/<orm>.md`)
2. Short `/adapters/<orm>.md` (discovery, CRUD, built-in auth, action helper)
3. `/limits/<orm>.md` only if there is a version pin or a boot constraint (initialized `DataSource`, schema file, …)
4. Example page under `/example/` if there is a dogfood app
5. Ungrey the ORM card
6. Add a `[Label]` tab on Auth, Actions, and any other snippet that actually differs
7. Do **not** duplicate register / lists / permissions / scope

## Checklist for a new HTTP framework

1. Ungrey the framework card
2. ORM chooser at `guide/installation/<framework>/index.md`
3. One install page per **shipping** ORM
4. `/frameworks/<framework>.md` with the real `mount` (or Nest module) signature
5. Do **not** duplicate the rest of the guide

---

## What not to do

- Do not put Prisma version pins on a TypeORM page
- Do not teach `admin.mount` or `createAdmin({ prisma })`
- Do not hide coming-soon stacks
- Do not invent Fastify/Nest/Drizzle snippets before the package exists
- Do not fork the shared guide per stack
- Do not put engineering roadmaps (`MULTI_ORM.md`, `CORE_CONTRACT.md`) in the VitePress sidebar
