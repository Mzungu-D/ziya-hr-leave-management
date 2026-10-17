/**
 * ============================================================================
 * ZIYA HR â€” LEAVE MANAGEMENT API SERVICE
 * ============================================================================
 *
 * Production frontend service for:
 *
 * - Leave Types
 * - Leave Balances
 * - Employee Leave Requests
 * - Leave Request Details
 * - Leave Request Cancellation
 * - Manager Approval Queue
 * - Manager Approval / Rejection
 * - HR Approval Queue
 * - HR Final Approval / Rejection
 *
 * SECURITY MODEL
 * ============================================================================
 *
 * - Authentication is handled by the backend session cookie.
 * - credentials: "include" is used on every request.
 * - organizationId is NEVER accepted from the frontend.
 * - employeeId is NEVER accepted for the current employee.
 * - Manager and HR identity are resolved by the backend session.
 * - The backend is authoritative for tenant isolation and authorization.
 * - No access token is stored in localStorage/sessionStorage.
 * - Authenticated responses use cache-control: no-store.
 * - Requests have a timeout.
 * - AbortSignal is supported.
 *
 * BACKEND CONTRACT
 * ============================================================================
 *
 * GET  /api/leave/types
 * GET  /api/leave/balances/me?year=2026
 * GET  /api/leave/requests/me
 * POST /api/leave/requests
 * GET  /api/leave/requests/:leaveRequestId
 * POST /api/leave/requests/:leaveRequestId/cancel
 *
 * GET  /api/leave/requests/pending/manager
 * POST /api/leave/requests/:leaveRequestId/manager-approve
 * POST /api/leave/requests/:leaveRequestId/manager-reject
 *
 * GET  /api/leave/requests/pending/hr
 * POST /api/leave/requests/:leaveRequestId/hr-approve
 * POST /api/leave/requests/:leaveRequestId/hr-reject
 *
 * ============================================================================
 */

const DEFAULT_API_BASE_URL =
  "https://ziya-hr-api-production.up.railway.app";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_JSON_RESPONSE_BYTES = 2_000_000;

/**
 * ============================================================================
 * ENDPOINTS
 * ============================================================================
 */

const LEAVE_ENDPOINTS = {
  types: "/api/leave/types",

  balances: "/api/leave/balances/me",

  myRequests: "/api/leave/requests/me",

  requests: "/api/leave/requests",

  request: (leaveRequestId: string) =>
    `/api/leave/requests/${encodeURIComponent(leaveRequestId)}`,

  cancel: (leaveRequestId: string) =>
    `/api/leave/requests/${encodeURIComponent(leaveRequestId)}/cancel`,

  managerPending:
    "/api/leave/requests/pending/manager",

  managerApprove: (leaveRequestId: string) =>
    `/api/leave/requests/${encodeURIComponent(
      leaveRequestId,
    )}/manager-approve`,

  managerReject: (leaveRequestId: string) =>
    `/api/leave/requests/${encodeURIComponent(
      leaveRequestId,
    )}/manager-reject`,

  managerTeamCalendar:
    "/api/leave/manager/team-calendar",

  managerLeaveReports:
    "/api/leave/manager/reports",

  hrPending:
    "/api/leave/requests/pending/hr",

  hrApprove: (leaveRequestId: string) =>
    `/api/leave/requests/${encodeURIComponent(
      leaveRequestId,
    )}/hr-approve`,

  hrReject: (leaveRequestId: string) =>
    `/api/leave/requests/${encodeURIComponent(
      leaveRequestId,
    )}/hr-reject`,
} as const;

/**
 * ============================================================================
 * SHARED TYPES
 * ============================================================================
 */

export interface LeaveServiceError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

export interface ManagerLeaveDateFilter {
  startDate?: string;
  endDate?: string;
}

export interface ManagerLeaveReport {
  totalRequests: number;
  totalRequestedDays: number;
  totalApprovedDays: number;
  byStatus: Record<string, number>;
  byLeaveType: Record<string, {
    requests: number;
    requestedDays: number;
    approvedDays: number;
  }>;
}

export interface LeaveRequestOptions {
  signal?: AbortSignal;
}

/**
 * ============================================================================
 * LEAVE TYPE
 * ============================================================================
 */

