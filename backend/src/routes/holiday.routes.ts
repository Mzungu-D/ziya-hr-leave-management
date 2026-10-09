import { Router } from "express";

import {
  activateHolidayController,
  createHolidayController,
  deactivateHolidayController,
  deleteHolidayController,
  getHolidayController,
  getHolidaySummaryController,
  listHolidaysController,
  updateHolidayController,
} from "../controllers/holiday.controller.js";

import { requireAuthentication } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

const router = Router();

/* -------------------------------------------------------------------------- */
/* Authentication                                                             */
/* -------------------------------------------------------------------------- */

router.use(
  requireAuthentication,
);

/* -------------------------------------------------------------------------- */
/* Holiday management                                                         */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/holidays
 *
 * List tenant holidays.
 */
router.get(
  "/",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  listHolidaysController,
);

/**
 * GET /api/holidays/summary
 *
 * Tenant-scoped holiday statistics.
 *
 * IMPORTANT:
 * This route must remain above /:holidayId.
 */
router.get(
  "/summary",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  getHolidaySummaryController,
);

/**
 * GET /api/holidays/:holidayId
 */
router.get(
  "/:holidayId",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  getHolidayController,
);

/**
 * POST /api/holidays
 */
router.post(
  "/",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  createHolidayController,
);

/**
 * PATCH /api/holidays/:holidayId
 */
router.patch(
  "/:holidayId",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  updateHolidayController,
);

/**
 * POST /api/holidays/:holidayId/activate
 */
router.post(
  "/:holidayId/activate",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  activateHolidayController,
);

/**
 * POST /api/holidays/:holidayId/deactivate
 */
router.post(
  "/:holidayId/deactivate",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  deactivateHolidayController,
);

/**
 * DELETE /api/holidays/:holidayId
 */
router.delete(
  "/:holidayId",
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
  deleteHolidayController,
);

export default router;