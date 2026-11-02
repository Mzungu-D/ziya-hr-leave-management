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
  deleteEmployeeController,
  getEmployeeController,
  listEmployeesController,
  sendInvitationController,
  updateAccountStatusController,
  updateEmployeeController,
} from "../controllers/employee.controller.js";

import {
  getProfilePictureController,
  getProfilePictureImageController,
  removeProfilePictureController,
  uploadProfilePictureController,
} from "../controllers/profile-picture.controller.js";

import {
  parseProfilePictureUpload,
} from "../middleware/profile-picture-upload.middleware.js";

import {
  profilePictureUploadRateLimit,
} from "../middleware/profile-picture-rate-limit.middleware.js";

const router =
  Router();

router.use(
  requireAuthentication,
);

router.get(
  "/",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  listEmployeesController,
);

router.post(
  "/",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  createEmployeeController,
);

router.get(
  "/:employeeId/profile-picture",
  getProfilePictureController,
);

router.get(
  "/:employeeId/profile-picture/image",
  getProfilePictureImageController,
);

router.post(
  "/:employeeId/profile-picture",
  profilePictureUploadRateLimit,
  parseProfilePictureUpload,
  uploadProfilePictureController,
);

router.delete(
  "/:employeeId/profile-picture",
  removeProfilePictureController,
);

router.get(
  "/:employeeId",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  getEmployeeController,
);

router.patch(
  "/:employeeId",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  updateEmployeeController,
);

router.patch(
  "/:employeeId/department",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  assignDepartmentController,
);

router.patch(
  "/:employeeId/reporting-manager",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  assignReportingManagerController,
);

router.patch(
  "/:employeeId/role",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  assignRoleController,
);

router.patch(
  "/:employeeId/status",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  updateAccountStatusController,
);

/*
 * Only HR administrators can send or resend activation invitations.
 */
router.post(
  "/:employeeId/invitation",
  requireRole("HR_ADMIN"),
  sendInvitationController,
);

router.delete(
  "/:employeeId",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  deleteEmployeeController,
);

export default router;