export interface LeaveType {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  daysPerYear: number;
  isActive: boolean;
  requiresDocument: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * ============================================================================
 * LEAVE BALANCE
 * ============================================================================
 *
 * The backend may return additional fields depending on the Prisma/database
 * projection. The fields below represent the stable frontend contract.
 */
export interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  year: number;

  entitledDays: number;
  usedDays: number;
  pendingDays?: number;
  remainingDays: number;

  leaveType?: LeaveType;

  createdAt?: string;
  updatedAt?: string;
}

/**
 * ============================================================================
 * LEAVE REQUEST STATUS
 * ============================================================================
 */

export type LeaveRequestStatus =
  | "PENDING_MANAGER"
  | "PENDING_HR"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

/**
 * ============================================================================
 * LEAVE REQUEST
 * ============================================================================
 */

export interface LeaveRequest {
  id: string;

  organizationId: string;
  employeeId: string;
  leaveTypeId: string;

  startDate: string;
  endDate: string;

  days?: number;
  requestedDays?: number;
  totalDays?: number;

  reason?: string | null;
  attachmentUrl?: string | null;

  status: LeaveRequestStatus | string;

  managerComments?: string | null;
  hrComments?: string | null;
  comments?: string | null;

  managerApprovedAt?: string | null;
  managerApprovedBy?: string | null;

  managerRejectedAt?: string | null;
  managerRejectedBy?: string | null;

  hrApprovedAt?: string | null;
  hrApprovedBy?: string | null;

  hrRejectedAt?: string | null;
  hrRejectedBy?: string | null;

  cancelledAt?: string | null;
  cancelledBy?: string | null;

  createdAt: string;
  updatedAt: string;

  leaveType?: LeaveType;

  employee?: LeaveEmployeeSummary;

  manager?: LeaveEmployeeSummary | null;

  hrApprover?: LeaveEmployeeSummary | null;
}

/**
 * ============================================================================
 * EMPLOYEE SUMMARY
 * ============================================================================
 *
 * Used when the backend returns employee information alongside a leave
 * request. Fields are optional because different backend projections may
 * return different subsets.
 */
export interface LeaveEmployeeSummary {
  id: string;

  firstName?: string;
  lastName?: string;

  name?: string;
  fullName?: string;

  email?: string;
  phone?: string;

  employeeNumber?: string;

  departmentId?: string;
  departmentName?: string;

  role?: string;
}

/**
 * ============================================================================
 * CREATE LEAVE REQUEST
 * ============================================================================
 *
 * IMPORTANT:
 *
 * There is deliberately NO:
 *
 * - organizationId
 * - employeeId
 *
 * Those values come from the authenticated backend session.
 */
export interface CreateLeaveRequestPayload {
  leaveTypeId: string;
  startDate: string;
  endDate: string;

  reason?: string | null;

  attachmentUrl?: string | null;
}

/**
 * ============================================================================
 * APPROVAL DECISION
 * ============================================================================
 */

export interface LeaveDecisionPayload {
  comments?: string | null;
}

/**
 * ============================================================================
 * API RESPONSE
 * ============================================================================
 */

interface ApiResponse<T> {
  success?: boolean;
  data?: T;

  message?: string;
  code?: string;

  error?: {
    message?: string;
    code?: string;
    details?: unknown;
  };
}

/**
 * ============================================================================
 * URL
 * ============================================================================
 */

function buildUrl(
  endpoint: string,
): string {
  return `${API_BASE_URL}${endpoint}`;
}

/**
 * ============================================================================
 * VALIDATION HELPERS
 * ============================================================================
 */

function assertNonEmptyString(
  value: string,
  fieldName: string,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw createServiceError(
      {
        message: `${fieldName} is required.`,
        code: "VALIDATION_ERROR",
        status: 400,
      },
      `${fieldName} is required.`,
    );
  }

  return normalized;
}

function assertLeaveRequestId(
  leaveRequestId: string,
): string {
  return assertNonEmptyString(
    leaveRequestId,
    "Leave request ID",
  );
}

/**
 * ============================================================================
 * ERROR CREATION
 * ============================================================================
 */

