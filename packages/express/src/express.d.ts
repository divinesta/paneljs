import type { AdminUser } from "paneljs";

declare global {
   namespace Express {
      interface Request {
         adminUser?: AdminUser;
      }
   }
}

export {};
