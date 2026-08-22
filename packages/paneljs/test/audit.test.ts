import { describe, expect, it, vi } from "vitest";

import { writeAuditEvent, type AuditConfig } from "../src/index.js";
import { adminUser } from "./fixtures.js";

describe("audit events", () => {
  it("does nothing when auditing is not configured", async () => {
    await expect(
      writeAuditEvent(undefined, adminUser, {
        type: "create",
        modelName: "User",
        recordIds: ["user-1"],
      }),
    ).resolves.toBeUndefined();
  });

  it("adds actor and timestamp to the supplied event", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const audit: AuditConfig = { write };
    const before = Date.now();

    await writeAuditEvent(audit, adminUser, {
      type: "action",
      modelName: "User",
      recordIds: ["user-1", "user-2"],
      metadata: { action: "activate_selected" },
    });

    const event = write.mock.calls[0]?.[0];
    expect(event).toMatchObject({
      type: "action",
      modelName: "User",
      recordIds: ["user-1", "user-2"],
      actor: {
        id: "admin-1",
        email: "ada@example.test",
        role: "ADMIN",
      },
      metadata: { action: "activate_selected" },
    });
    expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(before);
    expect(event.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("propagates writer failures for callers to handle", async () => {
    const failure = new Error("audit unavailable");
    await expect(
      writeAuditEvent(
        { write: vi.fn().mockRejectedValue(failure) },
        adminUser,
        { type: "delete", modelName: "User", recordIds: ["user-1"] },
      ),
    ).rejects.toBe(failure);
  });
});
