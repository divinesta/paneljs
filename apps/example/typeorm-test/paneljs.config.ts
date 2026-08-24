import { typeormAdapter } from "@paneljs/typeorm";
import { dataSource } from "./data-source.js";

await dataSource.initialize();

export default {
  adapter: typeormAdapter({ dataSource }),
  auth: {
    mode: "built-in" as const,
    identifier: "email" as const,
    secureCookies: false,
  },
};
