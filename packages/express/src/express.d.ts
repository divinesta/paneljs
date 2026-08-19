import type { AdminUser } from "@paneljs/paneljs";

declare global {
  namespace Express {
    interface Request {
      adminUser?: AdminUser;
    }
  }
}

export {};
