import { db } from "../../prisma/db.js";
import { AppError } from "../middleware/error.middleware.js";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

type DashboardStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

function startOfMonth(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      1,
      0,
      0,
      0,
      0,
    ),
  );
}

function startOfYear(year: number): Date {
  return new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
}

function startOfNextYear(year: number): Date {
  return new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
}

function isDateBetween(
  value: string | Date | null | undefined,
  start: Date,
  end: Date,
): boolean {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  return (
    !Number.isNaN(date.getTime()) &&
    date >= start &&
    date < end
  );
}

function roundPercentage(value: number): number {
  return Math.round(value * 10) / 10;
}

function toInitials(
  firstName: string,
  lastName: string,
): string {
  const first = firstName.trim().charAt(0).toUpperCase();
  const last = lastName.trim().charAt(0).toUpperCase();

  return `${first}${last}` || "?";
}

function toStatus(status: string): DashboardStatus {
  switch (status) {
    case "PENDING":
    case "MANAGER_APPROVED":
      return "PENDING";

    case "HR_APPROVED":
      return "APPROVED";

    case "REJECTED":
      return "REJECTED";

    case "CANCELLED":
      return "CANCELLED";

    default:
      return "PENDING";
  }
}

async function getAuthenticatedEmployee(
  employeeId: string,
) {
  const employee = await db.orm.public.Employee
    .include("department")
    .where({ id: employeeId })
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

  if (
    employee.role !== "HR_ADMIN" &&
    employee.role !== "SUPER_ADMIN"
  ) {
    throw new AppError(
      403,
      "HR administrator access is required.",
      "HR_ADMIN_ACCESS_REQUIRED",
    );
  }

  return employee;
}

