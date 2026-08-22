import { defineConfig } from "vitepress";

export default defineConfig({
   title: "PanelJS",
   description:
      "PanelJS is a Django-style admin panel for Node.js. Mount it on Express. Prisma and TypeORM today.",
   base: "/docs/",
   head: [
      ["meta", { name: "robots", content: "index, follow" }],
      ["meta", { property: "og:site_name", content: "PanelJS" }],
      ["meta", { property: "og:type", content: "website" }],
      [
         "meta",
         {
            property: "og:image",
            content: "https://www.paneljs.com/images/product-overview.png",
         },
      ],
      ["meta", { name: "twitter:card", content: "summary_large_image" }],
   ],
   outDir: "./.vitepress/dist",
   appearance: "dark",
   srcExclude: ["MULTI_ORM_NOTES.md"],
   cleanUrls: true,
   lastUpdated: true,
   themeConfig: {
      logo: "/logo.svg",
      siteTitle: "PanelJS",
      nav: [
         { text: "Installation", link: "/guide/installation/" },
         { text: "Guide", link: "/guide/what-this-is" },
         { text: "Example", link: "/example/basic" },
         { text: "Reference", link: "/reference/create-admin" },
         { text: "npm", link: "https://www.npmjs.com/package/paneljs" },
      ],
      sidebar: [
         {
            text: "Start",
            items: [
               { text: "What this is", link: "/guide/what-this-is" },
               { text: "Installation", link: "/guide/installation/" },
               { text: "Wire it into your app", link: "/guide/in-your-app" },
               { text: "How it works", link: "/guide/how-it-works" },
            ],
         },
         {
            text: "Shape the admin",
            items: [
               { text: "Register a model", link: "/guide/register" },
               { text: "Lists, search, and filters", link: "/guide/lists" },
               { text: "Forms and field visibility", link: "/guide/forms" },
               { text: "Relations", link: "/guide/relations" },
            ],
         },
         {
            text: "Trust",
            items: [
               { text: "Authentication", link: "/guide/auth" },
               { text: "Permissions", link: "/guide/permissions" },
               { text: "Multi-tenant scope", link: "/guide/scope" },
               { text: "Sensitive fields", link: "/guide/sensitive-fields" },
            ],
         },
         {
            text: "Extend",
            items: [
               { text: "Lifecycle hooks", link: "/guide/hooks" },
               { text: "Custom actions", link: "/guide/actions" },
               { text: "Audit log", link: "/guide/audit" },
            ],
         },
         {
            text: "Example",
            items: [
               { text: "Express + Prisma", link: "/example/basic" },
               { text: "Express + TypeORM", link: "/example/typeorm" },
            ],
         },
         {
            text: "Adapters",
            items: [
               { text: "Prisma", link: "/adapters/prisma" },
               { text: "TypeORM", link: "/adapters/typeorm" },
            ],
         },
         {
            text: "Frameworks",
            items: [
               { text: "Express", link: "/frameworks/express" },
               { text: "Fastify (coming soon)", link: "/frameworks/fastify" },
               { text: "Nest.js (coming soon)", link: "/frameworks/nestjs" },
            ],
         },
         {
            text: "Reference",
            items: [
               { text: "createAdmin()", link: "/reference/create-admin" },
               { text: "register()", link: "/reference/register" },
               { text: "AdminUser", link: "/reference/admin-user" },
               { text: "HTTP API", link: "/reference/http-api" },
               { text: "Errors", link: "/reference/errors" },
            ],
         },
         {
            text: "Limits",
            items: [
               { text: "What is not included", link: "/limits/not-included" },
               { text: "Prisma versions", link: "/limits/prisma" },
               { text: "TypeORM notes", link: "/limits/typeorm" },
            ],
         },
      ],
      socialLinks: [
         { icon: "github", link: "https://github.com/divinesta/paneljs" },
      ],
      search: { provider: "local" },
      editLink: {
         pattern:
            "https://github.com/divinesta/paneljs/edit/main/apps/docs/:path",
         text: "Edit this page",
      },
      outline: { level: [2, 3] },
      footer: {
         message: "Released under the MIT License.",
         copyright: "PanelJS",
      },
   },
});
