
import { Router } from "express";

import { listAuditLogsController } from "../controllers/audit-log.controller.js";
import { requireAuthentication } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

/**
 * Ziya HR — Audit Log Routes
 *
 * Mounted at:
 * /api/audit-logs
 *
 * Access policy:
 * - An authenticated, active employee session is required.
 * - Only HR_ADMIN and SUPER_ADMIN can list audit logs.
 * - Organization scope is derived by the service from the
 *   authenticated employee's database record.
 */

const router = Router();

/**
 * Authenticate every endpoint registered on this router.
 */
router.use(requireAuthentication);

/**
 * GET /
 *
 * List audit events for the authenticated employee's organization.
 *
 * The service independently verifies the employee's active status,
 * role, and organization before executing the tenant-scoped query.
 */
router.get(
  "/",
  requireRole("HR_ADMIN", "SUPER_ADMIN"),
  listAuditLogsController,
);

export default router;
