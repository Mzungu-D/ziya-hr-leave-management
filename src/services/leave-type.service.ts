/**
 * Leave Type API Service
 *
 * Production client for organization-scoped Leave Type management.
 *
 * Security model:
 * - Authentication is provided by the backend session cookie.
 * - Credentials are included on every request.
 * - organizationId is never accepted from the client for create/update.
 * - Organization scope is resolved by the backend from the authenticated
 *   employee/session.
 * - State-changing requests rely on the backend Origin-based CSRF protection.
 * - Authenticated Leave Type responses are never cached by the browser.
 *
 * Backend contract:
 * - GET    /api/leave-types
 * - POST   /api/leave-types
 * - GET    /api/leave-types/:leaveTypeId
 * - PATCH  /api/leave-types/:leaveTypeId
 * - POST   /api/leave-types/:leaveTypeId/activate
 * - POST   /api/leave-types/:leaveTypeId/deactivate
 */

const DEFAULT_API_BASE_URL =
  "https://ziya-hr-api-production.up.railway.app";

const configuredApiBaseUrl =
  import.meta.env.VITE_API_BASE_URL;

const API_BASE_URL = (
  configuredApiBaseUrl ||
  DEFAULT_API_BASE_URL
).trim().replace(/\/+$/, "");

const REQUEST_TIMEOUT_MS = 30_000;

const LEAVE_TYPE_ENDPOINTS = {
  collection: "/api/leave-types",

  item: (leaveTypeId: string) =>
    `/api/leave-types/${encodeURIComponent(leaveTypeId)}`,

  activate: (leaveTypeId: string) =>
    `/api/leave-types/${encodeURIComponent(leaveTypeId)}/activate`,

  deactivate: (leaveTypeId: string) =>
    `/api/leave-types/${encodeURIComponent(leaveTypeId)}/deactivate`,
} as const;

/**
 * Leave Type returned by the backend.
 *
 * This mirrors the existing backend contract exactly.
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
 * Payload accepted when creating a Leave Type.
 *
 * organizationId is intentionally absent.
 */
export interface CreateLeaveTypePayload {
  name: string;
  code: string;
  daysPerYear: number;
  requiresDocument: boolean;
}

/**
 * Payload accepted when updating a Leave Type.
 *
 * The backend supports partial updates.
 */
export interface UpdateLeaveTypePayload {
  name?: string;
  code?: string;
  daysPerYear?: number;
  requiresDocument?: boolean;
}

/**
 * Normalized error exposed to consuming UI code.
 */
export interface LeaveTypeServiceError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

/**
 * Backend response envelope.
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
 * Optional request controls.
 */
export interface LeaveTypeRequestOptions {
  signal?: AbortSignal;
}

/**
 * Internal request controller state.
 */
interface RequestController {
  controller: AbortController;
  cleanup: () => void;
  wasTimedOut: () => boolean;
}

/**
 * Basic object guard.
 */
function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null
  );
}

/**
 * Validate that the configured API base URL is usable.
 */
function validateApiBaseUrl(): void {
  if (!API_BASE_URL) {
    throw {
      message:
        "The Leave Management API is not configured.",
      code:
        "API_BASE_URL_NOT_CONFIGURED",
    } satisfies LeaveTypeServiceError;
  }

  try {
    const url = new URL(API_BASE_URL);

    if (
      url.protocol !== "https:" &&
      import.meta.env.DEV !== true
    ) {
      throw new Error(
        "Production API URL must use HTTPS.",
      );
    }
  } catch {
    throw {
      message:
        "The Leave Management API configuration is invalid.",
      code:
        "INVALID_API_BASE_URL",
    } satisfies LeaveTypeServiceError;
  }
}

/**
 * Build an absolute API URL.
 */
function buildUrl(
  endpoint: string,
): string {
  validateApiBaseUrl();

  return `${API_BASE_URL}${endpoint}`;
}

/**
 * Create a normalized service error.
 */
function createServiceError(
  error: unknown,
  fallbackMessage: string,
): LeaveTypeServiceError {
  if (
    isRecord(error)
  ) {
    const message =
      typeof error.message === "string" &&
      error.message.trim().length > 0
        ? error.message.trim()
        : fallbackMessage;

    const code =
      typeof error.code === "string" &&
      error.code.trim().length > 0
        ? error.code.trim()
        : undefined;

    const status =
      typeof error.status === "number" &&
      Number.isFinite(error.status)
        ? error.status
        : undefined;

    return {
      message,
      code,
      status,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      message:
        error.message.trim().length > 0
          ? error.message.trim()
          : fallbackMessage,
    };
  }

  return {
    message: fallbackMessage,
  };
}

