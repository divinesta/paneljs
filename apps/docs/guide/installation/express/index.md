---
title: Express
---

<script setup>
const orms = [
  { title: "Prisma", icon: "prisma", href: "/guide/installation/express/prisma", hint: "schema.prisma" },
  { title: "TypeORM", icon: "typeorm", href: "/guide/installation/express/typeorm", hint: "DataSource + entities" },
  { title: "Drizzle", icon: "drizzle", comingSoon: true },
];
</script>

# Express

You already have an Express server. PanelJS adds `/admin` on top of it.

Pick the ORM this app already uses.

<ChooserGrid :items="orms" />

Mounting itself is one call: `await mount(app, admin)` from `@paneljs/express`. Details: [Express](/frameworks/express).
