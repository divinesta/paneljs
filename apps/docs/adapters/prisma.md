# Prisma adapter

`@paneljs/prisma` answers two questions for PanelJS: what models exist, and how to read and write rows. The UI never talks to Prisma. Express never imports it.

```ts
import { prismaAdapter } from "@paneljs/prisma";

const admin = createAdmin({
  adapter: prismaAdapter({ prisma, schemaPath: "prisma/schema.prisma" }),
  auth: { getCurrentUser },
});
```

Peer dependencies: `prisma` and `@prisma/client` **7.5.x**. See [Prisma versions](/limits/prisma).

## Discovery

At mount, the adapter compiles `schema.prisma` with `getDMMF()` and maps models, fields, enums, and relations into PanelJS metadata.

Default path is `prisma/schema.prisma` relative to `process.cwd()`. Pass `schemaPath` if the file lives elsewhere. That file must ship in production.

Register names are Prisma model names, PascalCase, exact (`User`, not `users`).

## CRUD

List, get, create, update, and delete go through Prisma delegates (`prisma.user.findMany`, …). Search is case-insensitive when the schema `datasource` provider is `"postgresql"`.

## Built-in auth

`prismaAdapter` supplies the auth store. Generate the tables:

```sh
npx paneljs auth:schema --identifier email
```

Paste the models into `schema.prisma`, migrate, then `npx paneljs createsuperuser --config ./paneljs.config.mjs`. Full walkthrough: [Authentication](/guide/auth).

## Custom actions

The action handler receives `client` (your Prisma client) and `where: { scope, ids }`. `where` is not a Prisma `where`. Combine them, or use the helper:

```ts
import { prismaActionWhere } from "@paneljs/prisma";

handler: async ({ client, where }) => {
  const result = await client.post.updateMany({
    where: prismaActionWhere("id", where),
    data: { published: true },
  });
  return { message: `Published ${result.count} posts.` };
};
```

## What this adapter does not do

- Nested `connect` / `create` / `set` writes
- Composite primary keys (`@@id([a, b])`) — skipped
- Models with no `@id` — skipped

Install: [Express + Prisma](/guide/installation/express/prisma).
