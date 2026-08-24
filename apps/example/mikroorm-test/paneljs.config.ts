import { mikroormAdapter } from "@paneljs/mikroorm";
import { orm } from "./orm.js";

export default {
  adapter: mikroormAdapter({ orm }),
  auth: {
    mode: "built-in" as const,
    identifier: "email" as const,
    secureCookies: false,
  },
};
