#!/usr/bin/env node
import { stdin, stdout } from "node:process";

import { argument } from "./cli/args.js";
import { authSchema, createSuperuser } from "./cli/auth.js";
import { createDefaultInstall, runInit } from "./cli/init.js";
import { confirm, select } from "./cli/prompt.js";

const usage = (): void => {
  console.log(`Usage:
  paneljs init [--framework express] [--orm prisma|typeorm] [--pm npm|pnpm|yarn|bun] [--yes] [--dry-run]
  paneljs auth:schema --identifier <email|username>
  paneljs createsuperuser --config ./paneljs.config.mjs [--email value] [--username value] [--password value]

init adds PanelJS packages to the current app. It does not rewrite source files.
auth:schema and createsuperuser are Prisma setup tools. TypeORM uses builtInAuthEntities() instead.

The createsuperuser config module must default-export { prisma, auth }, where auth is a built-in auth configuration.`);
};

const command = process.argv[2];
const argv = process.argv.slice(2);

try {
  if (command === "init") {
    await runInit({
      cwd: process.cwd(),
      argv: process.argv.slice(3),
      io: {
        stdout,
        isTTY: Boolean(stdin.isTTY),
        env: process.env,
        select,
        confirm: (label) => confirm(label, true),
        install: createDefaultInstall(),
      },
    });
  } else if (command === "auth:schema") {
    console.log(authSchema(argument(argv, "--identifier") ?? ""));
  } else if (command === "createsuperuser") {
    await createSuperuser(argv);
  } else if (command === "--help" || command === "-h") {
    usage();
  } else {
    usage();
    process.exitCode = command ? 1 : 0;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Command failed.");
  process.exitCode = 1;
}
