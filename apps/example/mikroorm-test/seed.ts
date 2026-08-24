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

console.log("[paneljs] MikroORM example data seed complete.");
await orm.close(true);
