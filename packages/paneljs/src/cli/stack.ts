export type FrameworkId = "express" | "fastify" | "nestjs";
export type OrmId = "prisma" | "typeorm" | "drizzle";
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export interface StackChoice<Id extends string> {
  id: Id;
  label: string;
  available: boolean;
}

export const FRAMEWORKS: StackChoice<FrameworkId>[] = [
  { id: "express", label: "Express", available: true },
  { id: "fastify", label: "Fastify", available: false },
  { id: "nestjs", label: "Nest.js", available: false },
];

export const ORMS: StackChoice<OrmId>[] = [
  { id: "prisma", label: "Prisma", available: true },
  { id: "typeorm", label: "TypeORM", available: true },
  { id: "drizzle", label: "Drizzle", available: false },
];

const FRAMEWORK_ALIASES: Record<string, FrameworkId> = {
  express: "express",
  fastify: "fastify",
  nest: "nestjs",
  nestjs: "nestjs",
  "nest.js": "nestjs",
};

const ORM_ALIASES: Record<string, OrmId> = {
  prisma: "prisma",
  typeorm: "typeorm",
  drizzle: "drizzle",
};

export function parseFramework(value: string): FrameworkId {
  const id = FRAMEWORK_ALIASES[value.trim().toLowerCase()];
  if (!id) {
    throw new Error(
      `Unknown framework "${value}". Use express (fastify and nest.js are coming soon).`,
    );
  }
  return id;
}

export function parseOrm(value: string): OrmId {
  const id = ORM_ALIASES[value.trim().toLowerCase()];
  if (!id) {
    throw new Error(
      `Unknown ORM "${value}". Use prisma or typeorm (drizzle is coming soon).`,
    );
  }
  return id;
}

export function assertAvailable(
  kind: "framework" | "ORM",
  choice: StackChoice<string>,
): void {
  if (choice.available) return;
  const instead =
    kind === "framework"
      ? "Express is the HTTP adapter that ships today."
      : "Prisma and TypeORM are the data adapters that ship today.";
  throw new Error(`${choice.label} is coming soon. ${instead}`);
}

export function resolveFramework(id: FrameworkId): StackChoice<FrameworkId> {
  const choice = FRAMEWORKS.find((item) => item.id === id);
  if (!choice) throw new Error(`Unknown framework "${id}".`);
  assertAvailable("framework", choice);
  return choice;
}

export function resolveOrm(id: OrmId): StackChoice<OrmId> {
  const choice = ORMS.find((item) => item.id === id);
  if (!choice) throw new Error(`Unknown ORM "${id}".`);
  assertAvailable("ORM", choice);
  return choice;
}

/** npm-safe ranges. Published adapters used to leak `workspace:^`, which npm cannot install. */
export const PACKAGE_INSTALL_SPEC: Record<string, string> = {
  paneljs: "^0.3.3",
  "@paneljs/express": "^0.3.1",
  "@paneljs/prisma": "^0.3.3",
  "@paneljs/typeorm": "^0.1.7",
};

export function paneljsPackages(framework: FrameworkId, orm: OrmId): string[] {
  resolveFramework(framework);
  resolveOrm(orm);
  const http =
    framework === "express" ? "@paneljs/express" : `@paneljs/${framework}`;
  const data = orm === "prisma" ? "@paneljs/prisma" : `@paneljs/${orm}`;
  return ["paneljs", http, data];
}

export function docsUrl(framework: FrameworkId, orm: OrmId): string {
  return `https://www.paneljs.com/docs/guide/installation/${framework}/${orm}`;
}

export function setupSnippet(framework: FrameworkId, orm: OrmId): string {
  resolveFramework(framework);
  resolveOrm(orm);
  if (orm === "prisma") {
    return `import express from "express";
import { createAdmin } from "paneljs";
import { prismaAdapter } from "@paneljs/prisma";
import { mount } from "@paneljs/express";
import { prisma } from "./prisma.js";

const app = express();

const admin = createAdmin({
  adapter: prismaAdapter({ prisma }),
  auth: {
    getCurrentUser: async (req) => {
      const user = await getOperatorFromYourAuth(req);
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        isSuperAdmin: user.role === "SUPER_ADMIN",
      };
    },
  },
});

admin.register("User");
await mount(app, admin);`;
  }

  return `import express from "express";
import { createAdmin } from "paneljs";
import { typeormAdapter } from "@paneljs/typeorm";
import { mount } from "@paneljs/express";
import { dataSource } from "./data-source.js";

await dataSource.initialize();

const app = express();

const admin = createAdmin({
  adapter: typeormAdapter({ dataSource }),
  auth: {
    getCurrentUser: async (req) => {
      const user = await getOperatorFromYourAuth(req);
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        isSuperAdmin: user.role === "SUPER_ADMIN",
      };
    },
  },
});

admin.register("User");
await mount(app, admin);`;
}