function createServiceError(
  error: unknown,
  fallbackMessage: string,
): LeaveServiceError {
  if (
    typeof error === "object" &&
    error !== null
  ) {
    const candidate = error as {
      message?: unknown;
      code?: unknown;
      status?: unknown;
      details?: unknown;
    };

    return {
      message:
        typeof candidate.message === "string" &&
        candidate.message.trim().length > 0
          ? candidate.message
          : fallbackMessage,

      code:
        typeof candidate.code === "string"
          ? candidate.code
          : undefined,

      status:
        typeof candidate.status === "number"
          ? candidate.status
          : undefined,

      details:
        candidate.details,
    };
  }

  if (error instanceof Error) {
    return {
      message:
        error.message || fallbackMessage,
    };
  }

  if (typeof error === "string") {
    return {
      message:
        error.trim() || fallbackMessage,
    };
  }

  return {
    message: fallbackMessage,
  };
}

/**
 * ============================================================================
 * JSON RESPONSE READER
 * ============================================================================
 */

async function readJsonResponse<T>(
  response: Response,
): Promise<ApiResponse<T> | null> {
  if (
    response.status === 204 ||
    response.status === 205
  ) {
    return null;
  }

  const contentLength =
    response.headers.get("content-length");

  if (contentLength) {
    const numericLength =
      Number(contentLength);

    if (
      Number.isFinite(numericLength) &&
      numericLength >
        MAX_JSON_RESPONSE_BYTES
    ) {
      throw createServiceError(
        {
          message:
            "The server response is too large.",
          code:
            "RESPONSE_TOO_LARGE",
          status:
            response.status,
        },
        "The server response is too large.",
      );
    }
  }

  const text =
    await response.text();

  if (!text.trim()) {
    return null;
  }

  if (
    new TextEncoder().encode(text).length >
    MAX_JSON_RESPONSE_BYTES
  ) {
    throw createServiceError(
      {
        message:
          "The server response is too large.",
        code:
          "RESPONSE_TOO_LARGE",
        status:
          response.status,
      },
      "The server response is too large.",
    );
  }

  try {
    return JSON.parse(
      text,
    ) as ApiResponse<T>;
  } catch {
    throw createServiceError(
      {
        message:
          "The server returned an invalid response.",
        code:
          "INVALID_SERVER_RESPONSE",
        status:
          response.status,
      },
      "The server returned an invalid response.",
    );
  }
}

/**
 * ============================================================================
 * API ERROR EXTRACTION
 * ============================================================================
 */

function extractApiError(
  response: Response,
  body: ApiResponse<unknown> | null,
): LeaveServiceError {
  const nestedMessage =
    body?.error?.message;

  const message =
    typeof nestedMessage === "string" &&
    nestedMessage.trim()
      ? nestedMessage.trim()
      : typeof body?.message === "string" &&
          body.message.trim()
        ? body.message.trim()
        : response.status === 401
          ? "Your session has expired. Please sign in again."
          : response.status === 403
            ? "You do not have permission to perform this action."
            : response.status === 404
              ? "The requested leave record could not be found."
              : response.status === 409
                ? "The leave request could not be completed because the current record has changed."
                : response.status >= 500
                  ? "The leave service is temporarily unavailable."
                  : "The leave request could not be completed.";

  return {
    message,

    code:
      body?.error?.code ||
      body?.code,

    status:
      response.status,

    details:
      body?.error?.details,
  };
}

/**
 * ============================================================================
 * REQUEST EXECUTION
 * ============================================================================
 */

