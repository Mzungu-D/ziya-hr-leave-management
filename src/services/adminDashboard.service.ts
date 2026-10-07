/* ============================================================================
   ZIYA HR â€” ADMIN DASHBOARD SERVICE
   Production-ready frontend API client

   Security:
   - No organizationId is accepted from the browser.
   - Tenant/organization context is resolved by the backend from the
     authenticated session.
   - Authentication credentials are sent using credentials: "include".
   - No dashboard data is cached by the browser.
============================================================================ */

export type AdminDashboardStatus =
  | "OPERATIONAL"
  | "DEGRADED"
  | "OFFLINE";

export type AdminDashboardRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export interface AdminDashboardSummary {
  totalEmployees: number;
  activeEmployees: number;
  pendingApprovals: number;
  approvedThisMonth: number;
  leaveRequestsThisMonth: number;
  totalLeaveRequests: number;
}

export interface LeaveRequestsTrendItem {
  month: string;
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface LeaveTypeDistributionItem {
  id: string;
  name: string;
  code: string;
  value: number;
  percentage: number;
}

export interface LeaveUtilizationItem {
  id: string;
  name: string;
  allocatedDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  utilizationPercentage: number;
}

export interface EmployeeDistributionItem {
  name: string;
  value: number;
  percentage: number;
}

export interface RecentLeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeInitials: string;
  employeeRole?: string;
  employeeAvatarUrl?: string;
  department: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  requestedDays: number;
  status: AdminDashboardRequestStatus;
  submittedAt: string;
}

export interface UpcomingEvent {
  id: string;
  title: string;
  date: string;
  description: string;
  type: "LEAVE";
}

export interface DashboardAnnouncement {
  id: string;
  title: string;
  description: string;
  author: string;
  category: string;
  publishedAt: string;
}

export interface AdminSystemOverview {
  activeAdmins: number;
  managers: number;
  employees: number;
  leaveTypes: number;
  departments: number;
  systemStatus: AdminDashboardStatus;
}

export interface AdminDashboardData {
  generatedAt: string;
  summary: AdminDashboardSummary;
  leaveRequestsTrend: LeaveRequestsTrendItem[];
  leaveTypeDistribution: LeaveTypeDistributionItem[];
  leaveUtilization: LeaveUtilizationItem[];
  employeeDistribution: EmployeeDistributionItem[];
  recentLeaveRequests: RecentLeaveRequest[];
  upcomingEvents: UpcomingEvent[];
  announcements: DashboardAnnouncement[];
  systemOverview: AdminSystemOverview;
}

/* ============================================================================
   CONFIGURATION
============================================================================ */

const DEFAULT_API_BASE_URL =
  "https://ziya-hr-api-production.up.railway.app";

const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL ||
    DEFAULT_API_BASE_URL,
);

const ADMIN_DASHBOARD_ENDPOINT =
  "/api/admin/dashboard";

const REQUEST_TIMEOUT_MS = 30_000;

/* ============================================================================
   ERROR TYPES
============================================================================ */

export class AdminDashboardServiceError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly requestId?: string;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: string;
      requestId?: string;
      cause?: unknown;
    } = {},
  ) {
    super(message);

    this.name =
      "AdminDashboardServiceError";

    this.status =
      options.status ?? 500;

    this.code =
      options.code ?? "ADMIN_DASHBOARD_ERROR";

    this.requestId =
      options.requestId;

    if ("cause" in options) {
      Object.defineProperty(
        this,
        "cause",
        {
          value: options.cause,
          enumerable: false,
          configurable: true,
        },
      );
    }
  }
}

/* ============================================================================
   INTERNAL API TYPES
============================================================================ */

interface ApiErrorPayload {
  message?: unknown;
  error?: unknown;
  code?: unknown;
  requestId?: unknown;
}

/* ============================================================================
   GENERAL HELPERS
============================================================================ */

function normalizeBaseUrl(
  value: string,
): string {
  return value
    .trim()
    .replace(/\/+$/, "");
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isString(
  value: unknown,
): value is string {
  return typeof value === "string";
}

function isFiniteNumber(
  value: unknown,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function numberOrZero(
  value: unknown,
): number {
  if (isFiniteNumber(value)) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim() !== ""
  ) {
    const parsed =
      Number(value);

    if (
      Number.isFinite(parsed)
    ) {
      return parsed;
    }
  }

  return 0;
}

function stringOrEmpty(
  value: unknown,
): string {
  return isString(value)
    ? value
    : "";
}

function stringOrFallback(
  value: unknown,
  fallback: string,
): string {
  const result =
    stringOrEmpty(value).trim();

  return result || fallback;
}

/* ============================================================================
   RESPONSE HELPERS
============================================================================ */

async function parseResponse(
  response: Response,
): Promise<unknown> {
  const contentType =
    response.headers.get(
      "content-type",
    ) ?? "";

  if (
    contentType
      .toLowerCase()
      .includes("application/json")
  ) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  const text =
    await response.text();

  if (!text.trim()) {
    return null;
  }

  return {
    message: text.trim(),
  };
}

function unwrapApiData(
  payload: unknown,
): unknown {
  if (!isRecord(payload)) {
    return payload;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      payload,
      "data",
    )
  ) {
    return payload.data;
  }

  return payload;
}

