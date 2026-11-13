# Roadmap: from today's PanelJS to a full Django-style admin

**Focus:** `@paneljs/prisma`. New features land in core + Prisma first. TypeORM and MikroORM get them later, once the shape has proven itself. Nothing here blocks a Prisma release on another ORM.

**Related:** `ARCHITECTURE.md` (how the packages fit together), `MULTI_ORM.md` (adapter differences), `CORE_CONTRACT.md`, `packages/paneljs/src/query.ts`.

Status key: **Have** = shipped. **Partial** = exists with limits. **Missing** = not started.

---

## 1. What a full Django-style admin has

Django's admin works because `ModelAdmin` sits directly on the ORM. Everything below comes "for free" in Django because `get_queryset()` returns a real queryset. In PanelJS each row needs the query contract (`query.ts`) to grow first, then the Prisma adapter to translate it.

### Registration and site

| Feature | Django | PanelJS | Notes |
| --- | --- | --- | --- |
| Register a model with zero config | `admin.site.register(Post)` | **Have** | `admin.register("Post")`, defaults filled in `registry.ts` |
| Site title, base URL | `site_header`, URLconf | **Have** | `siteName`, `basePath` |
| Group models by app, order the index | app grouping | **Missing** | Dashboard is one flat list |
| Custom admin pages / URLs | `get_urls()` | **Missing** | |
| Several admin sites | `AdminSite()` | **Partial** | Possible with two `createAdmin` + two `basePath`s, not documented |
| Template / UI overrides | template overrides | **Missing** | UI is a prebuilt React bundle; theme only |
| Recent actions / history page | `LogEntry`, "History" button | **Partial** | `audit.write()` hook exists; no viewer in the UI |
| i18n | built in | **Missing** | |

### List page (changelist)

| Feature | Django | PanelJS | Notes |
| --- | --- | --- | --- |
| Choose columns | `list_display` | **Have** | `listDisplay`, scalars only |
| Computed / callable columns | methods in `list_display` | **Missing** | |
| Column from a related model | `author__name` | **Partial** | Only the display field of a belongs-to / has-one |
| Clickable column links | `list_display_links` | **Partial** | Fixed behaviour |
| Edit cells inline in the list | `list_editable` | **Missing** | |
| Filters | `list_filter` | **Partial** | `equals`, `in`, date `gte`/`lte`. Enums, booleans, dates, FK scalars only |
| Filter on a related field | `list_filter = ["author__country"]` | **Missing** | Needs field paths |
| Custom filters | `SimpleListFilter` | **Missing** | |
| Date drill-down | `date_hierarchy` | **Missing** | |
| Search | `search_fields` | **Partial** | One substring match over string columns. No `^` (startswith), `=` (exact), or related `author__email` |
| Sort by several columns | `ordering = ["-a", "b"]` | **Missing** | One sort field |
| Sort by related or computed column | `admin_order_field` | **Missing** | |
| Pagination | `list_per_page` | **Partial** | Offset only, page ≤ 10,000. No cursor / keyset |
| Bulk actions | `actions` | **Have** | Custom actions + delete selected, role-gated |
| Action with a form / intermediate page | intermediate templates | **Missing** | Only delete has a confirm page |
| Export (CSV etc.) | common add-on | **Missing** | |
| `OR` / `NOT` filtering | `Q` objects in `get_queryset` | **Missing** | Contract is AND-only |
| Aggregates / annotations in list | `annotate()` | **Missing** | |

### Add / change form

| Feature | Django | PanelJS | Notes |
| --- | --- | --- | --- |
| Auto form from model | `ModelForm` | **Have** | Scalars + belongs-to FK |
| Hide / read-only / role-gated fields | `exclude`, `readonly_fields` | **Have** | `fields: { x: { exclude, readOnly, writeRoles } }` |
| Field order and sections | `fields`, `fieldsets` | **Missing** | |
| Custom widgets | `formfield_overrides`, `radio_fields` | **Missing** | Widget picked from type in `fieldResolver.ts` |
| Belongs-to picker with search | `autocomplete_fields`, `raw_id_fields` | **Have** | `RelationSelect.tsx` |
| Many-to-many editor | `filter_horizontal` | **Missing** | Prisma labels m2m as `hasMany`; writes rejected |
| Inline child rows | `TabularInline`, `StackedInline` | **Missing** | |
| Nested create / connect | inlines + formsets | **Missing** | |
| Custom validation | `clean()` | **Partial** | `beforeCreate` / `beforeUpdate` hooks can throw |
| Slug from title | `prepopulated_fields` | **Missing** | |
| File / image upload | `FileField`, `ImageField` | **Missing** | `bytes` type exists, no widget, no storage |
| Rich text / JSON editor | add-ons | **Missing** | JSON is a raw text box |
| Save as new / save and continue | `save_as`, buttons | **Missing** | |
| Lifecycle hooks | `save_model`, `delete_model` | **Have** | `before*` / `after*` in `ModelConfig` |
| Atomic save (row + relations + hooks) | `transaction.atomic` | **Missing** | Each call is separate; no transaction |

