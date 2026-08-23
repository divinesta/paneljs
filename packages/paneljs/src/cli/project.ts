import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { OrmId, PackageManager } from "./stack.js";

export interface PackageManifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  packageManager?: string;
}

export interface PeerNeed {
  name: string;
  installAs: "dep" | "dev";
  spec?: string;
}

const PRISMA_PEERS: PeerNeed[] = [
  { name: "express", installAs: "dep" },
  { name: "@prisma/client", installAs: "dep", spec: "~7.5.0" },
  { name: "prisma", installAs: "dev", spec: "~7.5.0" },
];

const TYPEORM_PEERS: PeerNeed[] = [
  { name: "express", installAs: "dep" },
  { name: "typeorm", installAs: "dep", spec: "^0.3.20" },
];

export function readManifest(cwd: string): PackageManifest {
  const path = join(cwd, "package.json");
  if (!existsSync(path)) {
    throw new Error(
      "No package.json in this directory. Run paneljs init inside your app.",
    );
  }
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PackageManifest;
  } catch {
    throw new Error(`Could not parse ${path}.`);
  }
}

export function declaredSpec(
  manifest: PackageManifest,
  name: string,
): string | undefined {
  return (
    manifest.dependencies?.[name] ??
    manifest.devDependencies?.[name] ??
    manifest.optionalDependencies?.[name]
  );
}

export function detectPackageManager(
  cwd: string,
  manifest: PackageManifest,
  env: NodeJS.ProcessEnv,
  override?: string,
): PackageManager {
  if (override) {
    const allowed: PackageManager[] = ["npm", "pnpm", "yarn", "bun"];
    if (!allowed.includes(override as PackageManager)) {
      throw new Error(
        `Unknown package manager "${override}". Use npm, pnpm, yarn, or bun.`,
      );
    }
    return override as PackageManager;
  }

  const fromAgent = packageManagerFromUserAgent(env.npm_config_user_agent);
  if (fromAgent) return fromAgent;

  const field = manifest.packageManager?.split("@")[0];
  if (field === "npm" || field === "pnpm" || field === "yarn" || field === "bun") {
    return field;
  }

  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  if (existsSync(join(cwd, "bun.lock")) || existsSync(join(cwd, "bun.lockb")))
    return "bun";
  if (existsSync(join(cwd, "package-lock.json"))) return "npm";
  return "npm";
}

export function packageManagerFromUserAgent(
  userAgent: string | undefined,
): PackageManager | undefined {
  if (!userAgent) return undefined;
  const name = userAgent.split("/")[0];
  if (name === "npm" || name === "pnpm" || name === "yarn" || name === "bun") {
    return name;
  }
  return undefined;
}

export function peersFor(orm: OrmId): PeerNeed[] {
  if (orm === "prisma") return PRISMA_PEERS;
  if (orm === "typeorm") return TYPEORM_PEERS;
  return [{ name: "express", installAs: "dep" }];
}

export function incompatiblePeer(
  name: string,
  spec: string,
): string | undefined {
  if (
    spec.startsWith("workspace:") ||
    spec.startsWith("catalog:") ||
    spec === "*" ||
    spec === "latest"
  ) {
    return undefined;
  }
  const version = parseLeadingVersion(spec);
  if (!version) return undefined;

  if (name === "prisma" || name === "@prisma/client") {
    if (version.major !== 7 || version.minor !== 5) {
      return `${name}@${spec} is not Prisma 7.5.x. @paneljs/prisma requires ~7.5.0.`;
    }
    return undefined;
  }
  if (name === "typeorm") {
    if (
      version.major !== 0 ||
      version.minor < 3 ||
      (version.minor === 3 && version.patch < 20)
    ) {
      return `${name}@${spec} is below ^0.3.20.`;
    }
    return undefined;
  }
  if (name === "express") {
    if (version.major < 4 || (version.major === 4 && version.minor < 18)) {
      return `${name}@${spec} is below ^4.18 or ^5.`;
    }
    return undefined;
  }
  return undefined;
}

export function parseLeadingVersion(
  spec: string,
): { major: number; minor: number; patch: number } | undefined {
  const match = spec
    .replace(/^[~^>=<\s]+/, "")
    .match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return undefined;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3] ?? 0),
  };
}

export interface InstallPlan {
  dependencies: string[];
  devDependencies: string[];
  alreadyPresent: string[];
  incompatible: string[];
}

export function planInstall(
  manifest: PackageManifest,
  panelPackages: string[],
  peers: PeerNeed[],
  specs: Record<string, string> = {},
): InstallPlan {
  const incompatible: string[] = [];
  const alreadyPresent: string[] = [];
  const dependencies: string[] = [];
  const devDependencies: string[] = [];

  const consider = (name: string, installAs: "dep" | "dev", spec?: string) => {
    const declared = declaredSpec(manifest, name);
    if (declared) {
      const problem = incompatiblePeer(name, declared);
      if (problem) incompatible.push(problem);
      else alreadyPresent.push(name);
      return;
    }
    const token = spec ? `${name}@${spec}` : name;
    if (installAs === "dev") devDependencies.push(token);
    else dependencies.push(token);
  };

  for (const name of panelPackages) consider(name, "dep", specs[name]);
  for (const peer of peers) consider(peer.name, peer.installAs, peer.spec);

  return { dependencies, devDependencies, alreadyPresent, incompatible };
}

export function installArgs(
  pm: PackageManager,
  packages: string[],
  dev: boolean,
): string[] {
  if (packages.length === 0) return [];
  if (pm === "npm")
    return [
      "install",
      "--no-workspaces",
      ...(dev ? ["-D"] : []),
      ...packages,
    ];
  if (pm === "bun") return ["add", ...(dev ? ["-d"] : []), ...packages];
  return ["add", ...(dev ? ["-D"] : []), ...packages];
}
