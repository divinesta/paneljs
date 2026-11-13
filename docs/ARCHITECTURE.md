# How PanelJS fits together

A guided tour of the four packages that matter for the Prisma path: **core**, **prisma**, **express**, and the **UI**. Read it top to bottom once, then use it as a map.

**Related:** `ROADMAP.md` (what's missing), `MULTI_ORM.md` (adapter differences), `CORE_CONTRACT.md`.

---

## The one-paragraph version

The host app builds a Prisma client and calls `createAdmin({ adapter: prismaAdapter({ prisma }), auth })`, then `admin.register("Post")`, then `mount(app, admin)`. On mount, the **Prisma adapter** reads `schema.prisma` and turns every model into `AdminModelMeta`. **Core** keeps only the registered models, fills in defaults, and builds an `AdminService`. **Express** puts HTTP routes in front of that service and serves the **UI**. The UI is a React bundle that asks `/api/schema` what models exist and draws every page from that answer. No package above the adapter ever imports Prisma.

```text
browser (React UI)
   │  fetch /admin/api/...
   ▼
@paneljs/express     HTTP: auth middleware, routes, static files
   │  calls admin.service.list(...), .create(...) ...
   ▼
paneljs (core)       registry, AdminService, validation, permissions, scope
   │  calls adapter.resource(meta).findMany(query) ...
   ▼
@paneljs/prisma      translates PanelJS queries into Prisma calls
   │
   ▼
PrismaClient → database
```

Each arrow only passes **plain data types defined in core**: `AdminModelMeta`, the query types in `query.ts`, `AdminUser`. That is what keeps the layers swappable.

---

## 1. Core: `packages/paneljs`

Core is the brain. It has no HTTP and no ORM inside it.

### The types everyone shares

| File | What it holds |
| --- | --- |
| [`src/types.ts`](../packages/paneljs/src/types.ts) | `AdminFieldMeta` / `AdminModelMeta` (the model description), `ModelConfig` (what you pass to `register`), `AdminUser`, `AdminConfig`, `AuthConfig`, `SchemaResponse` |
| [`src/adapter.ts`](../packages/paneljs/src/adapter.ts) | `DataAdapter` (`introspect`, `resource`, optional `createAuthStore`, `dispose`) and `ModelResource` (the six CRUD calls) |
| [`src/query.ts`](../packages/paneljs/src/query.ts) | The query language: `FindManyQuery`, `CreateQuery`, `FieldFilters`, `FieldSelect`, etc. This is the file that has to grow for most roadmap work |

Think of `AdminModelMeta` as Django's `Model._meta`, and `ModelConfig` as a `ModelAdmin` class.

### Startup: `createAdmin` → `register` → `initialize`

- [`src/index.ts`](../packages/paneljs/src/index.ts) `createAdmin()` creates a registry. `register()` is synchronous and only stores the name + config. `initialize()` calls `adapter.introspect()`, hands the result to the registry, then builds the `AdminService`.
- [`src/registry.ts`](../packages/paneljs/src/registry.ts)
  - `resolveConfig()` (line ~57) is the "zero config" engine: default `listDisplay` (display field first, up to 6 scalars), `searchFields` (introspected searchables), `defaultSort` (`createdAt desc`, else id), `perPage` 50, permissions (list/view open, writes need roles).
  - `initialize()` (line ~278) fails loudly on typos: unknown model, unknown field in `fields`, `listDisplay`, `searchFields`, etc.
  - Each registered model becomes a `FullRegisteredModel` with three parts: `meta` (from the ORM), `resolved` (defaults filled in, JSON-safe), `raw` (your config, including functions like `scope` and hooks).

### Request time: `AdminService`

[`src/adminService.ts`](../packages/paneljs/src/adminService.ts) is the one place where admin operations happen. Express only calls this.

| Method | Line | What it does |
| --- | --- | --- |
| `list` | ~81 | permission → pagination check → `scope` → `findMany` + `count` in parallel |
| `get` | ~116 | permission → `scope` → `findFirst` |
| `create` | ~132 | permission → validate body → force scope values into data → `beforeCreate` (re-validated) → `create` → `afterCreate` → audit |
| `update` | ~179 | permission → check row exists in scope → validate → `beforeUpdate` → `updateMany` by id + scope → reload → `afterUpdate` → audit |
| `delete` | ~228 | permission → load in scope → `beforeDelete` → refuse if `Restrict` children exist → `deleteMany` → `afterDelete` → audit |
| `deletePreview`, `deleteSelected`, `runAction` | ~264+ | bulk actions and the delete confirm page |

Notice the pattern: **every** call resolves `scope` and passes it down. The adapter ANDs it into the query. That is how tenant isolation works.

Note: these steps are not wrapped in a transaction. If `afterCreate` fails, the row is already saved (`runPostCommit` logs an error and carries on).

### The helpers AdminService leans on

| File | Job |
| --- | --- |
| [`src/permissions.ts`](../packages/paneljs/src/permissions.ts) | `hasModelPermission(user, permissions, op)`: role allowlists; super admin passes |
| [`src/scope.ts`](../packages/paneljs/src/scope.ts) | `resolveScope` runs your `scope(adminUser)` and rejects `undefined` values. `applyCreateScope` writes scope values into create data so nobody can create rows in another tenant. `buildScopedRecordWhere` is a Prisma-shaped leftover (uses `AND`) |
| [`src/validation.ts`](../packages/paneljs/src/validation.ts) | `isFieldVisible` (hides `exclude`d fields and names matching password/token/secret/api key unless `expose: true`), `validateWritePayload` (~215): only writable, known, correctly typed fields; relation fields rejected |
| [`src/listQuery.ts`](../packages/paneljs/src/listQuery.ts) | Turns `?page=2&sort=title&dir=asc&search=x&published=true&createdAt_gte=…` into a `ParsedListQuery`. Enforces page ≤ 10,000, allowed sort and filter fields, search ≤ 200 chars |
| [`src/recordSelection.ts`](../packages/paneljs/src/recordSelection.ts) | Builds `FieldSelect`: which columns to load, plus the display field of each belongs-to |
| [`src/deleteRelations.ts`](../packages/paneljs/src/deleteRelations.ts) | Finds child models pointing at this one, previews what `Cascade` / `SetNull` / `Restrict` will do, and blocks `Restrict` |
| [`src/schema.ts`](../packages/paneljs/src/schema.ts) | `buildSchemaResponse`: what the UI receives. Only models the user may list, only visible fields, permissions turned into booleans |
| [`src/errors.ts`](../packages/paneljs/src/errors.ts) | `AdminApiError` and subclasses, each with an HTTP status and code |
| [`src/audit.ts`](../packages/paneljs/src/audit.ts) | Calls your `audit.write(event)` if configured |
| [`src/ids.ts`](../packages/paneljs/src/ids.ts) | Parses a URL id into string or number based on the id field type |

### Auth (framework-neutral half)

| File | Job |
| --- | --- |
| [`src/authStore.ts`](../packages/paneljs/src/authStore.ts) | `AdminAuthStore` interface: find user, create/find/delete session, create user |
| [`src/builtInAuth.ts`](../packages/paneljs/src/builtInAuth.ts) | `loginWithPassword` (~153), `authenticateSession` (~129), `resolveAuthStore` (~118), cookie helpers |
| [`src/passwords.ts`](../packages/paneljs/src/passwords.ts) | scrypt hash + timing-safe verify |

### CLI

[`src/cli.ts`](../packages/paneljs/src/cli.ts) and [`src/cli/`](../packages/paneljs/src/cli): `npx paneljs init` (scaffolds config, `init.ts`, `stack.ts`) and `createsuperuser` (`auth.ts`). The CLI loads the host's `paneljs.config.ts`, e.g. [`apps/example/prisma-test/paneljs.config.ts`](../apps/example/prisma-test/paneljs.config.ts), to get the adapter and auth store.

---

## 2. Prisma adapter: `packages/prisma`

Three files, three jobs. Everything Prisma-specific lives here.

### [`src/index.ts`](../packages/prisma/src/index.ts): the wiring

`prismaAdapter({ prisma, schemaPath? })` returns a `DataAdapter`:

- `introspect` → `introspector.ts`
- `resource(meta)` → finds `prisma[meta.clientKey]` (e.g. `prisma.post`) and wraps it with `prismaResource`
- `createAuthStore` → `authStore.ts`
- `dispose` → `prisma.$disconnect()`

### [`src/introspector.ts`](../packages/prisma/src/introspector.ts): schema → `AdminModelMeta`

`introspect()` (~481) reads `schema.prisma`, compiles it with `getDMMF` from `@prisma/internals`, and builds one `AdminModelMeta` per model. Results are cached per schema path.

| Function | Line | Decides |
| --- | --- | --- |
| `mapPrismaTypeToAdminType` | ~41 | `String`→string, `Int/Float/Decimal/BigInt`→number, `DateTime`→datetime, `Json`, `Bytes`, enum, relation |
| `determineRelationKind` | ~84 | belongsTo / hasOne / hasMany / manyToMany. A list is `manyToMany` when its opposite field (same `relationName` on the other model) is also a list |
| `isReadOnly` | ~115 | ids with defaults, `@updatedAt`, generated fields |
| `isSearchable` / `isFilterable` | ~137 / ~155 | non-id, non-FK strings / enums, booleans, dates, FK scalars |
| `detectDisplayField` | ~176 | `name`, `title`, `label`, `username`, `slug`, `email`, then fallbacks |
| `introspectModel` | ~312 | puts a model together; skips composite or missing ids |
| `patchRelationDisplayFields` | ~413 | second pass: copies the target model's display field onto each relation |

`getSchemaProvider` / `usesInsensitiveSearch` read the datasource provider so Postgres gets `mode: "insensitive"` search.

### [`src/resource.ts`](../packages/prisma/src/resource.ts): PanelJS query → Prisma call

`prismaResource()` (~154) implements the six `ModelResource` calls. The translators:

- `toPrismaSelect`: `{ fields, relations }` → `{ title: true, author: { select: { email: true } } }`
- `toPrismaFilters`: `{ equals }` → value, `{ in }` → `{ in }`, `{ gte, lte }` → range
- `toPrismaSearch`: `{ OR: [{ title: { contains, mode } }, …] }`
- `toPrismaWhere` (~126): ANDs scope + filters + search + id(s) with `combineAnd`, so keys never overwrite each other
- `rethrowWriteError` (~33): `P2002` → "unique value exists", `P2003`/`P2014` → "cannot delete…"

When the roadmap says "teach Prisma to translate X", it means adding to this file.

### [`src/authStore.ts`](../packages/prisma/src/authStore.ts): staff login storage

`prismaAuthStore(prisma, auth)` implements `AdminAuthStore` against `ExpressAdminUser` and `ExpressAdminSession` (names configurable via `userModel` / `sessionModel`).

---

## 3. Express transport: `packages/express`

Express is a thin shell. It translates HTTP into `AdminService` calls and errors into JSON.

### [`src/mount.ts`](../packages/express/src/mount.ts): the whole router in order

`mount(app, admin)` (~42) runs `admin.initialize()`, then builds one router at `basePath`:

1. Security headers (`X-Frame-Options: DENY`), `no-store` on `/api`, JSON body parsing.
2. Built-in auth only: refuses `secureCookies: false` in production, refuses registering the staff tables, mounts `/api/auth` (login, logout, config).
3. Auth middleware on `/api`: built-in session check or external `getCurrentUser`. Sets `req.adminUser`.
4. Same-origin check on POST/PUT/PATCH/DELETE (CSRF guard).
5. `GET /api/schema` (~113).
6. Action router, then CRUD router, then the API error handler.
7. Built-in only: redirect unauthenticated page loads to `/login` (~124).
8. Static UI files, then every other path returns `index.html` with `window.__PANELJS_BASE_PATH__` injected (~135).

### Routes

| File | Routes |
| --- | --- |
| [`src/crudRouter.ts`](../packages/express/src/crudRouter.ts) | `GET /:model` (list, via `parseListQuery`), `GET /:model/:id`, `POST /:model`, `PUT /:model/:id`, `DELETE /:model/:id`. `:model` is the plural name, e.g. `posts` |
| [`src/actionRouter.ts`](../packages/express/src/actionRouter.ts) | `GET /:model/actions/delete-preview?ids=…`, `POST /:model/actions/:action` |
| [`src/schemaEndpoint.ts`](../packages/express/src/schemaEndpoint.ts) | `GET /schema` → `buildSchemaResponse` |
| [`src/builtIn.ts`](../packages/express/src/builtIn.ts) | `/auth/config`, `/auth/login`, `/auth/logout`; session middleware; page redirect |

### Support

| File | Job |
| --- | --- |
| [`src/routeSupport.ts`](../packages/express/src/routeSupport.ts) | `route()` async wrapper, `getRegisteredModel`, `getAdminUser`, `getRecordId` |
| [`src/httpErrors.ts`](../packages/express/src/httpErrors.ts) | `AdminApiError` → `{ error, code }` with the right status; unknown errors → 500 |
| [`src/middleware.ts`](../packages/express/src/middleware.ts) | External-mode auth middleware |
| [`src/loginRateLimit.ts`](../packages/express/src/loginRateLimit.ts) | In-memory login limiter (per IP + identifier) |
| [`src/express.d.ts`](../packages/express/src/express.d.ts) | Adds `req.adminUser` to Express types |

A second framework (Fastify, Hono) would be a sibling of this package that calls the same `AdminService` methods.

---

## 4. UI: `packages/paneljs/ui`

A Vite + React app, built into `ui/dist` and shipped inside the `paneljs` package. `getAdminUiDist()` in core ([`src/uiPath.ts`](../packages/paneljs/src/uiPath.ts)) tells Express where it is. One build works at any `basePath` because the server injects the path.

### Boot

- [`ui/src/main.tsx`](../packages/paneljs/ui/src/main.tsx) renders `App`.
- [`ui/src/config.ts`](../packages/paneljs/ui/src/config.ts) reads `window.__PANELJS_BASE_PATH__`.
- [`ui/src/App.tsx`](../packages/paneljs/ui/src/App.tsx): on `/login` shows `LoginPage`; otherwise loads the schema with `useSchema` and, if ready, renders the shell + routes (~246):

| Route | Page |
| --- | --- |
| `/` | [`pages/Dashboard.tsx`](../packages/paneljs/ui/src/pages/Dashboard.tsx) |
| `/:model` | [`pages/ListView.tsx`](../packages/paneljs/ui/src/pages/ListView.tsx) |
| `/:model/new`, `/:model/:id/edit`, `/:model/:id` | [`pages/CreateView.tsx`](../packages/paneljs/ui/src/pages/CreateView.tsx) (one form for create, edit, view) |
| `/:model/delete` | [`pages/DeleteConfirmationPage.tsx`](../packages/paneljs/ui/src/pages/DeleteConfirmationPage.tsx) |

### Data

- [`ui/src/api.ts`](../packages/paneljs/ui/src/api.ts): `fetchSchema`, `fetchRecord`, `readApiError`. 401/403 on schema → "unauthorized" state.
- [`ui/src/types.ts`](../packages/paneljs/ui/src/types.ts): the UI's copy of `SchemaResponse` types.
- Hooks: [`useSchema`](../packages/paneljs/ui/src/hooks/useSchema.ts), [`useModelData`](../packages/paneljs/ui/src/hooks/useModelData.ts) (builds the list query string), [`useFilters`](../packages/paneljs/ui/src/hooks/useFilters.ts), [`useFormModel`](../packages/paneljs/ui/src/hooks/useFormModel.ts), [`useBulkActions`](../packages/paneljs/ui/src/hooks/useBulkActions.ts).

### Components

| File | Job |
| --- | --- |
| [`components/DataTable.tsx`](../packages/paneljs/ui/src/components/DataTable.tsx) | List table, sorting headers, row selection |
| [`components/ModelFilters.tsx`](../packages/paneljs/ui/src/components/ModelFilters.tsx) | Filter and date-range controls (re-exported by `FilterSidebar.tsx`) |
| [`components/ActionBar.tsx`](../packages/paneljs/ui/src/components/ActionBar.tsx) | Bulk action picker |
| [`components/AutoForm.tsx`](../packages/paneljs/ui/src/components/AutoForm.tsx) + [`FieldInput.tsx`](../packages/paneljs/ui/src/components/FieldInput.tsx) | One input per field |
| [`utils/fieldResolver.ts`](../packages/paneljs/ui/src/utils/fieldResolver.ts) | `writableFields` (no relations, read-only, or lists) and `resolveWidget` (type → text/number/boolean/enum/datetime). New widgets start here |
| [`components/RelationSelect.tsx`](../packages/paneljs/ui/src/components/RelationSelect.tsx) | Searchable picker for a belongs-to FK; queries the related model's list endpoint |
| [`components/ThemeProvider.tsx`](../packages/paneljs/ui/src/components/ThemeProvider.tsx) | Light/dark theme |
| [`components/Feedback.tsx`](../packages/paneljs/ui/src/components/Feedback.tsx) | Notices, not-found |

Styles live in [`ui/src/styles/`](../packages/paneljs/ui/src/styles), split by area (`tokens.css`, `table.css`, `forms.css`, …).

The UI never knows about Prisma. It only knows the schema JSON and the REST routes. A new field type or relation editor therefore needs: core type → adapter support → schema JSON → a widget here.

---

## 5. One request, end to end

Ada (tenant admin) opens **Posts**, page 2, searching "welcome".

1. **UI:** `ListView` → `useModelData` fetches `GET /admin/api/posts?page=2&sort=createdAt&dir=desc&search=welcome`.
2. **Express:** session middleware (`builtIn.ts`) turns the cookie into `req.adminUser`. Same-origin check is skipped for GET. `crudRouter` finds the model by plural name `posts`.
3. **Core:** `parseListQuery` validates the params → `{ page: 2, sort, dir, filters: {}, search: { text: "welcome", fields: ["title","content"] } }`.
4. **Core:** `AdminService.list` checks `list` permission, runs `scope(ada)` → `{ tenantId: "northwind" }`, builds the select (`buildListRecordSelect`), calls `findMany` + `count`.
5. **Prisma adapter:** `toPrismaWhere` → `{ AND: [{ tenantId: "northwind" }, { OR: [{ title: { contains: "welcome", mode: "insensitive" } }, …] }] }`, plus `select`, `orderBy`, `skip: 50`, `take: 50`. Calls `prisma.post.findMany(...)`.
6. **Back up:** rows → `{ records, total, page, perPage, totalPages }` → JSON → `DataTable`.

A create follows the same path, with `validateWritePayload` → `applyCreateScope` → hooks → `prisma.post.create` → audit.

---

## 6. Where to look when you…

| Want to… | Start in |
| --- | --- |
| Add a `ModelConfig` option | `types.ts` → `registry.ts` (`resolveConfig`, validation) → `schema.ts` if the UI needs it |
| Add a filter operator or query feature | `query.ts` → `listQuery.ts` → `prisma/src/resource.ts` → UI hooks |
| Change how Prisma models are read | `prisma/src/introspector.ts` |
| Change a write rule | `validation.ts`, `adminService.ts` |
| Add an HTTP route | `express/src/*Router.ts`, wired in `mount.ts` |
| Add a widget | `ui/src/utils/fieldResolver.ts`, `components/FieldInput.tsx` |
| Change login | `paneljs/src/builtInAuth.ts`, `express/src/builtIn.ts`, `prisma/src/authStore.ts` |

Tests: core in [`packages/paneljs/test`](../packages/paneljs/test) (one file per module). Runnable example: [`apps/example/prisma-test/index.ts`](../apps/example/prisma-test/index.ts).
