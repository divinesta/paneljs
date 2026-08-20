import { hashAdminPassword } from "paneljs";
import { dataSource } from "./data-source.js";

const tenants = [
  { id: "northwind", name: "Northwind" },
  { id: "contoso", name: "Contoso" },
];

await dataSource.initialize();

const posts = dataSource.getRepository("Post");
const users = dataSource.getRepository("User");
const tenantRepo = dataSource.getRepository("Tenant");
const authSessions = dataSource.getRepository("ExpressAdminSession");
const authUsers = dataSource.getRepository("ExpressAdminUser");

await posts.createQueryBuilder().delete().execute();
await users.createQueryBuilder().delete().execute();
await tenantRepo.createQueryBuilder().delete().execute();
await authSessions.createQueryBuilder().delete().execute();
await authUsers.createQueryBuilder().delete().execute();

await tenantRepo.save(tenants);

const ada = await users.save({
  email: "ada@northwind.test",
  fullName: "Ada Lovelace",
  role: "ADMIN",
  isActive: true,
  tenantId: "northwind",
});
const grace = await users.save({
  email: "grace@contoso.test",
  fullName: "Grace Hopper",
  role: "ADMIN",
  isActive: true,
  tenantId: "contoso",
});

await posts.save([
  {
    title: "Notes on the Analytical Engine",
    content: "What the machine might do.",
    published: true,
    authorId: ada.id,
    tenantId: "northwind",
  },
  {
    title: "Draft: punch cards",
    content: "Not ready yet.",
    published: false,
    authorId: ada.id,
    tenantId: "northwind",
  },
  {
    title: "COBOL remarks",
    content: "People should be able to write in English.",
    published: true,
    authorId: grace.id,
    tenantId: "contoso",
  },
]);

const adminEmail = process.env.PANELJS_ADMIN_EMAIL ?? "ada@example.test";
const adminPassword = process.env.PANELJS_ADMIN_PASSWORD ?? "changeme-now";
const passwordHash = await hashAdminPassword(adminPassword);

await authUsers.save([
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
  `[paneljs] TypeORM example seed complete. Sign in at /admin/login as ${adminEmail} / ${adminPassword}`,
);
await dataSource.destroy();
