#!/usr/bin/env node
import { stdin, stdout } from "node:process";

import { argument } from "./cli/args.js";
import { authSchema, createSuperuser } from "./cli/auth.js";
import { color } from "./cli/color.js";
import { createDefaultInstall, runInit } from "./cli/init.js";
import { confirm, select } from "./cli/prompt.js";

const usage = (): void => {
  console.log(`${color.title("paneljs")}

${color.bold("Usage")}
  ${color.cyan("paneljs init")} [--framework express] [--orm prisma|typeorm] [--pm npm|pnpm|yarn|bun] [--yes] [--dry-run]
  ${color.cyan("paneljs auth:schema")} --identifier <email|username>
  ${color.cyan("paneljs createsuperuser")} --config ./paneljs.config.mjs [--email value] [--username value] [--password value]

${color.dim("init adds PanelJS packages to the current app. It does not rewrite source files.")}
${color.dim("auth:schema prints Prisma models. createsuperuser works with every PanelJS ORM adapter.")}

${color.dim("The createsuperuser config module must default-export { adapter, auth }, where auth is a built-in auth configuration.")}`);
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
  const message = error instanceof Error ? error.message : "Command failed.";
  console.error(`${color.red("Error")} ${message}`);
  process.exitCode = 1;
}
