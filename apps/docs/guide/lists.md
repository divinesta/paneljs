# Lists, search, and filters

These three options live on `admin.register("Model", { ... })` in **your** app. They only change that model’s list page.

A complete User + Post setup is on [Wire it into your app](/guide/in-your-app). This page is the detail for each option.

## `listDisplay` — columns

```ts
admin.register("User", {
  listDisplay: ["email", "fullName", "role", "isActive"],
});

admin.register("Post", {
  listDisplay: ["title", "author", "published", "createdAt"],
});
```

What you type is what the table shows, left to right.

| Value                               | What appears                                  |
| ----------------------------------- | --------------------------------------------- |
| `"email"`, `"title"`, `"published"` | That scalar                                   |
| `"author"` (a `belongsTo` on Post)  | Related User’s display field (`author.email`) |
| `"posts"` (a `hasMany` on User)     | Not loaded — do not use as a column           |

Omit `listDisplay` and the library picks the display field, other scalars (up to 6), then `createdAt`.

A name that is not on the model fails at `mount`, not at first click.

## `searchFields` — search box

```ts
admin.register("User", {
  searchFields: ["email", "fullName"],
});

admin.register("Post", {
  searchFields: ["title", "content"],
});
```

Only **String** fields. The box on `/admin/users` becomes:

```
WHERE email CONTAINS ? OR fullName CONTAINS ?
```

Entries can follow relations with `__`, and take a Django-style prefix:

```ts
admin.register("Post", {
  // title contains, author's email starts with, sku matches exactly
  searchFields: ["title", "^author__email", "=sku"],
});
```

| If you…                          | Result                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| Omit `searchFields`              | All non-id string scalars                                                                  |
| Pass a non-string (`"isActive"`) | `mount` throws                                                                             |
| Use a relation path              | Must cross registered models; an admin who can't list a model on the way doesn't search it |
| Use PostgreSQL                   | Search is case-insensitive (Prisma reads the schema `provider`; TypeORM reads the driver)  |
| Type more than 200 characters    | `400 VALIDATION_ERROR`                                                                     |

## `listFilter` — filters

```ts
admin.register("User", {
  listFilter: ["role", "isActive"],
});

admin.register("Post", {
  listFilter: ["published", "createdAt"],
});
```

**Opt-in.** No `listFilter` means no filter UI and no filter query params.

| Field                             | Control                       |
| --------------------------------- | ----------------------------- |
| enum (`role`)                     | Select of enum values         |
| boolean (`isActive`, `published`) | True / false                  |
| date-time (`createdAt`)           | From / to (`__gte` / `__lte`) |
| text (`title`)                    | Contains                      |
| foreign key (`authorId`) / number | Exact value                   |

Filters can follow relations with `__`. Each relation crossed must be to a registered model:

```ts
admin.register("Post", {
  listFilter: ["author__country", "tags__name", "createdAt"],
});
```

A filter that is not allowed is `400`, not silently ignored. Scope is always `AND`-ed in — Ada cannot filter her way into Contoso. Only paths listed in `listFilter` are accepted from the URL, so nobody can probe fields you didn't offer (`?author__passwordHash__startsWith=a` is a `400`). A path through a model the admin can't list is also rejected.

### Filter operators in the URL

Append an operator to a `listFilter` key: `?author__country__in=NG,GH`, `?views__gt=100`, `?category__isNull=true`.

| Operator                    | Works on                        |
| --------------------------- | ------------------------------- |
| `equals` (default), `ne`    | everything                      |
| `in`, `notIn` (comma list)  | text, number, date-time, enum   |
| `gt`, `gte`, `lt`, `lte`    | number, date-time               |
| `contains`, `startsWith`    | text                            |
| `isNull` (`true` / `false`) | everything, including relations |

A path through a list relation (`tags__name=urgent`) matches when **some** related record matches. The old `createdAt_gte` spelling still works.

### Filters from your own code

`AdminService.list` takes a full filter tree, including `or`, `not` and `some` / `every` / `none` over list relations. It is checked against the registered models and the admin's permissions like a URL filter, but is not limited to `listFilter`:

```ts
await admin.service.list(postModel, adminUser, {
  filter: {
    or: [
      { path: ["author", "country"], op: "equals", value: "NG" },
      { not: { path: ["views"], op: "lt", value: 10 } },
      {
        path: ["tags"],
        quantifier: "none",
        where: { path: ["name"], op: "equals", value: "draft" },
      },
    ],
  },
});
```

The Prisma adapter supports all of this. The TypeORM and MikroORM adapters currently support an `AND` of `equals`, `in`, `gte` and `lte` on the model's own fields, and plain `contains` search; anything else returns `400`.

## `defaultSort` and `perPage`

```ts
admin.register("Post", {
  // Drafts first, then by author name. A leading "-" means descending.
  defaultSort: ["published", "author__name"],
  perPage: 25,
});
```

`defaultSort` takes one string (`"-createdAt"`), a list of up to 5, or the older `{ field: "createdAt", direction: "desc" }`. A path may cross relations that point at **one** record (`author__name`, `author__tenant__name`), up to 3 deep. It can't go through a list relation such as `tags__name`: a post has many tags, so there's no single value to sort by. Paths are checked at startup.

| Option        | Default if omitted            |
| ------------- | ----------------------------- |
| `defaultSort` | `createdAt desc`, else the id |
| `perPage`     | `50`                          |

### Sorting in the table

- **Click** a column header to sort by that column. Click again to reverse it.
- **Shift+click** another header to add it as the next sort column. Small numbers (1, 2, …) show the order.
- A **relation column** such as Author sorts by what the cell shows: the related record's display field (`author__name`).

In the URL this is `?sort=published,-createdAt`. The older `?sort=title&dir=desc` still works.

A URL may sort by the model's own visible fields, by any column in the table, and by anything in `defaultSort`. Other relation paths return `400`, so a URL can't order rows by related data you didn't put on screen. Paths through a model the administrator can't list are refused too.

### Stable order

PanelJS always adds the id as the last sort column. Without it, rows that tie (say, 60 posts imported in the same second) could come back in a different order on each request, so page 2 might repeat a row from page 1 and skip another.

Relation sorting is Prisma only for now. TypeORM and MikroORM sort by several of the model's own columns and return `400` for a relation path.

## `pluralName`

```ts
admin.register("Category", { pluralName: "categories" });
```

Drives `/admin/categories` and `/admin/api/categories`. The auto plural is usually fine (`User` → `users`).

## Minimal real file

This is enough for a useful User list after [install](/guide/installation/):

```ts
admin.register("User", {
  listDisplay: ["email", "fullName", "role", "isActive"],
  listFilter: ["role", "isActive"],
  searchFields: ["email", "fullName"],
});
```

Add `scope`, permissions, and actions next on [Wire it into your app](/guide/in-your-app).
