import type { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        employeeId: string;
        sessionId: string;
        role: UserRole;
      };

      file?: Multer.File;

      files?:
        | Multer.File[]
        | {
            [fieldname: string]: Multer.File[];
          };
    }
  }
}

export {};