export async function getAdminDashboard(
  employeeId: string,
) {
  const actor =
    await getAuthenticatedEmployee(employeeId);

  /*
   * IMPORTANT:
   *
   * Tenant context comes ONLY from the authenticated
   * employee. The browser must never provide organizationId.
   */
  const organizationId = actor.organizationId;

  const currentDate = new Date();
  const currentYear = currentDate.getUTCFullYear();

  const yearStart = startOfYear(currentYear);
  const nextYearStart =
    startOfNextYear(currentYear);

  const monthStart =
    startOfMonth(currentDate);

  /*
   * Tenant isolation:
   *
   * Employee, Department and LeaveType are directly
   * organization-scoped.
   *
   * LeaveRequest and LeaveBalance are scoped through
   * their Employee relationship because those records
   * do not currently expose organizationId directly.
   *
   * Never accept organizationId from:
   *
   * - query parameters
   * - route parameters
   * - request bodies
   * - frontend state
   */
  const [
    employees,
    departments,
    leaveTypes,
    leaveRequests,
    leaveBalances,
  ] = await Promise.all([
    db.orm.public.Employee
      .where({ organizationId })
      .include("department")
      .all(),

    db.orm.public.Department
      .where({ organizationId })
      .all(),

    db.orm.public.LeaveType
      .where({ organizationId })
      .all(),

    db.orm.public.LeaveRequest
      .include("employee")
      .include("department")
      .include("leaveType")
      .all(),

    db.orm.public.LeaveBalance
      .include("employee")
      .include("leaveType")
      .all(),
  ]);

  /*
   * Keep an explicit tenant-scoped employee collection.
   */
  const organizationEmployees =
    employees.filter(
      (employee: any) =>
        employee.organizationId === organizationId,
    );

  const employeeIds = new Set(
    organizationEmployees.map(
      (employee: any) => employee.id,
    ),
  );

  /*
   * Leave requests are additionally verified against
   * the employee's organization.
   */
  const organizationLeaveRequests =
    leaveRequests.filter(
      (request: any) =>
        employeeIds.has(request.employeeId) &&
        request.employee?.organizationId ===
          organizationId,
    );

  /*
   * Leave balances are additionally verified against
   * the employee's organization.
   */
  const organizationLeaveBalances =
    leaveBalances.filter(
      (balance: any) =>
        employeeIds.has(balance.employeeId) &&
        balance.employee?.organizationId ===
          organizationId,
    );

  /*
   * Active employees.
   */
  const activeEmployees =
    organizationEmployees.filter(
      (employee: any) =>
        employee.status === "ACTIVE",
    );

  /*
   * Pending approvals.
   */
  const pendingApprovals =
    organizationLeaveRequests.filter(
      (request: any) =>
        request.status === "PENDING" ||
        request.status === "MANAGER_APPROVED",
    );

  /*
   * HR approvals completed during the current month.
   */
  const approvedThisMonth =
    organizationLeaveRequests.filter(
      (request: any) =>
        request.status === "HR_APPROVED" &&
        isDateBetween(
          request.hrApprovedAt ??
            request.updatedAt,
          monthStart,
          currentDate,
        ),
    );

  /*
   * Requests submitted during the current month.
   */
  const leaveRequestsThisMonth =
    organizationLeaveRequests.filter(
      (request: any) =>
        isDateBetween(
          request.submittedAt,
          monthStart,
          currentDate,
        ),
    );

  /*
   * Requests submitted during the current year.
   */
  const yearlyRequests =
    organizationLeaveRequests.filter(
      (request: any) =>
        isDateBetween(
          request.submittedAt,
          yearStart,
          nextYearStart,
        ),
    );

  /*
   * Leave request trend.
   */
  const leaveRequestsTrend =
    MONTH_NAMES.map((month, index) => {
      const monthRequests =
        yearlyRequests.filter(
          (request: any) => {
            const submittedAt =
              new Date(request.submittedAt);

            return (
              !Number.isNaN(
                submittedAt.getTime(),
              ) &&
              submittedAt.getUTCMonth() ===
                index
            );
          },
        );

      return {
        month,

        total: monthRequests.length,

        pending:
          monthRequests.filter(
            (request: any) =>
              request.status === "PENDING" ||
              request.status ===
                "MANAGER_APPROVED",
          ).length,

        approved:
          monthRequests.filter(
            (request: any) =>
              request.status ===
              "HR_APPROVED",
          ).length,

        rejected:
          monthRequests.filter(
            (request: any) =>
              request.status === "REJECTED",
          ).length,
      };
    });

  /*
   * Total requested days for the year.
   */
  const yearlyRequestedDays =
    yearlyRequests.reduce(
      (
        total: number,
        request: any,
      ) =>
        total +
        Number(
          request.requestedDays || 0,
        ),
      0,
    );

  /*
   * Leave type distribution.
   */
  const leaveTypeDistribution =
    leaveTypes
      .filter(
        (leaveType: any) =>
          leaveType.organizationId ===
          organizationId,
      )
      .map((leaveType: any) => {
        const days =
          yearlyRequests
            .filter(
              (request: any) =>
                request.leaveTypeId ===
                leaveType.id,
            )
            .reduce(
              (
                total: number,
                request: any,
              ) =>
                total +
                Number(
                  request.requestedDays ||
                    0,
                ),
              0,
            );

        return {
          id: leaveType.id,
          name: leaveType.name,
          code: leaveType.code,
          value: days,

          percentage:
            yearlyRequestedDays > 0
              ? roundPercentage(
                  (days /
                    yearlyRequestedDays) *
                    100,
                )
              : 0,
        };
      })
      .filter(
        (item: any) =>
          item.value > 0,
      )
      .sort(
        (a: any, b: any) =>
          b.value - a.value,
      );

  /*
   * Current-year leave balances.
   */
  const currentYearBalances =
    organizationLeaveBalances.filter(
      (balance: any) =>
        Number(balance.year) ===
        currentYear,
    );

  const balanceByLeaveType =
    new Map<
      string,
      {
        allocated: number;
        used: number;
        pending: number;
      }
    >();

  for (
    const balance of currentYearBalances
  ) {
    const existing =
      balanceByLeaveType.get(
        balance.leaveTypeId,
      ) ?? {
        allocated: 0,
        used: 0,
        pending: 0,
      };

    existing.allocated += Number(
      balance.allocatedDays || 0,
    );

    existing.used += Number(
      balance.usedDays || 0,
    );

    existing.pending += Number(
      balance.pendingDays || 0,
    );

    balanceByLeaveType.set(
      balance.leaveTypeId,
      existing,
    );
  }

  /*
   * Leave utilization.
   */
  const leaveUtilization =
    leaveTypes
      .filter(
        (leaveType: any) =>
          leaveType.organizationId ===
          organizationId,
      )
      .map((leaveType: any) => {
        const balance =
          balanceByLeaveType.get(
            leaveType.id,
          ) ?? {
            allocated: 0,
            used: 0,
            pending: 0,
          };

        const remaining =
          Math.max(
            balance.allocated -
              balance.used -
              balance.pending,
            0,
          );

        return {
          id: leaveType.id,
          name: leaveType.name,

          allocatedDays:
            balance.allocated,

          usedDays:
            balance.used,

          pendingDays:
            balance.pending,

          remainingDays:
            remaining,

          utilizationPercentage:
            balance.allocated > 0
              ? roundPercentage(
                  (balance.used /
                    balance.allocated) *
                    100,
                )
              : 0,
        };
      });

  /*
   * Employee distribution by department.
   */
  const employeeDistributionMap =
    new Map<string, number>();

  for (
    const employee of activeEmployees
  ) {
    const departmentName =
      employee.department?.name?.trim() ||
      "Unassigned";

    employeeDistributionMap.set(
      departmentName,
      (employeeDistributionMap.get(
        departmentName,
      ) ?? 0) + 1,
    );
  }

  const employeeDistribution =
    Array.from(
      employeeDistributionMap.entries(),
    )
      .map(
        ([name, value]) => ({
          name,
          value,

          percentage:
            activeEmployees.length > 0
              ? roundPercentage(
                  (value /
                    activeEmployees.length) *
                    100,
                )
              : 0,
        }),
      )
      .sort(
        (a, b) =>
          b.value - a.value,
      );

  /*
   * Recent leave requests.
   */
  const recentLeaveRequests =
    [...organizationLeaveRequests]
      .sort(
        (a: any, b: any) =>
          new Date(
            b.submittedAt,
          ).getTime() -
          new Date(
            a.submittedAt,
          ).getTime(),
      )
      .slice(0, 10)
      .map(
        (request: any) => ({
          id: request.id,

          employeeId:
            request.employeeId,

          employeeName:
            `${request.employee?.firstName ?? ""} ${
              request.employee?.lastName ?? ""
            }`.trim() ||
            "Unknown employee",

          employeeInitials:
            toInitials(
              request.employee
                ?.firstName ?? "",
              request.employee
                ?.lastName ?? "",
            ),

          department:
            request.department?.name ??
            "Unassigned",

          leaveType:
            request.leaveType?.name ??
            "Leave",

          startDate:
            request.startDate,

          endDate:
            request.endDate,

          requestedDays:
            Number(
              request.requestedDays ||
                0,
            ),

          status:
            toStatus(
              request.status,
            ),

          submittedAt:
            request.submittedAt,
        }),
      );

  /*
   * Upcoming approved leave.
   */
  const upcomingEvents =
    [...organizationLeaveRequests]
      .filter(
        (request: any) =>
          request.status ===
            "HR_APPROVED" &&
          new Date(
            request.endDate,
          ) >= currentDate,
      )
      .sort(
        (a: any, b: any) =>
          new Date(
            a.startDate,
          ).getTime() -
          new Date(
            b.startDate,
          ).getTime(),
      )
      .slice(0, 6)
      .map(
        (request: any) => ({
          id: request.id,

          title:
            `${request.employee?.firstName ?? ""} ${
              request.employee?.lastName ?? ""
            }`.trim() ||
            "Employee",

          date:
            request.startDate,

          description:
            `${
              request.leaveType?.name ??
              "Leave"
            } • ${
              request.requestedDays
            } day(s)`,

          type: "LEAVE" as const,
        }),
      );

  /*
   * Active HR administrators.
   */
  const activeAdmins =
    activeEmployees.filter(
      (employee: any) =>
        employee.role === "HR_ADMIN" ||
        employee.role ===
          "SUPER_ADMIN",
    ).length;

  /*
   * Active managers.
   */
  const managers =
    activeEmployees.filter(
      (employee: any) =>
        employee.role ===
        "MANAGER",
    ).length;

  /*
   * Active leave types.
   */
  const activeLeaveTypes =
    leaveTypes.filter(
      (leaveType: any) =>
        leaveType.isActive === true,
    ).length;

  return {
    generatedAt:
      new Date().toISOString(),

    summary: {
      totalEmployees:
        organizationEmployees.length,

      activeEmployees:
        activeEmployees.length,

      pendingApprovals:
        pendingApprovals.length,

      approvedThisMonth:
        approvedThisMonth.length,

      leaveRequestsThisMonth:
        leaveRequestsThisMonth.length,

      totalLeaveRequests:
        organizationLeaveRequests.length,
    },

    leaveRequestsTrend,

    leaveTypeDistribution,

    leaveUtilization,

    employeeDistribution,

    recentLeaveRequests,

    upcomingEvents,

    /*
     * No fabricated announcements.
     * Connect this to an Announcement model/API
     * when that feature exists.
     */
    announcements: [],

    systemOverview: {
      activeAdmins,

      managers,

      employees:
        activeEmployees.length,

      leaveTypes:
        activeLeaveTypes,

      departments:
        departments.length,

      systemStatus:
        "OPERATIONAL" as const,
    },
  };
}