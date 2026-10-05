import type { UserRole } from "./auth.types.js";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        employeeId: string;
        sessionId: string;
        role: UserRole;
      };
    }
  }
}

export {};