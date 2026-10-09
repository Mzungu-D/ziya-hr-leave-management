export type ReportDateRange = {
  from: string;
  to: string;
};

export type ReportsOverview = {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  totalDepartments: number;
  totalLeaveTypes: number;
  totalLeaveRequests: number;
  pendingLeaveRequests: number;
  approvedLeaveRequests: number;
  rejectedLeaveRequests: number;
  cancelledLeaveRequests: number;
  approvedLeaveDays: number;
  pendingLeaveDays: number;
  utilizationRate: number;
};

export type WorkforceReportItem = {
  departmentId: string | null;
  departmentName: string;
  employeeCount: number;
  activeEmployees: number;
  inactiveEmployees: number;
};

export type MonthlyLeaveRequestReport = {
  month: string;
  label: string;
  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  cancelledRequests: number;
  requestedDays: number;
  approvedDays: number;
};

export type DepartmentReportItem = {
  departmentId: string | null;
  departmentName: string;
  employeeCount: number;
  leaveRequests: number;
  approvedRequests: number;
  pendingRequests: number;
  rejectedRequests: number;
  cancelledRequests: number;
  requestedDays: number;
  approvedDays: number;
  utilizationRate: number;
};

export type LeaveTypeReportItem = {
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  allocatedDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  utilizationRate: number;
  requestCount: number;
};

export type EmployeeReportItem = {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  departmentName: string;
  status: string;
  leaveRequests: number;
  approvedRequests: number;
  pendingRequests: number;
  rejectedRequests: number;
  cancelledRequests: number;
  requestedDays: number;
  approvedDays: number;
  pendingDays: number;
};

export type LeaveStatusReportItem = {
  status: string;
  count: number;
  requestedDays: number;
  percentage: number;
};

export type ReportsAnalytics = {
  generatedAt: string;
  period: {
    year: number;
    from: string;
    to: string;
  };
  overview: ReportsOverview;
  workforce: WorkforceReportItem[];
  monthlyLeaveRequests: MonthlyLeaveRequestReport[];
  departmentReport: DepartmentReportItem[];
  leaveTypeReport: LeaveTypeReportItem[];
  employeeReport: EmployeeReportItem[];
  leaveStatusReport: LeaveStatusReportItem[];
};

export type ReportsQuery = {
  year?: number;
  from?: string;
  to?: string;
  signal?: AbortSignal;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, "") ||
  "https://ziya-hr-api-production.up.railway.app";

const REPORTS_ENDPOINT = "/api/admin/reports";

const REQUEST_TIMEOUT_MS = 30_000;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function createTimeoutSignal(
  externalSignal?: AbortSignal,
): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();

  const timeout = window.setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  const abortFromExternal = () => {
    controller.abort();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", abortFromExternal, {
        once: true,
      });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      window.clearTimeout(timeout);

      externalSignal?.removeEventListener(
        "abort",
        abortFromExternal,
      );
    },
  };
}

function buildQueryString(query: ReportsQuery = {}): string {
  const params = new URLSearchParams();

  if (query.year !== undefined) {
    params.set("year", String(query.year));
  }

  if (query.from) {
    params.set("from", query.from);
  }

  if (query.to) {
    params.set("to", query.to);
  }

  const queryString = params.toString();

  return queryString ? `?${queryString}` : "";
}

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function validateQuery(query: ReportsQuery): void {
  if (query.year !== undefined) {
    if (
      !Number.isInteger(query.year) ||
      query.year < 2000 ||
      query.year > 2100
    ) {
      throw new Error(
        "Report year must be between 2000 and 2100.",
      );
    }
  }

  if (
    query.from !== undefined &&
    !isValidDateString(query.from)
  ) {
    throw new Error(
      "Report start date must use YYYY-MM-DD format.",
    );
  }

  if (
    query.to !== undefined &&
    !isValidDateString(query.to)
  ) {
    throw new Error(
      "Report end date must use YYYY-MM-DD format.",
    );
  }

  if (query.from && query.to && query.from > query.to) {
    throw new Error(
      "Report start date cannot be after the end date.",
    );
  }

  if (
    (query.from && !query.to) ||
    (!query.from && query.to)
  ) {
    throw new Error(
      "Both start and end dates are required for a custom range.",
    );
  }

  if (query.year !== undefined && query.from && query.to) {
    const fromYear = Number(query.from.slice(0, 4));
    const toYear = Number(query.to.slice(0, 4));

    if (
      fromYear !== query.year ||
      toYear !== query.year
    ) {
      throw new Error(
        "The custom report date range must belong to the selected year.",
      );
    }
  }
}

