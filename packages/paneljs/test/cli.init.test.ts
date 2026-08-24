import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  parseInitArgs,
  resolveInitPlan,
  runInit,
  type InitIo,
} from "../src/cli/init.js";
import {
  detectPackageManager,
  incompatiblePeer,
  installArgs,
  peersFor,
  planInstall,
} from "../src/cli/project.js";
import {
  PACKAGE_INSTALL_SPEC,
  docsUrl,
  paneljsPackages,
  parseFramework,
  parseOrm,
  resolveFramework,
  resolveOrm,
  setupSnippet,
} from "../src/cli/stack.js";
import { authSchema } from "../src/cli/auth.js";

const prismaManifest = {
  dependencies: {
    express: "^5.0.0",
    "@prisma/client": "~7.5.0",
  },
  devDependencies: {
    prisma: "~7.5.0",
  },
};

describe("init stack", () => {
  it("maps Express + Prisma to the published packages", () => {
    expect(paneljsPackages("express", "prisma")).toEqual([
      "paneljs",
      "@paneljs/express",
      "@paneljs/prisma",
    ]);
  });

  it("maps Express + TypeORM to the published packages", () => {
    expect(paneljsPackages("express", "typeorm")).toEqual([
      "paneljs",
      "@paneljs/express",
      "@paneljs/typeorm",
    ]);
  });

  it("maps Express + MikroORM to the published packages", () => {
    expect(paneljsPackages("express", "mikroorm")).toEqual([
      "paneljs",
      "@paneljs/express",
      "@paneljs/mikroorm",
    ]);
  });

  it("refuses coming-soon frameworks and ORMs", () => {
    expect(() => resolveFramework("fastify")).toThrow(/coming soon/);
    expect(() => resolveFramework("nestjs")).toThrow(/coming soon/);
    expect(() => resolveOrm("drizzle")).toThrow(/coming soon/);
    expect(parseFramework("nest.js")).toBe("nestjs");
    expect(parseOrm("typeorm")).toBe("typeorm");
    expect(parseOrm("mikro-orm")).toBe("mikroorm");
  });

  it("prints an ORM-specific setup snippet", () => {
    const prisma = setupSnippet("express", "prisma");
    const typeorm = setupSnippet("express", "typeorm");
    const mikroorm = setupSnippet("express", "mikroorm");
    expect(prisma).toContain("prismaAdapter");
    expect(prisma).not.toContain("typeormAdapter");
    expect(prisma).not.toContain("mikroormAdapter");
    expect(typeorm).toContain("typeormAdapter");
    expect(typeorm).toContain("dataSource.initialize()");
    expect(typeorm).not.toContain("prismaAdapter");
    expect(typeorm).not.toContain("mikroormAdapter");
    expect(mikroorm).toContain("mikroormAdapter");
    expect(mikroorm).toContain('from "./orm.js"');
    expect(mikroorm).not.toContain("prismaAdapter");
    expect(mikroorm).not.toContain("typeormAdapter");
    expect(docsUrl("express", "typeorm")).toContain(
      "/guide/installation/express/typeorm",
    );
    expect(docsUrl("express", "mikroorm")).toContain(
      "/guide/installation/express/mikroorm",
    );
  });
});

describe("init flags", () => {
  it("parses long flags and --yes", () => {
    expect(
      parseInitArgs([
        "--framework",
        "express",
        "--orm=typeorm",
        "--pm",
        "pnpm",
        "-y",
        "--dry-run",
      ]),
    ).toEqual({
      framework: "express",
      orm: "typeorm",
      pm: "pnpm",
      yes: true,
      dryRun: true,
      help: false,
    });
  });

  it("rejects unknown flags", () => {
    expect(() => parseInitArgs(["--write"])).toThrow(/Unknown init flag/);
  });
});

