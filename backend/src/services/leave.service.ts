import { randomUUID } from "node:crypto";

import { db } from "../../prisma/db.js";
import { AppError } from "../middleware/error.middleware.js";

export type LeaveRequestStatus =
  | "PENDING"
  | "MANAGER_APPROVED"
  | "HR_APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type LeaveApprovalAction =
  | "APPROVED"
  | "REJECTED";

export interface CreateLeaveRequestParams {
  organizationId: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
  attachmentUrl?: string | null;
}

type DbRecord = Record<string, any>;

const ACTIVE_OVERLAP_STATUSES: LeaveRequestStatus[] = [
  "PENDING",
  "MANAGER_APPROVED",
  "HR_APPROVED",
];

const MAX_TEXT_LENGTH = 2_000;
const MAX_ID_LENGTH = 128;

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

function requireId(
  value: string,
  label: string,
  code: string,
): string {
  if (typeof value !== "string") {
    throw new AppError(
      400,
      `${label} is required.`,
      code,
    );
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new AppError(
      400,
      `${label} is required.`,
      code,
    );
  }

  if (normalized.length > MAX_ID_LENGTH) {
    throw new AppError(
      400,
      `${label} is invalid.`,
      code,
    );
  }

  return normalized;
}

function normalizeOptionalText(
  value: string | null | undefined,
  max = MAX_TEXT_LENGTH,
): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new AppError(
      400,
      "Text value is invalid.",
      "INVALID_TEXT",
    );
  }

  const normalized = value
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length > max) {
    throw new AppError(
      400,
      `Text exceeds the maximum length of ${max} characters.`,
      "TEXT_TOO_LONG",
    );
  }

  return normalized || null;
}

function normalizeAttachmentUrl(
  value: string | null | undefined,
): string | null {
  const normalized =
    normalizeOptionalText(value);

  if (!normalized) {
    return null;
  }

  /*
   * Allow application-relative attachment paths.
   *
   * Reject protocol-relative URLs such as:
   * //evil.example/file
   */
  if (
    normalized.startsWith("/") &&
    !normalized.startsWith("//")
  ) {
    return normalized;
  }

  try {
    const url = new URL(normalized);

    /*
     * Attachment URLs must be HTTPS when absolute.
     */
    if (url.protocol !== "https:") {
      throw new AppError(
        400,
        "Attachment URL must use HTTPS.",
        "INVALID_ATTACHMENT_URL",
      );
    }

    return url.toString();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      400,
      "Attachment URL is invalid.",
      "INVALID_ATTACHMENT_URL",
    );
  }
}

function parseDate(
  value: string,
  label: string,
): Date {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new AppError(
      400,
      `${label} is required.`,
      "INVALID_DATE",
    );
  }

  const date = new Date(value);

  if (
    !Number.isFinite(
      date.getTime(),
    )
  ) {
    throw new AppError(
      400,
      `${label} must be a valid date.`,
      "INVALID_DATE",
    );
  }

  return date;
}

/* -------------------------------------------------------------------------- */
/* Date Helpers                                                               */
/* -------------------------------------------------------------------------- */

function startOfUtcDay(
  value: Date,
): Date {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
    ),
  );
}

function calculateRequestedDays(
  startDate: Date,
  endDate: Date,
): number {
  const start =
    startOfUtcDay(
      startDate,
    ).getTime();

  const end =
    startOfUtcDay(
      endDate,
    ).getTime();

  if (end < start) {
    throw new AppError(
      400,
      "End date cannot be before start date.",
      "INVALID_LEAVE_DATE_RANGE",
    );
  }

  return (
    Math.floor(
      (end - start) /
        86_400_000,
    ) + 1
  );
}

/* -------------------------------------------------------------------------- */
/* Public Response Mapping                                                    */
/* -------------------------------------------------------------------------- */

