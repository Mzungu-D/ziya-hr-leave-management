/**
 * Ziya HR Leave Management
 *
 * Production dashboard domain contract.
 *
 * IMPORTANT:
 * - This file contains types only.
 * - No API calls belong here.
 * - No organizationId is accepted from the browser.
 * - Tenant/organization scope is resolved by the backend
 *   from the authenticated session.
 */

export const ADMIN_DASHBOARD_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;

export type AdminDashboardStatus =
  (typeof ADMIN_DASHBOARD_STATUSES)[number];

export const ADMIN_SYSTEM_STATUSES = [
  "OPERATIONAL",
  "DEGRADED",
  "OFFLINE",
] as const;

export type AdminSystemStatus =
  (typeof ADMIN_SYSTEM_STATUSES)[number];

export const UPCOMING_EVENT_TYPES = [
  "LEAVE",
] as const;

export type UpcomingEventType =
  (typeof UPCOMING_EVENT_TYPES)[number];

/* -------------------------------------------------------------------------- */
/* Summary                                                                    */
/* -------------------------------------------------------------------------- */

export interface AdminDashboardSummary {
  readonly totalEmployees: number;
  readonly activeEmployees: number;
  readonly pendingApprovals: number;
  readonly approvedThisMonth: number;
  readonly leaveRequestsThisMonth: number;
  readonly totalLeaveRequests: number;
}

/* -------------------------------------------------------------------------- */
/* Leave request trend                                                        */
/* -------------------------------------------------------------------------- */

export interface LeaveRequestsTrendItem {
  readonly month: string;
  readonly total: number;
  readonly pending: number;
  readonly approved: number;
  readonly rejected: number;
}

/* -------------------------------------------------------------------------- */
/* Leave type distribution                                                    */
/* -------------------------------------------------------------------------- */

export interface LeaveTypeDistributionItem {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly value: number;
  readonly percentage: number;
}

/* -------------------------------------------------------------------------- */
/* Leave utilization                                                          */
/* -------------------------------------------------------------------------- */

export interface LeaveUtilizationItem {
  readonly id: string;
  readonly name: string;
  readonly allocatedDays: number;
  readonly usedDays: number;
  readonly pendingDays: number;
  readonly remainingDays: number;
  readonly utilizationPercentage: number;
}

/* -------------------------------------------------------------------------- */
/* Employee distribution                                                      */
/* -------------------------------------------------------------------------- */

export interface EmployeeDistributionItem {
  readonly name: string;
  readonly value: number;
  readonly percentage: number;
}

/* -------------------------------------------------------------------------- */
/* Recent leave requests                                                      */
/* -------------------------------------------------------------------------- */

export interface RecentLeaveRequest {
  readonly id: string;
  readonly employeeId: string;

  readonly employeeName: string;
  readonly employeeInitials: string;

  readonly department: string;
  readonly leaveType: string;

  /**
   * ISO-8601 date returned by the API.
   *
   * Example:
   * 2026-10-07
   */
  readonly startDate: string;

  /**
   * ISO-8601 date returned by the API.
   */
  readonly endDate: string;

  readonly requestedDays: number;

  readonly status: AdminDashboardStatus;

  /**
   * ISO-8601 timestamp returned by the API.
   */
  readonly submittedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Upcoming events                                                            */
/* -------------------------------------------------------------------------- */

export interface UpcomingEvent {
  readonly id: string;
  readonly title: string;

  /**
   * ISO-8601 date/timestamp returned by the API.
   */
  readonly date: string;

  readonly description: string;
  readonly type: UpcomingEventType;
}

/* -------------------------------------------------------------------------- */
/* Announcements                                                              */
/* -------------------------------------------------------------------------- */

export interface Announcement {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly author: string;
  readonly category: string;

  /**
   * ISO-8601 timestamp returned by the API.
   */
  readonly publishedAt: string;
}

/* -------------------------------------------------------------------------- */
/* System overview                                                            */
/* -------------------------------------------------------------------------- */

export interface AdminSystemOverview {
  readonly activeAdmins: number;
  readonly managers: number;
  readonly employees: number;
  readonly leaveTypes: number;
  readonly departments: number;
  readonly systemStatus: AdminSystemStatus;
}

/* -------------------------------------------------------------------------- */
/* Complete dashboard response                                                */
/* -------------------------------------------------------------------------- */

export interface AdminDashboardData {
  /**
   * ISO-8601 timestamp generated by the backend.
   */
  readonly generatedAt: string;

  readonly summary: AdminDashboardSummary;

  readonly leaveRequestsTrend: readonly LeaveRequestsTrendItem[];

  readonly leaveTypeDistribution:
    readonly LeaveTypeDistributionItem[];

  readonly leaveUtilization:
    readonly LeaveUtilizationItem[];

  readonly employeeDistribution:
    readonly EmployeeDistributionItem[];

  readonly recentLeaveRequests:
    readonly RecentLeaveRequest[];

  readonly upcomingEvents:
    readonly UpcomingEvent[];

  readonly announcements:
    readonly Announcement[];

  readonly systemOverview: AdminSystemOverview;
}

/* -------------------------------------------------------------------------- */
/* Dashboard loading state                                                    */
/* -------------------------------------------------------------------------- */

export type AdminDashboardLoadingState =
  | "idle"
  | "loading"
  | "success"
  | "error";

export interface AdminDashboardError {
  readonly message: string;
  readonly code?: string;
  readonly status?: number;
  readonly requestId?: string;
}

export interface AdminDashboardState {
  readonly data: AdminDashboardData | null;
  readonly loading: boolean;
  readonly error: AdminDashboardError | null;
  readonly lastUpdatedAt: string | null;
}

/* -------------------------------------------------------------------------- */
/* API contract                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The dashboard request intentionally has no organizationId.
 *
 * The backend determines the authenticated user's organization
 * from the authenticated session.
 */
export type AdminDashboardRequest = Record<string, never>;

/**
 * Standard successful API envelope.
 *
 * Supports the backend returning:
 *
 * {
 *   data: AdminDashboardData
 * }
 */
export interface AdminDashboardApiResponse {
  readonly data: AdminDashboardData;
}

/**
 * Standard API error envelope.
 */
export interface AdminDashboardApiErrorResponse {
  readonly message: string;
  readonly code?: string;
  readonly requestId?: string;
}