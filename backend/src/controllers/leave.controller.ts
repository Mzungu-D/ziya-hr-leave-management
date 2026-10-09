import type { Request, Response } from "express";
import { z } from "zod";

import { db } from "../../prisma/db.js";
import { AppError } from "../middleware/error.middleware.js";

import {
  cancelLeaveRequest,
  createLeaveRequest,
  getLeaveBalances,
  getLeaveRequest,
  hrApproveLeaveRequest,
  hrRejectLeaveRequest,
  listHrPendingRequests,
  listLeaveTypes,
  listManagerPendingRequests,
  listMyLeaveRequests,
  managerApproveLeaveRequest,
  managerRejectLeaveRequest,
} from "../services/leave.service.js";

/**
 * ============================================================================
 * AUTHENTICATED REQUEST CONTEXT
 * ============================================================================
 *
 * Organization/tenant scope is always derived from the authenticated
 * employee. The client is never allowed to provide organizationId.
 */
interface LeaveRequestContext {
  employeeId: string;
  organizationId: string;
  role: string;
}

/**
 * ============================================================================
 * AUTHENTICATED EMPLOYEE CONTEXT
 * ============================================================================
 *
 * Loads the employee from the database rather than trusting role or tenant
 * information supplied by the client.
 */
async function getContext(
  req: Request,
): Promise<LeaveRequestContext> {
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

  if (employee.status !== "ACTIVE") {
    throw new AppError(
      403,
      "This employee account is not active.",
      "EMPLOYEE_ACCOUNT_INACTIVE",
    );
  }

  return {
    employeeId: employee.id,
    organizationId: employee.organizationId,
    role: employee.role,
  };
}

/**
 * ============================================================================
 * CREATE LEAVE REQUEST VALIDATION
 * ============================================================================
 *
 * organizationId and employeeId are intentionally absent.
 *
 * They are derived from req.auth/database context.
 */
const createRequestSchema = z.object({
  leaveTypeId: z
    .string()
    .trim()
    .min(1)
    .max(100),

  startDate: z
    .string()
    .trim()
    .min(1)
    .max(100),

  endDate: z
    .string()
    .trim()
    .min(1)
    .max(100),

  reason: z
    .string()
    .max(2000)
    .nullable()
    .optional(),

  attachmentUrl: z
    .string()
    .max(2000)
    .nullable()
    .optional(),
});

/**
 * ============================================================================
 * APPROVAL DECISION VALIDATION
 * ============================================================================
 *
 * Comments are optional.
 *
 * The backend remains authoritative for:
 * - authenticated employee
 * - tenant
 * - role
 * - request ownership
 * - approval stage
 * - request status
 */
const decisionSchema = z.object({
  comments: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .optional(),
});

/**
 * ============================================================================
 * LEAVE REQUEST ID
 * ============================================================================
 */
function getId(
  req: Request,
): string {
  const value = Array.isArray(
    req.params.leaveRequestId,
  )
    ? req.params.leaveRequestId[0]
    : req.params.leaveRequestId;

  if (!value?.trim()) {
    throw new AppError(
      400,
      "Leave request ID is required.",
      "LEAVE_REQUEST_ID_REQUIRED",
    );
  }

  return value.trim();
}

/**
 * ============================================================================
 * LEAVE TYPES
 * ============================================================================
 *
 * GET /api/leave/types
 *
 * Returns active leave types for the authenticated employee's organization.
 */
export async function listLeaveTypesController(
  req: Request,
  res: Response,
): Promise<void> {
  const context = await getContext(req);

  const leaveTypes =
    await listLeaveTypes(
      context.organizationId,
    );

  res.status(200).json({
    success: true,
    data: leaveTypes,
  });
}

/**
 * ============================================================================
 * LEAVE BALANCES
 * ============================================================================
 *
 * GET /api/leave/balances/me
 *
 * Optional:
 *
 *   ?year=2026
 */
export async function listLeaveBalancesController(
  req: Request,
  res: Response,
): Promise<void> {
  const context = await getContext(req);

  const rawYear =
    typeof req.query.year === "string"
      ? Number(req.query.year)
      : new Date().getUTCFullYear();

  const year =
    Number.isInteger(rawYear) &&
    rawYear >= 2000 &&
    rawYear <= 2200
      ? rawYear
      : new Date().getUTCFullYear();

  const balances =
    await getLeaveBalances(
      context.organizationId,
      context.employeeId,
      year,
    );

  res.status(200).json({
    success: true,
    data: balances,
  });
}

/**
 * ============================================================================
 * CREATE LEAVE REQUEST
 * ============================================================================
 *
 * POST /api/leave/requests
 *
 * Tenant and employee identity are derived exclusively from the authenticated
 * session.
 */
export async function createLeaveRequestController(
  req: Request,
  res: Response,
): Promise<void> {
  const context = await getContext(req);

  const body =
    createRequestSchema.parse(
      req.body,
    );

  const leaveRequest =
    await createLeaveRequest({
      organizationId:
        context.organizationId,

      employeeId:
        context.employeeId,

      ...body,
    });

  res.status(201).json({
    success: true,
    data: leaveRequest,
  });
}

