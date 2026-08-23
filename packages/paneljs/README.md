# paneljs

Schema-driven admin core. Register models and serve a guarded operations UI.

Install with the adapters for your stack, or let the CLI pick them:

```bash
npx paneljs@latest init
```

```bash
npm install paneljs @paneljs/express @paneljs/prisma
```

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

See the [repository](https://github.com/divinesta/paneljs) for docs and the example app.