function getRequestId(
  response: Response,
  payload: unknown,
): string | undefined {
  const headerRequestId =
    response.headers.get(
      "x-request-id",
    );

  if (headerRequestId) {
    return headerRequestId;
  }

  if (!isRecord(payload)) {
    return undefined;
  }

  const requestId =
    payload.requestId;

  return isString(requestId)
    ? requestId
    : undefined;
}

function getServerErrorMessage(
  payload: unknown,
  status: number,
): string {
  if (isRecord(payload)) {
    const message =
      payload.message;

    if (
      isString(message) &&
      message.trim()
    ) {
      return message.trim();
    }

    const error =
      payload.error;

    if (
      isString(error) &&
      error.trim()
    ) {
      return error.trim();
    }
  }

  switch (status) {
    case 400:
      return "The dashboard request was invalid.";

    case 401:
      return "Your session has expired. Please sign in again.";

    case 403:
      return "You do not have permission to access the HR administration dashboard.";

    case 404:
      return "The HR administration dashboard endpoint could not be found.";

    case 408:
      return "The dashboard request timed out. Please try again.";

    case 429:
      return "Too many requests. Please wait a moment and try again.";

    case 500:
    case 502:
    case 503:
    case 504:
      return "The HR dashboard service is temporarily unavailable.";

    default:
      return "Unable to load the HR administration dashboard.";
  }
}

/* ============================================================================
   STATUS NORMALIZATION
============================================================================ */

function normalizeRequestStatus(
  value: unknown,
): AdminDashboardRequestStatus {
  switch (value) {
    case "APPROVED":
      return "APPROVED";

    case "REJECTED":
      return "REJECTED";

    case "CANCELLED":
      return "CANCELLED";

    case "PENDING":
      return "PENDING";

    /*
     * Some backend workflows may expose intermediate approval states.
     * The dashboard represents those as pending until the final decision.
     */
    case "MANAGER_APPROVED":
      return "PENDING";

    case "HR_APPROVED":
      return "APPROVED";

    default:
      return "PENDING";
  }
}

function normalizeSystemStatus(
  value: unknown,
): AdminDashboardStatus {
  switch (value) {
    case "DEGRADED":
      return "DEGRADED";

    case "OFFLINE":
      return "OFFLINE";

    case "OPERATIONAL":
    default:
      return "OPERATIONAL";
  }
}

/* ============================================================================
   RESPONSE VALIDATION
============================================================================ */

function validateDashboardEnvelope(
  value: unknown,
): asserts value is Record<
  string,
  unknown
> {
  if (!isRecord(value)) {
    throw new AdminDashboardServiceError(
      "The dashboard service returned an invalid response.",
      {
        status: 502,
        code:
          "INVALID_DASHBOARD_RESPONSE",
      },
    );
  }

  const summary =
    value.summary;

  const systemOverview =
    value.systemOverview;

  if (
    !isRecord(summary) ||
    !isRecord(systemOverview)
  ) {
    throw new AdminDashboardServiceError(
      "The dashboard service returned an incomplete response.",
      {
        status: 502,
        code:
          "INCOMPLETE_DASHBOARD_RESPONSE",
      },
    );
  }

  const requiredArrays = [
    "leaveRequestsTrend",
    "leaveTypeDistribution",
    "leaveUtilization",
    "employeeDistribution",
    "recentLeaveRequests",
    "upcomingEvents",
    "announcements",
  ] as const;

  for (const field of requiredArrays) {
    if (!Array.isArray(value[field])) {
      throw new AdminDashboardServiceError(
        `The dashboard response is missing ${field}.`,
        {
          status: 502,
          code:
            "INVALID_DASHBOARD_RESPONSE",
        },
      );
    }
  }
}

/* ============================================================================
   DATA NORMALIZATION
============================================================================ */

