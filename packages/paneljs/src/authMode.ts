import type { AuthConfig, BuiltInAuthConfig } from "./types.js";

export const isBuiltInAuth = (auth: AuthConfig): auth is BuiltInAuthConfig =>
  auth.mode === "built-in";
