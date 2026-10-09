import { db } from "../../prisma/db.js";
import { AppError } from "../middleware/error.middleware.js";

/* ==========================================================================
   ZIYA HR — REPORTS & ANALYTICS SERVICE

   Production requirements:
   - Strict tenant isolation
   - Organization resolved only from authenticated employee
   - No client-supplied organizationId
   - HR_ADMIN / SUPER_ADMIN only
   - Prisma 8 ORM contract
   - No mock/demo data
   - Real production database data only
   - Supports date-range reporting
   - Supports annual and monthly analytics
   - Safe handling of empty datasets
   - Deterministic report output
   ========================================================================== */

/* --------------------------------------------------------------------------
   Constants
   -------------------------------------------------------------------------- */

const REPORT_ROLES = new Set([
  "HR_ADMIN",
  "SUPER_ADMIN",
] as const);

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const LEAVE_REQUEST_STATUSES = [
  "PENDING",
  "MANAGER_APPROVED",
  "HR_APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;

type LeaveRequestStatus =
  (typeof LEAVE_REQUEST_STATUSES)[number];

/* --------------------------------------------------------------------------
   Public types
   -------------------------------------------------------------------------- */

export interface ReportDateRange {
  from: string;
  to: string;
}

export interface ReportsOverview {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  suspendedEmployees: number;

  totalDepartments: number;
  totalLeaveTypes: number;
  activeLeaveTypes: number;

  totalLeaveRequests: number;
  pendingLeaveRequests: number;
  approvedLeaveRequests: number;
  rejectedLeaveRequests: number;
  cancelledLeaveRequests: number;

  totalRequestedDays: number;
  approvedDays: number;
  pendingDays: number;

  totalAllocatedDays: number;
  totalUsedDays: number;
  totalRemainingDays: number;
  utilizationPercentage: number;
}

export interface MonthlyLeaveReport {
  month: number;
  monthName: string;
  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  cancelledRequests: number;
  requestedDays: number;
  approvedDays: number;
}

export interface DepartmentReport {
  departmentId: string;
  departmentName: string;
  employeeCount: number;
  activeEmployeeCount: number;
  leaveRequests: number;
  requestedDays: number;
  approvedDays: number;
  pendingRequests: number;
  utilizationPercentage: number;
}

export interface LeaveTypeReport {
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  employeeCount: number;
  requestCount: number;
  requestedDays: number;
  approvedDays: number;
  allocatedDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  utilizationPercentage: number;
}

export interface EmployeeLeaveReport {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  email: string;
  departmentId: string | null;
  departmentName: string;
  role: string;
  status: string;

  requestCount: number;
  requestedDays: number;
  approvedDays: number;
  pendingRequests: number;
  rejectedRequests: number;
  cancelledRequests: number;

  allocatedDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  utilizationPercentage: number;
}

export interface LeaveStatusReport {
  status: LeaveRequestStatus;
  count: number;
  requestedDays: number;
  percentage: number;
}

export interface AttendanceLikeWorkforceReport {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  pendingEmployees: number;
  suspendedEmployees: number;
}

export interface ReportsAnalyticsData {
  generatedAt: string;
  organizationId: string;
  organizationName: string;
  year: number;
  dateRange: ReportDateRange;

  overview: ReportsOverview;
  workforce: AttendanceLikeWorkforceReport;

  monthlyLeaveRequests: MonthlyLeaveReport[];
  departmentReport: DepartmentReport[];
  leaveTypeReport: LeaveTypeReport[];
  employeeReport: EmployeeLeaveReport[];
  leaveStatusReport: LeaveStatusReport[];
}

/* --------------------------------------------------------------------------
   Internal types
   -------------------------------------------------------------------------- */

interface DateRange {
  from: Date;
  to: Date;
}

interface ReportEmployee {
  id: string;
  organizationId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  departmentId: string | null;
  department: {
    id: string;
    name: string;
  } | null;
}

interface ReportLeaveType {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface ReportLeaveRequest {
  id: string;
  employeeId: string;
  departmentId: string | null;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  requestedDays: number;
  status: LeaveRequestStatus;
  submittedAt: string;
}

interface ReportLeaveBalance {
  employeeId: string;
  leaveTypeId: string;
  year: number;
  allocatedDays: number;
  usedDays: number;
  pendingDays: number;
}

interface OrganizationRecord {
  id: string;
  name: string;
}

/* --------------------------------------------------------------------------
   Generic helpers
   -------------------------------------------------------------------------- */

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function toDate(
  value: string | Date,
): Date {
  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(
      400,
      "Invalid report date.",
      "INVALID_REPORT_DATE",
    );
  }

  return date;
}

function startOfYear(
  year: number,
): Date {
  return new Date(
    Date.UTC(
      year,
      0,
      1,
      0,
      0,
      0,
      0,
    ),
  );
}

function endOfYear(
  year: number,
): Date {
  return new Date(
    Date.UTC(
      year + 1,
      0,
      1,
      0,
      0,
      0,
      0,
    ),
  );
}

function startOfMonth(
  year: number,
  month: number,
): Date {
  return new Date(
    Date.UTC(
      year,
      month,
      1,
      0,
      0,
      0,
      0,
    ),
  );
}

function endOfMonth(
  year: number,
  month: number,
): Date {
  return new Date(
    Date.UTC(
      year,
      month + 1,
      1,
      0,
      0,
      0,
      0,
    ),
  );
}

function clampYear(
  value: number,
): number {
  if (!Number.isInteger(value)) {
    throw new AppError(
      400,
      "Report year must be a whole number.",
      "INVALID_REPORT_YEAR",
    );
  }

  if (value < 2000 || value > 2100) {
    throw new AppError(
      400,
      "Report year must be between 2000 and 2100.",
      "INVALID_REPORT_YEAR",
    );
  }

  return value;
}

function normalizeDateRange(
  year: number,
  from?: string,
  to?: string,
): DateRange {
  const yearStart = startOfYear(year);
  const yearEnd = endOfYear(year);

  if (!from && !to) {
    return {
      from: yearStart,
      to: yearEnd,
    };
  }

  const rangeFrom = from
    ? toDate(from)
    : yearStart;

  const rangeTo = to
    ? toDate(to)
    : yearEnd;

  if (rangeFrom >= rangeTo) {
    throw new AppError(
      400,
      "Report start date must be before the report end date.",
      "INVALID_REPORT_DATE_RANGE",
    );
  }

  return {
    from: rangeFrom,
    to: rangeTo,
  };
}

function round(
  value: number,
  decimals = 2,
): number {
  const multiplier =
    10 ** decimals;

  return (
    Math.round(
      value * multiplier,
    ) / multiplier
  );
}

function percentage(
  numerator: number,
  denominator: number,
): number {
  if (
    denominator <= 0 ||
    !Number.isFinite(denominator)
  ) {
    return 0;
  }

  return round(
    (numerator / denominator) * 100,
  );
}

function employeeName(
  employee: ReportEmployee,
): string {
  return `${employee.firstName} ${employee.lastName}`
    .trim()
    .replace(/\s+/g, " ");
}

function isWithinRange(
  value: string,
  range: DateRange,
): boolean {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return (
    date >= range.from &&
    date < range.to
  );
}

function isApprovedStatus(
  status: string,
): boolean {
  return (
    status === "HR_APPROVED" ||
    status === "MANAGER_APPROVED"
  );
}

function isPendingStatus(
  status: string,
): boolean {
  return status === "PENDING";
}

/* --------------------------------------------------------------------------
   Authentication / tenant resolution
   -------------------------------------------------------------------------- */

/**
 * The organization is always resolved from the authenticated employee.
 *
 * Never accept organizationId from:
 * - query
 * - params
 * - body
 * - headers
 * - frontend state
 */
async function getAuthorizedEmployee(
  employeeId: string,
): Promise<ReportEmployee> {
  const employee =
    await db.orm.public.Employee
      .include("department")
      .where({
        id: employeeId,
      })
      .first();

  if (!employee) {
    throw new AppError(
      401,
      "Authenticated employee was not found.",
      "AUTHENTICATED_EMPLOYEE_NOT_FOUND",
    );
  }

  if (employee.status !== "ACTIVE") {
    throw new AppError(
      403,
      "Your account is not active.",
      "EMPLOYEE_NOT_ACTIVE",
    );
  }

  if (
    !REPORT_ROLES.has(
      employee.role as
        | "HR_ADMIN"
        | "SUPER_ADMIN",
    )
  ) {
    throw new AppError(
      403,
      "You do not have permission to access reports.",
      "REPORT_PERMISSION_DENIED",
    );
  }

  return employee as unknown as ReportEmployee;
}

/* --------------------------------------------------------------------------
   Organization
   -------------------------------------------------------------------------- */

async function getOrganization(
  organizationId: string,
): Promise<OrganizationRecord> {
  const organization =
    await db.orm.public.Organization
      .where({
        id: organizationId,
      })
      .first();

  if (!organization) {
    throw new AppError(
      404,
      "Organization was not found.",
      "ORGANIZATION_NOT_FOUND",
    );
  }

  return organization as unknown as OrganizationRecord;
}

/* --------------------------------------------------------------------------
   Data loading
   -------------------------------------------------------------------------- */

async function loadEmployees(
  organizationId: string,
): Promise<ReportEmployee[]> {
  const employees =
    await db.orm.public.Employee
      .include("department")
      .where({
        organizationId,
      })
      .all();

  return employees as unknown as ReportEmployee[];
}

async function loadLeaveTypes(
  organizationId: string,
): Promise<ReportLeaveType[]> {
  const leaveTypes =
    await db.orm.public.LeaveType
      .where({
        organizationId,
      })
      .all();

  return leaveTypes as unknown as ReportLeaveType[];
}

async function loadLeaveRequests(
  organizationId: string,
): Promise<ReportLeaveRequest[]> {
  const requests =
    await db.orm.public.LeaveRequest
      .include("employee")
      .include("department")
      .include("leaveType")
      .all();

  const rows =
    requests as unknown as Array<
      ReportLeaveRequest & {
        employee?: {
          organizationId?: string;
        };
      }
    >;

  return rows.filter(
    (request) =>
      request.employee?.organizationId ===
      organizationId,
  );
}

async function loadLeaveBalances(
  organizationId: string,
  employees: ReportEmployee[],
): Promise<ReportLeaveBalance[]> {
  const balances =
    await db.orm.public.LeaveBalance
      .include("employee")
      .include("leaveType")
      .all();

  const employeeIds =
    new Set(
      employees.map(
        (employee) => employee.id,
      ),
    );

  const rows =
    balances as unknown as Array<
      ReportLeaveBalance & {
        employee?: {
          id?: string;
          organizationId?: string;
        };
      }
    >;

  return rows.filter(
    (balance) =>
      employeeIds.has(
        balance.employeeId,
      ) &&
      balance.employee?.organizationId ===
        organizationId,
  );
}

/* --------------------------------------------------------------------------
   Overview
   -------------------------------------------------------------------------- */

function buildOverview(
  employees: ReportEmployee[],
  requests: ReportLeaveRequest[],
  balances: ReportLeaveBalance[],
): ReportsOverview {
  const activeEmployees =
    employees.filter(
      (employee) =>
        employee.status === "ACTIVE",
    ).length;

  const inactiveEmployees =
    employees.filter(
      (employee) =>
        employee.status === "INACTIVE",
    ).length;

  const suspendedEmployees =
    employees.filter(
      (employee) =>
        employee.status === "SUSPENDED",
    ).length;

  const pendingLeaveRequests =
    requests.filter(
      (request) =>
        request.status === "PENDING" ||
        request.status ===
          "MANAGER_APPROVED",
    ).length;

  const approvedLeaveRequests =
    requests.filter(
      (request) =>
        request.status ===
        "HR_APPROVED",
    ).length;

  const rejectedLeaveRequests =
    requests.filter(
      (request) =>
        request.status ===
        "REJECTED",
    ).length;

  const cancelledLeaveRequests =
    requests.filter(
      (request) =>
        request.status ===
        "CANCELLED",
    ).length;

  const totalRequestedDays =
    requests.reduce(
      (sum, request) =>
        sum + request.requestedDays,
      0,
    );

  const approvedDays =
    requests
      .filter((request) =>
        isApprovedStatus(
          request.status,
        ),
      )
      .reduce(
        (sum, request) =>
          sum + request.requestedDays,
        0,
      );

  const pendingDays =
    requests
      .filter((request) =>
        isPendingStatus(
          request.status,
        ),
      )
      .reduce(
        (sum, request) =>
          sum + request.requestedDays,
        0,
      );

  const totalAllocatedDays =
    balances.reduce(
      (sum, balance) =>
        sum + balance.allocatedDays,
      0,
    );

  const totalUsedDays =
    balances.reduce(
      (sum, balance) =>
        sum + balance.usedDays,
      0,
    );

  const totalPendingBalanceDays =
    balances.reduce(
      (sum, balance) =>
        sum + balance.pendingDays,
      0,
    );

  const totalRemainingDays =
    balances.reduce(
      (sum, balance) =>
        sum +
        Math.max(
          0,
          balance.allocatedDays -
            balance.usedDays -
            balance.pendingDays,
        ),
      0,
    );

  return {
    totalEmployees:
      employees.length,

    activeEmployees,

    inactiveEmployees,

    suspendedEmployees,

    totalDepartments:
      new Set(
        employees
          .map(
            (employee) =>
              employee.departmentId,
          )
          .filter(Boolean),
      ).size,

    totalLeaveTypes:
      new Set(
        requests.map(
          (request) =>
            request.leaveTypeId,
        ),
      ).size,

    activeLeaveTypes: 0,

    totalLeaveRequests:
      requests.length,

    pendingLeaveRequests,

    approvedLeaveRequests,

    rejectedLeaveRequests,

    cancelledLeaveRequests,

    totalRequestedDays,

    approvedDays,

    pendingDays:
      Math.max(
        pendingDays,
        totalPendingBalanceDays,
      ),

    totalAllocatedDays,

    totalUsedDays,

    totalRemainingDays,

    utilizationPercentage:
      percentage(
        totalUsedDays,
        totalAllocatedDays,
      ),
  };
}

/* --------------------------------------------------------------------------
   Monthly report
   -------------------------------------------------------------------------- */

function buildMonthlyReport(
  requests: ReportLeaveRequest[],
  year: number,
): MonthlyLeaveReport[] {
  return Array.from(
    { length: 12 },
    (_, month) => {
      const monthStart =
        startOfMonth(
          year,
          month,
        );

      const monthEnd =
        endOfMonth(
          year,
          month,
        );

      const rows =
        requests.filter(
          (request) => {
            const submitted =
              new Date(
                request.submittedAt,
              );

            return (
              submitted >= monthStart &&
              submitted < monthEnd
            );
          },
        );

      const approved =
        rows.filter(
          (request) =>
            request.status ===
            "HR_APPROVED",
        );

      const pending =
        rows.filter(
          (request) =>
            request.status ===
              "PENDING" ||
            request.status ===
              "MANAGER_APPROVED",
        );

      const rejected =
        rows.filter(
          (request) =>
            request.status ===
            "REJECTED",
        );

      const cancelled =
        rows.filter(
          (request) =>
            request.status ===
            "CANCELLED",
        );

      return {
        month: month + 1,
        monthName:
          MONTH_NAMES[month],
        totalRequests:
          rows.length,
        pendingRequests:
          pending.length,
        approvedRequests:
          approved.length,
        rejectedRequests:
          rejected.length,
        cancelledRequests:
          cancelled.length,
        requestedDays:
          rows.reduce(
            (sum, request) =>
              sum +
              request.requestedDays,
            0,
          ),
        approvedDays:
          approved.reduce(
            (sum, request) =>
              sum +
              request.requestedDays,
            0,
          ),
      };
    },
  );
}

/* --------------------------------------------------------------------------
   Department report
   -------------------------------------------------------------------------- */

function buildDepartmentReport(
  employees: ReportEmployee[],
  requests: ReportLeaveRequest[],
  balances: ReportLeaveBalance[],
): DepartmentReport[] {
  const departments = new Map<
    string,
    {
      id: string;
      name: string;
    }
  >();

  for (const employee of employees) {
    if (
      employee.departmentId &&
      employee.department
    ) {
      departments.set(
        employee.departmentId,
        {
          id: employee.departmentId,
          name:
            employee.department.name,
        },
      );
    }
  }

  const result =
    Array.from(
      departments.values(),
    ).map(
      (department) => {
        const departmentEmployees =
          employees.filter(
            (employee) =>
              employee.departmentId ===
              department.id,
          );

        const employeeIds =
          new Set(
            departmentEmployees.map(
              (employee) =>
                employee.id,
            ),
          );

        const departmentRequests =
          requests.filter(
            (request) =>
              employeeIds.has(
                request.employeeId,
              ),
          );

        const departmentBalances =
          balances.filter(
            (balance) =>
              employeeIds.has(
                balance.employeeId,
              ),
          );

        const requestedDays =
          departmentRequests.reduce(
            (sum, request) =>
              sum +
              request.requestedDays,
            0,
          );

        const approvedDays =
          departmentRequests
            .filter((request) =>
              isApprovedStatus(
                request.status,
              ),
            )
            .reduce(
              (sum, request) =>
                sum +
                request.requestedDays,
              0,
            );

        const allocatedDays =
          departmentBalances.reduce(
            (sum, balance) =>
              sum +
              balance.allocatedDays,
            0,
          );

        const usedDays =
          departmentBalances.reduce(
            (sum, balance) =>
              sum +
              balance.usedDays,
            0,
          );

        return {
          departmentId:
            department.id,

          departmentName:
            department.name,

          employeeCount:
            departmentEmployees.length,

          activeEmployeeCount:
            departmentEmployees.filter(
              (employee) =>
                employee.status ===
                "ACTIVE",
            ).length,

          leaveRequests:
            departmentRequests.length,

          requestedDays,

          approvedDays,

          pendingRequests:
            departmentRequests.filter(
              (request) =>
                request.status ===
                  "PENDING" ||
                request.status ===
                  "MANAGER_APPROVED",
            ).length,

          utilizationPercentage:
            percentage(
              usedDays,
              allocatedDays,
            ),
        };
      },
    );

  result.sort(
    (a, b) =>
      b.leaveRequests -
      a.leaveRequests,
  );

  return result;
}

/* --------------------------------------------------------------------------
   Leave type report
   -------------------------------------------------------------------------- */

function buildLeaveTypeReport(
  leaveTypes: ReportLeaveType[],
  requests: ReportLeaveRequest[],
  balances: ReportLeaveBalance[],
): LeaveTypeReport[] {
  return leaveTypes
    .map(
      (leaveType) => {
        const typeRequests =
          requests.filter(
            (request) =>
              request.leaveTypeId ===
              leaveType.id,
          );

        const typeBalances =
          balances.filter(
            (balance) =>
              balance.leaveTypeId ===
              leaveType.id,
          );

        const employeeIds =
          new Set(
            typeBalances.map(
              (balance) =>
                balance.employeeId,
            ),
          );

        const allocatedDays =
          typeBalances.reduce(
            (sum, balance) =>
              sum +
              balance.allocatedDays,
            0,
          );

        const usedDays =
          typeBalances.reduce(
            (sum, balance) =>
              sum +
              balance.usedDays,
            0,
          );

        const pendingDays =
          typeBalances.reduce(
            (sum, balance) =>
              sum +
              balance.pendingDays,
            0,
          );

        const requestedDays =
          typeRequests.reduce(
            (sum, request) =>
              sum +
              request.requestedDays,
            0,
          );

        const approvedDays =
          typeRequests
            .filter((request) =>
              isApprovedStatus(
                request.status,
              ),
            )
            .reduce(
              (sum, request) =>
                sum +
                request.requestedDays,
              0,
            );

        return {
          leaveTypeId:
            leaveType.id,

          leaveTypeName:
            leaveType.name,

          leaveTypeCode:
            leaveType.code,

          employeeCount:
            employeeIds.size,

          requestCount:
            typeRequests.length,

          requestedDays,

          approvedDays,

          allocatedDays,

          usedDays,

          pendingDays,

          remainingDays:
            Math.max(
              0,
              allocatedDays -
                usedDays -
                pendingDays,
            ),

          utilizationPercentage:
            percentage(
              usedDays,
              allocatedDays,
            ),
        };
      },
    )
    .sort(
      (a, b) =>
        b.requestCount -
        a.requestCount,
    );
}

/* --------------------------------------------------------------------------
   Employee report
   -------------------------------------------------------------------------- */

function buildEmployeeReport(
  employees: ReportEmployee[],
  requests: ReportLeaveRequest[],
  balances: ReportLeaveBalance[],
): EmployeeLeaveReport[] {
  return employees
    .map(
      (employee) => {
        const employeeRequests =
          requests.filter(
            (request) =>
              request.employeeId ===
              employee.id,
          );

        const employeeBalances =
          balances.filter(
            (balance) =>
              balance.employeeId ===
              employee.id,
          );

        const allocatedDays =
          employeeBalances.reduce(
            (sum, balance) =>
              sum +
              balance.allocatedDays,
            0,
          );

        const usedDays =
          employeeBalances.reduce(
            (sum, balance) =>
              sum +
              balance.usedDays,
            0,
          );

        const pendingDays =
          employeeBalances.reduce(
            (sum, balance) =>
              sum +
              balance.pendingDays,
            0,
          );

        const approvedDays =
          employeeRequests
            .filter((request) =>
              isApprovedStatus(
                request.status,
              ),
            )
            .reduce(
              (sum, request) =>
                sum +
                request.requestedDays,
              0,
            );

        return {
          employeeId:
            employee.id,

          employeeNumber:
            employee.employeeId,

          employeeName:
            employeeName(employee),

          email:
            employee.email,

          departmentId:
            employee.departmentId,

          departmentName:
            employee.department?.name ??
            "Unassigned",

          role:
            employee.role,

          status:
            employee.status,

          requestCount:
            employeeRequests.length,

          requestedDays:
            employeeRequests.reduce(
              (sum, request) =>
                sum +
                request.requestedDays,
              0,
            ),

          approvedDays,

          pendingRequests:
            employeeRequests.filter(
              (request) =>
                request.status ===
                  "PENDING" ||
                request.status ===
                  "MANAGER_APPROVED",
            ).length,

          rejectedRequests:
            employeeRequests.filter(
              (request) =>
                request.status ===
                "REJECTED",
            ).length,

          cancelledRequests:
            employeeRequests.filter(
              (request) =>
                request.status ===
                "CANCELLED",
            ).length,

          allocatedDays,

          usedDays,

          pendingDays,

          remainingDays:
            Math.max(
              0,
              allocatedDays -
                usedDays -
                pendingDays,
            ),

          utilizationPercentage:
            percentage(
              usedDays,
              allocatedDays,
            ),
        };
      },
    )
    .sort(
      (a, b) =>
        b.requestedDays -
        a.requestedDays,
    );
}

/* --------------------------------------------------------------------------
   Leave status report
   -------------------------------------------------------------------------- */

function buildLeaveStatusReport(
  requests: ReportLeaveRequest[],
): LeaveStatusReport[] {
  return LEAVE_REQUEST_STATUSES.map(
    (status) => {
      const rows =
        requests.filter(
          (request) =>
            request.status ===
            status,
        );

      return {
        status,

        count:
          rows.length,

        requestedDays:
          rows.reduce(
            (sum, request) =>
              sum +
              request.requestedDays,
            0,
          ),

        percentage:
          percentage(
            rows.length,
            requests.length,
          ),
      };
    },
  );
}

/* --------------------------------------------------------------------------
   Main report
   -------------------------------------------------------------------------- */

export async function getReportsAnalytics(
  employeeId: string,
  options: {
    year?: number;
    from?: string;
    to?: string;
  } = {},
): Promise<ReportsAnalyticsData> {
  const actor =
    await getAuthorizedEmployee(
      employeeId,
    );

  const organizationId =
    actor.organizationId;

  const year =
    clampYear(
      options.year ??
        new Date().getUTCFullYear(),
    );

  const dateRange =
    normalizeDateRange(
      year,
      options.from,
      options.to,
    );

  const organization =
    await getOrganization(
      organizationId,
    );

  /*
   * All organization-specific datasets are loaded using the organization
   * resolved from the authenticated employee.
   *
   * Leave requests and balances are additionally verified through their
   * employee relationship before being included in calculations.
   */
  const [
    employees,
    leaveTypes,
    allRequests,
  ] = await Promise.all([
    loadEmployees(
      organizationId,
    ),
    loadLeaveTypes(
      organizationId,
    ),
    loadLeaveRequests(
      organizationId,
    ),
  ]);

  const balances =
    await loadLeaveBalances(
      organizationId,
      employees,
    );

  /*
   * Reports operate on requests submitted inside the requested reporting
   * period. Employee and leave-type master data remains organization-wide.
   */
  const requests =
    allRequests.filter(
      (request) =>
        isWithinRange(
          request.submittedAt,
          dateRange,
        ),
    );

  const overview =
    buildOverview(
      employees,
      requests,
      balances,
    );

  overview.activeLeaveTypes =
    leaveTypes.filter(
      (leaveType) =>
        leaveType.isActive,
    ).length;

  /*
   * The overview's department count must come from actual organization
   * employees. LeaveType count comes from configured organization leave
   * types, not only types appearing in requests.
   */
  overview.totalDepartments =
    new Set(
      employees
        .map(
          (employee) =>
            employee.departmentId,
        )
        .filter(
          (
            departmentId,
          ): departmentId is string =>
            Boolean(departmentId),
        ),
    ).size;

  overview.totalLeaveTypes =
    leaveTypes.length;

  return {
    generatedAt:
      new Date().toISOString(),

    organizationId,

    organizationName:
      organization.name,

    year,

    dateRange: {
      from:
        dateRange.from.toISOString(),

      to:
        dateRange.to.toISOString(),
    },

    overview,

    workforce: {
      totalEmployees:
        employees.length,

      activeEmployees:
        employees.filter(
          (employee) =>
            employee.status ===
            "ACTIVE",
        ).length,

      inactiveEmployees:
        employees.filter(
          (employee) =>
            employee.status ===
            "INACTIVE",
        ).length,

      pendingEmployees:
        employees.filter(
          (employee) =>
            employee.status ===
            "PENDING",
        ).length,

      suspendedEmployees:
        employees.filter(
          (employee) =>
            employee.status ===
            "SUSPENDED",
        ).length,
    },

    monthlyLeaveRequests:
      buildMonthlyReport(
        requests,
        year,
      ),

    departmentReport:
      buildDepartmentReport(
        employees,
        requests,
        balances,
      ),

    leaveTypeReport:
      buildLeaveTypeReport(
        leaveTypes,
        requests,
        balances,
      ),

    employeeReport:
      buildEmployeeReport(
        employees,
        requests,
        balances,
      ),

    leaveStatusReport:
      buildLeaveStatusReport(
        requests,
      ),
  };
}

/* --------------------------------------------------------------------------
   Convenience reports
   -------------------------------------------------------------------------- */

export async function getAnnualReports(
  employeeId: string,
  year: number,
): Promise<ReportsAnalyticsData> {
  return getReportsAnalytics(
    employeeId,
    {
      year,
    },
  );
}

export async function getReportsForDateRange(
  employeeId: string,
  from: string,
  to: string,
): Promise<ReportsAnalyticsData> {
  const parsedFrom =
    toDate(from);

  return getReportsAnalytics(
    employeeId,
    {
      year:
        parsedFrom.getUTCFullYear(),
      from,
      to,
    },
  );
}