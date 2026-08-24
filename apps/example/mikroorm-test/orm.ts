import { MikroORM } from "@mikro-orm/postgresql";
import { entities } from "./entities.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to start the MikroORM example.");
}

export const orm = await MikroORM.init({
  clientUrl: databaseUrl,
  entities,
  allowGlobalContext: true,
});
