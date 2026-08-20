# @paneljs/typeorm

TypeORM adapter for [PanelJS](https://www.npmjs.com/package/@paneljs/paneljs).

```ts
import { createAdmin } from "@paneljs/paneljs";
import { typeormAdapter } from "@paneljs/typeorm";
import { mount } from "@paneljs/express";

await dataSource.initialize();

const admin = createAdmin({
  adapter: typeormAdapter({ dataSource }),
  auth: { getCurrentUser },
});

admin.register("User");
await mount(app, admin);
```

Peer dependency: `typeorm` ^0.3.20.

The `DataSource` must already be initialized. Introspection reads live entity metadata. CRUD `resource()` lands in the next slice.
