import { Router } from "express";

import { requireAuthentication } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

import {
  cancelLeaveRequestController,
  createLeaveRequestController,
  getLeaveRequestController,
  hrApproveController,
  hrRejectController,
  listHrPendingRequestsController,
  listLeaveBalancesController,
  listLeaveTypesController,
  listManagerPendingRequestsController,
  listMyLeaveRequestsController,
  managerApproveController,
  managerRejectController,
} from "../controllers/leave.controller.js";

const router = Router();

/**
 * ============================================================================
 * AUTHENTICATION
 * ============================================================================
 *
 * Every leave-management endpoint requires an authenticated active session.
 *
 * Organization/tenant scope is NOT accepted from the client. The service layer
 * derives it from the authenticated employee.
 */
router.use(requireAuthentication);

/**
 * ============================================================================
 * LEAVE CONFIGURATION
 * ============================================================================
 */

/**
 * GET /api/leave/types
 */
router.get(
  "/types",
  listLeaveTypesController,
);

/**
 * GET /api/leave/balances/me
 */
router.get(
  "/balances/me",
  listLeaveBalancesController,
);

/**
 * ============================================================================
 * EMPLOYEE REQUESTS
 * ============================================================================
 */

/**
 * GET /api/leave/requests/me
 */
router.get(
  "/requests/me",
  listMyLeaveRequestsController,
);

/**
 * POST /api/leave/requests
 *
 * Employee identity is derived from req.auth.
 */
router.post(
  "/requests",
  createLeaveRequestController,
);

/**
 * ============================================================================
 * APPROVAL QUEUES
 * ============================================================================
 *
 * These static routes MUST appear before:
 *
 *   /requests/:leaveRequestId
 *
 * so that "pending/manager" and "pending/hr" are always treated as their
 * intended static paths.
 */

/**
 * GET /api/leave/requests/pending/manager
 *
 * MANAGER:
 *   Department/reporting-manager approval.
 *
 * HR_ADMIN/SUPER_ADMIN:
 *   May access the manager approval queue, but the service layer remains
 *   responsible for determining which requests they are authorized to act on.
 */
router.get(
  "/requests/pending/manager",
  requireRole(
    "MANAGER",
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  listManagerPendingRequestsController,
);

/**
 * GET /api/leave/requests/pending/hr
 *
 * HR final approval queue.
 */
router.get(
  "/requests/pending/hr",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  listHrPendingRequestsController,
);

/**
 * ============================================================================
 * MANAGER / DEPARTMENT LEAD APPROVAL
 * ============================================================================
 */

/**
 * POST /api/leave/requests/:leaveRequestId/manager-approve
 */
router.post(
  "/requests/:leaveRequestId/manager-approve",
  requireRole(
    "MANAGER",
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  managerApproveController,
);

/**
 * POST /api/leave/requests/:leaveRequestId/manager-reject
 */
router.post(
  "/requests/:leaveRequestId/manager-reject",
  requireRole(
    "MANAGER",
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  managerRejectController,
);

/**
 * ============================================================================
 * HR FINAL APPROVAL
 * ============================================================================
 */

/**
 * POST /api/leave/requests/:leaveRequestId/hr-approve
 */
router.post(
  "/requests/:leaveRequestId/hr-approve",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  hrApproveController,
);

/**
 * POST /api/leave/requests/:leaveRequestId/hr-reject
 */
router.post(
  "/requests/:leaveRequestId/hr-reject",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  hrRejectController,
);

/**
 * ============================================================================
 * INDIVIDUAL REQUEST
 * ============================================================================
 */

/**
 * GET /api/leave/requests/:leaveRequestId
 *
 * Authorization/tenant ownership is enforced by the service layer.
 */
router.get(
  "/requests/:leaveRequestId",
  getLeaveRequestController,
);

/**
 * POST /api/leave/requests/:leaveRequestId/cancel
 *
 * Cancellation authorization is enforced by the service layer.
 */
router.post(
  "/requests/:leaveRequestId/cancel",
  cancelLeaveRequestController,
);

export default router;