async function request<T>(
  endpoint: string,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const controller =
    new AbortController();

  const timeoutId =
    window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );

  const externalSignal =
    options.signal;

  const abortFromExternal =
    () => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener(
        "abort",
        abortFromExternal,
        { once: true },
      );
    }
  }

  try {
    const headers: HeadersInit = {
      Accept:
        "application/json",

      "Cache-Control":
        "no-store",

      Pragma:
        "no-cache",
    };

    let body: string | undefined;

    if (
      options.body !== undefined
    ) {
      headers[
        "Content-Type"
      ] =
        "application/json";

      body =
        JSON.stringify(
          options.body,
        );
    }

    const response =
      await fetch(
        buildUrl(endpoint),
        {
          method:
            options.method || "GET",

          credentials:
            "include",

          headers,

          body,

          signal:
            controller.signal,

          cache:
            "no-store",

          referrerPolicy:
            "strict-origin-when-cross-origin",
        },
      );

    const responseBody =
      await readJsonResponse<T>(
        response,
      );

    if (!response.ok) {
      throw extractApiError(
        response,
        responseBody,
      );
    }

    if (
      responseBody &&
      responseBody.success === false
    ) {
      throw {
        message:
          responseBody.message ||
          responseBody.error?.message ||
          "The request was not successful.",

        code:
          responseBody.code ||
          responseBody.error?.code,

        status:
          response.status,

        details:
          responseBody.error?.details,
      };
    }

    if (
      responseBody &&
      Object.prototype.hasOwnProperty.call(
        responseBody,
        "data",
      )
    ) {
      return responseBody.data as T;
    }

    return undefined as T;
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      if (
        externalSignal?.aborted
      ) {
        throw createServiceError(
          {
            message:
              "The request was cancelled.",
            code:
              "REQUEST_CANCELLED",
          },
          "The request was cancelled.",
        );
      }

      throw createServiceError(
        {
          message:
            "The request timed out. Please try again.",
          code:
            "REQUEST_TIMEOUT",
          status:
            408,
        },
        "The request timed out. Please try again.",
      );
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error
    ) {
      throw createServiceError(
        error,
        "The leave request could not be completed.",
      );
    }

    throw createServiceError(
      {
        message:
          "Unable to connect to the leave service.",
        code:
          "NETWORK_ERROR",
      },
      "Unable to connect to the leave service.",
    );
  } finally {
    window.clearTimeout(
      timeoutId,
    );

    if (externalSignal) {
      externalSignal.removeEventListener(
        "abort",
        abortFromExternal,
      );
    }
  }
}

/**
 * ============================================================================
 * NORMALIZATION
 * ============================================================================
 */

function normalizeCreatePayload(
  payload: CreateLeaveRequestPayload,
): CreateLeaveRequestPayload {
  const leaveTypeId =
    assertNonEmptyString(
      payload.leaveTypeId,
      "Leave type",
    );

  const startDate =
    assertNonEmptyString(
      payload.startDate,
      "Start date",
    );

  const endDate =
    assertNonEmptyString(
      payload.endDate,
      "End date",
    );

  if (
    payload.reason !== undefined &&
    payload.reason !== null &&
    typeof payload.reason !== "string"
  ) {
    throw createServiceError(
      {
        message:
          "Reason must be text.",
        code:
          "VALIDATION_ERROR",
        status:
          400,
      },
      "Reason must be text.",
    );
  }

  if (
    payload.attachmentUrl !== undefined &&
    payload.attachmentUrl !== null &&
    typeof payload.attachmentUrl !== "string"
  ) {
    throw createServiceError(
      {
        message:
          "Attachment URL must be text.",
        code:
          "VALIDATION_ERROR",
        status:
          400,
      },
      "Attachment URL must be text.",
    );
  }

  return {
    leaveTypeId,

    startDate,

    endDate,

    reason:
      payload.reason === undefined
        ? undefined
        : payload.reason === null
          ? null
          : payload.reason.trim(),

    attachmentUrl:
      payload.attachmentUrl === undefined
        ? undefined
        : payload.attachmentUrl === null
          ? null
          : payload.attachmentUrl.trim(),
  };
}

function normalizeDecisionPayload(
  payload?: LeaveDecisionPayload,
): LeaveDecisionPayload {
  if (
    !payload ||
    payload.comments === undefined
  ) {
    return {};
  }

  if (
    payload.comments !== null &&
    typeof payload.comments !== "string"
  ) {
    throw createServiceError(
      {
        message:
          "Approval comments must be text.",
        code:
          "VALIDATION_ERROR",
        status:
          400,
      },
      "Approval comments must be text.",
    );
  }

  return {
    comments:
      payload.comments === null
        ? null
        : payload.comments.trim(),
  };
}

/**
 * ============================================================================
 * LEAVE TYPES
 * ============================================================================
 */

export async function listLeaveTypes(
  options: LeaveRequestOptions = {},
): Promise<LeaveType[]> {
  const data =
    await request<LeaveType[]>(
      LEAVE_ENDPOINTS.types,
      {
        method: "GET",
        signal: options.signal,
      },
    );

  return Array.isArray(data)
    ? data
    : [];
}

/**
 * ============================================================================
 * LEAVE BALANCES
 * ============================================================================
 */

