import { DataSource } from "typeorm";
import { entities } from "./entities.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to start the TypeORM example.");
}

export const dataSource = new DataSource({
  type: "postgres",
  url: databaseUrl,
  entities,
  synchronize: true,
});
