import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";

const exampleDirectory = resolve(process.cwd(), "apps/example/typeorm-test");
const requireFromExample = createRequire(
  resolve(exampleDirectory, "package.json"),
);
const tsxCli = requireFromExample.resolve("tsx/cli");
const port = 4174;

function configureRootlessPodman(): void {
  if (process.env.DOCKER_HOST || process.platform !== "linux") return;
  const userId = process.getuid?.();
  const socketPath =
    userId === undefined ? "" : `/run/user/${userId}/podman/podman.sock`;
  if (!socketPath || !existsSync(socketPath)) return;
  process.env.DOCKER_HOST = `unix://${socketPath}`;
  process.env.TESTCONTAINERS_RYUK_DISABLED ??= "true";
}

function run(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: exampleDirectory,
      env,
      stdio: "pipe",
    });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk));
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} ${args.join(" ")} failed:\n${output}`)),
    );
  });
}

async function waitForServer(url: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 302) return;
    } catch {
      // The process has not started listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("TypeORM E2E server did not start.");
}

export class TypeormBrowserEnvironment {
  private constructor(
    private readonly container: StartedPostgreSqlContainer,
    private readonly server: ReturnType<typeof spawn>,
  ) {}

  static async start(): Promise<TypeormBrowserEnvironment> {
    configureRootlessPodman();
    const container = await new PostgreSqlContainer("postgres:16-alpine")
      .withDatabase("paneljs_typeorm_e2e")
      .withUsername("paneljs")
      .withPassword("paneljs")
      .start();
    const env = {
      ...process.env,
      DATABASE_URL: container.getConnectionUri(),
      NODE_ENV: "test",
      PANELJS_SECURE_COOKIES: "false",
      PORT: String(port),
    };
    try {
      await run("pnpm", ["run", "e2e:seed"], env);
      const server = spawn(process.execPath, [tsxCli, "index.ts"], {
        cwd: exampleDirectory,
        env,
        stdio: process.env.PANELJS_E2E_DEBUG === "true" ? "inherit" : "pipe",
      });
      await waitForServer(`http://127.0.0.1:${port}/admin/login`);
      return new TypeormBrowserEnvironment(container, server);
    } catch (error) {
      await container.stop().catch(() => undefined);
      throw error;
    }
  }

  get baseUrl(): string {
    return `http://127.0.0.1:${port}/admin`;
  }

  async stop(): Promise<void> {
    this.server.kill("SIGTERM");
    await Promise.race([
      once(this.server, "exit"),
      new Promise((resolve) => setTimeout(resolve, 10_000)),
    ]);
    try {
      await this.container.stop();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isRootlessPodmanNetworkCleanupFailure =
        process.env.DOCKER_HOST?.includes("podman.sock") === true &&
        message.includes("rootless netns") &&
        message.includes("permission denied");
      if (!isRootlessPodmanNetworkCleanupFailure) throw error;
    }
  }
}
