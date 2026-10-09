/**
 * Department API Service
 *
 * Production client for organization-scoped Department management.
 *
 * Security model:
 * - Authentication is provided by the backend session cookie.
 * - Credentials are included on every request.
 * - organizationId is never accepted from the client.
 * - Organization scope is resolved by the backend from the authenticated
 *   employee/session.
 * - State-changing requests rely on backend CSRF protection.
 * - Authenticated Department responses are never browser-cached.
 * - Server responses are runtime validated before reaching the UI.
 * - Client payloads are normalized and validated before transmission.
 * - Department IDs are URL encoded before being sent to the API.
 *
 * Backend contract:
 * - GET    /api/departments
 * - POST   /api/departments
 * - GET    /api/departments/:departmentId
 * - PATCH  /api/departments/:departmentId
 * - DELETE /api/departments/:departmentId
 */

const DEFAULT_API_BASE_URL =
  "https://ziya-hr-api-production.up.railway.app";

const configuredApiBaseUrl =
  import.meta.env.VITE_API_BASE_URL;

const API_BASE_URL = (
  configuredApiBaseUrl ||
  DEFAULT_API_BASE_URL
)
  .trim()
  .replace(/\/+$/, "");

const REQUEST_TIMEOUT_MS = 30_000;

const MAX_DEPARTMENT_ID_LENGTH = 128;
const MAX_DEPARTMENT_NAME_LENGTH = 150;
const MAX_DEPARTMENT_CODE_LENGTH = 50;
const MAX_EMPLOYEE_ID_LENGTH = 128;

const DEPARTMENT_ENDPOINTS = {
  collection: "/api/departments",

  item: (departmentId: string) =>
    `/api/departments/${encodeURIComponent(departmentId)}`,
} as const;

/* -------------------------------------------------------------------------- */
/* Department Lead                                                            */
/* -------------------------------------------------------------------------- */

export interface DepartmentLead {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;

  role:
    | "MANAGER"
    | "HR_ADMIN"
    | "SUPER_ADMIN";

  status:
    | "PENDING"
    | "ACTIVE"
    | "INACTIVE"
    | "SUSPENDED";
}

/* -------------------------------------------------------------------------- */
/* Department                                                                 */
/* -------------------------------------------------------------------------- */

export interface Department {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  departmentLead: DepartmentLead | null;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Payloads                                                                   */
/* -------------------------------------------------------------------------- */

export interface CreateDepartmentPayload {
  name: string;
  code: string;
}

export interface UpdateDepartmentPayload {
  name?: string;
  code?: string;
  departmentLeadId?: string | null;
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

export interface DepartmentServiceError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

/* -------------------------------------------------------------------------- */
/* API Response                                                               */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Request Options                                                            */
/* -------------------------------------------------------------------------- */

export interface DepartmentRequestOptions {
  signal?: AbortSignal;
}

/* -------------------------------------------------------------------------- */
/* Request Controller                                                         */
/* -------------------------------------------------------------------------- */

interface RequestController {
  controller: AbortController;
  cleanup: () => void;
  wasTimedOut: () => boolean;
}

/* -------------------------------------------------------------------------- */
/* Generic Object Check                                                       */
/* -------------------------------------------------------------------------- */

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null
  );
}

/* -------------------------------------------------------------------------- */
/* API Configuration                                                          */
/* -------------------------------------------------------------------------- */