describe("package manager and peers", () => {
  it("prefers an explicit override, then the user agent, then the lockfile", () => {
    const cwd = mkdtempSync(join(tmpdir(), "paneljs-init-"));
    writeFileSync(join(cwd, "pnpm-lock.yaml"), "");
    expect(
      detectPackageManager(
        cwd,
        {},
        { npm_config_user_agent: "yarn/1.22.0" },
        "bun",
      ),
    ).toBe("bun");
    expect(
      detectPackageManager(cwd, {}, { npm_config_user_agent: "yarn/1.22.0" }),
    ).toBe("yarn");
    expect(detectPackageManager(cwd, {}, {})).toBe("pnpm");
  });

  it("flags incompatible Prisma, TypeORM, and MikroORM versions", () => {
    expect(incompatiblePeer("prisma", "^6.16.0")).toMatch(/7\.5/);
    expect(incompatiblePeer("@prisma/client", "8.0.0")).toMatch(/7\.5/);
    expect(incompatiblePeer("typeorm", "^0.2.45")).toMatch(/0\.3\.20/);
    expect(incompatiblePeer("@mikro-orm/core", "^5.9.0")).toMatch(/\^6\.4/);
    expect(incompatiblePeer("@mikro-orm/core", "^7.0.0")).toMatch(/\^6\.4/);
    expect(incompatiblePeer("express", "^3.0.0")).toMatch(/4\.18/);
    expect(incompatiblePeer("prisma", "~7.5.2")).toBeUndefined();
    expect(incompatiblePeer("typeorm", "^0.3.20")).toBeUndefined();
    expect(incompatiblePeer("@mikro-orm/core", "^6.4.0")).toBeUndefined();
    expect(incompatiblePeer("@mikro-orm/core", "^6.6.0")).toBeUndefined();
    expect(incompatiblePeer("express", "^5.0.0")).toBeUndefined();
  });

  it("plans only missing packages and pins Prisma peers", () => {
    const plan = planInstall(
      { dependencies: { express: "^5.0.0" } },
      paneljsPackages("express", "prisma"),
      [
        { name: "express", installAs: "dep" },
        { name: "@prisma/client", installAs: "dep", spec: "~7.5.0" },
        { name: "prisma", installAs: "dev", spec: "~7.5.0" },
      ],
      PACKAGE_INSTALL_SPEC,
    );
    expect(plan.alreadyPresent).toEqual(["express"]);
    expect(plan.dependencies).toEqual([
      "paneljs@^0.3.3",
      "@paneljs/express@^0.3.1",
      "@paneljs/prisma@^0.3.3",
      "@prisma/client@~7.5.0",
    ]);
    expect(plan.devDependencies).toEqual(["prisma@~7.5.0"]);
    expect(plan.incompatible).toEqual([]);
  });

  it("skips PanelJS packages that are already listed", () => {
    const plan = planInstall(
      {
        ...prismaManifest,
        dependencies: {
          ...prismaManifest.dependencies,
          paneljs: "0.3.0",
          "@paneljs/express": "0.3.0",
          "@paneljs/prisma": "0.3.0",
        },
      },
      paneljsPackages("express", "prisma"),
      [
        { name: "express", installAs: "dep" },
        { name: "@prisma/client", installAs: "dep", spec: "~7.5.0" },
        { name: "prisma", installAs: "dev", spec: "~7.5.0" },
      ],
    );
    expect(plan.dependencies).toEqual([]);
    expect(plan.devDependencies).toEqual([]);
    expect(plan.alreadyPresent).toEqual(
      expect.arrayContaining(["paneljs", "express", "prisma"]),
    );
  });

  it("plans the MikroORM adapter and v6 core peer", () => {
    const plan = planInstall(
      { dependencies: { express: "^5.0.0" } },
      paneljsPackages("express", "mikroorm"),
      peersFor("mikroorm"),
      PACKAGE_INSTALL_SPEC,
    );
    expect(plan.dependencies).toEqual([
      "paneljs@^0.3.3",
      "@paneljs/express@^0.3.1",
      "@paneljs/mikroorm@^0.1.0",
      "@mikro-orm/core@^6.4.0",
    ]);
    expect(plan.devDependencies).toEqual([]);
    expect(plan.incompatible).toEqual([]);
  });

  it("builds package-manager argv without a shell string", () => {
    expect(installArgs("pnpm", ["paneljs"], false)).toEqual(["add", "paneljs"]);
    expect(installArgs("npm", ["prisma@~7.5.0"], true)).toEqual([
      "install",
      "--no-workspaces",
      "-D",
      "prisma@~7.5.0",
    ]);
    expect(installArgs("bun", ["typeorm"], true)).toEqual([
      "add",
      "-d",
      "typeorm",
    ]);
  });
});

