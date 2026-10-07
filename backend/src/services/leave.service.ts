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

const ACTIVE_OVERLAP_STATUSES: LeaveRequestStatus[] = [
  "PENDING",
  "MANAGER_APPROVED",
  "HR_APPROVED",
];

function requireId(
  value: string,
  label: string,
  code: string,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new AppError(
      400,
      `${label} is required.`,
      code,
    );
  }

  return normalized;
}

function normalizeOptionalText(
  value: string | null | undefined,
  max: number,
): string | null {
  if (value == null) {
    return null;
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

function parseDate(
  value: string,
  label: string,
): Date {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw new AppError(
      400,
      `${label} must be a valid date.`,
      "INVALID_DATE",
    );
  }

  return date;
}

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
    startOfUtcDay(startDate).getTime();

  const end =
    startOfUtcDay(endDate).getTime();

  if (end < start) {
    throw new AppError(
      400,
      "End date cannot be before start date.",
      "INVALID_LEAVE_DATE_RANGE",
    );
  }

  return (
    Math.floor(
      (end - start) / 86400000,
    ) + 1
  );
}

function toPublicRequest(
  request: any,
) {
  return {
    id: request.id,

    employeeId:
      request.employeeId,

    employee:
      request.employee
        ? {
            id: request.employee.id,
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
              request.leaveType.isActive,
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
        request.approvals ?? []
      ).map(
        (approval: any) => ({
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

async function getEmployeeInOrganization(
  organizationId: string,
  employeeId: string,
) {
  const employee =
    await db.orm.public.Employee
      .include("department")
      .where({
        id: employeeId,
        organizationId,
      })
      .first();

  if (!employee) {
    throw new AppError(
      404,
      "Employee not found.",
      "EMPLOYEE_NOT_FOUND",
    );
  }

  if (employee.status !== "ACTIVE") {
    throw new AppError(
      403,
      "Only active employees can use leave management.",
      "EMPLOYEE_ACCOUNT_INACTIVE",
    );
  }

  return employee;
}

async function getLeaveTypeInOrganization(
  organizationId: string,
  leaveTypeId: string,
) {
  const leaveType =
    await db.orm.public.LeaveType
      .where({
        id: leaveTypeId,
        organizationId,
      })
      .first();

  if (!leaveType) {
    throw new AppError(
      404,
      "Leave type not found.",
      "LEAVE_TYPE_NOT_FOUND",
    );
  }

  if (!leaveType.isActive) {
    throw new AppError(
      409,
      "This leave type is inactive and cannot be requested.",
      "LEAVE_TYPE_INACTIVE",
    );
  }

  return leaveType;
}

async function getRequestInOrganization(
  organizationId: string,
  leaveRequestId: string,
) {
  const request =
    await db.orm.public.LeaveRequest
      .include("employee")
      .include("department")
      .include("leaveType")
      .include("approvals")
      .where({
        id: leaveRequestId,
      })
      .first();

  if (
    !request ||
    request.employee?.organizationId !==
      organizationId
  ) {
    throw new AppError(
      404,
      "Leave request not found.",
      "LEAVE_REQUEST_NOT_FOUND",
    );
  }

  return request;
}

async function ensureNoDepartmentCapacityConflict(
  organizationId: string,
  departmentId: string | null,
  startDate: Date,
  endDate: Date,
): Promise<void> {
  if (!departmentId) {
    return;
  }

  const requests =
    await db.orm.public.LeaveRequest
      .where({
        departmentId,
      })
      .all();

  const overlappingEmployeeIds =
    new Set<string>();

  const start =
    startOfUtcDay(startDate).getTime();

  const end =
    startOfUtcDay(endDate).getTime();

  for (const request of requests) {
    if (
      !ACTIVE_OVERLAP_STATUSES.includes(
        request.status as LeaveRequestStatus,
      )
    ) {
      continue;
    }

    const requestStart =
      startOfUtcDay(
        new Date(request.startDate),
      ).getTime();

    const requestEnd =
      startOfUtcDay(
        new Date(request.endDate),
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

  if (
    overlappingEmployeeIds.size >= 3
  ) {
    throw new AppError(
      409,
      "Leave cannot be submitted because the maximum of three employees from this department would be on leave during the selected period.",
      "DEPARTMENT_LEAVE_CAPACITY_EXCEEDED",
    );
  }

  void organizationId;
}

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

  return tx.orm.public.LeaveBalance.create({
    id: randomUUID(),
    employeeId,
    leaveTypeId,
    year,
    allocatedDays:
      Math.max(
        allocatedDays,
        0,
      ),
    pendingDays: 0,
    usedDays: 0,
    createdAt:
      new Date().toISOString(),
    updatedAt:
      new Date().toISOString(),
  });
}

function assertBalanceAvailable(
  balance: any,
  requestedDays: number,
): void {
  const available =
    balance.allocatedDays -
    balance.usedDays -
    balance.pendingDays;

  if (
    available < requestedDays
  ) {
    throw new AppError(
      409,
      `Insufficient leave balance. ${available} day(s) are available for this leave type.`,
      "INSUFFICIENT_LEAVE_BALANCE",
    );
  }
}

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
    (leaveType: any) => ({
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

export async function getLeaveBalances(
  organizationId: string,
  employeeId: string,
  year =
    new Date().getUTCFullYear(),
) {
  const employee =
    await getEmployeeInOrganization(
      organizationId,
      employeeId,
    );

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
    (balance: any) => ({
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

      allocatedDays:
        balance.allocatedDays,

      pendingDays:
        balance.pendingDays,

      usedDays:
        balance.usedDays,

      remainingDays:
        Math.max(
          balance.allocatedDays -
            balance.pendingDays -
            balance.usedDays,
          0,
        ),
    }),
  );
}

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
      2000,
    );

  const attachmentUrl =
    normalizeOptionalText(
      params.attachmentUrl,
      2000,
    );

  if (requestedDays <= 0) {
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

  await ensureNoDepartmentCapacityConflict(
    organizationId,
    employee.departmentId ??
      null,
    startDate,
    endDate,
  );

  const year =
    startDate.getUTCFullYear();

  const endYear =
    endDate.getUTCFullYear();

  if (year !== endYear) {
    throw new AppError(
      400,
      "A leave request cannot cross calendar years. Submit separate requests for each year.",
      "LEAVE_CROSSES_YEAR",
    );
  }

  const created =
    await db.transaction(
      async (tx: any) => {
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
              id: randomUUID(),

              employeeId:
                employee.id,

              departmentId:
                employee.departmentId ??
                null,

              leaveTypeId:
                leaveType.id,

              startDate:
                startDate.toISOString(),

              endDate:
                endDate.toISOString(),

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
            id: balance.id,
          })
          .update({
            pendingDays:
              balance.pendingDays +
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

export async function listMyLeaveRequests(
  organizationId: string,
  employeeId: string,
) {
  const employee =
    await getEmployeeInOrganization(
      organizationId,
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
    toPublicRequest,
  );
}

export async function getLeaveRequest(
  organizationId: string,
  employeeId: string,
  leaveRequestId: string,
) {
  const request =
    await getRequestInOrganization(
      organizationId,
      requireId(
        leaveRequestId,
        "Leave request ID",
        "LEAVE_REQUEST_ID_REQUIRED",
      ),
    );

  const actor =
    await getEmployeeInOrganization(
      organizationId,
      employeeId,
    );

  const isOwner =
    request.employeeId ===
    employeeId;

  const isHr =
    [
      "HR_ADMIN",
      "SUPER_ADMIN",
    ].includes(
      actor.role,
    );

  const isDepartmentLead =
    request.department
      ?.departmentLeadId ===
    employeeId;

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

async function ensureManagerCanAct(
  organizationId: string,
  actorId: string,
  request: any,
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
    ].includes(actor.role)
  ) {
    throw new AppError(
      403,
      "Only a manager or department lead can approve this request.",
      "MANAGER_APPROVAL_FORBIDDEN",
    );
  }

  if (
    request.employeeId ===
    actorId
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
    actorId;

  const isReportingManager =
    request.employee
      ?.reportsToId ===
    actorId;

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
    ].includes(actor.role)
  ) {
    throw new AppError(
      403,
      "Only HR administrators can perform final leave approval.",
      "HR_APPROVAL_FORBIDDEN",
    );
  }
}

export async function listManagerPendingRequests(
  organizationId: string,
  actorId: string,
) {
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
    ].includes(actor.role)
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
      (request: any) =>
        request.employee
          ?.organizationId ===
          organizationId &&
        (
          request.department
            ?.departmentLeadId ===
            actorId ||
          request.employee
            ?.reportsToId ===
            actorId
        ),
    )
    .map(
      toPublicRequest,
    );
}

export async function listHrPendingRequests(
  organizationId: string,
  actorId: string,
) {
  await ensureHrCanAct(
    organizationId,
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
      (request: any) =>
        request.employee
          ?.organizationId ===
        organizationId,
    )
    .map(
      toPublicRequest,
    );
}

async function writeApproval(
  organizationId: string,
  actorId: string,
  leaveRequestId: string,
  action: LeaveApprovalAction,
  comments: string | null,
  stage: "MANAGER" | "HR",
) {
  const request =
    await getRequestInOrganization(
      organizationId,
      leaveRequestId,
    );

  if (
    stage === "MANAGER"
  ) {
    await ensureManagerCanAct(
      organizationId,
      actorId,
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
      organizationId,
      actorId,
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

  const now =
    new Date().toISOString();

  const normalizedComments =
    normalizeOptionalText(
      comments,
      2000,
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
                leaveRequestId,
            })
            .first();

        if (
          !fresh ||
          fresh.employee
            ?.organizationId !==
            organizationId
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

        const updatedRequest =
          await tx.orm.public.LeaveRequest
            .where({
              id:
                leaveRequestId,
            })
            .update(
              updateData,
            );

        await tx.orm.public.LeaveApproval.create(
          {
            id:
              randomUUID(),

            leaveRequestId,

            approverId:
              actorId,

            action,

            comments:
              normalizedComments,

            createdAt:
              now,
          },
        );

        if (
          action ===
          "REJECTED"
        ) {
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

          if (balance) {
            await tx.orm.public.LeaveBalance
              .where({
                id:
                  balance.id,
              })
              .update({
                pendingDays:
                  Math.max(
                    balance.pendingDays -
                      fresh.requestedDays,
                    0,
                  ),

                updatedAt:
                  now,
              });
          }
        }

        if (
          stage === "HR" &&
          action ===
            "APPROVED"
        ) {
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
              "Leave balance could not be found for the approved request.",
              "LEAVE_BALANCE_NOT_FOUND",
            );
          }

          if (
            balance.pendingDays <
            fresh.requestedDays
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
                balance.pendingDays -
                fresh.requestedDays,

              usedDays:
                balance.usedDays +
                fresh.requestedDays,

              updatedAt:
                now,
            });
        }

        return updatedRequest;
      },
    );

  return getRequestInOrganization(
    organizationId,
    updated.id,
  );
}

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

export async function cancelLeaveRequest(
  organizationId: string,
  employeeId: string,
  leaveRequestId: string,
) {
  const request =
    await getRequestInOrganization(
      organizationId,
      leaveRequestId,
    );

  if (
    request.employeeId !==
    employeeId
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

  const now =
    new Date().toISOString();

  const year =
    new Date(
      request.startDate,
    ).getUTCFullYear();

  await db.transaction(
    async (tx: any) => {
      const fresh =
        await tx.orm.public.LeaveRequest
          .where({
            id:
              request.id,
          })
          .first();

      if (
        !fresh ||
        fresh.employeeId !==
          employeeId ||
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

      await tx.orm.public.LeaveRequest
        .where({
          id:
            fresh.id,
        })
        .update({
          status:
            "CANCELLED",

          updatedAt:
            now,
        });

      const balance =
        await tx.orm.public.LeaveBalance
          .where({
            employeeId,
            leaveTypeId:
              fresh.leaveTypeId,
            year,
          })
          .first();

      if (balance) {
        await tx.orm.public.LeaveBalance
          .where({
            id:
              balance.id,
          })
          .update({
            pendingDays:
              Math.max(
                balance.pendingDays -
                  fresh.requestedDays,
                0,
              ),

            updatedAt:
              now,
          });
      }
    },
  );

  return getRequestInOrganization(
    organizationId,
    request.id,
  );
}