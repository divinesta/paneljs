---
title: Installation
---

<script setup>
const frameworks = [
  { title: "Express", icon: "express", href: "/guide/installation/express/", hint: "mount(app, admin)" },
  { title: "Fastify", icon: "fastify", comingSoon: true },
  { title: "Nest.js", icon: "nest", comingSoon: true },
];
</script>

# Installation

PanelJS mounts onto an app you already have. It does not create a new project.

Pick the HTTP framework first, then the ORM that app already uses. After mount, `register("User")` is the same on every stack.

Coming-soon cards are listed so you can see what is next. They are not installable yet.

## CLI

From the root of **your** app:

::: code-group

```sh [npm]
npx paneljs@latest init
```

```sh [pnpm]
pnpm dlx paneljs@latest init
```

```sh [yarn]
yarn dlx paneljs@latest init
```

```sh [bun]
bunx paneljs@latest init
```

:::

The prompt asks for a framework, then an ORM. Fastify, Nest.js, and Drizzle are listed and cannot be selected yet.

`init` adds packages to this project. It does not create a new app and does not rewrite your source. You paste `createAdmin` / `mount` next to your existing `listen` call.

Skip the prompt:

::: code-group

```sh [Prisma]
npx paneljs init --framework express --orm prisma --yes
```

```sh [TypeORM]
npx paneljs init --framework express --orm typeorm --yes
```

```sh [MikroORM]
npx paneljs init --framework express --orm mikroorm --yes
```

:::

`--dry-run` prints the plan without installing. `--pm pnpm` (or npm / yarn / bun) overrides lockfile detection.

Or pick a stack below and install by hand.

<ChooserGrid :items="frameworks" />
