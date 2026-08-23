import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { hashAdminPassword } from "../passwords.js";
import type { BuiltInAuthConfig } from "../types.js";
import { argument } from "./args.js";
import { color } from "./color.js";
import { confirm, hiddenQuestion, question } from "./prompt.js";

export interface PaneljsCliConfig {
  prisma: object;
  auth: BuiltInAuthConfig;
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

const modelKey = (modelName: string) =>
  modelName.charAt(0).toLowerCase() + modelName.slice(1);

const loadConfig = async (configPath: string): Promise<PaneljsCliConfig> => {
  const module = await import(pathToFileURL(resolve(configPath)).href);
  const config = module.default as PaneljsCliConfig | undefined;
  if (!config?.prisma || config.auth?.mode !== "built-in")
    throw new Error(
      'The config must default-export { prisma, auth: { mode: "built-in", ... } }. TypeORM apps should insert the first operator with hashAdminPassword instead.',
    );
  return config;
};

export const createSuperuser = async (argv: string[]): Promise<void> => {
  const configPath = argument(argv, "--config");
  if (!configPath)
    throw new Error("createsuperuser requires --config ./paneljs.config.mjs");
  const config = await loadConfig(configPath);
  try {
    const identifierName = config.auth.identifier;
    const identifier =
      argument(argv, `--${identifierName}`) ??
      (await question(
        `${identifierName === "email" ? "Email" : "Username"}: `,
      ));
    const suppliedPassword =
      argument(argv, "--password") ?? process.env.EXPRESS_ADMIN_PASSWORD;
    const password = suppliedPassword ?? (await hiddenQuestion("Password: "));
    if (!suppliedPassword) {
      const confirmation = await hiddenQuestion("Confirm password: ");
      if (password !== confirmation) throw new Error("Passwords do not match.");
    }
    if (!identifier || identifier.length > 254)
      throw new Error(`A valid ${identifierName} is required.`);
    if (!password) throw new Error("Password cannot be empty.");
    if (password.length < 12) {
      const warning =
        "This password is shorter than the recommended 12 characters. Continue anyway?";
      if (suppliedPassword) console.warn(`Warning: ${warning}`);
      else if (!(await confirm(warning, false)))
        throw new Error("Superuser creation cancelled.");
    }

    const delegate = (config.prisma as Record<string, unknown>)[
      modelKey(config.auth.userModel ?? "ExpressAdminUser")
    ] as { create(args: unknown): Promise<unknown> } | undefined;
    if (!delegate)
      throw new Error(
        `Prisma client has no delegate for ${config.auth.userModel ?? "ExpressAdminUser"}. Generate your Prisma client after adding the auth schema.`,
      );
    await delegate.create({
      data: {
        [identifierName]: identifier,
        passwordHash: await hashAdminPassword(password),
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });
    console.log(
      `${color.title("Superuser created.")} Sign in at /admin/login with your ${identifierName}.`,
    );
  } finally {
    const disconnect = (config.prisma as { $disconnect?: () => Promise<void> })
      .$disconnect;
    if (disconnect) await disconnect.call(config.prisma);
  }
};
