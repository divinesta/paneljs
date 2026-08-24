import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { DataAdapter } from "../adapter.js";
import { resolveAuthStore } from "../builtInAuth.js";
import { hashAdminPassword } from "../passwords.js";
import type { BuiltInAuthConfig } from "../types.js";
import { argument } from "./args.js";
import { color } from "./color.js";
import { confirm, hiddenQuestion, question } from "./prompt.js";

export interface PaneljsCliConfig {
  adapter: DataAdapter;
  auth: BuiltInAuthConfig;
}

export interface CreateSuperuserIo {
  loadConfig(configPath: string): Promise<PaneljsCliConfig>;
  question(label: string): Promise<string>;
  hiddenQuestion(label: string): Promise<string>;
  confirm(label: string, defaultValue: boolean): Promise<boolean>;
  log(message: string): void;
  warn(message: string): void;
}

const emailSchema = `enum ExpressAdminRole {
  ADMIN
  SUPER_ADMIN
}

model ExpressAdminUser {
  id           String           @id @default(cuid())
  email        String           @unique
  passwordHash String
  role         ExpressAdminRole @default(ADMIN)
  isActive     Boolean          @default(true)
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt
  sessions     ExpressAdminSession[]
}

model ExpressAdminSession {
  id        String           @id @default(cuid())
  tokenHash String           @unique
  userId    String
  user      ExpressAdminUser @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime         @default(now())

  @@index([userId])
  @@index([expiresAt])
}`;

const usernameSchema = emailSchema.replace(
  "email        String           @unique",
  "username     String           @unique",
);

export function authSchema(identifier: string): string {
  if (identifier !== "email" && identifier !== "username") {
    throw new Error(
      "auth:schema requires --identifier email or --identifier username",
    );
  }
  return identifier === "email" ? emailSchema : usernameSchema;
}

export const loadConfig = async (
  configPath: string,
): Promise<PaneljsCliConfig> => {
  const module = await import(pathToFileURL(resolve(configPath)).href);
  const config = module.default as PaneljsCliConfig | undefined;
  if (!config?.adapter || config.auth?.mode !== "built-in")
    throw new Error(
      'The config must default-export { adapter, auth: { mode: "built-in", ... } }.',
    );
  return config;
};

const defaultIo: CreateSuperuserIo = {
  loadConfig,
  question,
  hiddenQuestion,
  confirm,
  log: console.log,
  warn: console.warn,
};

export const createSuperuser = async (
  argv: string[],
  io: CreateSuperuserIo = defaultIo,
): Promise<void> => {
  const configPath = argument(argv, "--config");
  if (!configPath)
    throw new Error("createsuperuser requires --config ./paneljs.config.mjs");
  const config = await io.loadConfig(configPath);
  try {
    const store = resolveAuthStore(config.adapter, config.auth);
    const identifierName = config.auth.identifier;
    const identifier =
      argument(argv, `--${identifierName}`) ??
      (await io.question(
        `${identifierName === "email" ? "Email" : "Username"}: `,
      ));
    const suppliedPassword =
      argument(argv, "--password") ?? process.env.EXPRESS_ADMIN_PASSWORD;
    const password =
      suppliedPassword ?? (await io.hiddenQuestion("Password: "));
    if (!suppliedPassword) {
      const confirmation = await io.hiddenQuestion("Confirm password: ");
      if (password !== confirmation) throw new Error("Passwords do not match.");
    }
    if (!identifier || identifier.length > 254)
      throw new Error(`A valid ${identifierName} is required.`);
    if (!password) throw new Error("Password cannot be empty.");
    if (password.length < 12) {
      const warning =
        "This password is shorter than the recommended 12 characters. Continue anyway?";
      if (suppliedPassword) io.warn(`Warning: ${warning}`);
      else if (!(await io.confirm(warning, false)))
        throw new Error("Superuser creation cancelled.");
    }

    if (await store.findUserByIdentifier(identifier)) {
      throw new Error(
        `An administrator with ${identifierName} "${identifier}" already exists.`,
      );
    }
    await store.createUser({
      identifier,
      passwordHash: await hashAdminPassword(password),
      role: "SUPER_ADMIN",
      isActive: true,
    });
    io.log(
      `${color.title("Superuser created.")} Sign in at /admin/login with your ${identifierName}.`,
    );
  } finally {
    await config.adapter.dispose?.();
  }
};