function toPublicRequest(
  request: DbRecord,
) {
  return {
    id: request.id,

    employeeId:
      request.employeeId,

    employee:
      request.employee
        ? {
            id:
              request.employee.id,

            employeeId:
              request.employee.employeeId,

            firstName:
              request.employee.firstName,

            lastName:
              request.employee.lastName,

            email:
              request.employee.email,

            role:
              request.employee.role,
          }
        : undefined,

    departmentId:
      request.departmentId,

    department:
      request.department
        ? {
            id:
              request.department.id,

            name:
              request.department.name,

            code:
              request.department.code,

            departmentLeadId:
              request.department
                .departmentLeadId ??
              null,
          }
        : null,

    leaveTypeId:
      request.leaveTypeId,

    leaveType:
      request.leaveType
        ? {
            id:
              request.leaveType.id,

            name:
              request.leaveType.name,

            code:
              request.leaveType.code,

            daysPerYear:
              request.leaveType
                .daysPerYear,

            requiresDocument:
              request.leaveType
                .requiresDocument,

            isActive:
              request.leaveType
                .isActive,
          }
        : undefined,

    startDate:
      request.startDate,

    endDate:
      request.endDate,

    requestedDays:
      request.requestedDays,

    reason:
      request.reason,

    attachmentUrl:
      request.attachmentUrl,

    status:
      request.status,

    submittedAt:
      request.submittedAt,

    managerApprovedAt:
      request.managerApprovedAt,

    hrApprovedAt:
      request.hrApprovedAt,

    rejectedAt:
      request.rejectedAt,

    rejectionReason:
      request.rejectionReason,

    updatedAt:
      request.updatedAt,

    approvals:
      (
        request.approvals ??
        []
      ).map(
        (
          approval: DbRecord,
        ) => ({
          id:
            approval.id,

          action:
            approval.action,

          approverId:
            approval.approverId,

          comments:
            approval.comments,

          createdAt:
            approval.createdAt,

          approver:
            approval.approver
              ? {
                  id:
                    approval
                      .approver.id,

                  employeeId:
                    approval
                      .approver
                      .employeeId,

                  firstName:
                    approval
                      .approver
                      .firstName,

                  lastName:
                    approval
                      .approver
                      .lastName,

                  role:
                    approval
                      .approver
                      .role,
                }
              : undefined,
        }),
      ),
  };
}

/* -------------------------------------------------------------------------- */
/* Organization-Scoped Employee                                               */
/* -------------------------------------------------------------------------- */