/**
 * Create an HTTP-level service error.
 */
function createHttpError(
  response: Response,
  body?: ApiResponse<unknown>,
): LeaveTypeServiceError {
  const backendMessage =
    body?.error?.message ??
    body?.message;

  const backendCode =
    body?.error?.code ??
    body?.code;

  const backendDetails =
    body?.error?.details;

  return {
    message:
      typeof backendMessage === "string" &&
      backendMessage.trim().length > 0
        ? backendMessage.trim()
        : `Leave Type request failed with status ${response.status}.`,

    code:
      typeof backendCode === "string" &&
      backendCode.trim().length > 0
        ? backendCode.trim()
        : undefined,

    status: response.status,

    details: backendDetails,
  };
}

/**
 * Read a JSON response body.
 *
 * The backend is expected to return JSON. For malformed/non-JSON
 * responses we safely return undefined and allow the HTTP layer
 * to generate the appropriate error.
 */
async function readJsonResponse<T>(
  response: Response,
): Promise<ApiResponse<T> | undefined> {
  const contentType =
    response.headers.get("content-type") ?? "";

  if (
    !contentType
      .toLowerCase()
      .includes("application/json")
  ) {
    return undefined;
  }

  try {
    const parsed: unknown =
      await response.json();

    if (!isRecord(parsed)) {
      return undefined;
    }

    return parsed as ApiResponse<T>;
  } catch {
    return undefined;
  }
}

/**
 * Validate a backend Leave Type object at runtime.
 *
 * TypeScript interfaces disappear at runtime, so network data must
 * not be blindly trusted as a LeaveType.
 */
function isLeaveType(
  value: unknown,
): value is LeaveType {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.organizationId === "string" &&
    typeof value.name === "string" &&
    typeof value.code === "string" &&
    typeof value.daysPerYear === "number" &&
    Number.isFinite(value.daysPerYear) &&
    typeof value.isActive === "boolean" &&
    typeof value.requiresDocument === "boolean" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

/**
 * Validate an array of Leave Types returned by the backend.
 */
function isLeaveTypeArray(
  value: unknown,
): value is LeaveType[] {
  return (
    Array.isArray(value) &&
    value.every(isLeaveType)
  );
}

/**
 * Validate and return a successful API response.
 */
async function parseResponse<T>(
  response: Response,
  validator: (value: unknown) => value is T,
): Promise<T> {
  const body =
    await readJsonResponse<T>(response);

  if (!response.ok) {
    throw createHttpError(
      response,
      body,
    );
  }

  if (!body) {
    throw {
      message:
        "The Leave Type server returned an invalid response.",
      status: response.status,
      code:
        "INVALID_API_RESPONSE",
    } satisfies LeaveTypeServiceError;
  }

  if (
    body.success !== undefined &&
    body.success !== true
  ) {
    throw {
      message:
        typeof body.message === "string" &&
        body.message.trim().length > 0
          ? body.message.trim()
          : "The Leave Type request was not successful.",
      code:
        typeof body.code === "string"
          ? body.code
          : "API_REQUEST_FAILED",
      status: response.status,
    } satisfies LeaveTypeServiceError;
  }

  if (body.data === undefined) {
    throw {
      message:
        "The Leave Type server returned a response without data.",
      status: response.status,
      code:
        "INVALID_API_RESPONSE",
    } satisfies LeaveTypeServiceError;
  }

  if (!validator(body.data)) {
    throw {
      message:
        "The Leave Type server returned data in an unexpected format.",
      status: response.status,
      code:
        "INVALID_API_RESPONSE",
    } satisfies LeaveTypeServiceError;
  }

  return body.data;
}

/**
 * Create a request controller with:
 * - caller cancellation support
 * - automatic timeout
 * - deterministic cleanup
 *
 * Caller cancellation and timeout are intentionally distinguished.
 */
function createRequestController(
  callerSignal?: AbortSignal,
): RequestController {
  const controller =
    new AbortController();

  let timedOut = false;

  const timeoutId =
    globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

  let callerAbortHandler:
    | (() => void)
    | undefined;

  if (callerSignal) {
    callerAbortHandler = () => {
      controller.abort();
    };

    if (callerSignal.aborted) {
      controller.abort();
    } else {
      callerSignal.addEventListener(
        "abort",
        callerAbortHandler,
        { once: true },
      );
    }
  }

  return {
    controller,

    cleanup: () => {
      globalThis.clearTimeout(
        timeoutId,
      );

      if (
        callerSignal &&
        callerAbortHandler
      ) {
        callerSignal.removeEventListener(
          "abort",
          callerAbortHandler,
        );
      }
    },

    wasTimedOut: () => timedOut,
  };
}

/**
 * Build request headers.
 *
 * Content-Type is only sent when a JSON body exists.
 */
function buildHeaders(
  hasJsonBody: boolean,
): HeadersInit {
  const headers: Record<
    string,
    string
  > = {
    Accept: "application/json",
  };

  if (hasJsonBody) {
    headers["Content-Type"] =
      "application/json";
  }

  return headers;
}

/**
 * Execute an authenticated Leave Type request.
 */
async function request<T>(
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "PATCH";
    body?: unknown;
    signal?: AbortSignal;
    validator: (
      value: unknown,
    ) => value is T;
  },
): Promise<T> {
  const method =
    options.method ?? "GET";

  const hasJsonBody =
    options.body !== undefined;

  const {
    controller,
    cleanup,
    wasTimedOut,
  } =
    createRequestController(
      options.signal,
    );

  try {
    const response =
      await fetch(
        buildUrl(endpoint),
        {
          method,

          credentials: "include",

          headers:
            buildHeaders(
              hasJsonBody,
            ),

          body:
            hasJsonBody
              ? JSON.stringify(
                  options.body,
                )
              : undefined,

          signal:
            controller.signal,

          cache: "no-store",

          /**
           * Keep requests same-origin-aware without
           * manually constructing an Origin header.
           * Browsers control Origin for security reasons.
           */
          redirect: "follow",
        },
      );

    return await parseResponse<T>(
      response,
      options.validator,
    );
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      if (options.signal?.aborted) {
        throw {
          message:
            "The Leave Type request was cancelled.",
          code:
            "REQUEST_CANCELLED",
        } satisfies LeaveTypeServiceError;
      }

      if (wasTimedOut()) {
        throw {
          message:
            "The Leave Type request timed out. Please try again.",
          code:
            "REQUEST_TIMEOUT",
        } satisfies LeaveTypeServiceError;
      }

      throw {
        message:
          "The Leave Type request was cancelled.",
        code:
          "REQUEST_CANCELLED",
      } satisfies LeaveTypeServiceError;
    }

    if (
      error instanceof TypeError
    ) {
      throw {
        message:
          "Unable to connect to the Leave Management service. Please check your connection and try again.",
        code:
          "NETWORK_ERROR",
      } satisfies LeaveTypeServiceError;
    }

    throw createServiceError(
      error,
      "Unable to communicate with the Leave Type service.",
    );
  } finally {
    cleanup();
  }
}

