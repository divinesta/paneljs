# PanelJS

A Django-style admin panel. One git repo, three packages:

| Package | npm name | Role |
| --- | --- | --- |
| `packages/paneljs` | `paneljs` | Core: registry, schema JSON, admin UI |
| `packages/express` | `@paneljs/express` | `mount(app, admin)` |
| `packages/prisma` | `@paneljs/prisma` | `prismaAdapter()`, DMMF introspector |

Apps:

- `apps/web` — marketing site (Vite + React)
- `apps/docs` — VitePress documentation

`EXPRESS-ADMIN` remains the published `prisma-express-admin` library until this repo is cut over.

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
