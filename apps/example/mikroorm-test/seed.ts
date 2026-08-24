import { hashAdminPassword } from "paneljs";
import { orm } from "./orm.js";

const tenants = [
  { id: "northwind", name: "Northwind" },
  { id: "contoso", name: "Contoso" },
];

await orm.schema.updateSchema();
const em = orm.em.fork();

await em.nativeDelete("Post", {});
await em.nativeDelete("User", {});
await em.nativeDelete("Tenant", {});
await em.nativeDelete("ExpressAdminSession", {});
await em.nativeDelete("ExpressAdminUser", {});

await em.insertMany("Tenant", tenants);

const adaId = await em.insert("User", {
  email: "ada@northwind.test",
  fullName: "Ada Lovelace",
  role: "ADMIN",
  isActive: true,
  tenant: "northwind",
});
const graceId = await em.insert("User", {
  email: "grace@contoso.test",
  fullName: "Grace Hopper",
  role: "ADMIN",
  isActive: true,
  tenant: "contoso",
});

await em.insertMany("Post", [
  {
    title: "Notes on the Analytical Engine",
    content: "What the machine might do.",
    published: true,
    author: adaId,
    tenant: "northwind",
  },
  {
    title: "Draft: punch cards",
    content: "Not ready yet.",
    published: false,
    author: adaId,
    tenant: "northwind",
  },
  {
    title: "COBOL remarks",
    content: "People should be able to write in English.",
    published: true,
    author: graceId,
    tenant: "contoso",
  },
]);

const adminEmail = process.env.PANELJS_ADMIN_EMAIL ?? "ada@example.test";
const adminPassword = process.env.PANELJS_ADMIN_PASSWORD ?? "changeme-now";
const passwordHash = await hashAdminPassword(adminPassword);

await em.insertMany("ExpressAdminUser", [
  {
    email: adminEmail,
    passwordHash,
    role: "SUPER_ADMIN",
    isActive: true,
  },
  {
    email: "northwind@example.test",
    passwordHash,
    role: "ADMIN",
    isActive: true,
    tenantId: "northwind",
  },
]);

console.log(
  `[paneljs] MikroORM example seed complete. Sign in at /admin/login as ${adminEmail} / ${adminPassword}`,
);
await orm.close(true);
