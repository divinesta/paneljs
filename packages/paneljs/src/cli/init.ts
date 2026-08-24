import { spawn } from "node:child_process";

import { argument, hasFlag } from "./args.js";
import {
  detectPackageManager,
  installArgs,
  peersFor,
  planInstall,
  readManifest,
  type InstallPlan,
  type PackageManifest,
} from "./project.js";
import { color } from "./color.js";
import type { SelectItem } from "./prompt.js";
import {
  docsUrl,
  FRAMEWORKS,
  ORMS,
  PACKAGE_INSTALL_SPEC,
  paneljsPackages,
  parseFramework,
  parseOrm,
  resolveFramework,
  resolveOrm,
  setupSnippet,
  type FrameworkId,
  type OrmId,
  type PackageManager,
} from "./stack.js";

export interface InitFlags {
  framework?: string;
  orm?: string;
  pm?: string;
  yes?: boolean;
  dryRun?: boolean;
  help?: boolean;
}

export interface InitIo {
  stdout: { write(chunk: string): void };
  isTTY: boolean;
  env: NodeJS.ProcessEnv;
  select(label: string, items: SelectItem[]): Promise<string>;
  confirm(label: string): Promise<boolean>;
  install(
    pm: PackageManager,
    cwd: string,
    dependencies: string[],
    devDependencies: string[],
  ): Promise<void>;
}

export function parseInitArgs(argv: string[]): InitFlags {
  const unknown = argv.filter(
    (item) =>
      item.startsWith("-") &&
      item !== "--framework" &&
      item !== "--orm" &&
      item !== "--pm" &&
      item !== "--yes" &&
      item !== "-y" &&
      item !== "--dry-run" &&
      item !== "--help" &&
      item !== "-h" &&
      !item.startsWith("--framework=") &&
      !item.startsWith("--orm=") &&
      !item.startsWith("--pm="),
  );
  if (unknown.length > 0) {
    throw new Error(`Unknown init flag: ${unknown[0]}`);
  }
  return {
    framework: argument(argv, "--framework"),
    orm: argument(argv, "--orm"),
    pm: argument(argv, "--pm"),
    yes: hasFlag(argv, "--yes") || hasFlag(argv, "-y"),
    dryRun: hasFlag(argv, "--dry-run"),
    help: hasFlag(argv, "--help") || hasFlag(argv, "-h"),
  };
}

export const INIT_USAGE = `Usage:
  paneljs init [--framework express] [--orm prisma|typeorm] [--pm npm|pnpm|yarn|bun] [--yes] [--dry-run]

Adds PanelJS packages to the app in this directory. Does not rewrite source files.
Fastify, Nest.js, and Drizzle are listed in the prompt but are not selectable yet.`;

export interface ResolvedInit {
  framework: FrameworkId;
  orm: OrmId;
  pm: PackageManager;
  plan: InstallPlan;
  packages: string[];
}

export function resolveInitPlan(
  cwd: string,
  flags: InitFlags,
  manifest: PackageManifest,
  env: NodeJS.ProcessEnv,
  framework: FrameworkId,
  orm: OrmId,
): ResolvedInit {
  const frameworkChoice = resolveFramework(framework);
  const ormChoice = resolveOrm(orm);
  const packages = paneljsPackages(frameworkChoice.id, ormChoice.id);
  const plan = planInstall(
    manifest,
    packages,
    peersFor(ormChoice.id),
    PACKAGE_INSTALL_SPEC,
  );
  if (plan.incompatible.length > 0) {
    throw new Error(plan.incompatible.join("\n"));
  }
  const pm = detectPackageManager(cwd, manifest, env, flags.pm);
  return {
    framework: frameworkChoice.id,
    orm: ormChoice.id,
    pm,
    plan,
    packages,
  };
}

