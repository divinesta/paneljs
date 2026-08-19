# @paneljs/prisma

Prisma adapter for [PanelJS](https://www.npmjs.com/package/paneljs). Reads `schema.prisma` via DMMF and runs scalar CRUD.

```ts
import { prismaAdapter } from "@paneljs/prisma";

const admin = createAdmin({
  adapter: prismaAdapter({ prisma, schemaPath: "prisma/schema.prisma" }),
  auth: { getCurrentUser },
});
```

Peer dependencies: `prisma` and `@prisma/client` 7.5.x.

CLI (after adding the built-in auth models):

```bash
npx paneljs createsuperuser --config ./paneljs.config.mjs
```
