import { PrismaPg } from "@prisma/adapter-pg";
import { hashAdminPassword } from "paneljs";

import { PrismaClient } from "./generated/prisma/client";

import "./seed.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error("DATABASE_URL is required to seed E2E users.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

try {
  const passwordHash = await hashAdminPassword("phase10-super-secret");
  await prisma.expressAdminUser.upsert({
    where: { email: "e2e-super@paneljs.test" },
    create: {
      email: "e2e-super@paneljs.test",
      passwordHash,
      role: "SUPER_ADMIN",
      isActive: true,
    },
    update: { passwordHash, role: "SUPER_ADMIN", isActive: true },
  });

  const adminPasswordHash = await hashAdminPassword("phase10-admin-secret");
  await prisma.expressAdminUser.upsert({
    where: { email: "e2e-admin@paneljs.test" },
    create: {
      email: "e2e-admin@paneljs.test",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      isActive: true,
      tenantId: "example-tenant-northwind",
    },
    update: {
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      isActive: true,
      tenantId: "example-tenant-northwind",
    },
  });
} finally {
  await prisma.$disconnect();
}
