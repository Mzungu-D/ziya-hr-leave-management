import { Router } from "express";

import {
  getAdminDashboardController,
} from "../controllers/adminDashboard.controller.js";

import {
  requireAuthentication,
} from "../middleware/auth.middleware.js";

import {
  requireRole,
} from "../middleware/role.middleware.js";

/* -------------------------------------------------------------------------- */
/* Router                                                                      */
/* -------------------------------------------------------------------------- */

const router = Router();

/* -------------------------------------------------------------------------- */
/* Authentication                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Every HR administration dashboard endpoint requires
 * an authenticated, active session.
 *
 * requireAuthentication:
 * - validates the HTTP-only access cookie
 * - verifies the access token
 * - verifies the server-side session
 * - checks session expiry/revocation
 * - verifies the employee still exists
 * - verifies the employee is ACTIVE
 * - populates req.auth
 *
 * No organization/tenant information is accepted from
 * the frontend.
 */
router.use(
  requireAuthentication,
);

/* -------------------------------------------------------------------------- */
/* HR Administration Dashboard                                                 */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/admin/dashboard
 *
 * HR dashboard is available only to:
 *
 * - HR_ADMIN
 * - SUPER_ADMIN
 *
 * Tenant isolation:
 * ---------------------------------------------------------
 * organizationId is NOT accepted from:
 *
 * - query parameters
 * - route parameters
 * - request body
 * - custom headers
 * - frontend state
 *
 * The dashboard service derives the organization from the
 * authenticated employee in req.auth.
 *
 * Responsive behavior:
 * ---------------------------------------------------------
 * The API returns the complete organization dashboard
 * dataset regardless of viewport size.
 *
 * The frontend is responsible for reflowing the same data
 * across:
 *
 * 320px
 * 375px
 * 390px
 * 414px
 * 768px
 * 820px
 * 1024px
 * 1280px
 * 1366px
 * 1440px
 * 1920px
 *
 * No dashboard information is removed for mobile/tablet
 * layouts.
 */
router.get(
  "/dashboard",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  getAdminDashboardController,
);

/* -------------------------------------------------------------------------- */
/* Export                                                                      */
/* -------------------------------------------------------------------------- */

export default router;