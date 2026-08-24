import { EntitySchema } from "@mikro-orm/core";
import { DEFAULT_AUTH_SESSION_MODEL, DEFAULT_AUTH_USER_MODEL } from "paneljs";

export type BuiltInAuthEntityOptions = {
  identifier?: "email" | "username";
  userModel?: string;
  sessionModel?: string;
};

/** MikroORM entities for PanelJS built-in login. Add these to your ORM `entities`. */
export function builtInAuthEntities(
  options: BuiltInAuthEntityOptions = {},
): EntitySchema[] {
  const identifier = options.identifier ?? "email";
  const userModel = options.userModel ?? DEFAULT_AUTH_USER_MODEL;
  const sessionModel = options.sessionModel ?? DEFAULT_AUTH_SESSION_MODEL;

  const user = new EntitySchema({
    name: userModel,
    tableName: "express_admin_users",
    properties: {
      id: { type: "uuid", primary: true, defaultRaw: "gen_random_uuid()" },
      ...(identifier === "email"
        ? { email: { type: "string", unique: true } }
        : { username: { type: "string", unique: true } }),
      passwordHash: { type: "string" },
      role: {
        enum: true,
        items: () => ["ADMIN", "SUPER_ADMIN"],
        nativeEnumName: "express_admin_role",
        default: "ADMIN",
      },
      isActive: { type: "boolean", default: true },
      tenantId: { type: "string", nullable: true },
      createdAt: {
        type: "datetime",
        columnType: "timestamptz",
        onCreate: () => new Date(),
      },
      updatedAt: {
        type: "datetime",
        columnType: "timestamptz",
        onCreate: () => new Date(),
        onUpdate: () => new Date(),
      },
      sessions: {
        kind: "1:m",
        entity: sessionModel,
        mappedBy: "user",
      },
    },
  });

  const session = new EntitySchema({
    name: sessionModel,
    tableName: "express_admin_sessions",
    properties: {
      id: { type: "uuid", primary: true, defaultRaw: "gen_random_uuid()" },
      tokenHash: { type: "string", unique: true },
      expiresAt: { type: "datetime", columnType: "timestamptz" },
      createdAt: {
        type: "datetime",
        columnType: "timestamptz",
        onCreate: () => new Date(),
      },
      user: {
        kind: "m:1",
        entity: userModel,
        inversedBy: "sessions",
        fieldName: "userId",
        deleteRule: "cascade",
      },
    },
    indexes: [{ properties: ["user"] }, { properties: ["expiresAt"] }],
  } as never);

  return [user, session];
}