/**
 * ============================================================================
 * EMPLOYEE REQUESTS
 * ============================================================================
 *
 * GET /api/leave/requests/me
 */
export async function listMyLeaveRequestsController(
  req: Request,
  res: Response,
): Promise<void> {
  const context = await getContext(req);

  const requests =
    await listMyLeaveRequests(
      context.organizationId,
      context.employeeId,
    );

  res.status(200).json({
    success: true,
    data: requests,
  });
}

/**
 * ============================================================================
 * SINGLE LEAVE REQUEST
 * ============================================================================
 *
 * GET /api/leave/requests/:leaveRequestId
 */
export async function getLeaveRequestController(
  req: Request,
  res: Response,
): Promise<void> {
  const context = await getContext(req);

  const leaveRequest =
    await getLeaveRequest(
      context.organizationId,
      context.employeeId,
      getId(req),
    );

  res.status(200).json({
    success: true,
    data: leaveRequest,
  });
}

/**
 * ============================================================================
 * CANCEL LEAVE REQUEST
 * ============================================================================
 *
 * POST /api/leave/requests/:leaveRequestId/cancel
 */
export async function cancelLeaveRequestController(
  req: Request,
  res: Response,
): Promise<void> {
  const context = await getContext(req);

  const leaveRequest =
    await cancelLeaveRequest(
      context.organizationId,
      context.employeeId,
      getId(req),
    );

  res.status(200).json({
    success: true,
    data: leaveRequest,
  });
}

/**
 * ============================================================================
 * MANAGER / DEPARTMENT LEAD QUEUE
 * ============================================================================
 *
 * GET /api/leave/requests/pending/manager
 *
 * The service determines which requests belong to the authenticated manager.
 * The frontend does not provide departmentId, employeeId, or organizationId.
 */
export async function listManagerPendingRequestsController(
  req: Request,
  res: Response,
): Promise<void> {
  const context = await getContext(req);

  const requests =
    await listManagerPendingRequests(
      context.organizationId,
      context.employeeId,
    );

  res.status(200).json({
    success: true,
    data: requests,
  });
}

/**
 * ============================================================================
 * MANAGER APPROVAL
 * ============================================================================
 *
 * POST /api/leave/requests/:leaveRequestId/manager-approve
 *
 * The backend service remains responsible for determining whether the
 * authenticated manager is actually authorized to approve this request.
 */
export async function managerApproveController(
  req: Request,
  res: Response,
): Promise<void> {
  const context = await getContext(req);

  const body =
    decisionSchema.parse(
      req.body ?? {},
    );

  const leaveRequest =
    await managerApproveLeaveRequest(
      context.organizationId,
      context.employeeId,
      getId(req),
      body.comments ?? null,
    );

  res.status(200).json({
    success: true,
    data: leaveRequest,
  });
}

/**
 * ============================================================================
 * MANAGER REJECTION
 * ============================================================================
 *
 * POST /api/leave/requests/:leaveRequestId/manager-reject
 */
export async function managerRejectController(
  req: Request,
  res: Response,
): Promise<void> {
  const context = await getContext(req);

  const body =
    decisionSchema.parse(
      req.body ?? {},
    );

  const leaveRequest =
    await managerRejectLeaveRequest(
      context.organizationId,
      context.employeeId,
      getId(req),
      body.comments ?? null,
    );

  res.status(200).json({
    success: true,
    data: leaveRequest,
  });
}

/**
 * ============================================================================
 * HR APPROVAL QUEUE
 * ============================================================================
 *
 * GET /api/leave/requests/pending/hr
 *
 * HR receives the final approval queue.
 *
 * Tenant scope is derived from the authenticated HR employee.
 */
export async function listHrPendingRequestsController(
  req: Request,
  res: Response,
): Promise<void> {
  const context = await getContext(req);

  const requests =
    await listHrPendingRequests(
      context.organizationId,
      context.employeeId,
    );

  res.status(200).json({
    success: true,
    data: requests,
  });
}

/**
 * ============================================================================
 * HR FINAL APPROVAL
 * ============================================================================
 *
 * POST /api/leave/requests/:leaveRequestId/hr-approve
 *
 * This is the final HR approval stage.
 */
export async function hrApproveController(
  req: Request,
  res: Response,
): Promise<void> {
  const context = await getContext(req);

  const body =
    decisionSchema.parse(
      req.body ?? {},
    );

  const leaveRequest =
    await hrApproveLeaveRequest(
      context.organizationId,
      context.employeeId,
      getId(req),
      body.comments ?? null,
    );

  res.status(200).json({
    success: true,
    data: leaveRequest,
  });
}

/**
 * ============================================================================
 * HR FINAL REJECTION
 * ============================================================================
 *
 * POST /api/leave/requests/:leaveRequestId/hr-reject
 */
export async function hrRejectController(
  req: Request,
  res: Response,
): Promise<void> {
  const context = await getContext(req);

  const body =
    decisionSchema.parse(
      req.body ?? {},
    );

  const leaveRequest =
    await hrRejectLeaveRequest(
      context.organizationId,
      context.employeeId,
      getId(req),
      body.comments ?? null,
    );

  res.status(200).json({
    success: true,
    data: leaveRequest,
  });
}