function normalizeDashboard(
  payload: unknown,
): AdminDashboardData {
  const data =
    unwrapApiData(payload);

  validateDashboardEnvelope(
    data,
  );

  const summary =
    data.summary as Record<
      string,
      unknown
    >;

  const systemOverview =
    data.systemOverview as Record<
      string,
      unknown
    >;

  return {
    generatedAt:
      stringOrFallback(
        data.generatedAt,
        new Date().toISOString(),
      ),

    summary: {
      totalEmployees:
        numberOrZero(
          summary.totalEmployees,
        ),

      activeEmployees:
        numberOrZero(
          summary.activeEmployees,
        ),

      pendingApprovals:
        numberOrZero(
          summary.pendingApprovals,
        ),

      approvedThisMonth:
        numberOrZero(
          summary.approvedThisMonth,
        ),

      leaveRequestsThisMonth:
        numberOrZero(
          summary.leaveRequestsThisMonth,
        ),

      totalLeaveRequests:
        numberOrZero(
          summary.totalLeaveRequests,
        ),
    },

    leaveRequestsTrend:
      (data.leaveRequestsTrend as unknown[]).map(
        (item: unknown) => {
          const row =
            isRecord(item)
              ? item
              : {};

          return {
            month:
              stringOrEmpty(
                row.month,
              ),

            total:
              numberOrZero(
                row.total,
              ),

            pending:
              numberOrZero(
                row.pending,
              ),

            approved:
              numberOrZero(
                row.approved,
              ),

            rejected:
              numberOrZero(
                row.rejected,
              ),
          };
        },
      ),

    leaveTypeDistribution:
      (data.leaveTypeDistribution as unknown[]).map(
        (item: unknown) => {
          const row =
            isRecord(item)
              ? item
              : {};

          return {
            id:
              stringOrEmpty(
                row.id,
              ),

            name:
              stringOrFallback(
                row.name,
                "Unknown leave type",
              ),

            code:
              stringOrEmpty(
                row.code,
              ),

            value:
              numberOrZero(
                row.value,
              ),

            percentage:
              numberOrZero(
                row.percentage,
              ),
          };
        },
      ),

    leaveUtilization:
      (data.leaveUtilization as unknown[]).map(
        (item: unknown) => {
          const row =
            isRecord(item)
              ? item
              : {};

          return {
            id:
              stringOrEmpty(
                row.id,
              ),

            name:
              stringOrFallback(
                row.name,
                "Unknown leave type",
              ),

            allocatedDays:
              numberOrZero(
                row.allocatedDays,
              ),

            usedDays:
              numberOrZero(
                row.usedDays,
              ),

            pendingDays:
              numberOrZero(
                row.pendingDays,
              ),

            remainingDays:
              numberOrZero(
                row.remainingDays,
              ),

            utilizationPercentage:
              numberOrZero(
                row.utilizationPercentage,
              ),
          };
        },
      ),

    employeeDistribution:
      (data.employeeDistribution as unknown[]).map(
        (item: unknown) => {
          const row =
            isRecord(item)
              ? item
              : {};

          return {
            name:
              stringOrFallback(
                row.name,
                "Unknown department",
              ),

            value:
              numberOrZero(
                row.value,
              ),

            percentage:
              numberOrZero(
                row.percentage,
              ),
          };
        },
      ),

    recentLeaveRequests:
      (data.recentLeaveRequests as unknown[]).map(
        (item: unknown) => {
          const row =
            isRecord(item)
              ? item
              : {};

          return {
            id:
              stringOrEmpty(
                row.id,
              ),

            employeeId:
              stringOrEmpty(
                row.employeeId,
              ),

            employeeName:
              stringOrFallback(
                row.employeeName,
                "Unknown employee",
              ),

            employeeInitials:
              stringOrFallback(
                row.employeeInitials,
                "U",
              ),

            employeeRole:
              isString(
                row.employeeRole,
              )
                ? row.employeeRole
                : undefined,

            employeeAvatarUrl:
              isString(
                row.employeeAvatarUrl,
              )
                ? row.employeeAvatarUrl
                : undefined,

            department:
              stringOrFallback(
                row.department,
                "Unassigned",
              ),

            leaveType:
              stringOrFallback(
                row.leaveType,
                "Leave",
              ),

            startDate:
              stringOrEmpty(
                row.startDate,
              ),

            endDate:
              stringOrEmpty(
                row.endDate,
              ),

            requestedDays:
              numberOrZero(
                row.requestedDays,
              ),

            status:
              normalizeRequestStatus(
                row.status,
              ),

            submittedAt:
              stringOrEmpty(
                row.submittedAt,
              ),
          };
        },
      ),

    upcomingEvents:
      (data.upcomingEvents as unknown[]).map(
        (item: unknown) => {
          const row =
            isRecord(item)
              ? item
              : {};

          return {
            id:
              stringOrEmpty(
                row.id,
              ),

            title:
              stringOrFallback(
                row.title,
                "Upcoming event",
              ),

            date:
              stringOrEmpty(
                row.date,
              ),

            description:
              stringOrEmpty(
                row.description,
              ),

            type: "LEAVE",
          };
        },
      ),

    announcements:
      (data.announcements as unknown[]).map(
        (item: unknown) => {
          const row =
            isRecord(item)
              ? item
              : {};

          return {
            id:
              stringOrEmpty(
                row.id,
              ),

            title:
              stringOrFallback(
                row.title,
                "Announcement",
              ),

            description:
              stringOrEmpty(
                row.description,
              ),

            author:
              stringOrFallback(
                row.author,
                "HR Department",
              ),

            category:
              stringOrFallback(
                row.category,
                "General",
              ),

            publishedAt:
              stringOrEmpty(
                row.publishedAt,
              ),
          };
        },
      ),

    systemOverview: {
      activeAdmins:
        numberOrZero(
          systemOverview.activeAdmins,
        ),

      managers:
        numberOrZero(
          systemOverview.managers,
        ),

      employees:
        numberOrZero(
          systemOverview.employees,
        ),

      leaveTypes:
        numberOrZero(
          systemOverview.leaveTypes,
        ),

      departments:
        numberOrZero(
          systemOverview.departments,
        ),

      systemStatus:
        normalizeSystemStatus(
          systemOverview.systemStatus,
        ),
    },
  };
}

