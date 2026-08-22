import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { once } from "node:events";
import { resolve } from "node:path";

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";

const exampleDirectory = resolve(process.cwd(), "apps/example/prisma-test");
const port = 4173;

function configureRootlessPodman(): void {
  if (process.env.DOCKER_HOST || process.platform !== "linux") return;
  const userId = process.getuid?.();
  if (userId === undefined) return;

  const socketPath = `/run/user/${userId}/podman/podman.sock`;
  if (!existsSync(socketPath)) return;

  process.env.DOCKER_HOST = `unix://${socketPath}`;
  process.env.TESTCONTAINERS_RYUK_DISABLED ??= "true";
}

function run(
  command: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      cwd: exampleDirectory,
      env: environment,
      stdio: "pipe",
    });
    let output = "";
    process.stdout.on("data", (chunk: Buffer) => (output += chunk));
    process.stderr.on("data", (chunk: Buffer) => (output += chunk));
    process.once("error", reject);
    process.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed:\n${output}`));
    });
  });
}

async function waitForServer(url: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 302) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`PanelJS E2E server did not start: ${String(lastError)}`);
}

export class BrowserEnvironment {
  private constructor(
    private readonly container: StartedPostgreSqlContainer,
    private readonly server: ReturnType<typeof spawn>,
  ) {}

  static async start(): Promise<BrowserEnvironment> {
    configureRootlessPodman();
    const container = await new PostgreSqlContainer("postgres:16-alpine")
      .withDatabase("paneljs_e2e")
      .withUsername("paneljs")
      .withPassword("paneljs")
      .start();
    const environment = {
      ...process.env,
      DATABASE_URL: container.getConnectionUri(),
      NODE_ENV: "test",
      PANELJS_SECURE_COOKIES: "false",
      PORT: String(port),
    };

    try {
      await run("pnpm", ["run", "db:generate"], environment);
      await run("pnpm", ["run", "db:push"], environment);
      await run("pnpm", ["run", "e2e:seed"], environment);
      const server = spawn("pnpm", ["run", "start"], {
        cwd: exampleDirectory,
        env: environment,
        stdio: "pipe",
      });
      server.once("error", (error) => {
        throw error;
      });
      await waitForServer(`http://127.0.0.1:${port}/admin/login`);
      return new BrowserEnvironment(container, server);
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
