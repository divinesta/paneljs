# @paneljs/express

Express adapter for [PanelJS](https://www.npmjs.com/package/paneljs). Mounts the admin UI and JSON API.

```ts
import { mount } from "@paneljs/express";

await mount(app, admin);
```

Peer dependency: `express` ^4.18 or ^5.
