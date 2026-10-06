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
  createDepartmentController,
  deleteDepartmentController,
  getDepartmentController,
  listDepartmentsController,
  updateDepartmentController,
} from "../controllers/department.controller.js";

/* -------------------------------------------------------------------------- */
/* Department routes                                                          */
/* -------------------------------------------------------------------------- */

const router = Router();

/*
 * Every department endpoint requires an authenticated,
 * active employee session.
 *
 * Tenant/organization context is derived server-side from
 * the authenticated employee by the controller/service layer.
 */
router.use(
  requireAuthentication,
);

/*
 * Department master-data administration is restricted to
 * HR administrators and super administrators.
 */
router.use(
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
);

/* -------------------------------------------------------------------------- */
/* Collection                                                                 */
/* -------------------------------------------------------------------------- */

router.get(
  "/",
  listDepartmentsController,
);

router.post(
  "/",
  createDepartmentController,
);

/* -------------------------------------------------------------------------- */
/* Individual department                                                      */
/* -------------------------------------------------------------------------- */

router.get(
  "/:departmentId",
  getDepartmentController,
);

router.patch(
  "/:departmentId",
  updateDepartmentController,
);

router.delete(
  "/:departmentId",
  deleteDepartmentController,
);

export default router;