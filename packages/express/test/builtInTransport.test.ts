import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { createBuiltInHttpHarness } from "./httpHarness.js";

describe("Express built-in authentication transport", () => {
  let app: Awaited<ReturnType<typeof createBuiltInHttpHarness>>["app"];

  beforeAll(async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    ({ app } = await createBuiltInHttpHarness({ basePath: "/secure" }));
    log.mockRestore();
  });

  it("HTTP-023 redirects protected pages while leaving login available", async () => {
    await request(app)
      .get("/secure")
      .expect(302)
      .expect("location", "/secure/login");
    await request(app).get("/secure/login").expect(200);
  });

  it("HTTP-024/AUTH-018 exposes auth config and generic invalid credentials", async () => {
    const config = await request(app)
      .get("/secure/api/auth/config")
      .expect(200)
      .expect({ identifier: "email" });
    expect(config.headers["cache-control"]).toBe("private, no-store");
    await request(app)
      .post("/secure/api/auth/login")
      .send({ identifier: "missing@paneljs.test", password: "wrong" })
      .expect(401)
      .expect({ error: "Invalid credentials.", code: "INVALID_CREDENTIALS" });
    await request(app)
      .post("/secure/api/auth/login")
      .send({
        identifier: "built-in@paneljs.test",
        password: "wrong-password",
      })
      .expect(401)
      .expect({ error: "Invalid credentials.", code: "INVALID_CREDENTIALS" });
  });

  it("HTTP-024/AUTH-023/AUTH-026 logs in with a scoped cookie, authenticates, and logs out", async () => {
    const agent = request.agent(app);
    const login = await agent
      .post("/secure/api/auth/login")
      .send({
        identifier: "built-in@paneljs.test",
        password: "correct-password",
      })
      .expect(200)
      .expect({ ok: true });
    const cookie = login.headers["set-cookie"]?.[0] ?? "";
    expect(cookie).toContain("Path=/secure");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toMatch(/Max-Age=\d+/);
    expect(cookie).toContain("Expires=");

    await agent.get("/secure/api/schema").expect(200);
    const logout = await agent.post("/secure/api/auth/logout").expect(204);
    expect(logout.headers["set-cookie"]?.[0]).toContain("Max-Age=0");
    await agent.get("/secure/api/schema").expect(401);
  });

  it.each([
    {},
    { identifier: "x".repeat(255), password: "password" },
    {
      identifier: "built-in@paneljs.test",
      password: "x".repeat(1_025),
    },
  ])("AUTH-028 safely rejects bounded login input %#", async (body) => {
    await request(app)
      .post("/secure/api/auth/login")
      .send(body)
      .expect(401)
      .expect({ error: "Invalid credentials.", code: "INVALID_CREDENTIALS" });
  });

  it("HTTP-024 rejects cross-origin authentication mutations", async () => {
    await request(app)
      .post("/secure/api/auth/login")
      .set("origin", "https://evil.test")
      .send({
        identifier: "built-in@paneljs.test",
        password: "correct-password",
      })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe("ORIGIN_FORBIDDEN"));
    await request(app)
      .post("/secure/api/auth/logout")
      .set("origin", "https://evil.test")
      .expect(403);
  });

  it("AUTH-029 rate-limits repeated login attempts with Retry-After", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const limited = await createBuiltInHttpHarness({
      basePath: "/limited",
      rateLimit: { windowMs: 60_000, maxAttempts: 1 },
    });
    log.mockRestore();

    await request(limited.app)
      .post("/limited/api/auth/login")
      .send({ identifier: "missing@paneljs.test", password: "wrong" })
      .expect(401);
    const response = await request(limited.app)
      .post("/limited/api/auth/login")
      .send({ identifier: "missing@paneljs.test", password: "wrong" })
      .expect(429);
    expect(response.headers["retry-after"]).toBeDefined();
    expect(response.body.code).toBe("LOGIN_RATE_LIMITED");
  });

  it("AUTH-025 refuses an explicitly insecure production cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      await expect(
        createBuiltInHttpHarness({ secureCookies: false }),
      ).rejects.toThrow(
        "Built-in auth refuses secureCookies: false in production",
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
