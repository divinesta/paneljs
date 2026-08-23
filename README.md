# PanelJS

A Django-style admin panel. One git repo, four packages:

| Package            | npm name           | Role                                  |
| ------------------ | ------------------ | ------------------------------------- |
| `packages/paneljs` | `paneljs`          | Core: registry, schema JSON, admin UI |
| `packages/express` | `@paneljs/express` | `mount(app, admin)`                   |
| `packages/prisma`   | `@paneljs/prisma`    | `prismaAdapter()`, DMMF introspector |
| `packages/typeorm`  | `@paneljs/typeorm`   | `typeormAdapter()`                   |
| `packages/mikroorm` | `@paneljs/mikroorm`  | `mikroormAdapter()`                  |

Apps:

- `apps/web` — marketing site (Vite + React)
- `apps/docs` — VitePress documentation
- `apps/example` — Prisma + Express dogfood app
- `apps/example-typeorm` — TypeORM + Express dogfood app
- `apps/example-mikroorm` — MikroORM + Express dogfood app

Testing requirements and package ownership are defined in the
[behavior matrix](./docs/testing/behavior-matrix.md).

`EXPRESS-ADMIN` remains the published `prisma-express-admin` library until this repo is cut over.

```bash
npx paneljs@latest init
```

Adds `paneljs`, `@paneljs/express`, and `@paneljs/prisma`, `@paneljs/typeorm`, or `@paneljs/mikroorm`. Does not rewrite source files.

```ts
import { createAdmin } from "paneljs";
import { prismaAdapter } from "@paneljs/prisma";
import { mount } from "@paneljs/express";

const admin = createAdmin({
  adapter: prismaAdapter({ prisma }),
  auth: { getCurrentUser },
});

admin.register("User");
await mount(app, admin);
```
