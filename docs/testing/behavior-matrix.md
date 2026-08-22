# PanelJS behavior matrix

This document is the release contract for PanelJS testing. It defines what the
product promises, which layer owns each promise, and which class of test must
prove it.

The matrix describes **observable behavior**, not implementation details. An ORM
adapter may use completely different queries internally, but it must produce the
same PanelJS result for every shared behavior marked `Required`.

## How to read the matrix

### Owners

| Owner      | Responsibility                                                                  |
| ---------- | ------------------------------------------------------------------------------- |
| Core       | ORM- and HTTP-independent PanelJS rules and admin operations                    |
| Adapter    | Translation between the PanelJS contract and one ORM                            |
| Auth store | Persistence of built-in administrator users and sessions                        |
| Transport  | Express now; Fastify, NestJS, or Next.js later                                  |
| UI         | Browser-visible rendering and interaction                                       |
| Database   | Referential actions and constraints that must be verified using a real database |

`Owner` means the **target architectural owner**. Some core-owned operations are
currently implemented in `@paneljs/express`; see [Ownership migrations](#ownership-migrations).

### Test classes

| Code | Test class              | Runs with                                                     |
| ---- | ----------------------- | ------------------------------------------------------------- |
| `CU` | Core unit               | No HTTP server or database                                    |
| `AC` | Adapter contract        | One real ORM and database                                     |
| `AS` | Auth-store contract     | One real ORM and database                                     |
| `AB` | Admin behavior contract | Core admin operations and one real adapter                    |
| `HT` | HTTP transport          | Express with a fake adapter unless a real adapter is required |
| `UI` | Browser end-to-end      | UI, transport, adapter, and real database                     |

### Requirement levels

| Level              | Meaning                                                 |
| ------------------ | ------------------------------------------------------- |
| `Required`         | Must pass before the affected package can be published  |
| `Adapter-specific` | Required only for an adapter that exposes this behavior |
| `Deferred`         | Deliberately outside the first complete test release    |

Phase 3 implements the `CU` coverage for registry, permissions, scopes, IDs,
queries, validation, record selection, schema generation, authentication, and
auditing. Adapter, admin-behavior, transport, and browser contracts remain to be
implemented in later phases.

## Test data baseline

Every adapter contract must provide equivalent models and deterministic seed
data. ORM-native type names may differ, but their normalized PanelJS semantics
must agree.

| Fixture                | Purpose                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `Tenant`               | Simple equality scope and parent deletion                                            |
| `User`                 | CRUD, unique strings, enum, boolean, generated id, timestamps, tenant relation       |
| `Post`                 | Search, nullable content, boolean filter, date range, pagination, belongs-to display |
| `CascadeChild`         | Required FK with `onDelete: Cascade`                                                 |
| `NullableChild`        | Nullable FK with `onDelete: SetNull`                                                 |
| `ProtectedChild`       | Required FK with `onDelete: Restrict`                                                |
| Built-in admin user    | Email/username login, roles, active state, password hash                             |
| Built-in admin session | Valid, expired, and missing sessions                                                 |

The seed must include two tenants, records in both tenants, at least three pages
of sortable records, searchable mixed-case values, and parents covering all
three referential actions.

## 1. Registry and initialization

| ID        | Behavior                          | Expected result                                                                      | Owner          | Test | Level    |
| --------- | --------------------------------- | ------------------------------------------------------------------------------------ | -------------- | ---- | -------- |
| `REG-001` | Initialize an admin once          | Adapter introspection runs once and registered models resolve                        | Core           | `CU` | Required |
| `REG-002` | Initialize the same admin again   | Initialization is idempotent and introspection is not repeated                       | Core           | `CU` | Required |
| `REG-003` | Register a known model            | Model configuration is retained and resolved after initialization                    | Core           | `CU` | Required |
| `REG-004` | Register an unknown model         | Initialization fails with a clear model-name error                                   | Core           | `CU` | Required |
| `REG-005` | Register the same model twice     | A warning is emitted and the second configuration replaces the first                 | Core           | `CU` | Required |
| `REG-006` | Omit optional model configuration | Documented defaults for list, filter, search, sort, page size, and permissions apply | Core           | `CU` | Required |
| `REG-007` | Configure an invalid plural name  | Registration or initialization rejects it                                            | Core           | `CU` | Required |
| `REG-008` | Configure an invalid action name  | Registration or initialization rejects it                                            | Core           | `CU` | Required |
| `REG-009` | Omit permissions in production    | Initialization rejects the model configuration                                       | Core           | `CU` | Required |
| `REG-010` | Register built-in auth models     | Mounting built-in auth rejects exposure of user or session models                    | Core/Transport | `HT` | Required |

## 2. Normalized model introspection

| ID         | Behavior                               | Expected result                                                                                               | Owner   | Test | Level    |
| ---------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------- | ---- | -------- |
| `META-001` | Discover supported models              | `introspect()` returns a map keyed by model name                                                              | Adapter | `AC` | Required |
| `META-002` | Normalize model identity               | Name, plural name, client key, id field, and display field are present                                        | Adapter | `AC` | Required |
| `META-003` | Normalize scalar fields                | String, number, boolean, datetime, JSON, enum, and bytes map to PanelJS field types                           | Adapter | `AC` | Required |
| `META-004` | Normalize primary keys                 | The supported single primary key is marked as the id field                                                    | Adapter | `AC` | Required |
| `META-005` | Normalize generated fields             | Generated ids and generated timestamps are read-only                                                          | Adapter | `AC` | Required |
| `META-006` | Normalize required and nullable fields | `isRequired` matches database nullability                                                                     | Adapter | `AC` | Required |
| `META-007` | Normalize uniqueness                   | Unique fields have `isUnique: true`                                                                           | Adapter | `AC` | Required |
| `META-008` | Normalize defaults                     | Available default information has a stable PanelJS representation                                             | Adapter | `AC` | Required |
| `META-009` | Normalize enums                        | Enum name and allowed values are available                                                                    | Adapter | `AC` | Required |
| `META-010` | Normalize timestamps                   | Created and updated timestamp field names are identified                                                      | Adapter | `AC` | Required |
| `META-011` | Normalize belongs-to relations         | Related model, FK fields, relation name, display field, and relation kind are present                         | Adapter | `AC` | Required |
| `META-012` | Normalize has-many relations           | Parent-side collection is represented as `hasMany`                                                            | Adapter | `AC` | Required |
| `META-013` | Normalize one-to-one relations         | Supported sides are represented as `belongsTo` or `hasOne` consistently                                       | Adapter | `AC` | Required |
| `META-014` | Normalize many-to-many relations       | Supported explicit relations use `manyToMany`; internal junction models are not exposed                       | Adapter | `AC` | Required |
| `META-015` | Normalize cascade                      | ORM metadata becomes `onDelete: "Cascade"`                                                                    | Adapter | `AC` | Required |
| `META-016` | Normalize set-null                     | ORM metadata becomes `onDelete: "SetNull"`                                                                    | Adapter | `AC` | Required |
| `META-017` | Normalize restrict/protect             | ORM metadata becomes `onDelete: "Restrict"`                                                                   | Adapter | `AC` | Required |
| `META-018` | Default omitted referential action     | Required FK defaults to Restrict and optional FK defaults according to the adapter's documented ORM semantics | Adapter | `AC` | Required |
| `META-019` | Model has no supported id              | Model is skipped or rejected with documented behavior; it is never partially usable                           | Adapter | `AC` | Required |
| `META-020` | Model has a composite id               | Model is skipped or rejected with documented behavior                                                         | Adapter | `AC` | Required |
| `META-021` | ORM-native type differs                | `nativeType` may differ, while the normalized field type and capabilities remain equivalent                   | Adapter | `AC` | Required |

## 3. Adapter resource contract

| ID         | Behavior                         | Expected result                                                                           | Owner   | Test | Level    |
| ---------- | -------------------------------- | ----------------------------------------------------------------------------------------- | ------- | ---- | -------- |
| `DATA-001` | Obtain a model resource          | `resource(meta)` addresses the requested model or throws a clear configuration error      | Adapter | `AC` | Required |
| `DATA-002` | List records                     | `findMany` returns plain records using the requested select                               | Adapter | `AC` | Required |
| `DATA-003` | Retrieve one record              | `findFirst` returns the selected row                                                      | Adapter | `AC` | Required |
| `DATA-004` | Retrieve a missing record        | `findFirst` returns `null`                                                                | Adapter | `AC` | Required |
| `DATA-005` | Count records                    | `count` returns the number matching the same scope, filters, search, and ids              | Adapter | `AC` | Required |
| `DATA-006` | Create a record                  | `create` persists data and returns the requested projection                               | Adapter | `AC` | Required |
| `DATA-007` | Update one record                | `updateMany({ id })` updates only the matching row and returns count 1                    | Adapter | `AC` | Required |
| `DATA-008` | Update multiple selected records | `updateMany({ ids })` updates only selected matching rows                                 | Adapter | `AC` | Required |
| `DATA-009` | Update no matching record        | Result count is 0                                                                         | Adapter | `AC` | Required |
| `DATA-010` | Delete one record                | `deleteMany({ id })` deletes only the matching row and returns count 1                    | Adapter | `AC` | Required |
| `DATA-011` | Delete multiple selected records | `deleteMany({ ids })` deletes only selected matching rows                                 | Adapter | `AC` | Required |
| `DATA-012` | Delete no matching record        | Result count is 0                                                                         | Adapter | `AC` | Required |
| `DATA-013` | Write without id or ids          | Full-table update/delete is rejected rather than executed                                 | Adapter | `AC` | Required |
| `DATA-014` | Select scalar fields             | Returned records contain requested scalars and omit unrequested scalars                   | Adapter | `AC` | Required |
| `DATA-015` | Select relation display          | Relation is returned as an object containing only its display field                       | Adapter | `AC` | Required |
| `DATA-016` | Select a null relation           | Relation value is returned as `null`                                                      | Adapter | `AC` | Required |
| `DATA-017` | Generate an id                   | An omitted generated id is created and returned                                           | Adapter | `AC` | Required |
| `DATA-018` | Preserve supported values        | Booleans, dates, enums, nullable values, and decimal strings survive supported CRUD flows | Adapter | `AC` | Required |
| `DATA-019` | Foreign-key violation            | Adapter throws a safe `RequestValidationError`, not a raw ORM error                       | Adapter | `AC` | Required |
| `DATA-020` | Required-column violation        | Adapter returns a safe validation error where normalization is supported                  | Adapter | `AC` | Required |
| `DATA-021` | Expose raw ORM client            | `adapter.client` is the original opaque ORM handle for custom actions                     | Adapter | `AC` | Required |

## 4. Querying, searching, sorting, and pagination

| ID          | Behavior                         | Expected result                                                                      | Owner        | Test    | Level            |
| ----------- | -------------------------------- | ------------------------------------------------------------------------------------ | ------------ | ------- | ---------------- |
| `QUERY-001` | Default list query               | Page 1, configured sort, and configured page size are used                           | Core         | `CU/AB` | Required         |
| `QUERY-002` | Positive page                    | Skip is `(page - 1) * perPage` and take is `perPage`                                 | Core/Adapter | `AB`    | Required         |
| `QUERY-003` | Invalid page                     | Zero, negative, decimal, non-number, repeated, or page over 10,000 is rejected       | Core         | `CU/HT` | Required         |
| `QUERY-004` | Sort ascending                   | Visible scalar is sorted ascending                                                   | Core/Adapter | `AC/AB` | Required         |
| `QUERY-005` | Sort descending                  | Visible scalar is sorted descending                                                  | Core/Adapter | `AC/AB` | Required         |
| `QUERY-006` | Invalid sort field               | Hidden, relation, or unknown field is rejected                                       | Core         | `CU/HT` | Required         |
| `QUERY-007` | Invalid sort direction           | Any value other than `asc` or `desc` is rejected                                     | Core         | `CU/HT` | Required         |
| `QUERY-008` | String equality filter           | Only exact matching rows are returned                                                | Core/Adapter | `AC/AB` | Required         |
| `QUERY-009` | Number equality filter           | String query input is parsed to a finite number before adapter execution             | Core/Adapter | `CU/AB` | Required         |
| `QUERY-010` | Boolean equality filter          | Only literal `true` and `false` are accepted                                         | Core/Adapter | `CU/AB` | Required         |
| `QUERY-011` | Enum equality filter             | Only declared enum values are accepted                                               | Core/Adapter | `CU/AB` | Required         |
| `QUERY-012` | Date equality filter             | Valid ISO date-time input becomes a Date equality filter                             | Core/Adapter | `CU/AB` | Required         |
| `QUERY-013` | Date lower bound                 | `_gte` returns rows on or after the boundary                                         | Core/Adapter | `AC/AB` | Required         |
| `QUERY-014` | Date upper bound                 | `_lte` returns rows on or before the boundary                                        | Core/Adapter | `AC/AB` | Required         |
| `QUERY-015` | Combined date range              | Both boundaries are applied together                                                 | Core/Adapter | `AC/AB` | Required         |
| `QUERY-016` | Disallowed filter                | Unknown, hidden, relation, or unconfigured filter is rejected                        | Core         | `CU/HT` | Required         |
| `QUERY-017` | Search one field                 | Rows containing the text in the configured string field are returned                 | Adapter      | `AC/AB` | Required         |
| `QUERY-018` | Search several fields            | A match in any configured search field is returned                                   | Adapter      | `AC/AB` | Required         |
| `QUERY-019` | Search case folding              | Search is case-insensitive when the adapter/database documents support for it        | Adapter      | `AC`    | Adapter-specific |
| `QUERY-020` | Empty search                     | Whitespace-only search is ignored                                                    | Core         | `CU/AB` | Required         |
| `QUERY-021` | Long search                      | Search longer than 200 characters is rejected                                        | Core         | `CU/HT` | Required         |
| `QUERY-022` | Search with no searchable fields | Non-empty search is rejected                                                         | Core         | `CU/HT` | Required         |
| `QUERY-023` | Combine constraints              | Scope, filters, search, and selected ids are combined without one overriding another | Adapter      | `AC/AB` | Required         |
| `QUERY-024` | Pagination totals                | `total`, `page`, `perPage`, and `totalPages` describe the complete filtered result   | Core/Adapter | `AB/HT` | Required         |
| `QUERY-025` | Page beyond result set           | Records are empty while totals remain correct                                        | Core/Adapter | `AB/HT` | Required         |

## 5. Schema, field visibility, and record selection

| ID           | Behavior                          | Expected result                                                                 | Owner | Test       | Level    |
| ------------ | --------------------------------- | ------------------------------------------------------------------------------- | ----- | ---------- | -------- |
| `SCHEMA-001` | Build schema identity             | Response contains current id, email, role, and super-admin flag                 | Core  | `CU/HT`    | Required |
| `SCHEMA-002` | Build schema context              | Response contains site name, base path, and auth mode                           | Core  | `CU/HT`    | Required |
| `SCHEMA-003` | Hide unlistable model             | Models without list permission are absent                                       | Core  | `CU/HT/UI` | Required |
| `SCHEMA-004` | Hide excluded field               | Excluded fields are absent from metadata and resolved configuration             | Core  | `CU/HT/UI` | Required |
| `SCHEMA-005` | Hide sensitive field by default   | Password, token, secret, credential, and private-key-like names are absent      | Core  | `CU/HT`    | Required |
| `SCHEMA-006` | Explicitly expose sensitive field | `{ expose: true }` makes the field visible while normal write rules still apply | Core  | `CU/HT`    | Required |
| `SCHEMA-007` | Mark non-writable field           | Schema reports it as read-only for the current administrator                    | Core  | `CU/HT/UI` | Required |
| `SCHEMA-008` | Resolve operation permissions     | Schema booleans match current user and model configuration                      | Core  | `CU/HT/UI` | Required |
| `SCHEMA-009` | Resolve action visibility         | Only authorized actions are returned; delete-selected follows delete permission | Core  | `CU/HT/UI` | Required |
| `SCHEMA-010` | Build list projection             | Only id and configured visible list-display fields are selected                 | Core  | `CU/AB`    | Required |
| `SCHEMA-011` | Build record projection           | Visible scalar fields plus safe displayed relations are selected                | Core  | `CU/AB`    | Required |
| `SCHEMA-012` | Sensitive relation display field  | Sensitive related display value is not selected                                 | Core  | `CU/AB`    | Required |

## 6. Authentication and sessions

| ID         | Behavior                             | Expected result                                                                 | Owner           | Test    | Level    |
| ---------- | ------------------------------------ | ------------------------------------------------------------------------------- | --------------- | ------- | -------- |
| `AUTH-001` | Hash and verify password             | Correct password succeeds and incorrect password fails                          | Core            | `CU`    | Required |
| `AUTH-002` | Verify malformed stored hash         | Verification fails safely                                                       | Core            | `CU`    | Required |
| `AUTH-003` | External auth returns valid admin    | Request continues with the normalized admin user                                | Transport       | `HT`    | Required |
| `AUTH-004` | External auth returns null           | API returns `401 AUTHENTICATION_REQUIRED`                                       | Transport       | `HT`    | Required |
| `AUTH-005` | External auth returns malformed user | API returns `401 AUTHENTICATION_REQUIRED`                                       | Transport       | `HT`    | Required |
| `AUTH-006` | External auth throws                 | API returns `401` without leaking the thrown error                              | Transport       | `HT`    | Required |
| `AUTH-007` | Resolve explicit auth store          | Configured `auth.store` takes precedence                                        | Core            | `CU`    | Required |
| `AUTH-008` | Resolve adapter auth store           | Adapter factory is used when no explicit store exists                           | Core            | `CU`    | Required |
| `AUTH-009` | Missing auth store                   | Built-in auth fails during setup with a clear error                             | Core            | `CU/HT` | Required |
| `AUTH-010` | Find administrator by email          | Matching built-in user is returned without password transformation              | Auth store      | `AS`    | Required |
| `AUTH-011` | Find administrator by username       | Configured username lookup works                                                | Auth store      | `AS`    | Required |
| `AUTH-012` | Missing administrator                | Store returns `null`                                                            | Auth store      | `AS`    | Required |
| `AUTH-013` | Create session                       | Hashed token, user id, and expiration are persisted                             | Auth store      | `AS`    | Required |
| `AUTH-014` | Find session with user               | Valid session and its administrator are returned                                | Auth store      | `AS`    | Required |
| `AUTH-015` | Expired session lookup               | Expired session cannot authenticate                                             | Core/Auth store | `CU/AS` | Required |
| `AUTH-016` | Delete session                       | Matching session is removed; a missing session is harmless                      | Auth store      | `AS`    | Required |
| `AUTH-017` | Successful login                     | Valid active ADMIN/SUPER_ADMIN creates a session and returns cookie data        | Core            | `CU/AB` | Required |
| `AUTH-018` | Invalid credentials                  | Missing user and wrong password return the same `401 INVALID_CREDENTIALS` shape | Core            | `CU/HT` | Required |
| `AUTH-019` | Inactive administrator               | Login and session authentication fail                                           | Core            | `CU/AB` | Required |
| `AUTH-020` | Unsupported administrator role       | Login and session authentication fail                                           | Core            | `CU/AB` | Required |
| `AUTH-021` | Session token storage                | Raw token is returned only in the cookie; SHA-256 hash is stored                | Core/Auth store | `CU/AS` | Required |
| `AUTH-022` | Session TTL                          | Default is seven days and configured TTL is honored                             | Core            | `CU`    | Required |
| `AUTH-023` | Session cookie                       | Cookie is HttpOnly, SameSite=Lax, base-path scoped, and has matching age/expiry | Core/Transport  | `CU/HT` | Required |
| `AUTH-024` | Secure cookie default                | Secure defaults on in production and off outside production unless configured   | Core            | `CU`    | Required |
| `AUTH-025` | Unsafe production cookie             | Mount refuses `secureCookies: false` in production                              | Transport       | `HT`    | Required |
| `AUTH-026` | Logout                               | Stored session is removed and an expired cookie is returned                     | Core/Transport  | `CU/HT` | Required |
| `AUTH-027` | Malformed cookie encoding            | Request is unauthenticated without throwing                                     | Core            | `CU`    | Required |
| `AUTH-028` | Login input bounds                   | Empty/oversized identifier or password receives generic invalid credentials     | Core/Transport  | `CU/HT` | Required |
| `AUTH-029` | Login throttling                     | Limit is enforced per mounted admin, IP, and identifier with `Retry-After`      | Transport       | `HT`    | Required |

## 7. Permissions, scopes, and relation safety

| ID        | Behavior                                    | Expected result                                                           | Owner        | Test       | Level            |
| --------- | ------------------------------------------- | ------------------------------------------------------------------------- | ------------ | ---------- | ---------------- |
| `SEC-001` | Default read permission                     | Authenticated non-super-admin may list/view when omitted in development   | Core         | `CU/AB`    | Required         |
| `SEC-002` | Default write permission                    | Create/update/delete are denied when omitted                              | Core         | `CU/AB`    | Required         |
| `SEC-003` | Role allowlist                              | Only listed roles may use the operation                                   | Core         | `CU/AB`    | Required         |
| `SEC-004` | Empty allowlist                             | Everyone except a super-admin is denied                                   | Core         | `CU/AB`    | Required         |
| `SEC-005` | Super-admin permission bypass               | Model and action allowlists are bypassed                                  | Core         | `CU/AB`    | Required         |
| `SEC-006` | Super-admin scope behavior                  | Scope is still applied unless the configured scope function returns `{}`  | Core         | `CU/AB`    | Required         |
| `SEC-007` | Action permission intersection              | Model action roles and action-level roles must both allow when both exist | Core         | `CU/AB`    | Required         |
| `SEC-008` | Missing action allowlist                    | Non-super-admin is denied                                                 | Core         | `CU/AB`    | Required         |
| `SEC-009` | Field write roles                           | Unauthorized writable field is rejected and reported read-only in schema  | Core         | `CU/AB`    | Required         |
| `SEC-010` | Protected account fields                    | Role, isActive, and isSuperAdmin default to super-admin-only writes       | Core         | `CU/AB`    | Required         |
| `SEC-011` | Resolve empty scope                         | `{}` adds no row constraint                                               | Core/Adapter | `CU/AC`    | Required         |
| `SEC-012` | Resolve simple equality scope               | Constraint applies to list, count, get, update, delete, and actions       | Core/Adapter | `AC/AB`    | Required         |
| `SEC-013` | Undefined scope value                       | Request is rejected instead of broadening access                          | Core         | `CU/AB`    | Required         |
| `SEC-014` | Scoped create                               | Simple scope equalities are injected into created data                    | Core         | `CU/AB`    | Required         |
| `SEC-015` | Conflicting scoped create                   | Caller-provided conflicting value is rejected                             | Core         | `CU/AB`    | Required         |
| `SEC-016` | Complex scoped create                       | Automatic injection is rejected; host must use a hook                     | Core         | `CU/AB`    | Required         |
| `SEC-017` | Change scoped field                         | Update is rejected                                                        | Core         | `CU/AB`    | Required         |
| `SEC-018` | Change FK controlled by relation scope      | Update is rejected                                                        | Core         | `CU/AB`    | Required         |
| `SEC-019` | Access another tenant by id                 | Response behaves as record not found and reveals no existence             | Core/Adapter | `AB/HT/UI` | Required         |
| `SEC-020` | Mixed scoped bulk ids                       | Entire action is rejected when any requested id is unavailable            | Core/Adapter | `AB/HT`    | Required         |
| `SEC-021` | Select visible related record               | Belongs-to FK is accepted                                                 | Core/Adapter | `AB`       | Required         |
| `SEC-022` | Select out-of-scope related record          | Write is rejected as unavailable                                          | Core/Adapter | `AB`       | Required         |
| `SEC-023` | Select relation without list permission     | Write is denied                                                           | Core         | `AB`       | Required         |
| `SEC-024` | Select relation whose model is unregistered | Write is rejected with a validation error                                 | Core         | `AB`       | Required         |
| `SEC-025` | Nested read scope                           | Nested equality scope works only where the adapter explicitly supports it | Adapter      | `AC`       | Adapter-specific |

The portable adapter contract requires simple equality scopes. Nested predicates
remain adapter-specific until PanelJS defines a normalized nested-scope language
that every supported ORM can implement.

## 8. Create, retrieve, update, and hooks

| ID         | Behavior                               | Expected result                                                               | Owner | Test       | Level    |
| ---------- | -------------------------------------- | ----------------------------------------------------------------------------- | ----- | ---------- | -------- |
| `CRUD-001` | List permitted model                   | Paginated response contains only selected, scoped rows                        | Core  | `AB/HT`    | Required |
| `CRUD-002` | View permitted record                  | Selected, scoped record is returned                                           | Core  | `AB/HT`    | Required |
| `CRUD-003` | View missing record                    | `RECORD_NOT_FOUND` is produced                                                | Core  | `AB/HT`    | Required |
| `CRUD-004` | Create valid record                    | Validated, scoped data is persisted and selected record returned              | Core  | `AB/HT`    | Required |
| `CRUD-005` | Reject non-object create body          | Validation error is produced                                                  | Core  | `CU/AB/HT` | Required |
| `CRUD-006` | Reject unknown create field            | Validation error is produced                                                  | Core  | `CU/AB/HT` | Required |
| `CRUD-007` | Reject missing required field          | Validation error identifies the required field                                | Core  | `CU/AB/HT` | Required |
| `CRUD-008` | Reject wrong scalar type               | Validation error identifies the invalid field                                 | Core  | `CU/AB/HT` | Required |
| `CRUD-009` | Reject nested relation write           | Relation objects are not writable in the first contract                       | Core  | `CU/AB/HT` | Required |
| `CRUD-010` | Update valid record                    | Only validated fields on the scoped row change                                | Core  | `AB/HT`    | Required |
| `CRUD-011` | Update missing record                  | `RECORD_NOT_FOUND` is produced                                                | Core  | `AB/HT`    | Required |
| `CRUD-012` | Concurrently disappeared update target | Zero affected rows becomes `RECORD_NOT_FOUND`                                 | Core  | `AB`       | Required |
| `CRUD-013` | Reload updated record                  | Response contains the persisted selected result                               | Core  | `AB/HT`    | Required |
| `CRUD-014` | Run before-create hook                 | Hook receives validated scoped data; validated output is persisted            | Core  | `CU/AB`    | Required |
| `CRUD-015` | Before-create changes scope            | Scope is re-applied and cannot be overwritten                                 | Core  | `CU/AB`    | Required |
| `CRUD-016` | Run after-create hook                  | Hook receives committed record                                                | Core  | `AB`       | Required |
| `CRUD-017` | Run before-update hook                 | Hook receives id and validated data; output is revalidated                    | Core  | `CU/AB`    | Required |
| `CRUD-018` | Before-update changes scope            | Scoped field/FK protections are checked again                                 | Core  | `CU/AB`    | Required |
| `CRUD-019` | Run after-update hook                  | Hook receives reloaded committed record                                       | Core  | `AB`       | Required |
| `CRUD-020` | Invalid hook output                    | Request fails with a safe validation error before persistence                 | Core  | `CU/AB`    | Required |
| `CRUD-021` | Post-commit hook throws                | Committed write remains successful; failure is logged without leaking details | Core  | `AB`       | Required |

## 9. Single and bulk deletion

| ID        | Behavior                               | Expected result                                                                         | Owner            | Test       | Level    |
| --------- | -------------------------------------- | --------------------------------------------------------------------------------------- | ---------------- | ---------- | -------- |
| `DEL-001` | Delete normal record                   | Scoped record is removed                                                                | Core             | `AB/HT`    | Required |
| `DEL-002` | Delete missing record                  | `RECORD_NOT_FOUND` is produced                                                          | Core             | `AB/HT`    | Required |
| `DEL-003` | Delete out-of-scope record             | Same not-found behavior is produced                                                     | Core             | `AB/HT`    | Required |
| `DEL-004` | Concurrently disappeared delete target | Zero affected rows becomes `RECORD_NOT_FOUND`                                           | Core             | `AB`       | Required |
| `DEL-005` | Cascade relation preview               | Related rows are grouped by parent and marked Cascade                                   | Core/Adapter     | `AB/HT/UI` | Required |
| `DEL-006` | Set-null relation preview              | Related rows are grouped by parent and marked SetNull                                   | Core/Adapter     | `AB/HT/UI` | Required |
| `DEL-007` | Restrict relation preview              | Related rows are grouped by parent and marked Restrict                                  | Core/Adapter     | `AB/HT/UI` | Required |
| `DEL-008` | Hidden child model in preview          | Relation rows are omitted when user lacks child list permission                         | Core             | `AB/HT`    | Required |
| `DEL-009` | Cascade delete                         | Parent and cascade children are removed by the database                                 | Database/Adapter | `AC/AB`    | Required |
| `DEL-010` | Set-null delete                        | Parent is removed; child remains and its FK becomes null                                | Database/Adapter | `AC/AB`    | Required |
| `DEL-011` | Restrict delete                        | Parent remains and safe validation error is produced                                    | Core/Database    | `AC/AB/HT` | Required |
| `DEL-012` | Before-delete hook                     | Hook runs before constraint checks and deletion                                         | Core             | `AB`       | Required |
| `DEL-013` | After-delete hook                      | Hook runs only for a successfully deleted row                                           | Core             | `AB`       | Required |
| `DEL-014` | Bulk delete valid rows                 | Every selected scoped row is deleted and count appears in message                       | Core             | `AB/HT/UI` | Required |
| `DEL-015` | Bulk delete one row                    | Singular message is used                                                                | Core             | `AB/HT`    | Required |
| `DEL-016` | Bulk delete duplicate ids              | Request is rejected                                                                     | Transport/Core   | `HT`       | Required |
| `DEL-017` | Bulk delete empty ids                  | Request is rejected                                                                     | Transport/Core   | `HT`       | Required |
| `DEL-018` | Bulk delete over 100 ids               | Request is rejected                                                                     | Transport        | `HT`       | Required |
| `DEL-019` | Bulk delete malformed id               | Request is rejected using model id rules                                                | Core/Transport   | `CU/HT`    | Required |
| `DEL-020` | Bulk delete missing/scoped-out id      | Entire operation is rejected before deletion                                            | Core             | `AB/HT`    | Required |
| `DEL-021` | Bulk delete with restricted relation   | Entire operation is rejected before deleting any selected parent                        | Core/Database    | `AB/HT`    | Required |
| `DEL-022` | Row changes during bulk deletion       | Successfully deleted ids are reported; changed/unavailable rows produce partial message | Core             | `AB/HT`    | Required |
| `DEL-023` | Bulk deletion hooks                    | Before/after hooks run once per successfully deleted row                                | Core             | `AB`       | Required |
| `DEL-024` | Post-delete hook throws                | Database deletion remains committed and later safe work continues                       | Core             | `AB`       | Required |

## 10. Custom actions and auditing

| ID          | Behavior                               | Expected result                                                       | Owner          | Test       | Level            |
| ----------- | -------------------------------------- | --------------------------------------------------------------------- | -------------- | ---------- | ---------------- |
| `ACT-001`   | Execute authorized action              | Handler receives ids, admin user, opaque client, and `{ scope, ids }` | Core           | `AB/HT`    | Required         |
| `ACT-002`   | Execute unknown action                 | Permission denial is produced for every user and no handler runs      | Core           | `AB/HT`    | Required         |
| `ACT-003`   | Execute unauthorized action            | Permission denial is produced                                         | Core           | `AB/HT/UI` | Required         |
| `ACT-004`   | Action includes unavailable id         | Entire action is rejected and handler does not run                    | Core           | `AB/HT`    | Required         |
| `ACT-005`   | Action handler succeeds                | Its safe result is returned as JSON                                   | Core/Transport | `AB/HT`    | Required         |
| `ACT-006`   | Action handler throws expected error   | Safe PanelJS error is preserved                                       | Core/Transport | `AB/HT`    | Required         |
| `ACT-007`   | Action handler throws unexpected error | Transport returns generic internal error                              | Transport      | `HT`       | Required         |
| `ACT-008`   | Convert action where for Prisma        | Scope and ids become a safe Prisma conjunction                        | Adapter        | `AC`       | Adapter-specific |
| `ACT-009`   | Convert action where for TypeORM       | Simple scope and ids become safe TypeORM criteria                     | Adapter        | `AC`       | Adapter-specific |
| `AUDIT-001` | Audit create                           | Event includes type, model, created id, actor, and timestamp          | Core           | `CU/AB`    | Required         |
| `AUDIT-002` | Audit update                           | Event includes updated id                                             | Core           | `CU/AB`    | Required         |
| `AUDIT-003` | Audit single delete                    | Event includes deleted id                                             | Core           | `CU/AB`    | Required         |
| `AUDIT-004` | Audit bulk delete                      | One event includes successfully deleted ids                           | Core           | `AB`       | Required         |
| `AUDIT-005` | Audit custom action                    | Event includes ids and action name metadata                           | Core           | `AB`       | Required         |
| `AUDIT-006` | No audit configured                    | Mutation succeeds without an audit call                               | Core           | `CU/AB`    | Required         |
| `AUDIT-007` | Audit writer throws after commit       | Mutation remains successful and failure is logged                     | Core           | `AB`       | Required         |

## 11. HTTP transport behavior

| ID         | Behavior                            | Expected result                                                        | Owner     | Test | Level    |
| ---------- | ----------------------------------- | ---------------------------------------------------------------------- | --------- | ---- | -------- |
| `HTTP-001` | Normalize default base path         | Admin mounts at `/admin`                                               | Transport | `HT` | Required |
| `HTTP-002` | Normalize custom base path          | Leading slash is required and trailing slashes are removed             | Transport | `HT` | Required |
| `HTTP-003` | Invalid base path                   | Mount fails before adding routes                                       | Transport | `HT` | Required |
| `HTTP-004` | Schema route                        | `GET /api/schema` returns user-specific schema JSON                    | Transport | `HT` | Required |
| `HTTP-005` | List route                          | `GET /api/:model` returns paginated JSON and status 200                | Transport | `HT` | Required |
| `HTTP-006` | Detail route                        | `GET /api/:model/:id` returns JSON and status 200                      | Transport | `HT` | Required |
| `HTTP-007` | Create route                        | `POST /api/:model` returns JSON and status 201                         | Transport | `HT` | Required |
| `HTTP-008` | Update route                        | `PUT /api/:model/:id` returns JSON and status 200                      | Transport | `HT` | Required |
| `HTTP-009` | Delete route                        | `DELETE /api/:model/:id` returns status 204 with no body               | Transport | `HT` | Required |
| `HTTP-010` | Delete preview route                | Query ids are parsed and preview JSON is returned                      | Transport | `HT` | Required |
| `HTTP-011` | Action route                        | JSON ids are parsed and core action result is returned                 | Transport | `HT` | Required |
| `HTTP-012` | Unknown model                       | Returns `404 MODEL_NOT_FOUND`                                          | Transport | `HT` | Required |
| `HTTP-013` | Invalid record id                   | Returns `400 VALIDATION_ERROR`                                         | Transport | `HT` | Required |
| `HTTP-014` | Expected PanelJS error              | Status, message, and code are preserved                                | Transport | `HT` | Required |
| `HTTP-015` | Unexpected error                    | Returns `500 INTERNAL_ERROR` without internal message                  | Transport | `HT` | Required |
| `HTTP-016` | Same-origin mutation                | Missing origin or matching host is allowed                             | Transport | `HT` | Required |
| `HTTP-017` | Cross-origin mutation               | POST, PUT, PATCH, and DELETE return `403 ORIGIN_FORBIDDEN`             | Transport | `HT` | Required |
| `HTTP-018` | Cross-origin read                   | GET remains available after authentication                             | Transport | `HT` | Required |
| `HTTP-019` | API caching                         | API responses contain `Cache-Control: private, no-store`               | Transport | `HT` | Required |
| `HTTP-020` | Frame protection                    | Mounted responses set DENY/frame-ancestors headers                     | Transport | `HT` | Required |
| `HTTP-021` | Static UI                           | Built UI assets are served below base path                             | Transport | `HT` | Required |
| `HTTP-022` | UI fallback                         | Non-API route returns index HTML with injected base path               | Transport | `HT` | Required |
| `HTTP-023` | Protected built-in page             | Unauthenticated HTML request redirects to base-path login              | Transport | `HT` | Required |
| `HTTP-024` | Built-in login/config/logout routes | Routes use documented statuses, JSON, and cookie headers               | Transport | `HT` | Required |
| `HTTP-025` | JSON body limit and malformed JSON  | Express returns a safe client error rather than executing an operation | Transport | `HT` | Required |

## 12. Browser-visible behavior

| ID       | Behavior                   | Expected result                                                               | Owner | Test    | Level    |
| -------- | -------------------------- | ----------------------------------------------------------------------------- | ----- | ------- | -------- |
| `UI-001` | Open protected admin       | Logged-out user reaches login; logged-in user reaches dashboard               | UI    | `UI`    | Required |
| `UI-002` | Submit invalid login       | Generic error is shown without revealing account existence                    | UI    | `UI`    | Required |
| `UI-003` | Submit valid login         | Dashboard loads and session persists across navigation                        | UI    | `UI`    | Required |
| `UI-004` | Log out                    | Session clears and login page is shown                                        | UI    | `UI`    | Required |
| `UI-005` | Dashboard permissions      | Only listable models appear                                                   | UI    | `UI`    | Required |
| `UI-006` | Open list                  | Records and configured columns render                                         | UI    | `UI`    | Required |
| `UI-007` | Render related display     | Belongs-to display value renders without exposing hidden fields               | UI    | `UI`    | Required |
| `UI-008` | Search list                | Search changes rows and pagination metadata                                   | UI    | `UI`    | Required |
| `UI-009` | Filter list                | Supported filter changes rows and can be cleared                              | UI    | `UI`    | Required |
| `UI-010` | Sort list                  | Sort direction changes and resulting order is visible                         | UI    | `UI`    | Required |
| `UI-011` | Paginate list              | Next/previous navigation loads the correct page                               | UI    | `UI`    | Required |
| `UI-012` | Empty list                 | Clear empty state is displayed                                                | UI    | `UI`    | Required |
| `UI-013` | View record                | Correct visible fields and relation labels render                             | UI    | `UI`    | Required |
| `UI-014` | Create permission          | Create control and route are unavailable without permission                   | UI    | `UI`    | Required |
| `UI-015` | Create record              | Form fields match schema; successful submit displays persisted record         | UI    | `UI`    | Required |
| `UI-016` | Create validation error    | Field or form error is visible and entered data is not silently lost          | UI    | `UI`    | Required |
| `UI-017` | Update permission          | Edit control and route are unavailable without permission                     | UI    | `UI`    | Required |
| `UI-018` | Update record              | Existing values load and successful submit displays persisted changes         | UI    | `UI`    | Required |
| `UI-019` | Read-only field            | Field cannot be changed through the form                                      | UI    | `UI`    | Required |
| `UI-020` | Relation options           | Only permitted, scoped related records are selectable                         | UI    | `UI`    | Required |
| `UI-021` | Delete permission          | Delete controls and route are unavailable without permission                  | UI    | `UI`    | Required |
| `UI-022` | Single delete confirmation | Selected record is shown and confirmation removes it                          | UI    | `UI`    | Required |
| `UI-023` | Select multiple rows       | Selection state and action availability are correct                           | UI    | `UI`    | Required |
| `UI-024` | Bulk delete                | Confirmed selected rows disappear and success message is shown                | UI    | `UI`    | Required |
| `UI-025` | Cascade preview            | Related rows are shown as being deleted                                       | UI    | `UI`    | Required |
| `UI-026` | Set-null preview           | Related rows are shown as being unlinked                                      | UI    | `UI`    | Required |
| `UI-027` | Restrict preview           | Blocking relation is explained and confirmation is disabled                   | UI    | `UI`    | Required |
| `UI-028` | Action permission          | Unauthorized custom action is hidden and cannot be invoked directly           | UI    | `UI/HT` | Required |
| `UI-029` | Run custom action          | Selected rows reach the handler and result message is shown                   | UI    | `UI`    | Required |
| `UI-030` | Expired session            | UI returns to an authentication-required state without exposing data          | UI    | `UI`    | Required |
| `UI-031` | API failure state          | User receives a useful error and can retry or navigate safely                 | UI    | `UI`    | Required |
| `UI-032` | Browser history            | Back, forward, and direct model URLs resolve correctly under custom base path | UI    | `UI`    | Required |

The complete browser suite runs on the canonical Prisma + Express setup. Every
additional ORM must run a smoke set containing `UI-003`, `UI-006`, `UI-015`,
`UI-018`, `UI-022`, `UI-024`, and one referential-action flow.

## 13. Error and failure guarantees

| ID        | Behavior                      | Expected result                                           | Owner             | Test    | Level    |
| --------- | ----------------------------- | --------------------------------------------------------- | ----------------- | ------- | -------- |
| `ERR-001` | Validation failure            | Status 400 and code `VALIDATION_ERROR`                    | Core/Transport    | `CU/HT` | Required |
| `ERR-002` | Authentication failure        | Status 401 and code `AUTHENTICATION_REQUIRED`             | Core/Transport    | `CU/HT` | Required |
| `ERR-003` | Permission failure            | Status 403 and code `PERMISSION_DENIED`                   | Core/Transport    | `CU/HT` | Required |
| `ERR-004` | Unknown model                 | Status 404 and code `MODEL_NOT_FOUND`                     | Core/Transport    | `CU/HT` | Required |
| `ERR-005` | Missing or scoped-out record  | Status 404 and code `RECORD_NOT_FOUND`                    | Core/Transport    | `AB/HT` | Required |
| `ERR-006` | Unexpected internal failure   | Generic status 500 response; private error is logged only | Transport         | `HT`    | Required |
| `ERR-007` | ORM constraint failure        | Safe PanelJS error is returned instead of ORM details     | Adapter/Transport | `AC/HT` | Required |
| `ERR-008` | Post-commit extension failure | Committed database result is not reported as rolled back  | Core              | `AB`    | Required |

## 14. Deferred behavior

| ID        | Behavior                                        | Reason                                                                  | Owner        | Test | Level    |
| --------- | ----------------------------------------------- | ----------------------------------------------------------------------- | ------------ | ---- | -------- |
| `DEF-001` | Nested create/update relation objects           | First write contract supports scalars and belongs-to FK values only     | Core/Adapter | —    | Deferred |
| `DEF-002` | Composite primary keys                          | Current normalized resource contract accepts one id field               | Core/Adapter | —    | Deferred |
| `DEF-003` | Models without primary keys                     | Safe update/delete targeting cannot be guaranteed                       | Core/Adapter | —    | Deferred |
| `DEF-004` | Common arbitrary nested scope DSL               | Prisma and TypeORM do not yet share a defined nested predicate language | Core/Adapter | —    | Deferred |
| `DEF-005` | Every database dialect                          | First integration matrix targets PostgreSQL                             | Adapter      | —    | Deferred |
| `DEF-006` | Full browser suite for every ORM/transport pair | Adapter and transport contracts avoid an unbounded Cartesian matrix     | UI           | —    | Deferred |
| `DEF-007` | Performance and load guarantees                 | Correctness and security are the first release gate                     | All          | —    | Deferred |
| `DEF-008` | Visual screenshot regression                    | Functional browser behavior comes first                                 | UI           | —    | Deferred |

## Ownership migrations

The following target-core behaviors currently live in `@paneljs/express` and
must be moved only after characterization tests protect them:

| Current file                              | Behavior to move to core                                                           | Behavior groups protected first |
| ----------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------- |
| `packages/express/src/crudRouter.ts`      | CRUD orchestration, permissions, scopes, relation validation, hooks, audit calls   | `CRUD-*`, `SEC-*`, `AUDIT-*`    |
| `packages/express/src/actionRouter.ts`    | Action authorization, selected-row verification, bulk deletion, hooks, audit calls | `ACT-*`, `DEL-014`–`DEL-024`    |
| `packages/express/src/deleteRelations.ts` | Child-relation discovery, delete preview, Restrict checks                          | `DEL-005`–`DEL-011`             |

Express retains URL/query/body parsing, middleware, cookies, headers, status
codes, static files, redirects, and error-to-HTTP conversion (`HTTP-*`).

## Release gates

### Pull request

An affected package must pass:

1. Formatting and type checks.
2. Its core unit tests.
3. Its adapter/auth-store contract when adapter code changed.
4. Admin behavior tests when core operations or an adapter changed.
5. Express transport tests when transport code changed.
6. The canonical browser smoke set when UI or HTTP behavior changed.

### Package publication

Before publishing `paneljs`, `@paneljs/prisma`, `@paneljs/typeorm`, or a transport:

1. Every applicable `Required` row must have an automated test.
2. All applicable tests must pass on a clean PostgreSQL database.
3. The full canonical browser suite must pass.
4. Every additional supported ORM must pass its browser smoke set.
5. Build and package-content verification must pass.

### Adding another ORM

A new ORM is supported only when it:

1. Supplies an equivalent fixture and deterministic seed.
2. Passes every portable `META-*`, `DATA-*`, and `QUERY-*` adapter contract.
3. Passes the auth-store contract if it advertises built-in auth support.
4. Passes all `AB` security and user-operation behaviors.
5. Passes the required browser smoke set through a supported transport.
