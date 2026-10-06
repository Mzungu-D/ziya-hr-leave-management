import type {
  Request,
  Response,
} from "express";

import { z } from "zod";

import { db } from "../../prisma/db.js";

import {
  AppError,
} from "../middleware/error.middleware.js";

import {
  activateLeaveType,
  createLeaveType,
  deactivateLeaveType,
  getLeaveType,
  listActiveLeaveTypes,
  listLeaveTypes,
  updateLeaveType,
} from "../services/leave-type.service.js";


/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface AuthenticatedEmployeeContext {
  employeeId: string;

  organizationId: string;

  role:
    | "EMPLOYEE"
    | "MANAGER"
    | "HR_ADMIN"
    | "SUPER_ADMIN";
}


/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Leave type creation.
 *
 * organizationId is intentionally NOT accepted from the client.
 * It is always derived from the authenticated employee.
 */
const createLeaveTypeSchema =
  z
    .object({
      name:
        z
          .string()
          .trim()
          .min(1)
          .max(120),

      code:
        z
          .string()
          .trim()
          .min(1)
          .max(50),

      daysPerYear:
        z
          .number()
          .int()
          .min(0)
          .max(2_147_483_647),

      isActive:
        z
          .boolean()
          .optional(),

      requiresDocument:
        z
          .boolean()
          .optional(),
    })
    .strict();


/**
 * Leave type update.
 *
 * PATCH semantics:
 * every field is optional, but at least one field must be
 * supplied by the caller.
 */
const updateLeaveTypeSchema =
  z
    .object({
      name:
        z
          .string()
          .trim()
          .min(1)
          .max(120)
          .optional(),

      code:
        z
          .string()
          .trim()
          .min(1)
          .max(50)
          .optional(),

      daysPerYear:
        z
          .number()
          .int()
          .min(0)
          .max(2_147_483_647)
          .optional(),

      isActive:
        z
          .boolean()
          .optional(),

      requiresDocument:
        z
          .boolean()
          .optional(),
    })
    .strict()
    .refine(
      (value) =>
        Object.keys(value).length > 0,
      {
        message:
          "At least one leave type field must be supplied.",
        path: [],
      }
    );


/**
 * Query validation.
 *
 * Active leave types are returned by default.
 *
 * HR administrators may explicitly request inactive records
 * when maintaining the configuration catalogue.
 */
const listLeaveTypesQuerySchema =
  z
    .object({
      includeInactive:
        z
          .enum([
            "true",
            "false",
          ])
          .optional(),
    })
    .strict();


/* -------------------------------------------------------------------------- */
/* Authentication / organization context                                      */
/* -------------------------------------------------------------------------- */

async function getAuthenticatedEmployeeContext(
  req: Request,
): Promise<AuthenticatedEmployeeContext> {
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
        id:
          req.auth.employeeId,
      })
      .first();

  if (!employee) {
    throw new AppError(
      401,
      "The authenticated employee account could not be found.",
      "AUTHENTICATED_EMPLOYEE_NOT_FOUND",
    );
  }

  if (
    employee.status !==
    "ACTIVE"
  ) {
    throw new AppError(
      403,
      "This employee account is not active.",
      "EMPLOYEE_ACCOUNT_INACTIVE",
    );
  }

  return {
    employeeId:
      employee.id,

    organizationId:
      employee.organizationId,

    role:
      employee.role as AuthenticatedEmployeeContext["role"],
  };
}


/* -------------------------------------------------------------------------- */
/* Route parameter helpers                                                     */
/* -------------------------------------------------------------------------- */

function getLeaveTypeIdParam(
  req: Request,
): string {
  const rawLeaveTypeId =
    req.params.leaveTypeId;

  const leaveTypeId =
    Array.isArray(
      rawLeaveTypeId
    )
      ? rawLeaveTypeId[0]
      : rawLeaveTypeId;

  const normalizedLeaveTypeId =
    leaveTypeId?.trim();

  if (
    !normalizedLeaveTypeId
  ) {
    throw new AppError(
      400,
      "Leave type ID is required.",
      "LEAVE_TYPE_ID_REQUIRED",
    );
  }

  return normalizedLeaveTypeId;
}


/* -------------------------------------------------------------------------- */
/* List leave types                                                            */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/leave-types
 *
 * By default returns only active leave types.
 *
 * GET /api/leave-types?includeInactive=true
 * returns the complete configuration catalogue.
 */
