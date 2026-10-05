import {
  Router,
} from "express";

import {
  requireAuthentication,
} from "../middleware/auth.middleware.js";

import {
  requireRole,
} from "../middleware/role.middleware.js";

import {
  assignDepartmentController,
  assignReportingManagerController,
  assignRoleController,
  createEmployeeController,
  getEmployeeController,
  listEmployeesController,
  updateAccountStatusController,
  updateEmployeeController,
} from "../controllers/employee.controller.js";

const router =
  Router();

/*
 * All employee-management endpoints require an authenticated session.
 */
router.use(
  requireAuthentication,
);

/*
 * Employee listing.
 *
 * HR administrators and super administrators can view employees
 * belonging to their authenticated organization.
 */
router.get(
  "/",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  listEmployeesController,
);

/*
 * Employee creation.
 */
router.post(
  "/",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  createEmployeeController,
);

/*
 * Employee details.
 */
router.get(
  "/:employeeId",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  getEmployeeController,
);

/*
 * General employee update.
 */
router.patch(
  "/:employeeId",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  updateEmployeeController,
);

/*
 * Department assignment.
 */
router.patch(
  "/:employeeId/department",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  assignDepartmentController,
);

/*
 * Reporting-manager assignment.
 *
 * This is important for the leave approval chain:
 *
 * Employee
 *    ↓
 * Reporting Manager / Lead
 *    ↓
 * HR
 */
router.patch(
  "/:employeeId/reporting-manager",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  assignReportingManagerController,
);

/*
 * Role assignment.
 */
router.patch(
  "/:employeeId/role",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  assignRoleController,
);

/*
 * Account status management.
 */
router.patch(
  "/:employeeId/status",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  updateAccountStatusController,
);

export default router;