function validateReportsResponse(
  payload: unknown,
): asserts payload is ApiResponse<ReportsAnalytics> & {
  data: ReportsAnalytics;
} {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid reports response.");
  }

  const response =
    payload as ApiResponse<ReportsAnalytics>;

  if (response.success !== true || !response.data) {
    throw new Error(
      response.message ||
        "Unable to load reports.",
    );
  }

  const data = response.data;

  if (
    !data.overview ||
    !data.period ||
    !Array.isArray(data.workforce) ||
    !Array.isArray(data.monthlyLeaveRequests) ||
    !Array.isArray(data.departmentReport) ||
    !Array.isArray(data.leaveTypeReport) ||
    !Array.isArray(data.employeeReport) ||
    !Array.isArray(data.leaveStatusReport)
  ) {
    throw new Error(
      "The reports response is incomplete.",
    );
  }
}

async function requestReports(
  endpoint: string,
  signal?: AbortSignal,
): Promise<ReportsAnalytics> {
  const timeout = createTimeoutSignal(signal);

  try {
    const response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        signal: timeout.signal,
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache",
        },
      },
    );

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throw new Error(
        `Reports API returned an invalid response (${response.status}).`,
      );
    }

    if (!response.ok) {
      if (
        payload &&
        typeof payload === "object" &&
        "message" in payload &&
        typeof payload.message === "string"
      ) {
        throw new Error(payload.message);
      }

      if (response.status === 401) {
        throw new Error(
          "Your session has expired. Please sign in again.",
        );
      }

      if (response.status === 403) {
        throw new Error(
          "You do not have permission to access reports.",
        );
      }

      throw new Error(
        `Unable to load reports (${response.status}).`,
      );
    }

    validateReportsResponse(payload);

    return payload.data;
  } catch (error) {
    if (isAbortError(error)) {
      if (signal?.aborted) {
        throw error;
      }

      throw new Error(
        "The reports request timed out. Please try again.",
      );
    }

    throw error;
  } finally {
    timeout.cleanup();
  }
}

/**
 * Load reports using the selected year or custom date range.
 */
export async function getReports(
  query: ReportsQuery = {},
): Promise<ReportsAnalytics> {
  validateQuery(query);

  const { signal, ...requestQuery } = query;

  return requestReports(
    `${REPORTS_ENDPOINT}${buildQueryString(
      requestQuery,
    )}`,
    signal,
  );
}

/**
 * Load reports for an explicit date range.
 */
export async function getReportsForDateRange(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<ReportsAnalytics> {
  const query: ReportsQuery = {
    from,
    to,
  };

  validateQuery(query);

  return requestReports(
    `${REPORTS_ENDPOINT}/range${buildQueryString(
      query,
    )}`,
    signal,
  );
}

/**
 * Load the complete annual report.
 */
export async function getAnnualReports(
  year: number,
  signal?: AbortSignal,
): Promise<ReportsAnalytics> {
  validateQuery({ year });

  return requestReports(
    `${REPORTS_ENDPOINT}/annual/${encodeURIComponent(
      String(year),
    )}`,
    signal,
  );
}

/**
 * Load the current calendar year's report.
 */
export async function getCurrentYearReports(
  signal?: AbortSignal,
): Promise<ReportsAnalytics> {
  return getAnnualReports(
    new Date().getFullYear(),
    signal,
  );
}

export const reportsService = {
  getReports,
  getReportsForDateRange,
  getAnnualReports,
  getCurrentYearReports,
};

export default reportsService;