### Delete

| Feature | Django | PanelJS | Notes |
| --- | --- | --- | --- |
| Confirm page listing related objects | yes | **Have** | `deleteRelations.ts`, one level deep |
| Respect `PROTECT` / `RESTRICT` | yes | **Have** | `assertNoRestrictedRelations` |
| Full nested tree of cascades | yes | **Partial** | Direct children only |

### Models and data types

| Feature | Django | PanelJS | Notes |
| --- | --- | --- | --- |
| Single primary key | yes | **Have** | |
| Composite primary key | Django 5.2 `CompositePrimaryKey` | **Missing** | Skipped at introspection |
| Models with no id | no (Django requires a pk) | **Missing** | Skipped |
| Enums, booleans, dates, numbers, strings | yes | **Have** | |
| JSON | yes | **Partial** | Editable as text; not filterable |
| Bytes / files | yes | **Missing** | |
| Decimal / BigInt precision | yes | **Partial** | Prisma `Decimal` and `BigInt` map to `number` in `introspector.ts`; large or exact values can lose precision |
| Unmapped tables / views | `inspectdb`, unmanaged models | **Missing** | Only what's in `schema.prisma` |

### Auth and permissions

| Feature | Django | PanelJS | Notes |
| --- | --- | --- | --- |
| Staff login, sessions | yes | **Have** | Built-in mode, scrypt, hashed session tokens |
| Bring your own auth | custom backends | **Have** | External mode `getCurrentUser` |
| Create superuser | `createsuperuser` | **Have** | `npx paneljs createsuperuser` |
| Per-model permissions | `has_*_permission` | **Have** | Role allowlists in `permissions` |
| Per-row permissions | `has_change_permission(request, obj)` | **Partial** | `scope()` filters rows; no per-object check |
| Groups and permission records | `Group`, `Permission` | **Missing** | Roles are strings |
| Manage staff users in the UI | `User` admin | **Missing** | Staff tables are blocked from registration on purpose |
| Password change / reset | yes | **Missing** | |
| Revoke all sessions on password change | yes | **Missing** | |
| 2FA | add-on | **Missing** | |

### Errors and safety

| Feature | Django | PanelJS | Notes |
| --- | --- | --- | --- |
| Unique violation as a form error | yes | **Have** | Prisma `P2002` |
| FK violation as a form error | yes | **Partial** | `P2003`/`P2014` mapped, but the message always says "cannot delete" |
| Not-null / not-found mapping | yes | **Missing** | Prisma `P2011`, `P2025` |
| Error tied to a field | yes | **Missing** | Errors are one message for the form |
| CSRF / clickjacking | yes | **Have** | Same-origin check on mutations, `X-Frame-Options: DENY` |
| Login rate limit | add-on | **Have** | `loginRateLimit.ts` |

---

## 2. Prisma-first plan

The rule for every step: change `query.ts` (core types) first, then the Prisma adapter, then validation + Express, then the UI. Never ship a core type Prisma cannot translate.

### Step 1. Label many-to-many correctly (small)

`packages/prisma/src/introspector.ts` `determineRelationKind` returns `hasMany` for every list relation. Detect many-to-many: a list relation whose opposite field (same `relationName` on the other model) is also a list. Unlocks step 5.

### Step 2. Quick error and search fixes (small)

- In `packages/prisma/src/resource.ts` `rethrowWriteError`, pick the FK message by operation (create/update vs delete).
- Map `P2011` (null) and `P2025` (not found).
- Return the field name with the error when Prisma gives it (`meta.target`) so the UI can mark the input.
- Add a test for `%` and `_` in search text, and record the result here.

### Step 3. Filter tree and field paths (medium)

