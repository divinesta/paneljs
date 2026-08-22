# `@paneljs/testkit`

Private workspace package containing the behavioral contracts that PanelJS
adapters and core admin operations must pass. It is not published to npm.

## Contracts

- `defineAdapterContract(harness)` tests normalized metadata, scoped reads,
  selections, filters, search, sorting, pagination, create, update, bulk update,
  delete, and bulk delete through `DataAdapter`.
- `defineAuthStoreContract(harness)` tests email/username lookup plus session
  creation, lookup, expiration, deletion, and missing records.
- `defineAdminBehaviorContract(harness)` is the first framework-neutral contract
  for scoped lists, pagination, CRUD permissions, scoped creates and updates,
  not-found isolation, and atomic selected deletion.

The admin-behavior contract uses a small driver because the framework-neutral
core `AdminService` has not been extracted from Express yet. After extraction,
the harness will adapt `AdminService` methods to that driver and the contract
will grow to cover the remaining `AB` rows in the behavior matrix.

## Harness lifecycle

Every contract follows the same lifecycle:

1. `create()` starts or allocates the environment once.
2. `reset()` restores deterministic canonical data before every test.
3. Shared tests call only the public PanelJS contract.
4. Direct read helpers verify what was actually persisted.
5. `dispose()` releases the database or other resources once.

An adapter package only supplies its ORM-specific setup:

```ts
import { defineAdapterContract } from "@paneljs/testkit";

defineAdapterContract({
  name: "Prisma PostgreSQL",
  async create() {
    return createPrismaContractEnvironment();
  },
});
```

Prisma and TypeORM environments must use equivalent model names and the fresh,
deterministic data returned by `createContractSeedData()`. It includes two
tenants, two users, three posts, and Cascade, SetNull, and Restrict child rows.
`createAuthStoreSeed()` supplies equivalent email and username auth records.
Their schema syntax and direct database inspection code remain ORM-specific.

The canonical PostgreSQL schemas live with their adapters:

- Prisma: `packages/prisma/test/fixture/schema.prisma`
- TypeORM: `packages/typeorm/test/fixture/entities.ts`

Generated Prisma client files are intentionally ignored. Run
`pnpm --filter @paneljs/prisma fixture:generate` before a Prisma integration
suite that imports that client.

## Prisma PostgreSQL contract

Run the real Prisma adapter and auth-store contracts with:

```sh
pnpm --filter @paneljs/prisma test:integration
```

The suite starts PostgreSQL 16 with Testcontainers, applies the canonical
schema, and resets deterministic data before every test. Docker is discovered
normally. On Linux, an already-active rootless Podman socket at
`/run/user/<uid>/podman/podman.sock` is also detected automatically.

## Demonstration harnesses

`test/` contains deliberately small in-memory implementations. They prove the
shared suites execute and document the minimum harness behavior. They are not a
third production adapter and must never be imported by published packages.
