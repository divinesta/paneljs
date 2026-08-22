import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { getAdminUiDist } from "paneljs";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createExternalHttpHarness,
  type TransportMemoryAdapter,
} from "./httpHarness.js";

describe("Express external-auth transport", () => {
  let app: Awaited<ReturnType<typeof createExternalHttpHarness>>["app"];
  let adapter: TransportMemoryAdapter;

  beforeAll(async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    ({ app, adapter } = await createExternalHttpHarness({
      siteName: "Transport Test",
    }));
    log.mockRestore();
  });

  beforeEach(() => adapter.reset());

  it("HTTP-001/HTTP-004/AUTH-003 returns the user-specific schema at the default path", async () => {
    const response = await request(app)
      .get("/admin/api/schema")
      .set("x-test-auth", "admin")
      .expect(200);

    expect(response.body).toMatchObject({
      siteName: "Transport Test",
      basePath: "/admin",
      authMode: "external",
      identity: { id: "transport-admin", role: "ADMIN" },
    });
    expect(response.body.models[0].meta.name).toBe("Post");
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
  });

  it.each([undefined, "malformed", "throw"])(
    "AUTH-004 through AUTH-006 rejects external auth value %s",
    async (authValue) => {
      const call = request(app).get("/admin/api/schema");
      if (authValue) call.set("x-test-auth", authValue);
      const response = await call.expect(401);
      expect(response.body).toEqual({
        error: "Authentication required",
        code: "AUTHENTICATION_REQUIRED",
      });
    },
  );

  it("HTTP-005 parses search, filters, and pagination into a list response", async () => {
    const response = await request(app)
      .get("/admin/api/posts?search=Second&published=false&page=1")
      .set("x-test-auth", "admin")
      .expect(200);

    expect(response.body).toMatchObject({
      total: 1,
      page: 1,
      perPage: 25,
      totalPages: 1,
    });
    expect(response.body.records).toEqual([
      { id: 2, title: "Second post", published: false },
    ]);
  });

  it("HTTP-006 through HTTP-009 preserves CRUD statuses and JSON", async () => {
    await request(app)
      .get("/admin/api/posts/1")
      .set("x-test-auth", "admin")
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ id: 1 }));

    const created = await request(app)
      .post("/admin/api/posts")
      .set("x-test-auth", "admin")
      .send({ title: "Created", published: false })
      .expect(201);
    expect(created.body).toMatchObject({
      id: 3,
      title: "Created",
      tenantId: "tenant-a",
    });

    await request(app)
      .put("/admin/api/posts/3")
      .set("x-test-auth", "admin")
      .send({ title: "Updated" })
      .expect(200)
      .expect(({ body }) => expect(body.title).toBe("Updated"));

    await request(app)
      .delete("/admin/api/posts/3")
      .set("x-test-auth", "admin")
      .expect(204)
      .expect("");
  });

  it("HTTP-010/HTTP-011 parses delete previews and action IDs", async () => {
    const preview = await request(app)
      .get("/admin/api/posts/actions/delete-preview?ids=1,2")
      .set("x-test-auth", "admin")
      .expect(200);
    expect(preview.body).toMatchObject({ relations: [] });
    expect(preview.body.records).toHaveLength(2);

    await request(app)
      .post("/admin/api/posts/actions/announce")
      .set("x-test-auth", "admin")
      .send({ ids: [1, 2] })
      .expect(200)
      .expect({ message: "Announced 2." });

    await request(app)
      .post("/admin/api/posts/actions/delete_selected")
      .set("x-test-auth", "admin")
      .send({ ids: [1, 2] })
      .expect(200)
      .expect({ message: "Deleted 2 records." });
  });

  it("HTTP-012 through HTTP-014 preserves safe model, ID, and validation errors", async () => {
    await request(app)
      .get("/admin/api/missing")
      .set("x-test-auth", "admin")
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe("MODEL_NOT_FOUND"));
    await request(app)
      .get("/admin/api/posts/not-a-number")
      .set("x-test-auth", "admin")
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe("VALIDATION_ERROR"));
    await request(app)
      .post("/admin/api/posts")
      .set("x-test-auth", "admin")
      .send({ title: "Invalid", published: false, unknown: true })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe("VALIDATION_ERROR"));
  });

  it("HTTP-015 hides unexpected internal error details", async () => {
    const errorLog = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const response = await request(app)
      .post("/admin/api/posts")
      .set("x-test-auth", "admin")
      .send({ title: "explode", published: false })
      .expect(500);
    errorLog.mockRestore();

    expect(response.body).toEqual({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
    expect(response.text).not.toContain("private adapter details");
  });

  it("HTTP-016 through HTTP-018 enforces same-origin mutations but permits reads", async () => {
    await request(app)
      .post("/admin/api/posts")
      .set("x-test-auth", "admin")
      .set("origin", "https://evil.test")
      .send({ title: "Blocked", published: false })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe("ORIGIN_FORBIDDEN"));

    await request(app)
      .post("/admin/api/posts")
      .set("host", "panel.test")
      .set("origin", "http://panel.test")
      .set("x-test-auth", "admin")
      .send({ title: "Allowed", published: false })
      .expect(201);

    await request(app)
      .get("/admin/api/posts")
      .set("x-test-auth", "admin")
      .set("origin", "https://evil.test")
      .expect(200);
  });

  it("HTTP-025 returns a safe client error for malformed and oversized JSON", async () => {
    const malformed = await request(app)
      .post("/admin/api/posts")
      .set("x-test-auth", "admin")
      .set("content-type", "application/json")
      .send('{"title":')
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe("INVALID_JSON"));
    expect(malformed.headers["cache-control"]).toBe("private, no-store");

    await request(app)
      .post("/admin/api/posts")
      .set("x-test-auth", "admin")
      .send({ title: "x".repeat(110_000), published: false })
      .expect(413)
      .expect(({ body }) => expect(body.code).toBe("BODY_TOO_LARGE"));
  });
});

describe("Express mount and UI transport", () => {
  it("HTTP-002 normalizes a custom base path and serves UI fallback/assets", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { app } = await createExternalHttpHarness({
      basePath: "/control///",
    });
    log.mockRestore();

    const schema = await request(app)
      .get("/control/api/schema")
      .set("x-test-auth", "admin")
      .expect(200);
    expect(schema.body.basePath).toBe("/control");

    const page = await request(app).get("/control/posts/1").expect(200);
    expect(page.type).toBe("text/html");
    expect(page.text).toContain('window.__PANELJS_BASE_PATH__="/control"');

    const assets = await readdir(join(getAdminUiDist(), "assets"));
    await request(app).get(`/control/assets/${assets[0]}`).expect(200);
  });

  it("HTTP-003 rejects a base path without a leading slash", async () => {
    await expect(
      createExternalHttpHarness({ basePath: "control" }),
    ).rejects.toThrow("must start with '/'");
  });
});
