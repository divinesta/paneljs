import { EntitySchema } from "typeorm";
import { DEFAULT_AUTH_SESSION_MODEL, DEFAULT_AUTH_USER_MODEL } from "paneljs";

export type BuiltInAuthEntityOptions = {
  identifier?: "email" | "username";
  userModel?: string;
  sessionModel?: string;
};

/** TypeORM entities for PanelJS built-in login. Add these to your DataSource `entities`. */
export function builtInAuthEntities(
  options: BuiltInAuthEntityOptions = {},
): EntitySchema[] {
  const identifier = options.identifier ?? "email";
  const userModel = options.userModel ?? DEFAULT_AUTH_USER_MODEL;
  const sessionModel = options.sessionModel ?? DEFAULT_AUTH_SESSION_MODEL;

  const user = new EntitySchema<Record<string, unknown>>({
    name: userModel,
    tableName: "express_admin_users",
    columns: {
      id: { type: "uuid", primary: true, generated: "uuid" },
      ...(identifier === "email"
        ? { email: { type: "varchar", unique: true } }
        : { username: { type: "varchar", unique: true } }),
      passwordHash: { type: "varchar" },
      role: {
        type: "enum",
        enum: ["ADMIN", "SUPER_ADMIN"],
        default: "ADMIN",
        enumName: "express_admin_role",
      },
      isActive: { type: "boolean", default: true },
      tenantId: { type: "varchar", nullable: true },
      createdAt: { type: "timestamptz", createDate: true },
      updatedAt: { type: "timestamptz", updateDate: true },
    },
    relations: {
      sessions: {
        type: "one-to-many",
        target: sessionModel,
        inverseSide: "user",
      },
    },
  });

  const session = new EntitySchema<Record<string, unknown>>({
    name: sessionModel,
    tableName: "express_admin_sessions",
    columns: {
      id: { type: "uuid", primary: true, generated: "uuid" },
      tokenHash: { type: "varchar", unique: true },
      userId: { type: "uuid" },
      expiresAt: { type: "timestamptz" },
      createdAt: { type: "timestamptz", createDate: true },
    },
    relations: {
      user: {
        type: "many-to-one",
        target: userModel,
        joinColumn: { name: "userId" },
        inverseSide: "sessions",
        onDelete: "CASCADE",
      },
    },
    indices: [{ columns: ["userId"] }, { columns: ["expiresAt"] }],
  });

  return [user, session];
}
