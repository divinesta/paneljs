export const DEFAULT_AUTH_USER_MODEL = "ExpressAdminUser";
export const DEFAULT_AUTH_SESSION_MODEL = "ExpressAdminSession";

export type AuthStoreOptions = {
   identifier: "email" | "username";
   userModel?: string;
   sessionModel?: string;
};

export interface BuiltInUserRecord {
   id: string;
   email?: string;
   username?: string;
   passwordHash: string;
   role: string;
   isActive: boolean;
   tenantId?: string;
}

export interface BuiltInSessionRecord {
   tokenHash: string;
   expiresAt: Date;
   user: BuiltInUserRecord;
}

export interface AdminAuthStore {
   findUserByIdentifier(identifier: string): Promise<BuiltInUserRecord | null>;
   findSessionWithUser(tokenHash: string): Promise<BuiltInSessionRecord | null>;
   createSession(input: { tokenHash: string; userId: string; expiresAt: Date }): Promise<void>;
   deleteSessionByTokenHash(tokenHash: string): Promise<void>;
}
