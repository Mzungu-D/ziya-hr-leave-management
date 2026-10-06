import { Router } from "express";

import { requireAuthentication } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

import {
  activateLeaveTypeController,
  createLeaveTypeController,
  deactivateLeaveTypeController,
  getLeaveTypeController,
  listLeaveTypesController,
  updateLeaveTypeController,
} from "../controllers/leave-type.controller.js";

const router = Router();

/**
 * All leave-type configuration endpoints require
 * an authenticated user.
 */
router.use(requireAuthentication);

/**
 * Leave types are organization-level HR configuration.
 *
 * Only HR administrators and super administrators
 * may create, modify, activate, deactivate, or
 * inspect inactive leave types.
 */
router.use(requireRole("HR_ADMIN", "SUPER_ADMIN"));

/**
 * GET /api/leave-types
 *
 * Returns active leave types by default.
 *
 * ?includeInactive=true
 * may be used by HR/SUPER_ADMIN to retrieve
 * the complete configuration set.
 */
router.get("/", listLeaveTypesController);

/**
 * POST /api/leave-types
 *
 * Create a new leave type for the authenticated
 * employee's organization.
 */
router.post("/", createLeaveTypeController);

/**
 * GET /api/leave-types/:leaveTypeId
 *
 * Retrieve one leave type belonging to the
 * authenticated employee's organization.
 */
router.get("/:leaveTypeId", getLeaveTypeController);

/**
 * PATCH /api/leave-types/:leaveTypeId
 *
 * Update an existing leave type.
 */
router.patch("/:leaveTypeId", updateLeaveTypeController);

/**
 * POST /api/leave-types/:leaveTypeId/deactivate
 *
 * Soft-deactivate a leave type.
 *
 * The record remains in the database so historical
 * leave requests and accounting/audit relationships
 * remain intact.
 */
router.post(
  "/:leaveTypeId/deactivate",
  deactivateLeaveTypeController,
);

/**
 * POST /api/leave-types/:leaveTypeId/activate
 *
 * Reactivate a previously deactivated leave type.
 */
router.post(
  "/:leaveTypeId/activate",
  activateLeaveTypeController,
);

export default router;