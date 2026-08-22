# List actions

List actions are bulk verbs on selected rows. Every list has a built-in **Delete selected** action when the current admin has `delete` permission. It is the default action, honours `scope`, runs the model's delete hooks, and writes a `delete` audit event.

You can add custom actions for other operations, such as publishing posts:

::: code-group

```ts [Prisma]
import { prismaActionWhere } from "@paneljs/prisma";

admin.register("Post", {
  actions: [
    {
      name: "publish_selected",
      label: "Publish selected posts",
      allowedRoles: ["SUPER_ADMIN", "ADMIN"],
      handler: async ({ client, where }) => {
        const result = await client.post.updateMany({
          where: prismaActionWhere("id", where),
          data: { published: true },
        });
        return { message: `Published ${result.count} posts.` };
      },
    },
  ],
});
```

```ts [TypeORM]
import { typeormActionWhere } from "@paneljs/typeorm";
import type { DataSource } from "typeorm";

admin.register("Post", {
  actions: [
    {
      name: "publish_selected",
      label: "Publish selected posts",
      allowedRoles: ["SUPER_ADMIN", "ADMIN"],
      handler: async ({ client, where }) => {
        const result = await (client as DataSource)
          .getRepository("Post")
          .update(typeormActionWhere("id", where), { published: true });
        const count = result.affected ?? 0;
        return { message: `Published ${count} posts.` };
      },
    },
  ],
});
```

:::

The UI shows `label`. The route is `POST /admin/api/posts/actions/publish_selected`.

## What the handler receives

```ts
{
  ids: Array<string | number>; // only rows that passed scope
  adminUser: AdminUser;
  client: unknown; // Prisma client or TypeORM DataSource
  where: { scope: Record<string, unknown>; ids: Array<string | number> };
}
```

Return `{ message: string }`. That string is what the UI toasts.

## Safety checks, in order

1. Caller is authenticated
2. Caller has **list** permission on the model
3. The action exists and the caller may run it (`allowedRoles`, or `permissions.actions[name]`)
4. Body is `{ ids: [...] }` — 1 to **100** unique string/number ids
5. Those rows are reloaded with the action `where` (scope + selected ids)
6. If any id is missing, the action **does not run** (`400`)
7. Handler, then optional audit `{ type: "action", metadata: { action } }`

Ada cannot publish Grace’s draft by pasting its id into the request.

## Permissions

`allowedRoles` on the action is the usual allowlist. Super-admin bypasses it. An action must define `allowedRoles`, `permissions.actions[name]`, or both; omitting both denies the action.

You can also set `permissions.actions.publish_selected`. Both are enforced when present.

The schema endpoint only lists actions this person may run. Hidden in the UI is not the boundary — the POST is.

The built-in delete action uses the model's `delete` permission; it cannot be changed through `permissions.actions`.

## Do the work safely

Use `where.scope` and `ids` (or `where.ids`) in every mutation so the action stays tenant-safe. `where` is **not** a Prisma `where` object and not TypeORM criteria.

- Prisma: `prismaActionWhere("id", where)` from `@paneljs/prisma`
- TypeORM: `typeormActionWhere("id", where)` from `@paneljs/typeorm`