export async function getLeaveBalances(
  year?: number,
  options: LeaveRequestOptions = {},
): Promise<LeaveBalance[]> {
  const currentYear =
    new Date().getFullYear();

  const requestedYear =
    year === undefined
      ? currentYear
      : Number(year);

  const validYear =
    Number.isInteger(requestedYear) &&
    requestedYear >= 2000 &&
    requestedYear <= 2200;

  if (!validYear) {
    throw createServiceError(
      {
        message:
          "Invalid leave balance year.",
        code:
          "INVALID_YEAR",
        status:
          400,
      },
      "Invalid leave balance year.",
    );
  }

  const endpoint =
    `${LEAVE_ENDPOINTS.balances}?year=${encodeURIComponent(
      String(requestedYear),
    )}`;

  const data =
    await request<LeaveBalance[]>(
      endpoint,
      {
        method: "GET",
        signal: options.signal,
      },
    );

  return Array.isArray(data)
    ? data
    : [];
}

/**
 * ============================================================================
 * EMPLOYEE â€” MY LEAVE REQUESTS
 * ============================================================================
 */

export async function listMyLeaveRequests(
  options: LeaveRequestOptions = {},
): Promise<LeaveRequest[]> {
  const data =
    await request<LeaveRequest[]>(
      LEAVE_ENDPOINTS.myRequests,
      {
        method: "GET",
        signal: options.signal,
      },
    );

  return Array.isArray(data)
    ? data
    : [];
}

/**
 * ============================================================================
 * EMPLOYEE â€” CREATE LEAVE REQUEST
 * ============================================================================
 */

export async function createLeaveRequest(
  payload: CreateLeaveRequestPayload,
  options: LeaveRequestOptions = {},
): Promise<LeaveRequest> {
  const normalized =
    normalizeCreatePayload(
      payload,
    );

  return request<LeaveRequest>(
    LEAVE_ENDPOINTS.requests,
    {
      method: "POST",

      body: normalized,

      signal:
        options.signal,
    },
  );
}

/**
 * ============================================================================
 * EMPLOYEE â€” GET SINGLE REQUEST
 * ============================================================================
 */

export async function getLeaveRequest(
  leaveRequestId: string,
  options: LeaveRequestOptions = {},
): Promise<LeaveRequest> {
  const id =
    assertLeaveRequestId(
      leaveRequestId,
    );

  return request<LeaveRequest>(
    LEAVE_ENDPOINTS.request(id),
    {
      method: "GET",

      signal:
        options.signal,
    },
  );
}

/**
 * ============================================================================
 * EMPLOYEE â€” CANCEL REQUEST
 * ============================================================================
 */

export async function cancelLeaveRequest(
  leaveRequestId: string,
  options: LeaveRequestOptions = {},
): Promise<LeaveRequest> {
  const id =
    assertLeaveRequestId(
      leaveRequestId,
    );

  return request<LeaveRequest>(
    LEAVE_ENDPOINTS.cancel(id),
    {
      method: "POST",

      signal:
        options.signal,
    },
  );
}

/**
 * ============================================================================
 * MANAGER â€” PENDING REQUESTS
 * ============================================================================
 */

export async function listManagerPendingRequests(
  options: LeaveRequestOptions = {},
): Promise<LeaveRequest[]> {
  const data =
    await request<LeaveRequest[]>(
      LEAVE_ENDPOINTS.managerPending,
      {
        method: "GET",

        signal:
          options.signal,
      },
    );

  return Array.isArray(data)
    ? data
    : [];
}

/**
 * ============================================================================
 * MANAGER â€” APPROVE
 * ============================================================================
 */

export async function listManagerTeamLeave(
  filters: ManagerLeaveDateFilter = {},
  options: LeaveRequestOptions = {},
): Promise<LeaveRequest[]> {
  const params = new URLSearchParams();
  if (filters.startDate?.trim()) params.set("startDate", filters.startDate.trim());
  if (filters.endDate?.trim()) params.set("endDate", filters.endDate.trim());

  const query = params.toString();
  const endpoint = query
    ? `${LEAVE_ENDPOINTS.managerTeamCalendar}?${query}`
    : LEAVE_ENDPOINTS.managerTeamCalendar;

  const data = await request<LeaveRequest[]>(endpoint, {
    method: "GET",
    signal: options.signal,
  });
  return Array.isArray(data) ? data : [];
}

