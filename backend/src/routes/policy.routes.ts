import { Router } from "express";

import {
  archivePolicyController,
  createPolicyController,
  deletePolicyController,
  getPolicyController,
  getPolicySummaryController,
  listPoliciesController,
  publishPolicyController,
  restorePolicyController,
  updatePolicyController,
} from "../controllers/policy.controller.js";

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
 * Every Policy endpoint requires an authenticated,
 * active server-side session.
 *
 * Tenant/organization identity is derived from req.auth
 * and the authenticated Employee record.
 *
 * The client must never provide organizationId as a
 * tenant selector.
 */
router.use(
  requireAuthentication,
);

/* -------------------------------------------------------------------------- */
/* Policy access                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Policies are an HR administration feature.
 *
 * HR_ADMIN:
 * - manage organization policies
 *
 * SUPER_ADMIN:
 * - manage organization policies
 *
 * Other roles:
 * - cannot access the administration Policy API.
 */
router.use(
  requireRole(
    "HR_ADMIN",
    "SUPER_ADMIN",
  ),
);

/* -------------------------------------------------------------------------- */
/* Policy collection                                                          */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/policies
 *
 * List policies belonging to the authenticated
 * organization.
 *
 * Optional query parameters:
 *
 * ?status=DRAFT
 * ?status=PUBLISHED
 * ?status=ARCHIVED
 * ?search=leave
 */
router.get(
  "/",
  listPoliciesController,
);

/**
 * POST /api/policies
 *
 * Create a new organization policy.
 */
router.post(
  "/",
  createPolicyController,
);

/* -------------------------------------------------------------------------- */
/* Policy summary                                                             */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/policies/summary
 *
 * Returns tenant-scoped policy statistics.
 *
 * This route is intentionally declared before
 * /:policyId so that "summary" cannot be interpreted
 * as a policy ID.
 */
router.get(
  "/summary",
  getPolicySummaryController,
);

/* -------------------------------------------------------------------------- */
/* Individual policy                                                          */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/policies/:policyId
 *
 * Retrieve one policy from the authenticated tenant.
 */
router.get(
  "/:policyId",
  getPolicyController,
);

/**
 * PATCH /api/policies/:policyId
 *
 * Update an existing non-archived policy.
 */
router.patch(
  "/:policyId",
  updatePolicyController,
);

/**
 * DELETE /api/policies/:policyId
 *
 * Permanently delete a DRAFT policy.
 *
 * The service layer prevents deletion of published
 * and archived policies.
 */
router.delete(
  "/:policyId",
  deletePolicyController,
);

/* -------------------------------------------------------------------------- */
/* Policy lifecycle                                                           */
/* -------------------------------------------------------------------------- */

/**
 * POST /api/policies/:policyId/publish
 *
 * Publish a policy.
 */
router.post(
  "/:policyId/publish",
  publishPolicyController,
);

/**
 * POST /api/policies/:policyId/archive
 *
 * Archive a policy while retaining its historical
 * record.
 */
router.post(
  "/:policyId/archive",
  archivePolicyController,
);

/**
 * POST /api/policies/:policyId/restore
 *
 * Restore an archived policy to DRAFT.
 *
 * Restoring does not automatically publish the policy.
 */
router.post(
  "/:policyId/restore",
  restorePolicyController,
);

/* -------------------------------------------------------------------------- */
/* Export                                                                     */
/* -------------------------------------------------------------------------- */

export default router;