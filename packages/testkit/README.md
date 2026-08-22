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

Prisma and TypeORM environments must use equivalent model names and seed
semantics from `CONTRACT_MODELS` and `AdapterContractSeed`. Their schema syntax
and direct database inspection code remain ORM-specific.

## Demonstration harnesses

`test/` contains deliberately small in-memory implementations. They prove the
shared suites execute and document the minimum harness behavior. They are not a
third production adapter and must never be imported by published packages.
