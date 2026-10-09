import { Router } from "express";

import {
  getAnnualReportsController,
  getReportsController,
  getReportsForDateRangeController,
} from "../controllers/reports.controller.js";

import { requireAuthentication } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

/* ==========================================================================
   ZIYA HR — REPORTS & ANALYTICS ROUTES

   Security:
   - Authentication required for every endpoint.
   - HR_ADMIN / SUPER_ADMIN only.
   - organizationId is never accepted from the client.
   - Tenant is resolved from the authenticated employee.
   ========================================================================== */

const router = Router();

/* --------------------------------------------------------------------------
   Authentication
   -------------------------------------------------------------------------- */

router.use(
  requireAuthentication,
);

/* --------------------------------------------------------------------------
   Reports & Analytics
   -------------------------------------------------------------------------- */

/**
 * GET /api/admin/reports
 *
 * Optional:
 * ?year=2026
 *
 * Or:
 * ?year=2026&from=2026-01-01&to=2026-12-31
 */
router.get(
  "/",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  getReportsController,
);

/**
 * GET /api/admin/reports/range
 *
 * Required:
 * ?from=2026-01-01&to=2026-06-30
 */
router.get(
  "/range",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  getReportsForDateRangeController,
);

/**
 * GET /api/admin/reports/annual/:year
 *
 * Example:
 * /api/admin/reports/annual/2026
 */
router.get(
  "/annual/:year",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  getAnnualReportsController,
);

export default router;