export async function listLeaveTypesController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getAuthenticatedEmployeeContext(
      req,
    );

  const query =
    listLeaveTypesQuerySchema.parse(
      req.query,
    );

  const includeInactive =
    query.includeInactive ===
    "true";

  const leaveTypes =
    includeInactive
      ? await listLeaveTypes(
          context.organizationId,
          {
            includeInactive:
              true,
          },
        )
      : await listActiveLeaveTypes(
          context.organizationId,
        );

  res.status(200).json({
    success: true,

    data: leaveTypes,
  });
}


/* -------------------------------------------------------------------------- */
/* Get leave type                                                              */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/leave-types/:leaveTypeId
 */
export async function getLeaveTypeController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getAuthenticatedEmployeeContext(
      req,
    );

  const leaveTypeId =
    getLeaveTypeIdParam(
      req,
    );

  const leaveType =
    await getLeaveType(
      context.organizationId,
      leaveTypeId,
    );

  res.status(200).json({
    success: true,

    data: leaveType,
  });
}


/* -------------------------------------------------------------------------- */
/* Create leave type                                                           */
/* -------------------------------------------------------------------------- */

/**
 * POST /api/leave-types
 */
export async function createLeaveTypeController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getAuthenticatedEmployeeContext(
      req,
    );

  const body =
    createLeaveTypeSchema.parse(
      req.body,
    );

  const leaveType =
    await createLeaveType({
      organizationId:
        context.organizationId,

      name:
        body.name,

      code:
        body.code,

      daysPerYear:
        body.daysPerYear,

      isActive:
        body.isActive,

      requiresDocument:
        body.requiresDocument,
    });

  res.status(201).json({
    success: true,

    data: leaveType,
  });
}


/* -------------------------------------------------------------------------- */
/* Update leave type                                                           */
/* -------------------------------------------------------------------------- */

/**
 * PATCH /api/leave-types/:leaveTypeId
 */
export async function updateLeaveTypeController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getAuthenticatedEmployeeContext(
      req,
    );

  const leaveTypeId =
    getLeaveTypeIdParam(
      req,
    );

  const body =
    updateLeaveTypeSchema.parse(
      req.body,
    );

  const leaveType =
    await updateLeaveType({
      organizationId:
        context.organizationId,

      leaveTypeId,

      ...(body.name !== undefined
        ? {
            name:
              body.name,
          }
        : {}),

      ...(body.code !== undefined
        ? {
            code:
              body.code,
          }
        : {}),

      ...(body.daysPerYear !==
      undefined
        ? {
            daysPerYear:
              body.daysPerYear,
          }
        : {}),

      ...(body.isActive !==
      undefined
        ? {
            isActive:
              body.isActive,
          }
        : {}),

      ...(body.requiresDocument !==
      undefined
        ? {
            requiresDocument:
              body.requiresDocument,
          }
        : {}),
    });

  res.status(200).json({
    success: true,

    data: leaveType,
  });
}


/* -------------------------------------------------------------------------- */
/* Deactivate leave type                                                      */
/* -------------------------------------------------------------------------- */

/**
 * PATCH /api/leave-types/:leaveTypeId/deactivate
 *
 * This does NOT delete the leave type.
 *
 * Historical leave requests and balances can continue to
 * reference the record.
 */
export async function deactivateLeaveTypeController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getAuthenticatedEmployeeContext(
      req,
    );

  const leaveTypeId =
    getLeaveTypeIdParam(
      req,
    );

  const leaveType =
    await deactivateLeaveType(
      context.organizationId,
      leaveTypeId,
    );

  res.status(200).json({
    success: true,

    data: leaveType,
  });
}


/* -------------------------------------------------------------------------- */
/* Activate leave type                                                        */
/* -------------------------------------------------------------------------- */

/**
 * PATCH /api/leave-types/:leaveTypeId/activate
 */
export async function activateLeaveTypeController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getAuthenticatedEmployeeContext(
      req,
    );

  const leaveTypeId =
    getLeaveTypeIdParam(
      req,
    );

  const leaveType =
    await activateLeaveType(
      context.organizationId,
      leaveTypeId,
    );

  res.status(200).json({
    success: true,

    data: leaveType,
  });
}