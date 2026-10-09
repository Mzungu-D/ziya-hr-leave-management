import type {
  Request,
  Response,
} from "express";
import { z } from "zod";

import { db } from "../../prisma/db.js";
import { AppError } from "../middleware/error.middleware.js";

import {
  archivePolicy,
  createPolicy,
  deletePolicy,
  getPolicy,
  getPolicySummary,
  listPolicies,
  publishPolicy,
  restorePolicy,
  updatePolicy,
} from "../services/policy.service.js";

/* -------------------------------------------------------------------------- */
/* Authentication / tenant context                                            */
/* -------------------------------------------------------------------------- */

interface AuthContext {
  employeeId: string;
  organizationId: string;
  role: string;
}

async function getContext(
  req: Request,
): Promise<AuthContext> {
  if (!req.auth) {
    throw new AppError(
      401,
      "Authentication required.",
      "AUTHENTICATION_REQUIRED",
    );
  }

  const employee =
    await db.orm.public.Employee
      .where({
        id: req.auth.employeeId,
      })
      .first();

  if (!employee) {
    throw new AppError(
      401,
      "Authenticated employee not found.",
      "AUTHENTICATED_EMPLOYEE_NOT_FOUND",
    );
  }

  if (
    employee.status !== "ACTIVE"
  ) {
    throw new AppError(
      403,
      "This employee account is not active.",
      "EMPLOYEE_ACCOUNT_INACTIVE",
    );
  }

  if (
    !employee.organizationId
  ) {
    throw new AppError(
      403,
      "The authenticated employee is not assigned to an organization.",
      "EMPLOYEE_ORGANIZATION_MISSING",
    );
  }

  return {
    employeeId: employee.id,
    organizationId:
      employee.organizationId,
    role: employee.role,
  };
}

/* -------------------------------------------------------------------------- */
/* Validation schemas                                                         */
/* -------------------------------------------------------------------------- */

const policyStatusSchema =
  z.enum([
    "DRAFT",
    "PUBLISHED",
    "ARCHIVED",
  ]);

const createPolicySchema =
  z.object({
    title: z
      .string()
      .trim()
      .min(1, "Policy title is required.")
      .max(
        200,
        "Policy title cannot exceed 200 characters.",
      ),

    code: z
      .string()
      .trim()
      .min(1, "Policy code is required.")
      .max(
        100,
        "Policy code cannot exceed 100 characters.",
      )
      .regex(
        /^[A-Za-z0-9][A-Za-z0-9_-]*$/,
        "Policy code may contain only letters, numbers, underscores and hyphens.",
      ),

    description: z
      .string()
      .max(
        2000,
        "Policy description cannot exceed 2000 characters.",
      )
      .nullable()
      .optional(),

    content: z
      .string()
      .trim()
      .min(1, "Policy content is required.")
      .max(
        1_000_000,
        "Policy content is too large.",
      ),

    status:
      policyStatusSchema.optional(),

    version: z
      .number()
      .int()
      .min(1)
      .max(999999)
      .optional(),

    effectiveFrom: z
      .union([
        z.string().trim().min(1),
        z.date(),
      ])
      .nullable()
      .optional(),

    effectiveTo: z
      .union([
        z.string().trim().min(1),
        z.date(),
      ])
      .nullable()
      .optional(),
  });

const updatePolicySchema =
  z
    .object({
      title: z
        .string()
        .trim()
        .min(1)
        .max(200)
        .optional(),

      code: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .regex(
          /^[A-Za-z0-9][A-Za-z0-9_-]*$/,
          "Policy code may contain only letters, numbers, underscores and hyphens.",
        )
        .optional(),

      description: z
        .string()
        .max(2000)
        .nullable()
        .optional(),

      content: z
        .string()
        .trim()
        .min(1)
        .max(1_000_000)
        .optional(),

      version: z
        .number()
        .int()
        .min(1)
        .max(999999)
        .optional(),

      effectiveFrom: z
        .union([
          z.string().trim().min(1),
          z.date(),
        ])
        .nullable()
        .optional(),

      effectiveTo: z
        .union([
          z.string().trim().min(1),
          z.date(),
        ])
        .nullable()
        .optional(),
    })
    .refine(
      (value) =>
        Object.keys(value).length > 0,
      {
        message:
          "At least one policy field must be provided.",
      },
    );

const listPoliciesQuerySchema =
  z.object({
    status:
      policyStatusSchema.optional(),

    search: z
      .string()
      .trim()
      .max(
        200,
        "Search cannot exceed 200 characters.",
      )
      .optional(),
  });