function validateApiBaseUrl(): void {
  if (!API_BASE_URL) {
    throw {
      message:
        "The Leave Management API is not configured.",
      code:
        "API_BASE_URL_NOT_CONFIGURED",
    } satisfies DepartmentServiceError;
  }

  let url: URL;

  try {
    url = new URL(API_BASE_URL);
  } catch {
    throw {
      message:
        "The Leave Management API configuration is invalid.",
      code:
        "INVALID_API_BASE_URL",
    } satisfies DepartmentServiceError;
  }

  /*
   * Production authenticated requests must use HTTPS.
   */
  if (
    url.protocol !== "https:" &&
    import.meta.env.DEV !== true
  ) {
    throw {
      message:
        "Production API URL must use HTTPS.",
      code:
        "INVALID_API_PROTOCOL",
    } satisfies DepartmentServiceError;
  }

  /*
   * Only HTTP and HTTPS are allowed.
   */
  if (
    url.protocol !== "https:" &&
    url.protocol !== "http:"
  ) {
    throw {
      message:
        "The Leave Management API uses an unsupported protocol.",
      code:
        "INVALID_API_PROTOCOL",
    } satisfies DepartmentServiceError;
  }

  if (!url.hostname) {
    throw {
      message:
        "The Leave Management API hostname is invalid.",
      code:
        "INVALID_API_HOST",
    } satisfies DepartmentServiceError;
  }
}

/* -------------------------------------------------------------------------- */
/* Build URL                                                                  */
/* -------------------------------------------------------------------------- */

function buildUrl(
  endpoint: string,
): string {
  validateApiBaseUrl();

  if (
    typeof endpoint !== "string" ||
    !endpoint.startsWith("/")
  ) {
    throw {
      message:
        "The Department API endpoint is invalid.",
      code:
        "INVALID_API_ENDPOINT",
    } satisfies DepartmentServiceError;
  }

  return `${API_BASE_URL}${endpoint}`;
}

/* -------------------------------------------------------------------------- */
/* Normalize Service Error                                                    */
/* -------------------------------------------------------------------------- */

function createServiceError(
  error: unknown,
  fallbackMessage: string,
): DepartmentServiceError {
  if (isRecord(error)) {
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

/* -------------------------------------------------------------------------- */
/* HTTP Error                                                                 */
/* -------------------------------------------------------------------------- */

function createHttpError(
  response: Response,
  body?: ApiResponse<unknown>,
): DepartmentServiceError {
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
        : `Department request failed with status ${response.status}.`,

    code:
      typeof backendCode === "string" &&
      backendCode.trim().length > 0
        ? backendCode.trim()
        : undefined,

    status: response.status,

    details: backendDetails,
  };
}

/* -------------------------------------------------------------------------- */
/* Read JSON Response                                                         */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Department Lead Validation                                                 */
/* -------------------------------------------------------------------------- */

function isDepartmentLead(
  value: unknown,
): value is DepartmentLead {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&

    typeof value.employeeId === "string" &&
    value.employeeId.trim().length > 0 &&

    typeof value.firstName === "string" &&

    typeof value.lastName === "string" &&

    typeof value.email === "string" &&

    (
      value.role === "MANAGER" ||
      value.role === "HR_ADMIN" ||
      value.role === "SUPER_ADMIN"
    ) &&

    (
      value.status === "PENDING" ||
      value.status === "ACTIVE" ||
      value.status === "INACTIVE" ||
      value.status === "SUSPENDED"
    )
  );
}

/* -------------------------------------------------------------------------- */
/* Department Validation                                                      */
/* -------------------------------------------------------------------------- */

function isDepartment(
  value: unknown,
): value is Department {
  if (!isRecord(value)) {
    return false;
  }

  const departmentLead =
    value.departmentLead;

  return (
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&

    typeof value.organizationId === "string" &&
    value.organizationId.trim().length > 0 &&

    typeof value.name === "string" &&
    value.name.trim().length > 0 &&

    typeof value.code === "string" &&
    value.code.trim().length > 0 &&

    (
      departmentLead === null ||
      isDepartmentLead(departmentLead)
    ) &&

    typeof value.createdAt === "string" &&
    value.createdAt.trim().length > 0 &&

    typeof value.updatedAt === "string" &&
    value.updatedAt.trim().length > 0
  );
}

/* -------------------------------------------------------------------------- */
/* Department Array Validation                                                */
/* -------------------------------------------------------------------------- */

function isDepartmentArray(
  value: unknown,
): value is Department[] {
  return (
    Array.isArray(value) &&
    value.every(isDepartment)
  );
}