- `query.ts`: replace flat `FieldFilters` with a tree: `{ and } | { or } | { not } | { path, op, value }`. Operators: `equals`, `ne`, `in`, `notIn`, `gt`, `gte`, `lt`, `lte`, `contains`, `startsWith`, `isNull`.
- `path` is a list (`["author", "name"]`). Core checks each hop against `AdminModelMeta` relations and visibility, so nothing outside the registered schema is reachable.
- Prisma: build nested `where` (`{ author: { name: { contains } } }`), `OR`, `NOT`, and `some` / `every` / `none` for list relations.
- `listQuery.ts`: parse `author__name__contains=ada` style params into the tree.
- Config: allow `listFilter: ["author__country"]` and `searchFields: ["author__email", "^title"]`.

### Step 4. Multi-sort and related sort (small)

- `sort` becomes a list. Allow a relation path for belongs-to (`author__name`).
- Always add the id as a final tiebreaker (needed for step 8).

### Step 5. Many-to-many and nested writes (medium to large)

- `CreateQuery` / `UpdateManyQuery` get a `relations` part next to `data`: `{ tags: { set: [ids] } }`, `{ author: { connect: id } }`.
- `validation.ts`: accept that typed shape instead of rejecting relation fields.
- Prisma: `create` can nest it directly. `updateMany` cannot write relations, so a single-record update with relations becomes `update` inside `$transaction`.
- UI: multi-select for m2m (reuse `RelationSelect.tsx` with multiple values).
- Later: has-many inlines on the parent form, explicit junction tables with extra columns.

### Step 6. Transactions (medium)

- Add an optional `transaction(fn)` to `DataAdapter`; Prisma maps it to `$transaction`.
- `AdminService.create` / `update` / `delete` run the write, the relation writes, and the audit write in one transaction. `after*` hooks stay post-commit.

### Step 7. Form layout and widgets (medium, UI-heavy)

- `ModelConfig`: `fieldsets`, field order, `widget` per field (`textarea`, `richtext`, `json`, `radio`, `slug`).
- `prepopulated` for slugs.
- Save-and-continue, save-as-new buttons.

### Step 8. Keyset pagination (small to medium)

- Cursor `{ after: { sortValues, id } }` in `FindManyQuery`; Prisma `cursor` + `skip: 1` or a `where` on the sort tuple.
- Remove the 10,000-page cap for cursor mode.

### Step 9. Computed columns and aggregates (medium)

- `listDisplay` accepts `{ name, label, value: (row) => … }` for computed columns (computed in core after fetch).
- New `ModelResource.aggregate()` → Prisma `groupBy` / `_count` / `_sum` for counts in lists and dashboard numbers.

### Step 10. Actions with forms, export (medium)

- `AdminAction.form` describes input fields; UI shows an intermediate page; handler receives the values.
- Built-in CSV export action that streams through `findMany` in pages.

### Step 11. History viewer (small to medium)

- A read side for audit: `audit.list({ modelName, recordId })`. Prisma can ship a ready `AdminAuditLog`-backed implementation.
- "History" tab on the record page.

### Step 12. Files (medium)

- `widget: "file"` on a string (path/URL) field, plus a pluggable `storage` in `AdminConfig` (local disk, S3). Do not store blobs in rows by default.

### Step 13. Staff management and auth extras (medium)

- Password change for the logged-in staff user; revoke other sessions on change.
- Optional staff-user screen inside the panel, separate from model registration.

### Step 14. Composite primary keys (large)

- `idField: string` → `idFields: string[]`, composite id encoded as one URL-safe string.
- Prisma: `where: { a_b: { a, b } }`. Touches routes, selection, delete preview, actions, UI links. Do it once everything above is stable.

### Step 15. Port to TypeORM and MikroORM

Only features that have been stable on Prisma for a release.

---

## 3. Order at a glance

| Order | Step | Size |
| --- | --- | --- |
| 1 | m2m label | S |
| 2 | Errors + search test | S |
| 3 | Filter tree + field paths | M |
| 4 | Multi-sort | S |
| 5 | m2m / nested writes | M–L |
| 6 | Transactions | M |
| 7 | Form layout + widgets | M |
| 8 | Keyset pagination | S–M |
| 9 | Computed columns + aggregates | M |
| 10 | Action forms + export | M |
| 11 | History viewer | S–M |
| 12 | Files | M |
| 13 | Staff management | M |
| 14 | Composite keys | L |
| 15 | Port to other ORMs | — |

Update the status columns in section 1 whenever a step lands.
