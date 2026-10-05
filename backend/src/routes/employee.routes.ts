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

/**
 * --------------------------------------------------------------------------
 * Authentication
 * --------------------------------------------------------------------------
 *
 * Every employee endpoint requires an authenticated employee session.
 */
router.use(
  requireAuthentication,
);

/**
 * --------------------------------------------------------------------------
 * Employee listing
 * --------------------------------------------------------------------------
 */

router.get(
  "/",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  listEmployeesController,
);

/**
 * --------------------------------------------------------------------------
 * Employee creation
 * --------------------------------------------------------------------------
 */

router.post(
  "/",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  createEmployeeController,
);

/**
 * --------------------------------------------------------------------------
 * Profile picture metadata
 * --------------------------------------------------------------------------
 *
 * Employees may access their own metadata.
 * HR_ADMIN/SUPER_ADMIN may access employees in their organization.
 *
 * Authorization is enforced inside the profile-picture service.
 */
router.get(
  "/:employeeId/profile-picture",
  getProfilePictureController,
);

/**
 * --------------------------------------------------------------------------
 * Private profile picture image
 * --------------------------------------------------------------------------
 *
 * The backend authorizes the request and streams the image from private
 * Railway object storage.
 *
 * No public storage URL is exposed.
 */
router.get(
  "/:employeeId/profile-picture/image",
  getProfilePictureImageController,
);

/**
 * --------------------------------------------------------------------------
 * Upload / replace profile picture
 * --------------------------------------------------------------------------
 *
 * Authentication runs first.
 *
 * Rate limiting runs before multipart processing.
 *
 * Multer then enforces:
 * - 5 MB maximum
 * - one file
 * - zero arbitrary fields
 * - one multipart part
 */
router.post(
  "/:employeeId/profile-picture",
  profilePictureUploadRateLimit,
  parseProfilePictureUpload,
  uploadProfilePictureController,
);

/**
 * --------------------------------------------------------------------------
 * Remove profile picture
 * --------------------------------------------------------------------------
 */

router.delete(
  "/:employeeId/profile-picture",
  removeProfilePictureController,
);

/**
 * --------------------------------------------------------------------------
 * Employee details
 * --------------------------------------------------------------------------
 */

router.get(
  "/:employeeId",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  getEmployeeController,
);

/**
 * --------------------------------------------------------------------------
 * General employee update
 * --------------------------------------------------------------------------
 */

router.patch(
  "/:employeeId",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  updateEmployeeController,
);

/**
 * --------------------------------------------------------------------------
 * Department assignment
 * --------------------------------------------------------------------------
 */

router.patch(
  "/:employeeId/department",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  assignDepartmentController,
);

/**
 * --------------------------------------------------------------------------
 * Reporting-manager assignment
 * --------------------------------------------------------------------------
 */

router.patch(
  "/:employeeId/reporting-manager",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  assignReportingManagerController,
);

/**
 * --------------------------------------------------------------------------
 * Role assignment
 * --------------------------------------------------------------------------
 */

router.patch(
  "/:employeeId/role",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  assignRoleController,
);

/**
 * --------------------------------------------------------------------------
 * Account status management
 * --------------------------------------------------------------------------
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