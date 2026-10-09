import { Router } from "express";

import {
  getSystemSettingController,
  getSystemSettingDefinitionsController,
  getSystemSettingsController,
  resetSystemSettingController,
  resetSystemSettingsController,
  updateSystemSettingController,
  updateSystemSettingsController,
} from "../controllers/systemSettings.controller.js";

import {
  requireAuthentication,
} from "../middleware/auth.middleware.js";

import {
  requireRole,
} from "../middleware/role.middleware.js";

/* -------------------------------------------------------------------------- */
/* Router                                                                     */
/* -------------------------------------------------------------------------- */

const router = Router();

/* -------------------------------------------------------------------------- */
/* Authentication                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Every System Settings endpoint requires:
 *
 * 1. A valid HTTP-only access cookie.
 * 2. A valid access token.
 * 3. A valid, non-revoked server-side session.
 * 4. An existing employee account.
 * 5. An ACTIVE employee account.
 *
 * Tenant context is subsequently resolved from the authenticated employee.
 *
 * The frontend must never provide organizationId.
 */
router.use(
  requireAuthentication,
);

/* -------------------------------------------------------------------------- */
/* Authorization                                                              */
/* -------------------------------------------------------------------------- */

/**
 * System Settings are restricted to:
 *
 * - HR_ADMIN
 * - SUPER_ADMIN
 *
 * The role is taken from the authenticated server-side session.
 *
 * A role supplied through:
 * - request body
 * - query string
 * - route parameter
 * - custom header
 *
 * is never trusted.
 */
router.use(
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
);

/* -------------------------------------------------------------------------- */
/* Read settings                                                              */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/admin/settings
 *
 * Returns all supported System Settings for the authenticated tenant.
 *
 * The service resolves the organization from req.auth.employeeId.
 */
router.get(
  "/",
  getSystemSettingsController,
);

/**
 * GET /api/admin/settings/definitions
 *
 * Returns the controlled System Settings definitions and their application
 * defaults.
 *
 * This allows the frontend to build the settings interface from the backend
 * contract rather than maintaining a second uncontrolled list.
 */
router.get(
  "/definitions",
  getSystemSettingDefinitionsController,
);

/**
 * GET /api/admin/settings/:key
 *
 * Returns one setting for the authenticated tenant.
 *
 * Example:
 *
 * GET /api/admin/settings/organization_timezone
 */
router.get(
  "/:key",
  getSystemSettingController,
);

/* -------------------------------------------------------------------------- */
/* Update settings                                                            */
/* -------------------------------------------------------------------------- */

/**
 * PUT /api/admin/settings
 *
 * Atomically updates multiple System Settings.
 *
 * The service performs:
 * - tenant isolation
 * - key allow-list validation
 * - type validation
 * - value validation
 * - duplicate-key validation
 * - database transaction
 */
router.put(
  "/",
  updateSystemSettingsController,
);

/**
 * PUT /api/admin/settings/:key
 *
 * Updates one System Setting.
 *
 * The controller requires the URL key and body key to match.
 *
 * Example:
 *
 * PUT /api/admin/settings/manager_approval_required
 */
router.put(
  "/:key",
  updateSystemSettingController,
);

/* -------------------------------------------------------------------------- */
/* Reset settings                                                             */
/* -------------------------------------------------------------------------- */

/**
 * DELETE /api/admin/settings/:key
 *
 * Removes the explicit tenant override for one setting.
 *
 * The application default will then be returned.
 */
router.delete(
  "/:key",
  resetSystemSettingController,
);

/**
 * DELETE /api/admin/settings
 *
 * Removes all explicitly configured System Settings for the authenticated
 * tenant.
 *
 * This operation is tenant-scoped and cannot affect another organization.
 */
router.delete(
  "/",
  resetSystemSettingsController,
);

/* -------------------------------------------------------------------------- */
/* Export                                                                     */
/* -------------------------------------------------------------------------- */

export default router;