async function getEmployeeInOrganization(
  organizationId: string,
  employeeId: string,
) {
  const normalizedOrganizationId =
    requireId(
      organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  const normalizedEmployeeId =
    requireId(
      employeeId,
      "Employee ID",
      "EMPLOYEE_ID_REQUIRED",
    );

  const employee =
    await db.orm.public.Employee
      .include("department")
      .where({
        id:
          normalizedEmployeeId,

        organizationId:
          normalizedOrganizationId,
      })
      .first();

  if (!employee) {
    throw new AppError(
      404,
      "Employee not found.",
      "EMPLOYEE_NOT_FOUND",
    );
  }

  if (
    employee.status !==
    "ACTIVE"
  ) {
    throw new AppError(
      403,
      "Only active employees can use leave management.",
      "EMPLOYEE_ACCOUNT_INACTIVE",
    );
  }

  return employee;
}

/* -------------------------------------------------------------------------- */
/* Organization-Scoped Leave Type                                             */
/* -------------------------------------------------------------------------- */

async function getLeaveTypeInOrganization(
  organizationId: string,
  leaveTypeId: string,
) {
  const normalizedOrganizationId =
    requireId(
      organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  const normalizedLeaveTypeId =
    requireId(
      leaveTypeId,
      "Leave type ID",
      "LEAVE_TYPE_ID_REQUIRED",
    );

  const leaveType =
    await db.orm.public.LeaveType
      .where({
        id:
          normalizedLeaveTypeId,

        organizationId:
          normalizedOrganizationId,
      })
      .first();

  if (!leaveType) {
    throw new AppError(
      404,
      "Leave type not found.",
      "LEAVE_TYPE_NOT_FOUND",
    );
  }

  if (
    !leaveType.isActive
  ) {
    throw new AppError(
      409,
      "This leave type is inactive and cannot be requested.",
      "LEAVE_TYPE_INACTIVE",
    );
  }

  return leaveType;
}

/* -------------------------------------------------------------------------- */
/* Organization-Scoped Leave Request                                          */
/* -------------------------------------------------------------------------- */

async function getRequestInOrganization(
  organizationId: string,
  leaveRequestId: string,
) {
  const normalizedOrganizationId =
    requireId(
      organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  const normalizedLeaveRequestId =
    requireId(
      leaveRequestId,
      "Leave request ID",
      "LEAVE_REQUEST_ID_REQUIRED",
    );

  const request =
    await db.orm.public.LeaveRequest
      .include("employee")
      .include("department")
      .include("leaveType")
      .include("approvals")
      .where({
        id:
          normalizedLeaveRequestId,
      })
      .first();

  /*
   * IMPORTANT:
   *
   * LeaveRequest itself does not rely on a client-supplied
   * organizationId. Tenant ownership is verified through
   * the employee attached to the request.
   */
  if (
    !request ||
    request.employee
      ?.organizationId !==
      normalizedOrganizationId
  ) {
    throw new AppError(
      404,
      "Leave request not found.",
      "LEAVE_REQUEST_NOT_FOUND",
    );
  }

  return request;
}

/* -------------------------------------------------------------------------- */
/* Employee Overlap Protection                                                */
/* -------------------------------------------------------------------------- */

async function ensureNoEmployeeOverlap(
  client: any,
  organizationId: string,
  employeeId: string,
  startDate: Date,
  endDate: Date,
): Promise<void> {
  const requests =
    await client.orm.public.LeaveRequest
      .include("employee")
      .where({
        employeeId,
      })
      .all();

  const start =
    startOfUtcDay(
      startDate,
    ).getTime();

  const end =
    startOfUtcDay(
      endDate,
    ).getTime();

  for (
    const request of
      requests as DbRecord[]
  ) {
    /*
     * Never trust the employeeId alone for tenant
     * isolation when evaluating an existing request.
     */
    if (
      request.employee
        ?.organizationId !==
      organizationId
    ) {
      continue;
    }

    if (
      !ACTIVE_OVERLAP_STATUSES.includes(
        request.status as LeaveRequestStatus,
      )
    ) {
      continue;
    }

    const requestStart =
      startOfUtcDay(
        new Date(
          request.startDate,
        ),
      ).getTime();

    const requestEnd =
      startOfUtcDay(
        new Date(
          request.endDate,
        ),
      ).getTime();

    if (
      requestStart <= end &&
      requestEnd >= start
    ) {
      throw new AppError(
        409,
        "You already have an active leave request overlapping the selected dates.",
        "EMPLOYEE_LEAVE_OVERLAP",
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Department Capacity Protection                                             */
/* -------------------------------------------------------------------------- */

async function ensureNoDepartmentCapacityConflict(
  client: any,
  organizationId: string,
  departmentId: string | null,
  startDate: Date,
  endDate: Date,
): Promise<void> {
  if (!departmentId) {
    return;
  }

  const requests =
    await client.orm.public.LeaveRequest
      .include("employee")
      .where({
        departmentId,
      })
      .all();

  const overlappingEmployeeIds =
    new Set<string>();

  const start =
    startOfUtcDay(
      startDate,
    ).getTime();

  const end =
    startOfUtcDay(
      endDate,
    ).getTime();

  for (
    const request of
      requests as DbRecord[]
  ) {
    /*
     * Explicit organization verification prevents a
     * cross-tenant capacity calculation.
     */
    if (
      request.employee
        ?.organizationId !==
      organizationId
    ) {
      continue;
    }

    if (
      !ACTIVE_OVERLAP_STATUSES.includes(
        request.status as LeaveRequestStatus,
      )
    ) {
      continue;
    }

    const requestStart =
      startOfUtcDay(
        new Date(
          request.startDate,
        ),
      ).getTime();

    const requestEnd =
      startOfUtcDay(
        new Date(
          request.endDate,
        ),
      ).getTime();

    if (
      requestStart <= end &&
      requestEnd >= start
    ) {
      overlappingEmployeeIds.add(
        request.employeeId,
      );
    }
  }

  /*
   * Three existing employees means the fourth request
   * must be rejected.
   */
  if (
    overlappingEmployeeIds.size >= 3
  ) {
    throw new AppError(
      409,
      "Leave cannot be submitted because the maximum of three employees from this department would be on leave during the selected period.",
      "DEPARTMENT_LEAVE_CAPACITY_EXCEEDED",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Leave Balance                                                               */
/* -------------------------------------------------------------------------- */

async function getOrCreateBalance(
  tx: any,
  employeeId: string,
  leaveTypeId: string,
  year: number,
  allocatedDays: number,
) {
  const existing =
    await tx.orm.public.LeaveBalance
      .where({
        employeeId,
        leaveTypeId,
        year,
      })
      .first();

  if (existing) {
    return existing;
  }

  const now =
    new Date().toISOString();

  return tx.orm.public.LeaveBalance.create(
    {
      id:
        randomUUID(),

      employeeId,

      leaveTypeId,

      year,

      allocatedDays:
        Math.max(
          Number(
            allocatedDays,
          ) || 0,
          0,
        ),

      pendingDays:
        0,

      usedDays:
        0,

      createdAt:
        now,

      updatedAt:
        now,
    },
  );
}

function assertBalanceAvailable(
  balance: DbRecord,
  requestedDays: number,
): void {
  const allocatedDays =
    Number(
      balance.allocatedDays,
    ) || 0;

  const usedDays =
    Number(
      balance.usedDays,
    ) || 0;

  const pendingDays =
    Number(
      balance.pendingDays,
    ) || 0;

  const available =
    allocatedDays -
    usedDays -
    pendingDays;

  if (
    available <
    requestedDays
  ) {
    throw new AppError(
      409,
      `Insufficient leave balance. ${Math.max(
        available,
        0,
      )} day(s) are available for this leave type.`,
      "INSUFFICIENT_LEAVE_BALANCE",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Leave Types                                                                 */
/* -------------------------------------------------------------------------- */

export async function listLeaveTypes(
  organizationId: string,
) {
  const normalizedOrganizationId =
    requireId(
      organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  const leaveTypes =
    await db.orm.public.LeaveType
      .where({
        organizationId:
          normalizedOrganizationId,
      })
      .all();

  return leaveTypes.map(
    (
      leaveType: DbRecord,
    ) => ({
      id:
        leaveType.id,

      organizationId:
        leaveType.organizationId,

      name:
        leaveType.name,

      code:
        leaveType.code,

      daysPerYear:
        leaveType.daysPerYear,

      isActive:
        leaveType.isActive,

      requiresDocument:
        leaveType.requiresDocument,

      createdAt:
        leaveType.createdAt,

      updatedAt:
        leaveType.updatedAt,
    }),
  );
}

/* -------------------------------------------------------------------------- */
/* Leave Balances                                                              */
/* -------------------------------------------------------------------------- */

export async function getLeaveBalances(
  organizationId: string,
  employeeId: string,
  year =
    new Date().getUTCFullYear(),
) {
  const normalizedOrganizationId =
    requireId(
      organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  const employee =
    await getEmployeeInOrganization(
      normalizedOrganizationId,
      employeeId,
    );

  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2100
  ) {
    throw new AppError(
      400,
      "Leave balance year is invalid.",
      "INVALID_LEAVE_BALANCE_YEAR",
    );
  }

  const balances =
    await db.orm.public.LeaveBalance
      .include("leaveType")
      .where({
        employeeId:
          employee.id,

        year,
      })
      .all();

  return balances.map(
    (
      balance: DbRecord,
    ) => {
      const allocatedDays =
        Number(
          balance.allocatedDays,
        ) || 0;

      const pendingDays =
        Number(
          balance.pendingDays,
        ) || 0;

      const usedDays =
        Number(
          balance.usedDays,
        ) || 0;

      return {
        id:
          balance.id,

        employeeId:
          balance.employeeId,

        leaveTypeId:
          balance.leaveTypeId,

        leaveTypeName:
          balance.leaveType?.name ??
          "Unknown leave type",

        year:
          balance.year,

        allocatedDays,

        pendingDays,

        usedDays,

        remainingDays:
          Math.max(
            allocatedDays -
              pendingDays -
              usedDays,
            0,
          ),
      };
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Create Leave Request                                                        */
/* -------------------------------------------------------------------------- */

export async function createLeaveRequest(
  params: CreateLeaveRequestParams,
) {
  const organizationId =
    requireId(
      params.organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  const employeeId =
    requireId(
      params.employeeId,
      "Employee ID",
      "EMPLOYEE_ID_REQUIRED",
    );

  const leaveTypeId =
    requireId(
      params.leaveTypeId,
      "Leave type ID",
      "LEAVE_TYPE_ID_REQUIRED",
    );

  const employee =
    await getEmployeeInOrganization(
      organizationId,
      employeeId,
    );

  const leaveType =
    await getLeaveTypeInOrganization(
      organizationId,
      leaveTypeId,
    );

  const startDate =
    parseDate(
      params.startDate,
      "Start date",
    );

  const endDate =
    parseDate(
      params.endDate,
      "End date",
    );

  const requestedDays =
    calculateRequestedDays(
      startDate,
      endDate,
    );

  const reason =
    normalizeOptionalText(
      params.reason,
    );

  const attachmentUrl =
    normalizeAttachmentUrl(
      params.attachmentUrl,
    );

  if (
    requestedDays <= 0
  ) {
    throw new AppError(
      400,
      "Leave must contain at least one day.",
      "INVALID_REQUESTED_DAYS",
    );
  }

  if (
    leaveType.requiresDocument &&
    !attachmentUrl
  ) {
    throw new AppError(
      400,
      "A supporting document is required for this leave type.",
      "LEAVE_DOCUMENT_REQUIRED",
    );
  }

  const year =
    startDate.getUTCFullYear();

  const endYear =
    endDate.getUTCFullYear();

  if (
    year !== endYear
  ) {
    throw new AppError(
      400,
      "A leave request cannot cross calendar years. Submit separate requests for each year.",
      "LEAVE_CROSSES_YEAR",
    );
  }

  const created =
    await db.transaction(
      async (tx: any) => {
        /*
         * Recheck inside the transaction.
         *
         * This prevents a request that passed an earlier
         * validation from being written after another leave
         * request changed the relevant state.
         */
        await ensureNoEmployeeOverlap(
          tx,
          organizationId,
          employee.id,
          startDate,
          endDate,
        );

        await ensureNoDepartmentCapacityConflict(
          tx,
          organizationId,
          employee.departmentId ??
            null,
          startDate,
          endDate,
        );

        const balance =
          await getOrCreateBalance(
            tx,
            employee.id,
            leaveType.id,
            year,
            leaveType.daysPerYear,
          );

        assertBalanceAvailable(
          balance,
          requestedDays,
        );

        const now =
          new Date().toISOString();

        const request =
          await tx.orm.public.LeaveRequest.create(
            {
              id:
                randomUUID(),

              employeeId:
                employee.id,

              departmentId:
                employee.departmentId ??
                null,

              leaveTypeId:
                leaveType.id,

              /*
               * Leave is a calendar-day concept.
               * Persist normalized UTC day boundaries.
               */
              startDate:
                startOfUtcDay(
                  startDate,
                ).toISOString(),

              endDate:
                startOfUtcDay(
                  endDate,
                ).toISOString(),

              requestedDays,

              reason,

              attachmentUrl,

              status:
                "PENDING",

              submittedAt:
                now,

              createdAt:
                now,

              updatedAt:
                now,

              managerApprovedAt:
                null,

              hrApprovedAt:
                null,

              rejectedAt:
                null,

              rejectionReason:
                null,
            },
          );

        await tx.orm.public.LeaveBalance
          .where({
            id:
              balance.id,
          })
          .update({
            pendingDays:
              (
                Number(
                  balance.pendingDays,
                ) || 0
              ) +
              requestedDays,

            updatedAt:
              now,
          });

        return request;
      },
    );

  return getRequestInOrganization(
    organizationId,
    created.id,
  );
}

/* -------------------------------------------------------------------------- */
/* Employee Leave Requests                                                    */
/* -------------------------------------------------------------------------- */

export async function listMyLeaveRequests(
  organizationId: string,
  employeeId: string,
) {
  const normalizedOrganizationId =
    requireId(
      organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  const employee =
    await getEmployeeInOrganization(
      normalizedOrganizationId,
      employeeId,
    );

  const requests =
    await db.orm.public.LeaveRequest
      .include("employee")
      .include("department")
      .include("leaveType")
      .include("approvals")
      .where({
        employeeId:
          employee.id,
      })
      .all();

  return requests.map(
    (
      request: DbRecord,
    ) =>
      toPublicRequest(
        request,
      ),
  );
}

/* -------------------------------------------------------------------------- */
/* Get Leave Request                                                           */
/* -------------------------------------------------------------------------- */

export async function getLeaveRequest(
  organizationId: string,
  employeeId: string,
  leaveRequestId: string,
) {
  const normalizedOrganizationId =
    requireId(
      organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  const normalizedEmployeeId =
    requireId(
      employeeId,
      "Employee ID",
      "EMPLOYEE_ID_REQUIRED",
    );

  const request =
    await getRequestInOrganization(
      normalizedOrganizationId,
      leaveRequestId,
    );

  const actor =
    await getEmployeeInOrganization(
      normalizedOrganizationId,
      normalizedEmployeeId,
    );

  const isOwner =
    request.employeeId ===
    normalizedEmployeeId;

  const isHr = [
    "HR_ADMIN",
    "SUPER_ADMIN",
  ].includes(
    actor.role,
  );

  const isDepartmentLead =
    request.department
      ?.departmentLeadId ===
    normalizedEmployeeId;

  if (
    !isOwner &&
    !isHr &&
    !isDepartmentLead
  ) {
    throw new AppError(
      403,
      "You do not have access to this leave request.",
      "LEAVE_REQUEST_FORBIDDEN",
    );
  }

  return toPublicRequest(
    request,
  );
}

/* -------------------------------------------------------------------------- */
/* Manager Authorization                                                      */
/* -------------------------------------------------------------------------- */

async function ensureManagerCanAct(
  organizationId: string,
  actorId: string,
  request: DbRecord,
): Promise<void> {
  const actor =
    await getEmployeeInOrganization(
      organizationId,
      actorId,
    );

  if (
    ![
      "MANAGER",
      "HR_ADMIN",
      "SUPER_ADMIN",
    ].includes(
      actor.role,
    )
  ) {
    throw new AppError(
      403,
      "Only a manager or department lead can approve this request.",
      "MANAGER_APPROVAL_FORBIDDEN",
    );
  }

  if (
    request.employeeId ===
    actor.id
  ) {
    throw new AppError(
      403,
      "You cannot approve your own leave request.",
      "SELF_APPROVAL_FORBIDDEN",
    );
  }

  const isDepartmentLead =
    request.department
      ?.departmentLeadId ===
    actor.id;

  const isReportingManager =
    request.employee
      ?.reportsToId ===
    actor.id;

  if (
    !isDepartmentLead &&
    !isReportingManager
  ) {
    throw new AppError(
      403,
      "You are not the manager or department lead for this employee.",
      "NOT_REQUEST_MANAGER",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* HR Authorization                                                           */
/* -------------------------------------------------------------------------- */

async function ensureHrCanAct(
  organizationId: string,
  actorId: string,
): Promise<void> {
  const actor =
    await getEmployeeInOrganization(
      organizationId,
      actorId,
    );

  if (
    ![
      "HR_ADMIN",
      "SUPER_ADMIN",
    ].includes(
      actor.role,
    )
  ) {
    throw new AppError(
      403,
      "Only HR administrators can perform final leave approval.",
      "HR_APPROVAL_FORBIDDEN",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Manager Pending Requests                                                   */
/* -------------------------------------------------------------------------- */

export async function listManagerPendingRequests(
  organizationId: string,
  actorId: string,
) {
  const normalizedOrganizationId =
    requireId(
      organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  const actor =
    await getEmployeeInOrganization(
      normalizedOrganizationId,
      actorId,
    );

  if (
    ![
      "MANAGER",
      "HR_ADMIN",
      "SUPER_ADMIN",
    ].includes(
      actor.role,
    )
  ) {
    throw new AppError(
      403,
      "Manager access is required.",
      "MANAGER_ACCESS_REQUIRED",
    );
  }

  const requests =
    await db.orm.public.LeaveRequest
      .include("employee")
      .include("department")
      .include("leaveType")
      .include("approvals")
      .where({
        status:
          "PENDING",
      })
      .all();

  return requests
    .filter(
      (
        request: DbRecord,
      ) =>
        request.employee
          ?.organizationId ===
          normalizedOrganizationId &&
        (
          request.department
            ?.departmentLeadId ===
            actor.id ||
          request.employee
            ?.reportsToId ===
            actor.id
        ),
    )
    .map(
      (
        request: DbRecord,
      ) =>
        toPublicRequest(
          request,
        ),
    );
}

/* -------------------------------------------------------------------------- */
/* HR Pending Requests                                                        */
/* -------------------------------------------------------------------------- */

export async function listHrPendingRequests(
  organizationId: string,
  actorId: string,
) {
  const normalizedOrganizationId =
    requireId(
      organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  await ensureHrCanAct(
    normalizedOrganizationId,
    actorId,
  );

  const requests =
    await db.orm.public.LeaveRequest
      .include("employee")
      .include("department")
      .include("leaveType")
      .include("approvals")
      .where({
        status:
          "MANAGER_APPROVED",
      })
      .all();

  return requests
    .filter(
      (
        request: DbRecord,
      ) =>
        request.employee
          ?.organizationId ===
        normalizedOrganizationId,
    )
    .map(
      (
        request: DbRecord,
      ) =>
        toPublicRequest(
          request,
        ),
    );
}

/* -------------------------------------------------------------------------- */
/* Approval Transaction                                                       */
/* -------------------------------------------------------------------------- */

async function writeApproval(
  organizationId: string,
  actorId: string,
  leaveRequestId: string,
  action: LeaveApprovalAction,
  comments: string | null,
  stage: "MANAGER" | "HR",
) {
  const normalizedOrganizationId =
    requireId(
      organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  const normalizedActorId =
    requireId(
      actorId,
      "Actor ID",
      "ACTOR_ID_REQUIRED",
    );

  const normalizedRequestId =
    requireId(
      leaveRequestId,
      "Leave request ID",
      "LEAVE_REQUEST_ID_REQUIRED",
    );

  const request =
    await getRequestInOrganization(
      normalizedOrganizationId,
      normalizedRequestId,
    );

  if (
    stage === "MANAGER"
  ) {
    await ensureManagerCanAct(
      normalizedOrganizationId,
      normalizedActorId,
      request,
    );

    if (
      request.status !==
      "PENDING"
    ) {
      throw new AppError(
        409,
        "This leave request is no longer awaiting manager approval.",
        "INVALID_MANAGER_APPROVAL_STATE",
      );
    }
  } else {
    await ensureHrCanAct(
      normalizedOrganizationId,
      normalizedActorId,
    );

    if (
      request.status !==
      "MANAGER_APPROVED"
    ) {
      throw new AppError(
        409,
        "This leave request is not ready for HR approval.",
        "INVALID_HR_APPROVAL_STATE",
      );
    }
  }

  const normalizedComments =
    normalizeOptionalText(
      comments,
    );

  const updated =
    await db.transaction(
      async (tx: any) => {
        const fresh =
          await tx.orm.public.LeaveRequest
            .include("employee")
            .include("department")
            .include("leaveType")
            .where({
              id:
                normalizedRequestId,
            })
            .first();

        if (
          !fresh ||
          fresh.employee
            ?.organizationId !==
            normalizedOrganizationId
        ) {
          throw new AppError(
            404,
            "Leave request not found.",
            "LEAVE_REQUEST_NOT_FOUND",
          );
        }

        const expectedStatus =
          stage === "MANAGER"
            ? "PENDING"
            : "MANAGER_APPROVED";

        if (
          fresh.status !==
          expectedStatus
        ) {
          throw new AppError(
            409,
            "This leave request has already been processed.",
            "LEAVE_REQUEST_ALREADY_PROCESSED",
          );
        }

        const nextStatus =
          action === "REJECTED"
            ? "REJECTED"
            : stage === "MANAGER"
              ? "MANAGER_APPROVED"
              : "HR_APPROVED";

        const now =
          new Date().toISOString();

        const updateData:
          Record<
            string,
            unknown
          > = {
            status:
              nextStatus,

            updatedAt:
              now,
          };

        if (
          action ===
          "REJECTED"
        ) {
          updateData.rejectedAt =
            now;

          updateData.rejectionReason =
            normalizedComments ??
            "Leave request rejected.";
        } else if (
          stage ===
          "MANAGER"
        ) {
          updateData.managerApprovedAt =
            now;
        } else {
          updateData.hrApprovedAt =
            now;
        }

        /*
         * Conditional state update.
         *
         * The status is part of the WHERE condition so a stale
         * approval cannot overwrite a request that has already
         * been processed by another transaction.
         */
        const updatedRequest =
          await tx.orm.public.LeaveRequest
            .where({
              id:
                normalizedRequestId,

              status:
                expectedStatus,
            })
            .update(
              updateData,
            );

        if (
          !updatedRequest ||
          updatedRequest.status !==
            nextStatus
        ) {
          throw new AppError(
            409,
            "This leave request was changed by another action. Please refresh and try again.",
            "LEAVE_REQUEST_STATE_CHANGED",
          );
        }

        await tx.orm.public.LeaveApproval.create(
          {
            id:
              randomUUID(),

            leaveRequestId:
              normalizedRequestId,

            approverId:
              normalizedActorId,

            action,

            comments:
              normalizedComments,

            createdAt:
              now,
          },
        );

        const year =
          new Date(
            fresh.startDate,
          ).getUTCFullYear();

        const balance =
          await tx.orm.public.LeaveBalance
            .where({
              employeeId:
                fresh.employeeId,

              leaveTypeId:
                fresh.leaveTypeId,

              year,
            })
            .first();

        if (!balance) {
          throw new AppError(
            409,
            "Leave balance could not be found for this request.",
            "LEAVE_BALANCE_NOT_FOUND",
          );
        }

        const pendingDays =
          Number(
            balance.pendingDays,
          ) || 0;

        const requestedDays =
          Number(
            fresh.requestedDays,
          ) || 0;

        if (
          requestedDays <= 0
        ) {
          throw new AppError(
            409,
            "The leave request contains an invalid number of days.",
            "INVALID_REQUESTED_DAYS",
          );
        }

        /*
         * Rejection releases the pending balance.
         */
        if (
          action ===
          "REJECTED"
        ) {
          if (
            pendingDays <
            requestedDays
          ) {
            throw new AppError(
              409,
              "Leave balance is inconsistent with this request.",
              "LEAVE_BALANCE_INCONSISTENT",
            );
          }

          await tx.orm.public.LeaveBalance
            .where({
              id:
                balance.id,
            })
            .update({
              pendingDays:
                pendingDays -
                requestedDays,

              updatedAt:
                now,
            });
        }

        /*
         * Final HR approval moves the days from pending
         * to used.
         */
        if (
          stage === "HR" &&
          action ===
            "APPROVED"
        ) {
          if (
            pendingDays <
            requestedDays
          ) {
            throw new AppError(
              409,
              "Leave balance is inconsistent with this request.",
              "LEAVE_BALANCE_INCONSISTENT",
            );
          }

          await tx.orm.public.LeaveBalance
            .where({
              id:
                balance.id,
            })
            .update({
              pendingDays:
                pendingDays -
                requestedDays,

              usedDays:
                (
                  Number(
                    balance.usedDays,
                  ) || 0
                ) +
                requestedDays,

              updatedAt:
                now,
            });
        }

        return updatedRequest;
      },
    );

  return getRequestInOrganization(
    normalizedOrganizationId,
    updated.id,
  );
}

/* -------------------------------------------------------------------------- */
/* Manager Approval                                                           */
/* -------------------------------------------------------------------------- */

export async function managerApproveLeaveRequest(
  organizationId: string,
  actorId: string,
  leaveRequestId: string,
  comments?: string | null,
) {
  return writeApproval(
    organizationId,
    actorId,
    leaveRequestId,
    "APPROVED",
    comments ?? null,
    "MANAGER",
  );
}

/* -------------------------------------------------------------------------- */
/* Manager Rejection                                                          */
/* -------------------------------------------------------------------------- */

export async function managerRejectLeaveRequest(
  organizationId: string,
  actorId: string,
  leaveRequestId: string,
  comments?: string | null,
) {
  return writeApproval(
    organizationId,
    actorId,
    leaveRequestId,
    "REJECTED",
    comments ?? null,
    "MANAGER",
  );
}

/* -------------------------------------------------------------------------- */
/* HR Approval                                                                */
/* -------------------------------------------------------------------------- */

export async function hrApproveLeaveRequest(
  organizationId: string,
  actorId: string,
  leaveRequestId: string,
  comments?: string | null,
) {
  return writeApproval(
    organizationId,
    actorId,
    leaveRequestId,
    "APPROVED",
    comments ?? null,
    "HR",
  );
}

/* -------------------------------------------------------------------------- */
/* HR Rejection                                                               */
/* -------------------------------------------------------------------------- */

export async function hrRejectLeaveRequest(
  organizationId: string,
  actorId: string,
  leaveRequestId: string,
  comments?: string | null,
) {
  return writeApproval(
    organizationId,
    actorId,
    leaveRequestId,
    "REJECTED",
    comments ?? null,
    "HR",
  );
}

/* -------------------------------------------------------------------------- */
/* Cancel Leave Request                                                       */
/* -------------------------------------------------------------------------- */

export async function cancelLeaveRequest(
  organizationId: string,
  employeeId: string,
  leaveRequestId: string,
) {
  const normalizedOrganizationId =
    requireId(
      organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  const normalizedEmployeeId =
    requireId(
      employeeId,
      "Employee ID",
      "EMPLOYEE_ID_REQUIRED",
    );

  const normalizedRequestId =
    requireId(
      leaveRequestId,
      "Leave request ID",
      "LEAVE_REQUEST_ID_REQUIRED",
    );

  /*
   * Verify that the actor is still an active employee
   * in this organization.
   */
  await getEmployeeInOrganization(
    normalizedOrganizationId,
    normalizedEmployeeId,
  );

  const request =
    await getRequestInOrganization(
      normalizedOrganizationId,
      normalizedRequestId,
    );

  if (
    request.employeeId !==
    normalizedEmployeeId
  ) {
    throw new AppError(
      403,
      "You can only cancel your own leave request.",
      "LEAVE_REQUEST_FORBIDDEN",
    );
  }

  if (
    ![
      "PENDING",
      "MANAGER_APPROVED",
    ].includes(
      request.status,
    )
  ) {
    throw new AppError(
      409,
      "Only pending or manager-approved leave requests can be cancelled.",
      "LEAVE_REQUEST_CANNOT_CANCEL",
    );
  }

  await db.transaction(
    async (tx: any) => {
      const fresh =
        await tx.orm.public.LeaveRequest
          .include("employee")
          .where({
            id:
              normalizedRequestId,
          })
          .first();

      if (
        !fresh ||
        fresh.employee
          ?.organizationId !==
          normalizedOrganizationId ||
        fresh.employeeId !==
          normalizedEmployeeId ||
        ![
          "PENDING",
          "MANAGER_APPROVED",
        ].includes(
          fresh.status,
        )
      ) {
        throw new AppError(
          409,
          "This leave request has already changed and cannot be cancelled.",
          "LEAVE_REQUEST_STATE_CHANGED",
        );
      }

      const now =
        new Date().toISOString();

      /*
       * Conditional cancellation prevents a second action
       * from cancelling an already changed request.
       */
      const updatedRequest =
        await tx.orm.public.LeaveRequest
          .where({
            id:
              fresh.id,

            status:
              fresh.status,
          })
          .update({
            status:
              "CANCELLED",

            updatedAt:
              now,
          });

      if (
        !updatedRequest ||
        updatedRequest.status !==
          "CANCELLED"
      ) {
        throw new AppError(
          409,
          "This leave request was changed by another action. Please refresh and try again.",
          "LEAVE_REQUEST_STATE_CHANGED",
        );
      }

      const year =
        new Date(
          fresh.startDate,
        ).getUTCFullYear();

      const balance =
        await tx.orm.public.LeaveBalance
          .where({
            employeeId:
              normalizedEmployeeId,

            leaveTypeId:
              fresh.leaveTypeId,

            year,
          })
          .first();

      if (!balance) {
        throw new AppError(
          409,
          "Leave balance could not be found for this request.",
          "LEAVE_BALANCE_NOT_FOUND",
        );
      }

      const pendingDays =
        Number(
          balance.pendingDays,
        ) || 0;

      const requestedDays =
        Number(
          fresh.requestedDays,
        ) || 0;

      if (
        requestedDays <= 0
      ) {
        throw new AppError(
          409,
          "The leave request contains an invalid number of days.",
          "INVALID_REQUESTED_DAYS",
        );
      }

      if (
        pendingDays <
        requestedDays
      ) {
        throw new AppError(
          409,
          "Leave balance is inconsistent with this request.",
          "LEAVE_BALANCE_INCONSISTENT",
        );
      }

      await tx.orm.public.LeaveBalance
        .where({
          id:
            balance.id,
        })
        .update({
          pendingDays:
            pendingDays -
            requestedDays,

          updatedAt:
            now,
        });
    },
  );

  return getRequestInOrganization(
    normalizedOrganizationId,
    normalizedRequestId,
  );
}