/* -------------------------------------------------------------------------- */
/* Response Parser                                                            */
/* -------------------------------------------------------------------------- */

async function parseResponse<T>(
  response: Response,
  validator: (
    value: unknown,
  ) => value is T,
): Promise<T> {
  const body =
    await readJsonResponse<T>(
      response,
    );

  /*
   * HTTP-level error.
   */
  if (!response.ok) {
    throw createHttpError(
      response,
      body,
    );
  }

  /*
   * Successful responses must contain JSON.
   */
  if (!body) {
    throw {
      message:
        "The Department server returned an invalid response.",
      status: response.status,
      code:
        "INVALID_API_RESPONSE",
    } satisfies DepartmentServiceError;
  }

  /*
   * Explicit API-level failure.
   */
  if (
    body.success !== undefined &&
    body.success !== true
  ) {
    throw {
      message:
        typeof body.message === "string" &&
        body.message.trim().length > 0
          ? body.message.trim()
          : "The Department request was not successful.",

      code:
        typeof body.code === "string" &&
        body.code.trim().length > 0
          ? body.code.trim()
          : "API_REQUEST_FAILED",

      status: response.status,

      details:
        body.error?.details,
    } satisfies DepartmentServiceError;
  }

  /*
   * Successful responses must contain data.
   */
  if (
    body.data === undefined
  ) {
    throw {
      message:
        "The Department server returned a response without data.",
      status: response.status,
      code:
        "INVALID_API_RESPONSE",
    } satisfies DepartmentServiceError;
  }

  /*
   * Runtime contract validation.
   */
  if (
    !validator(body.data)
  ) {
    throw {
      message:
        "The Department server returned data in an unexpected format.",
      status: response.status,
      code:
        "INVALID_API_RESPONSE",
    } satisfies DepartmentServiceError;
  }

  return body.data;
}

/* -------------------------------------------------------------------------- */
/* Request Controller                                                         */
/* -------------------------------------------------------------------------- */

