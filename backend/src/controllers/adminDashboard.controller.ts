import type { Request, Response } from "express";

import { AppError } from "../middleware/error.middleware.js";
import { getAdminDashboard } from "../services/adminDashboard.service.js";

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

const DASHBOARD_CACHE_CONTROL =
  "private, no-store, no-cache, must-revalidate, proxy-revalidate";

const DASHBOARD_PRAGMA = "no-cache";

/* -------------------------------------------------------------------------- */
/* Authentication helpers                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Returns the authenticated employee ID.
 *
 * The dashboard is strictly tenant-scoped.
 *
 * IMPORTANT:
 * organizationId is intentionally NOT read from:
 * - req.query
 * - req.params
 * - req.body
 * - custom request headers
 *
 * The dashboard service resolves the organization from this
 * authenticated employee's database record.
 */
function getAuthenticatedEmployeeId(
  req: Request,
): string {
  if (!req.auth) {
    throw new AppError(
      401,
      "Authentication required.",
      "AUTHENTICATION_REQUIRED",
    );
  }

  const employeeId =
    typeof req.auth.employeeId === "string"
      ? req.auth.employeeId.trim()
      : "";

  if (!employeeId) {
    throw new AppError(
      401,
      "Authenticated employee identity is missing.",
      "AUTHENTICATED_EMPLOYEE_ID_MISSING",
    );
  }

  return employeeId;
}

/* -------------------------------------------------------------------------- */
/* Get admin dashboard                                                         */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/admin/dashboard
 *
 * Returns the HR administration dashboard for the authenticated
 * employee's organization.
 *
 * Security model:
 *
 * 1. Authentication middleware must run before this controller.
 * 2. The employee identity comes exclusively from req.auth.
 * 3. organizationId is resolved server-side by the dashboard service.
 * 4. The client cannot select another organization.
 * 5. HR_ADMIN / SUPER_ADMIN authorization is enforced by the service.
 * 6. Dashboard responses are never cached because they contain
 *    tenant-specific HR information.
 *
 * Error handling:
 *
 * This controller deliberately does not catch service errors.
 * Errors are passed to the application's centralized Express
 * error middleware so logging, status codes and production
 * error responses remain consistent across the API.
 */
export async function getAdminDashboardController(
  req: Request,
  res: Response,
): Promise<void> {
  const employeeId =
    getAuthenticatedEmployeeId(req);

  /*
   * HR dashboard data contains employee and leave information.
   *
   * Prevent browsers, proxies and intermediary caches from
   * retaining or serving another user's tenant data.
   */
  res.setHeader(
    "Cache-Control",
    DASHBOARD_CACHE_CONTROL,
  );

  res.setHeader(
    "Pragma",
    DASHBOARD_PRAGMA,
  );

  res.setHeader(
    "Expires",
    "0",
  );

  /*
   * If authentication is cookie/header based, make the
   * response explicitly vary by authentication context.
   */
  res.setHeader(
    "Vary",
    "Cookie, Authorization",
  );

  const dashboard =
    await getAdminDashboard(
      employeeId,
    );

  res.status(200).json({
    success: true,
    data: dashboard,
  });
}