/* ============================================================================
   REQUEST
============================================================================ */

export async function getAdminDashboard(
  signal?: AbortSignal,
): Promise<AdminDashboardData> {
  const controller =
    new AbortController();

  let timeoutTriggered = false;

  const timeoutId =
    globalThis.setTimeout(() => {
      timeoutTriggered = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

  const forwardAbort = () => {
    controller.abort();
  };

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener(
        "abort",
        forwardAbort,
        { once: true },
      );
    }
  }

  try {
    const response =
      await fetch(
        `${API_BASE_URL}${ADMIN_DASHBOARD_ENDPOINT}`,
        {
          method: "GET",

          /*
           * The backend owns authentication and tenant resolution.
           * Never send organizationId from the frontend.
           */
          credentials: "include",

          /*
           * Dashboard information should always reflect current
           * organization data.
           */
          cache: "no-store",

          headers: {
            Accept:
              "application/json",
          },

          signal:
            controller.signal,
        },
      );

    const payload =
      await parseResponse(
        response,
      );

    if (!response.ok) {
      const errorPayload =
        isRecord(payload)
          ? (payload as ApiErrorPayload)
          : null;

      throw new AdminDashboardServiceError(
        getServerErrorMessage(
          payload,
          response.status,
        ),
        {
          status:
            response.status,

          code:
            isString(
              errorPayload?.code,
            )
              ? errorPayload.code
              : "ADMIN_DASHBOARD_REQUEST_FAILED",

          requestId:
            getRequestId(
              response,
              payload,
            ),
        },
      );
    }

    return normalizeDashboard(
      payload,
    );
  } catch (error) {
    if (
      error instanceof
      AdminDashboardServiceError
    ) {
      throw error;
    }

    if (
      error instanceof
      DOMException &&
      error.name === "AbortError"
    ) {
      if (timeoutTriggered) {
        throw new AdminDashboardServiceError(
          "The dashboard request timed out. Please try again.",
          {
            status: 408,
            code:
              "DASHBOARD_TIMEOUT",
          },
        );
      }

      throw new AdminDashboardServiceError(
        "The dashboard request was cancelled.",
        {
          status: 499,
          code:
            "REQUEST_CANCELLED",
        },
      );
    }

    if (
      error instanceof
      TypeError
    ) {
      throw new AdminDashboardServiceError(
        "Unable to connect to the HR dashboard service.",
        {
          status: 0,
          code:
            "NETWORK_ERROR",
          cause: error,
        },
      );
    }

    throw new AdminDashboardServiceError(
      "An unexpected error occurred while loading the HR dashboard.",
      {
        status: 500,
        code:
          "UNKNOWN_ERROR",
        cause: error,
      },
    );
  } finally {
    globalThis.clearTimeout(
      timeoutId,
    );

    if (signal) {
      signal.removeEventListener(
        "abort",
        forwardAbort,
      );
    }
  }
}