export async function getManagerLeaveReport(
  filters: ManagerLeaveDateFilter = {},
  options: LeaveRequestOptions = {},
): Promise<ManagerLeaveReport> {
  const params = new URLSearchParams();
  if (filters.startDate?.trim()) params.set("startDate", filters.startDate.trim());
  if (filters.endDate?.trim()) params.set("endDate", filters.endDate.trim());

  const query = params.toString();
  const endpoint = query
    ? `${LEAVE_ENDPOINTS.managerLeaveReports}?${query}`
    : LEAVE_ENDPOINTS.managerLeaveReports;

  return request<ManagerLeaveReport>(endpoint, {
    method: "GET",
    signal: options.signal,
  });
}

export async function managerApproveLeaveRequest(
  leaveRequestId: string,
  payload: LeaveDecisionPayload = {},
  options: LeaveRequestOptions = {},
): Promise<LeaveRequest> {
  const id =
    assertLeaveRequestId(
      leaveRequestId,
    );

  const body =
    normalizeDecisionPayload(
      payload,
    );

  return request<LeaveRequest>(
    LEAVE_ENDPOINTS.managerApprove(id),
    {
      method: "POST",

      body,

      signal:
        options.signal,
    },
  );
}

/**
 * ============================================================================
 * MANAGER â€” REJECT
 * ============================================================================
 */

export async function managerRejectLeaveRequest(
  leaveRequestId: string,
  payload: LeaveDecisionPayload = {},
  options: LeaveRequestOptions = {},
): Promise<LeaveRequest> {
  const id =
    assertLeaveRequestId(
      leaveRequestId,
    );

  const body =
    normalizeDecisionPayload(
      payload,
    );

  return request<LeaveRequest>(
    LEAVE_ENDPOINTS.managerReject(id),
    {
      method: "POST",

      body,

      signal:
        options.signal,
    },
  );
}

/**
 * ============================================================================
 * HR â€” PENDING REQUESTS
 * ============================================================================
 */

export async function listHrPendingRequests(
  options: LeaveRequestOptions = {},
): Promise<LeaveRequest[]> {
  const data =
    await request<LeaveRequest[]>(
      LEAVE_ENDPOINTS.hrPending,
      {
        method: "GET",

        signal:
          options.signal,
      },
    );

  return Array.isArray(data)
    ? data
    : [];
}

/**
 * ============================================================================
 * HR â€” FINAL APPROVAL
 * ============================================================================
 */

export async function hrApproveLeaveRequest(
  leaveRequestId: string,
  payload: LeaveDecisionPayload = {},
  options: LeaveRequestOptions = {},
): Promise<LeaveRequest> {
  const id =
    assertLeaveRequestId(
      leaveRequestId,
    );

  const body =
    normalizeDecisionPayload(
      payload,
    );

  return request<LeaveRequest>(
    LEAVE_ENDPOINTS.hrApprove(id),
    {
      method: "POST",

      body,

      signal:
        options.signal,
    },
  );
}

/**
 * ============================================================================
 * HR â€” FINAL REJECTION
 * ============================================================================
 */

export async function hrRejectLeaveRequest(
  leaveRequestId: string,
  payload: LeaveDecisionPayload = {},
  options: LeaveRequestOptions = {},
): Promise<LeaveRequest> {
  const id =
    assertLeaveRequestId(
      leaveRequestId,
    );

  const body =
    normalizeDecisionPayload(
      payload,
    );

  return request<LeaveRequest>(
    LEAVE_ENDPOINTS.hrReject(id),
    {
      method: "POST",

      body,

      signal:
        options.signal,
    },
  );
}

/**
 * ============================================================================
 * DEFAULT EXPORT
 * ============================================================================
 *
 * Named exports remain the preferred API. The default object is provided for
 * convenient service-style imports where required by existing pages.
 */
const leaveService = {
  listLeaveTypes,

  getLeaveBalances,

  listMyLeaveRequests,

  createLeaveRequest,

  getLeaveRequest,

  cancelLeaveRequest,

  listManagerPendingRequests,

  listManagerTeamLeave,

  getManagerLeaveReport,

  managerApproveLeaveRequest,

  managerRejectLeaveRequest,

  listHrPendingRequests,

  hrApproveLeaveRequest,

  hrRejectLeaveRequest,
};

export default leaveService;
