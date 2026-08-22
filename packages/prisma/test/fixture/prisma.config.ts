import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "schema.prisma",
  datasource: {
    // Client generation and schema validation do not connect to this fallback.
    // Integration setup replaces it with the Testcontainers database URL.
    url:
      process.env.DATABASE_URL ??
      "postgresql://paneljs:paneljs@127.0.0.1:5432/paneljs_contract",
  },
});
