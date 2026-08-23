# Site content

## Blog posts

Add a Markdown file in `blog/`:

```text
apps/web/content/blog/your-slug.md
```

```md
---
title: Shipping TypeORM
date: 2026-08-23
description: What changed and how to mount it.
image: /images/blog/your-cover.jpg
---

Your post in **Markdown**. Headings, lists, links, and fenced code work.

Set `draft: true` to keep a file out of `/blog` until you are ready.
```

The filename is the URL: `your-slug.md` → `/blog/your-slug`.

Do not put HTML pages here. Markdown is the format.
