import type { RequestHandler } from "express";

import type { UserRole } from "../types/auth.types.js";

/**
 * Restrict an endpoint to one or more authenticated roles.
 *
 * This middleware must be used after requireAuthentication.
 *
 * Never accept a role from request input.
 */
export function requireRole(
  ...allowedRoles: readonly UserRole[]
): RequestHandler {
  if (allowedRoles.length === 0) {
    throw new Error(
      "requireRole requires at least one permitted role",
    );
  }

  return (req, res, next) => {
    if (!req.auth) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication required.",
        },
      });

      return;
    }

    if (!allowedRoles.includes(req.auth.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message:
            "You do not have access to this resource.",
        },
      });

      return;
    }

    next();
  };
}