/**
 * Validate a Leave Type ID before placing it into a URL.
 */
function validateLeaveTypeId(
  leaveTypeId: string,
): string {
  if (
    typeof leaveTypeId !== "string"
  ) {
    throw {
      message:
        "A valid Leave Type ID is required.",
      code:
        "INVALID_LEAVE_TYPE_ID",
    } satisfies LeaveTypeServiceError;
  }

  const normalized =
    leaveTypeId.trim();

  if (!normalized) {
    throw {
      message:
        "A valid Leave Type ID is required.",
      code:
        "INVALID_LEAVE_TYPE_ID",
    } satisfies LeaveTypeServiceError;
  }

  return normalized;
}

/**
 * Validate a create/update payload.
 *
 * These checks are deliberately limited to client-side
 * correctness. The backend remains authoritative.
 */
function validateLeaveTypePayload(
  payload:
    | CreateLeaveTypePayload
    | UpdateLeaveTypePayload,
): void {
  if (
    !isRecord(payload)
  ) {
    throw {
      message:
        "A valid Leave Type payload is required.",
      code:
        "INVALID_LEAVE_TYPE_PAYLOAD",
    } satisfies LeaveTypeServiceError;
  }

  if (
    "name" in payload &&
    payload.name !== undefined
  ) {
    if (
      typeof payload.name !== "string" ||
      payload.name.trim().length === 0
    ) {
      throw {
        message:
          "Leave Type name cannot be empty.",
        code:
          "INVALID_LEAVE_TYPE_NAME",
      } satisfies LeaveTypeServiceError;
    }
  }

  if (
    "code" in payload &&
    payload.code !== undefined
  ) {
    if (
      typeof payload.code !== "string" ||
      payload.code.trim().length === 0
    ) {
      throw {
        message:
          "Leave Type code cannot be empty.",
        code:
          "INVALID_LEAVE_TYPE_CODE",
      } satisfies LeaveTypeServiceError;
    }
  }

  if (
    "daysPerYear" in payload &&
    payload.daysPerYear !== undefined
  ) {
    if (
      typeof payload.daysPerYear !== "number" ||
      !Number.isSafeInteger(
        payload.daysPerYear,
      ) ||
      payload.daysPerYear < 0
    ) {
      throw {
        message:
          "Days per year must be a valid non-negative whole number.",
        code:
          "INVALID_LEAVE_TYPE_DAYS",
      } satisfies LeaveTypeServiceError;
    }
  }

  if (
    "requiresDocument" in payload &&
    payload.requiresDocument !== undefined
  ) {
    if (
      typeof payload.requiresDocument !== "boolean"
    ) {
      throw {
        message:
          "Document requirement must be true or false.",
        code:
          "INVALID_DOCUMENT_REQUIREMENT",
      } satisfies LeaveTypeServiceError;
    }
  }
}

