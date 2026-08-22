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

<ChooserGrid :items="frameworks" />
