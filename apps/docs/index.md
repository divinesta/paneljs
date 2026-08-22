---
layout: home
title: PanelJS - The Admin Panel for JavaScript ORMs
description: A Django-style admin for Node.js. Mount it on Express. Prisma and TypeORM today — Fastify, Nest, and more adapters next.

hero:
  name: PanelJS
  text: The admin panel for JavaScript ORMs.
  tagline: A Django-style admin for Node.js. You already wrote the data model — PanelJS turns it into a guarded operations UI.
  actions:
    - theme: brand
      text: Installation
      link: /guide/installation/
    - theme: alt
      text: What this is
      link: /guide/what-this-is

features:
  - title: Schema-driven
    details: The ORM you already have is the source of truth. register("User") is enough to get a working list and form. No second admin schema.
  - title: Pick your stack
    details: Express today. Prisma and TypeORM today. Fastify, Nest, and Drizzle are next. After mount, the admin API does not change.
  - title: Built-in or external auth
    details: Use the built-in admin-only login, sessions, and first-user setup, or plug in an existing session, JWT, or API key.
  - title: Scope is first-class
    details: A scope() function is applied to list, read, update, delete, relation picks, and custom actions. Ada cannot see Grace's tenant by guessing an ID.
  - title: Safe by default
    details: Password-like fields stay hidden. Unknown write keys are rejected. The schema endpoint sits behind the same auth as CRUD.
---
