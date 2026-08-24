# Express

`@paneljs/express` is the HTTP adapter. It mounts the admin UI and JSON API on an Express 4 or 5 app.

```ts
import { mount } from "@paneljs/express";

await mount(app, admin);
```

Peer dependency: `express` `^4.18` or `^5`.

`mount` must run after every `register`. It must be awaited. That is when the data adapter introspects, registrations are validated, and the router is attached at `basePath` (default `/admin`).

## What it mounts, in order

JSON body parser, built-in auth endpoints when enabled, auth on `/api`, schema route, action routes, CRUD routes, error handler, static UI, SPA fallback.

API routes are mounted first so `/admin/api/*` always wins over the SPA.

## What it does not know

Express does not import Prisma, TypeORM, or MikroORM. It talks to `admin` and `adapter.resource()`. Pick an ORM on [Installation](/guide/installation/).

## Request object

External `getCurrentUser` receives the incoming request. Cookie and `Authorization` headers are yours to read. Built-in mode sets an `HttpOnly`, `SameSite=Lax` cookie scoped to `basePath`.

## Next

- [Express + Prisma](/guide/installation/express/prisma)
- [Express + TypeORM](/guide/installation/express/typeorm)
- [How it works](/guide/how-it-works)