function createRequestController(
  callerSignal?: AbortSignal,
): RequestController {
  const controller =
    new AbortController();

  let timedOut = false;

  const timeoutId =
    globalThis.setTimeout(
      () => {
        timedOut = true;
        controller.abort();
      },
      REQUEST_TIMEOUT_MS,
    );

  let callerAbortHandler:
    | (() => void)
    | undefined;

  if (callerSignal) {
    callerAbortHandler =
      () => {
        controller.abort();
      };

    if (
      callerSignal.aborted
    ) {
      controller.abort();
    } else {
      callerSignal.addEventListener(
        "abort",
        callerAbortHandler,
        {
          once: true,
        },
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

    wasTimedOut: () =>
      timedOut,
  };
}

/* -------------------------------------------------------------------------- */
/* Request Headers                                                            */
/* -------------------------------------------------------------------------- */

function buildHeaders(
  hasJsonBody: boolean,
): HeadersInit {
  const headers: Record<
    string,
    string
  > = {
    Accept:
      "application/json",
  };

  if (hasJsonBody) {
    headers["Content-Type"] =
      "application/json";
  }

  return headers;
}

/* -------------------------------------------------------------------------- */
/* Generic Authenticated Request                                              */
/* -------------------------------------------------------------------------- */

async function request<T>(
  endpoint: string,
  options: {
    method?:
      | "GET"
      | "POST"
      | "PATCH"
      | "DELETE";

    body?: unknown;

    signal?: AbortSignal;

    validator: (
      value: unknown,
    ) => value is T;
  },
): Promise<T> {
  const method =
    options.method ??
    "GET";

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
    let serializedBody:
      | string
      | undefined;

    if (hasJsonBody) {
      try {
        serializedBody =
          JSON.stringify(
            options.body,
          );
      } catch {
        throw {
          message:
            "The Department request could not be serialized.",
          code:
            "REQUEST_SERIALIZATION_ERROR",
        } satisfies DepartmentServiceError;
      }
    }

    const response =
      await fetch(
        buildUrl(endpoint),
        {
          method,

          /*
           * Authentication is handled by the
           * backend session cookie.
           */
          credentials:
            "include",

          headers:
            buildHeaders(
              hasJsonBody,
            ),

          body:
            serializedBody,

          signal:
            controller.signal,

          /*
           * Department data is tenant-specific.
           * Never reuse stale cached responses.
           */
          cache:
            "no-store",

          redirect:
            "follow",
        },
      );

    return await parseResponse<T>(
      response,
      options.validator,
    );
  } catch (error) {
    /*
     * Abort / timeout handling.
     */
    if (
      error instanceof DOMException &&
      error.name ===
        "AbortError"
    ) {
      if (
        options.signal?.aborted
      ) {
        throw {
          message:
            "The Department request was cancelled.",
          code:
            "REQUEST_CANCELLED",
        } satisfies DepartmentServiceError;
      }

      if (
        wasTimedOut()
      ) {
        throw {
          message:
            "The Department request timed out. Please try again.",
          code:
            "REQUEST_TIMEOUT",
        } satisfies DepartmentServiceError;
      }

      throw {
        message:
          "The Department request was cancelled.",
        code:
          "REQUEST_CANCELLED",
      } satisfies DepartmentServiceError;
    }

    /*
     * Network failure.
     */
    if (
      error instanceof TypeError
    ) {
      throw {
        message:
          "Unable to connect to the Leave Management service. Please check your connection and try again.",
        code:
          "NETWORK_ERROR",
      } satisfies DepartmentServiceError;
    }

    /*
     * Preserve structured API errors.
     */
    throw createServiceError(
      error,
      "Unable to communicate with the Department service.",
    );
  } finally {
    cleanup();
  }
}

/* -------------------------------------------------------------------------- */
/* String Validation                                                          */
/* -------------------------------------------------------------------------- */

function normalizeRequiredString(
  value: unknown,
  fieldName: string,
  maxLength: number,
  errorCode: string,
): string {
  if (
    typeof value !== "string"
  ) {
    throw {
      message:
        `${fieldName} must be a valid string.`,
      code:
        errorCode,
    } satisfies DepartmentServiceError;
  }

  const normalized =
    value.trim();

  if (!normalized) {
    throw {
      message:
        `${fieldName} cannot be empty.`,
      code:
        errorCode,
    } satisfies DepartmentServiceError;
  }

  if (
    normalized.length >
    maxLength
  ) {
    throw {
      message:
        `${fieldName} cannot exceed ${maxLength} characters.`,
      code:
        errorCode,
    } satisfies DepartmentServiceError;
  }

  return normalized;
}

/* -------------------------------------------------------------------------- */
/* Department ID Validation                                                   */
/* -------------------------------------------------------------------------- */

function validateDepartmentId(
  departmentId: string,
): string {
  return normalizeRequiredString(
    departmentId,
    "Department ID",
    MAX_DEPARTMENT_ID_LENGTH,
    "INVALID_DEPARTMENT_ID",
  );
}

/* -------------------------------------------------------------------------- */
/* Department Lead ID Validation                                              */
/* -------------------------------------------------------------------------- */

function validateDepartmentLeadId(
  departmentLeadId: string,
): string {
  return normalizeRequiredString(
    departmentLeadId,
    "Department Lead ID",
    MAX_EMPLOYEE_ID_LENGTH,
    "INVALID_DEPARTMENT_LEAD_ID",
  );
}

/* -------------------------------------------------------------------------- */
/* Department Payload Validation                                              */
/* -------------------------------------------------------------------------- */

function validateDepartmentPayload(
  payload:
    | CreateDepartmentPayload
    | UpdateDepartmentPayload,
): void {
  if (!isRecord(payload)) {
    throw {
      message:
        "A valid Department payload is required.",
      code:
        "INVALID_DEPARTMENT_PAYLOAD",
    } satisfies DepartmentServiceError;
  }

  /*
   * Do not allow the browser to control tenant scope.
   */
  if (
    "organizationId" in payload
  ) {
    throw {
      message:
        "Organization scope cannot be supplied by the client.",
      code:
        "ORGANIZATION_SCOPE_FORBIDDEN",
    } satisfies DepartmentServiceError;
  }

  /*
   * IDs are generated and controlled by the backend.
   */
  if ("id" in payload) {
    throw {
      message:
        "Department ID cannot be supplied in the Department payload.",
      code:
        "INVALID_DEPARTMENT_PAYLOAD",
    } satisfies DepartmentServiceError;
  }

  /*
   * System-managed fields are not client-controlled.
   */
  if (
    "createdAt" in payload ||
    "updatedAt" in payload
  ) {
    throw {
      message:
        "System-managed Department fields cannot be supplied by the client.",
      code:
        "INVALID_DEPARTMENT_PAYLOAD",
    } satisfies DepartmentServiceError;
  }

  /*
   * Nested Department Lead objects are not accepted.
   * Only departmentLeadId may be supplied.
   */
  if (
    "departmentLead" in payload
  ) {
    throw {
      message:
        "Department Lead data cannot be supplied directly. Use departmentLeadId.",
      code:
        "INVALID_DEPARTMENT_PAYLOAD",
    } satisfies DepartmentServiceError;
  }

  /*
   * From this point onward, work with the explicit
   * TypeScript payload type instead of the Record narrowing.
   */
  const typedPayload =
    payload as
      | CreateDepartmentPayload
      | UpdateDepartmentPayload;

  if (
    "name" in typedPayload &&
    typedPayload.name !== undefined
  ) {
    normalizeRequiredString(
      typedPayload.name,
      "Department name",
      MAX_DEPARTMENT_NAME_LENGTH,
      "INVALID_DEPARTMENT_NAME",
    );
  }

  if (
    "code" in typedPayload &&
    typedPayload.code !== undefined
  ) {
    normalizeRequiredString(
      typedPayload.code,
      "Department code",
      MAX_DEPARTMENT_CODE_LENGTH,
      "INVALID_DEPARTMENT_CODE",
    );
  }

  if (
    "departmentLeadId" in typedPayload &&
    typedPayload.departmentLeadId !== undefined &&
    typedPayload.departmentLeadId !== null
  ) {
    /*
     * Explicit local narrowing avoids passing
     * string | undefined to a string-only validator.
     */
    const departmentLeadId =
      typedPayload.departmentLeadId;

    if (
      typeof departmentLeadId !==
      "string"
    ) {
      throw {
        message:
          "Department Lead ID must be a valid employee ID.",
        code:
          "INVALID_DEPARTMENT_LEAD_ID",
      } satisfies DepartmentServiceError;
    }

    validateDepartmentLeadId(
      departmentLeadId,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Prepare Create Payload                                                     */
/* -------------------------------------------------------------------------- */

function prepareCreatePayload(
  payload: CreateDepartmentPayload,
): CreateDepartmentPayload {
  validateDepartmentPayload(
    payload,
  );

  const name =
    normalizeRequiredString(
      payload.name,
      "Department name",
      MAX_DEPARTMENT_NAME_LENGTH,
      "INVALID_DEPARTMENT_NAME",
    );

  const code =
    normalizeRequiredString(
      payload.code,
      "Department code",
      MAX_DEPARTMENT_CODE_LENGTH,
      "INVALID_DEPARTMENT_CODE",
    );

  /*
   * Build a new object deliberately.
   *
   * This prevents accidental transmission of properties
   * added to the original object by UI code.
   */
  return {
    name,
    code,
  };
}

/* -------------------------------------------------------------------------- */
/* Prepare Update Payload                                                     */
/* -------------------------------------------------------------------------- */

function prepareUpdatePayload(
  payload: UpdateDepartmentPayload,
): UpdateDepartmentPayload {
  validateDepartmentPayload(
    payload,
  );

  const prepared:
    UpdateDepartmentPayload = {};

  if (
    "name" in payload &&
    payload.name !== undefined
  ) {
    prepared.name =
      normalizeRequiredString(
        payload.name,
        "Department name",
        MAX_DEPARTMENT_NAME_LENGTH,
        "INVALID_DEPARTMENT_NAME",
      );
  }

  if (
    "code" in payload &&
    payload.code !== undefined
  ) {
    prepared.code =
      normalizeRequiredString(
        payload.code,
        "Department code",
        MAX_DEPARTMENT_CODE_LENGTH,
        "INVALID_DEPARTMENT_CODE",
      );
  }

  if (
    "departmentLeadId" in payload
  ) {
    if (
      payload.departmentLeadId ===
      null
    ) {
      prepared.departmentLeadId =
        null;
    } else if (
      typeof payload.departmentLeadId ===
      "string"
    ) {
      prepared.departmentLeadId =
        validateDepartmentLeadId(
          payload.departmentLeadId,
        );
    } else {
      throw {
        message:
          "Department Lead ID must be a valid employee ID.",
        code:
          "INVALID_DEPARTMENT_LEAD_ID",
      } satisfies DepartmentServiceError;
    }
  }

  /*
   * Never send an empty PATCH request.
   */
  if (
    Object.keys(prepared)
      .length === 0
  ) {
    throw {
      message:
        "At least one Department field must be provided for an update.",
      code:
        "EMPTY_DEPARTMENT_UPDATE",
    } satisfies DepartmentServiceError;
  }

  return prepared;
}

/* -------------------------------------------------------------------------- */
/* List Departments                                                           */
/* -------------------------------------------------------------------------- */

export async function listDepartments(
  options: DepartmentRequestOptions = {},
): Promise<Department[]> {
  return request<Department[]>(
    DEPARTMENT_ENDPOINTS.collection,
    {
      method: "GET",

      signal:
        options.signal,

      validator:
        isDepartmentArray,
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Get Department                                                             */
/* -------------------------------------------------------------------------- */

export async function getDepartment(
  departmentId: string,
  options: DepartmentRequestOptions = {},
): Promise<Department> {
  const id =
    validateDepartmentId(
      departmentId,
    );

  return request<Department>(
    DEPARTMENT_ENDPOINTS.item(id),
    {
      method: "GET",

      signal:
        options.signal,

      validator:
        isDepartment,
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Create Department                                                          */
/* -------------------------------------------------------------------------- */

export async function createDepartment(
  payload: CreateDepartmentPayload,
  options: DepartmentRequestOptions = {},
): Promise<Department> {
  const preparedPayload =
    prepareCreatePayload(
      payload,
    );

  return request<Department>(
    DEPARTMENT_ENDPOINTS.collection,
    {
      method: "POST",

      body:
        preparedPayload,

      signal:
        options.signal,

      validator:
        isDepartment,
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Update Department                                                          */
/* -------------------------------------------------------------------------- */

export async function updateDepartment(
  departmentId: string,
  payload: UpdateDepartmentPayload,
  options: DepartmentRequestOptions = {},
): Promise<Department> {
  const id =
    validateDepartmentId(
      departmentId,
    );

  const preparedPayload =
    prepareUpdatePayload(
      payload,
    );

  return request<Department>(
    DEPARTMENT_ENDPOINTS.item(id),
    {
      method: "PATCH",

      body:
        preparedPayload,

      signal:
        options.signal,

      validator:
        isDepartment,
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Delete Department                                                          */
/* -------------------------------------------------------------------------- */

export async function deleteDepartment(
  departmentId: string,
  options: DepartmentRequestOptions = {},
): Promise<Department> {
  const id =
    validateDepartmentId(
      departmentId,
    );

  return request<Department>(
    DEPARTMENT_ENDPOINTS.item(id),
    {
      method: "DELETE",

      signal:
        options.signal,

      validator:
        isDepartment,
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Service Object                                                             */
/* -------------------------------------------------------------------------- */

export const departmentService = {
  listDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} as const;