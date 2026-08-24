import { hashAdminPassword } from "paneljs";
import { dataSource } from "./data-source.js";

import "./seed.js";

await dataSource.initialize();

try {
  const users = dataSource.getRepository("ExpressAdminUser");
  const passwordHash = await hashAdminPassword("admin123");
  const existing = await users.findOne({
    where: { email: "admin@example.com" },
  });

  await users.save({
    ...existing,
    email: "admin@example.com",
    passwordHash,
    role: "SUPER_ADMIN",
    isActive: true,
  });
} finally {
  await dataSource.destroy();
}