export async function runInit(input: {
  cwd: string;
  argv: string[];
  io: InitIo;
}): Promise<void> {
  const flags = parseInitArgs(input.argv);
  if (flags.help === true) {
    input.io.stdout.write(`${INIT_USAGE}\n`);
    return;
  }

  const manifest = readManifest(input.cwd);
  const framework = await pick(
    "Which Node framework are you using?",
    flags.framework,
    FRAMEWORKS.map((item) => ({
      value: item.id,
      label: item.label,
      disabled: !item.available,
    })),
    flags,
    input.io,
    (value) => parseFramework(value),
  );
  const orm = await pick(
    "Which ORM are you using?",
    flags.orm,
    ORMS.map((item) => ({
      value: item.id,
      label: item.label,
      disabled: !item.available,
    })),
    flags,
    input.io,
    (value) => parseOrm(value),
  );

  const resolved = resolveInitPlan(
    input.cwd,
    flags,
    manifest,
    input.io.env,
    framework,
    orm,
  );

  const { plan } = resolved;
  const adding = [...plan.dependencies, ...plan.devDependencies];
  input.io.stdout.write("\n");
  if (adding.length === 0) {
    input.io.stdout.write(
      `${color.accent("✔")} PanelJS packages for this stack are already listed.\n`,
    );
  } else {
    input.io.stdout.write(
      `${color.dim("Using")} ${color.bold(resolved.pm)}. ${color.bold("Will add:")}\n`,
    );
    for (const name of plan.dependencies)
      input.io.stdout.write(`  ${color.cyan(name)}\n`);
    for (const name of plan.devDependencies)
      input.io.stdout.write(`  ${color.cyan(name)} ${color.dim("(dev)")}\n`);
  }
  if (plan.alreadyPresent.length > 0) {
    input.io.stdout.write(
      `${color.dim("Already present:")} ${color.dim(plan.alreadyPresent.join(", "))}\n`,
    );
  }
  input.io.stdout.write(color.dim("No source files will be changed.\n"));

  if (flags.dryRun === true) {
    input.io.stdout.write(
      `\n${color.yellow("Dry run.")} ${color.dim("Nothing was installed.")}\n`,
    );
    writeSnippet(input.io, resolved.framework, resolved.orm);
    return;
  }

  if (adding.length > 0 && flags.yes !== true) {
    if (!input.io.isTTY) {
      throw new Error("Non-interactive install requires --yes.");
    }
    const ok = await input.io.confirm("Install these packages?");
    if (!ok) throw new Error("Init cancelled.");
  }

  if (adding.length > 0) {
    await input.io.install(
      resolved.pm,
      input.cwd,
      plan.dependencies,
      plan.devDependencies,
    );
  }

  input.io.stdout.write(
    `\n${color.title("Installed.")} Wire this into your existing server:\n\n`,
  );
  writeSnippet(input.io, resolved.framework, resolved.orm);
}

function writeSnippet(io: InitIo, framework: FrameworkId, orm: OrmId): void {
  io.stdout.write(`${setupSnippet(framework, orm)}\n\n`);
  io.stdout.write(
    `${color.bold("Docs")} ${color.link(docsUrl(framework, orm))}\n`,
  );
  io.stdout.write(
    `${color.bold("Auth")} ${color.link("https://www.paneljs.com/docs/guide/auth")}\n`,
  );
}

async function pick<T extends string>(
  label: string,
  flagged: string | undefined,
  items: SelectItem[],
  flags: InitFlags,
  io: InitIo,
  parse: (value: string) => T,
): Promise<T> {
  if (flagged) return parse(flagged);
  if (flags.yes === true || !io.isTTY) {
    throw new Error(
      `${label} Pass the matching flag with --yes, or run in a terminal.`,
    );
  }
  return parse(await io.select(label, items));
}

export function createDefaultInstall(): InitIo["install"] {
  return async (pm, cwd, dependencies, devDependencies) => {
    if (dependencies.length > 0)
      await runCommand(pm, installArgs(pm, dependencies, false), cwd);
    if (devDependencies.length > 0)
      await runCommand(pm, installArgs(pm, devDependencies, true), cwd);
  };
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(`${command} ${args.join(" ")} exited with code ${code}.`),
        );
    });
  });
}