/* -------------------------------------------------------------------------- */
/* Route parameter validation                                                  */
/* -------------------------------------------------------------------------- */

function getPolicyId(
  req: Request,
): string {
  const value =
    Array.isArray(
      req.params.policyId,
    )
      ? req.params.policyId[0]
      : req.params.policyId;

  if (!value?.trim()) {
    throw new AppError(
      400,
      "Policy ID is required.",
      "POLICY_ID_REQUIRED",
    );
  }

  return value.trim();
}

/* -------------------------------------------------------------------------- */
/* Controllers                                                                */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/policies
 *
 * Lists policies belonging to the authenticated
 * employee's organization only.
 */
export async function listPoliciesController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getContext(req);

  const query =
    listPoliciesQuerySchema.parse(
      req.query,
    );

  const policies =
    await listPolicies({
      organizationId:
        context.organizationId,
      actorId:
        context.employeeId,
      status: query.status,
      search: query.search,
    });

  res.status(200).json({
    success: true,
    data: policies,
  });
}

/**
 * GET /api/policies/:policyId
 *
 * Retrieves one policy from the
 * authenticated tenant.
 */
export async function getPolicyController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getContext(req);

  const policy =
    await getPolicy(
      context.organizationId,
      context.employeeId,
      getPolicyId(req),
    );

  res.status(200).json({
    success: true,
    data: policy,
  });
}

/**
 * POST /api/policies
 *
 * Creates a policy inside the authenticated
 * organization.
 *
 * organizationId is deliberately NOT accepted
 * from the client.
 */
export async function createPolicyController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getContext(req);

  const body =
    createPolicySchema.parse(
      req.body,
    );

  const policy =
    await createPolicy({
      organizationId:
        context.organizationId,

      actorId:
        context.employeeId,

      title: body.title,

      code: body.code,

      description:
        body.description,

      content: body.content,

      status:
        body.status,

      version:
        body.version,

      effectiveFrom:
        body.effectiveFrom,

      effectiveTo:
        body.effectiveTo,
    });

  res.status(201).json({
    success: true,
    data: policy,
  });
}

/**
 * PATCH /api/policies/:policyId
 *
 * Updates editable policy fields.
 */
export async function updatePolicyController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getContext(req);

  const body =
    updatePolicySchema.parse(
      req.body,
    );

  const policy =
    await updatePolicy({
      organizationId:
        context.organizationId,

      actorId:
        context.employeeId,

      policyId:
        getPolicyId(req),

      title:
        body.title,

      code:
        body.code,

      description:
        body.description,

      content:
        body.content,

      version:
        body.version,

      effectiveFrom:
        body.effectiveFrom,

      effectiveTo:
        body.effectiveTo,
    });

  res.status(200).json({
    success: true,
    data: policy,
  });
}

/**
 * POST /api/policies/:policyId/publish
 *
 * Publishes a policy.
 */
export async function publishPolicyController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getContext(req);

  const policy =
    await publishPolicy(
      context.organizationId,
      context.employeeId,
      getPolicyId(req),
    );

  res.status(200).json({
    success: true,
    data: policy,
  });
}

/**
 * POST /api/policies/:policyId/archive
 *
 * Archives a policy while preserving
 * its historical record.
 */
export async function archivePolicyController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getContext(req);

  const policy =
    await archivePolicy(
      context.organizationId,
      context.employeeId,
      getPolicyId(req),
    );

  res.status(200).json({
    success: true,
    data: policy,
  });
}

/**
 * POST /api/policies/:policyId/restore
 *
 * Restores an archived policy to DRAFT.
 */
export async function restorePolicyController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getContext(req);

  const policy =
    await restorePolicy(
      context.organizationId,
      context.employeeId,
      getPolicyId(req),
    );

  res.status(200).json({
    success: true,
    data: policy,
  });
}

/**
 * DELETE /api/policies/:policyId
 *
 * Permanently deletes a DRAFT policy.
 *
 * Published and archived policies are protected
 * by the service layer.
 */
export async function deletePolicyController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getContext(req);

  await deletePolicy(
    context.organizationId,
    context.employeeId,
    getPolicyId(req),
  );

  res.status(204).send();
}

/**
 * GET /api/policies/summary
 *
 * Returns tenant-scoped policy statistics.
 */
export async function getPolicySummaryController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getContext(req);

  const summary =
    await getPolicySummary(
      context.organizationId,
      context.employeeId,
    );

  res.status(200).json({
    success: true,
    data: summary,
  });
}