describe("runInit", () => {
  const io = (
    install = vi.fn(async () => {}),
  ): InitIo & {
    install: ReturnType<typeof vi.fn>;
    output: string;
  } => {
    let output = "";
    return {
      stdout: {
        write(chunk: string) {
          output += chunk;
        },
      },
      isTTY: false,
      env: {},
      select: async () => {
        throw new Error("select should not run");
      },
      confirm: async () => {
        throw new Error("confirm should not run");
      },
      install,
      get output() {
        return output;
      },
    };
  };

  it("requires package.json", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "paneljs-init-"));
    await expect(
      runInit({
        cwd,
        argv: ["--framework", "express", "--orm", "prisma", "--yes"],
        io: io(),
      }),
    ).rejects.toThrow(/No package.json/);
  });

  it("refuses a coming-soon stack without installing", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "paneljs-init-"));
    writeFileSync(
      join(cwd, "package.json"),
      JSON.stringify({ name: "app", dependencies: { express: "^5.0.0" } }),
    );
    const fake = io();
    await expect(
      runInit({
        cwd,
        argv: ["--framework", "fastify", "--orm", "prisma", "--yes"],
        io: fake,
      }),
    ).rejects.toThrow(/coming soon/);
    expect(fake.install).not.toHaveBeenCalled();
  });

  it("refuses an incompatible Prisma version", () => {
    expect(() =>
      resolveInitPlan(
        "/tmp",
        {},
        { dependencies: { express: "^5.0.0", prisma: "^6.0.0" } },
        {},
        "express",
        "prisma",
      ),
    ).toThrow(/7\.5/);
  });

  it("dry-run prints the snippet and does not install", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "paneljs-init-"));
    writeFileSync(
      join(cwd, "package.json"),
      JSON.stringify({
        name: "app",
        dependencies: prismaManifest.dependencies,
        devDependencies: prismaManifest.devDependencies,
      }),
    );
    const fake = io();
    await runInit({
      cwd,
      argv: ["--framework", "express", "--orm", "prisma", "--yes", "--dry-run"],
      io: fake,
    });
    expect(fake.install).not.toHaveBeenCalled();
    expect(fake.output).toMatch(/Dry run/);
    expect(fake.output).toMatch(/prismaAdapter/);
    expect(fake.output).toMatch(/No source files will be changed/);
  });

  it("installs missing PanelJS packages with --yes", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "paneljs-init-"));
    writeFileSync(
      join(cwd, "package.json"),
      JSON.stringify({
        name: "app",
        dependencies: {
          express: "^5.0.0",
          typeorm: "^0.3.20",
        },
      }),
    );
    const fake = io();
    await runInit({
      cwd,
      argv: ["--framework", "express", "--orm", "typeorm", "--yes"],
      io: fake,
    });
    expect(fake.install).toHaveBeenCalledTimes(1);
    expect(fake.install.mock.calls[0][2]).toEqual([
      "paneljs@^0.3.3",
      "@paneljs/express@^0.3.1",
      "@paneljs/typeorm@^0.1.7",
    ]);
    expect(fake.install.mock.calls[0][3]).toEqual([]);
    expect(fake.output).toMatch(/typeormAdapter/);
    expect(fake.output).not.toMatch(/prismaAdapter/);
  });

  it("installs MikroORM packages and prints its snippet", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "paneljs-init-"));
    writeFileSync(
      join(cwd, "package.json"),
      JSON.stringify({
        name: "app",
        dependencies: { express: "^5.0.0" },
      }),
    );
    const fake = io();
    await runInit({
      cwd,
      argv: ["--framework", "express", "--orm", "mikroorm", "--yes"],
      io: fake,
    });
    expect(fake.install).toHaveBeenCalledTimes(1);
    expect(fake.install.mock.calls[0][2]).toEqual([
      "paneljs@^0.3.3",
      "@paneljs/express@^0.3.1",
      "@paneljs/mikroorm@^0.1.0",
      "@mikro-orm/core@^6.4.0",
    ]);
    expect(fake.install.mock.calls[0][3]).toEqual([]);
    expect(fake.output).toMatch(/mikroormAdapter/);
    expect(fake.output).toMatch(/installation\/express\/mikroorm/);
    expect(fake.output).not.toMatch(/prismaAdapter|typeormAdapter/);
  });

  it("does not spawn when every package is already listed", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "paneljs-init-"));
    writeFileSync(
      join(cwd, "package.json"),
      JSON.stringify({
        name: "app",
        dependencies: {
          express: "^5.0.0",
          typeorm: "^0.3.20",
          paneljs: "0.3.1",
          "@paneljs/express": "0.3.0",
          "@paneljs/typeorm": "0.1.5",
        },
      }),
    );
    const fake = io();
    await runInit({
      cwd,
      argv: ["--framework", "express", "--orm", "typeorm", "--yes"],
      io: fake,
    });
    expect(fake.install).not.toHaveBeenCalled();
    expect(fake.output).toMatch(/already listed/);
  });
});

describe("auth:schema", () => {
  it("prints email or username Prisma models", () => {
    expect(authSchema("email")).toContain(
      "email        String           @unique",
    );
    expect(authSchema("username")).toContain(
      "username     String           @unique",
    );
    expect(() => authSchema("phone")).toThrow(/--identifier/);
  });
});
