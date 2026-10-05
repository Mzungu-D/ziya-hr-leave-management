import type { RequestHandler } from "express";

import type { UserRole } from "../types/auth.types.js";

/**
 * Restricts access to one or more authenticated user roles.
 *
 * This middleware MUST be used after requireAuthentication.
 *
 * Security:
 * - The role is read exclusively from req.auth.
 * - No role is accepted from request body, query parameters,
 *   route parameters, headers, or client-side state.
 * - Unauthenticated requests receive HTTP 401.
 * - Authenticated users without an allowed role receive HTTP 403.
 */
export function requireRole(
  ...allowedRoles: UserRole[]
): RequestHandler {
  return (req, res, next): void => {
    if (!req.auth) {
      res.status(401).json({
        success: false,
        code: "UNAUTHENTICATED",
        message: "Authentication required.",
      });

      return;
    }

    if (allowedRoles.length === 0) {
      res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "You do not have permission to access this resource.",
      });

      return;
    }

    if (!allowedRoles.includes(req.auth.role)) {
      res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "You do not have permission to access this resource.",
      });

      return;
    }

    next();
  };
}

/**
 * Employee-level access.
 *
 * Every authenticated role in the system is an employee-level user,
 * including managers and administrators.
 */
export const requireEmployee = requireRole(
  "EMPLOYEE",
  "MANAGER",
  "HR_ADMIN",
  "SUPER_ADMIN",
);

/**
 * Manager-level access.
 *
 * HR administrators and super administrators are intentionally included
 * because they have authority above manager-level operations.
 */
export const requireManager = requireRole(
  "MANAGER",
  "HR_ADMIN",
  "SUPER_ADMIN",
);

/**
 * HR administrator-level access.
 *
 * SUPER_ADMIN is included because this role has system-wide authority.
 */
export const requireHrAdmin = requireRole(
  "HR_ADMIN",
  "SUPER_ADMIN",
);

/**
 * Super administrator-only access.
 */
export const requireSuperAdmin = requireRole(
  "SUPER_ADMIN",
);