/**
 * Clone a payload before transmission.
 *
 * This prevents accidental mutation of an object owned by the
 * calling component while JSON serialization is performed.
 */
function preparePayload<
  T extends
    | CreateLeaveTypePayload
    | UpdateLeaveTypePayload,
>(
  payload: T,
): T {
  validateLeaveTypePayload(
    payload,
  );

  return {
    ...payload,
  };
}

/**
 * List Leave Types.
 *
 * includeInactive=false:
 *   active Leave Types only.
 *
 * includeInactive=true:
 *   active and inactive Leave Types.
 */
export async function listLeaveTypes(
  includeInactive = false,
  options: LeaveTypeRequestOptions = {},
): Promise<LeaveType[]> {
  const query =
    includeInactive
      ? "?includeInactive=true"
      : "";

  return request<LeaveType[]>(
    `${LEAVE_TYPE_ENDPOINTS.collection}${query}`,
    {
      method: "GET",
      signal: options.signal,
      validator: isLeaveTypeArray,
    },
  );
}

/**
 * Retrieve one Leave Type.
 */
export async function getLeaveType(
  leaveTypeId: string,
  options: LeaveTypeRequestOptions = {},
): Promise<LeaveType> {
  const id =
    validateLeaveTypeId(
      leaveTypeId,
    );

  return request<LeaveType>(
    LEAVE_TYPE_ENDPOINTS.item(id),
    {
      method: "GET",
      signal: options.signal,
      validator: isLeaveType,
    },
  );
}

/**
 * Create a Leave Type.
 *
 * organizationId is intentionally impossible to provide
 * through the public payload contract.
 */
export async function createLeaveType(
  payload: CreateLeaveTypePayload,
  options: LeaveTypeRequestOptions = {},
): Promise<LeaveType> {
  const preparedPayload =
    preparePayload(
      payload,
    );

  return request<LeaveType>(
    LEAVE_TYPE_ENDPOINTS.collection,
    {
      method: "POST",
      body: preparedPayload,
      signal: options.signal,
      validator: isLeaveType,
    },
  );
}

/**
 * Update a Leave Type.
 */
export async function updateLeaveType(
  leaveTypeId: string,
  payload: UpdateLeaveTypePayload,
  options: LeaveTypeRequestOptions = {},
): Promise<LeaveType> {
  const id =
    validateLeaveTypeId(
      leaveTypeId,
    );

  const preparedPayload =
    preparePayload(
      payload,
    );

  return request<LeaveType>(
    LEAVE_TYPE_ENDPOINTS.item(id),
    {
      method: "PATCH",
      body: preparedPayload,
      signal: options.signal,
      validator: isLeaveType,
    },
  );
}

/**
 * Deactivate a Leave Type.
 */
export async function deactivateLeaveType(
  leaveTypeId: string,
  options: LeaveTypeRequestOptions = {},
): Promise<LeaveType> {
  const id =
    validateLeaveTypeId(
      leaveTypeId,
    );

  return request<LeaveType>(
    LEAVE_TYPE_ENDPOINTS.deactivate(id),
    {
      method: "POST",
      signal: options.signal,
      validator: isLeaveType,
    },
  );
}

/**
 * Activate a Leave Type.
 */
export async function activateLeaveType(
  leaveTypeId: string,
  options: LeaveTypeRequestOptions = {},
): Promise<LeaveType> {
  const id =
    validateLeaveTypeId(
      leaveTypeId,
    );

  return request<LeaveType>(
    LEAVE_TYPE_ENDPOINTS.activate(id),
    {
      method: "POST",
      signal: options.signal,
      validator: isLeaveType,
    },
  );
}

/**
 * Public Leave Type service API.
 */
export const leaveTypeService = {
  listLeaveTypes,
  getLeaveType,
  createLeaveType,
  updateLeaveType,
  deactivateLeaveType,
  activateLeaveType,
} as const;