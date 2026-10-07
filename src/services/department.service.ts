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
 * - State-changing requests rely on the backend Origin-based CSRF protection.
 * - Authenticated Department responses are never cached by the browser.
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

const DEPARTMENT_ENDPOINTS = {
  collection: "/api/departments",

  item: (departmentId: string) =>
    `/api/departments/${encodeURIComponent(
      departmentId,
    )}`,
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
  departmentLead:
    | DepartmentLead
    | null;
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
/* Request Options                                                             */
/* -------------------------------------------------------------------------- */

export interface DepartmentRequestOptions {
  signal?: AbortSignal;
}

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

  try {
    const url = new URL(
      API_BASE_URL,
    );

    /*
     * Production API communication must use HTTPS.
     *
     * Local development may use HTTP when Vite is
     * running in development mode.
     */
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
): Promise<
  ApiResponse<T> | undefined
> {
  const contentType =
    response.headers.get(
      "content-type",
    ) ?? "";

  if (
    !contentType
      .toLowerCase()
      .includes(
        "application/json",
      )
  ) {
    return undefined;
  }

  try {
    const parsed: unknown =
      await response.json();

    if (
      !isRecord(parsed)
    ) {
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
    typeof value.employeeId === "string" &&
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
    typeof value.organizationId === "string" &&
    typeof value.name === "string" &&
    typeof value.code === "string" &&
    (
      departmentLead === null ||
      isDepartmentLead(
        departmentLead,
      )
    ) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
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
   * Successful API calls must return JSON.
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
        typeof body.message ===
          "string" &&
        body.message.trim().length > 0
          ? body.message.trim()
          : "The Department request was not successful.",

      code:
        typeof body.code ===
          "string"
          ? body.code
          : "API_REQUEST_FAILED",

      status: response.status,
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
    !validator(
      body.data,
    )
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
    headers[
      "Content-Type"
    ] = "application/json";
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
    options.body !==
    undefined;

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
        buildUrl(
          endpoint,
        ),
        {
          method,

          /*
           * Authentication is handled by
           * the backend session cookie.
           */
          credentials:
            "include",

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

          /*
           * Department data is authenticated
           * and organization-specific.
           *
           * Never allow stale browser/proxy
           * responses to be reused.
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
      error instanceof
        DOMException &&
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
      error instanceof
        TypeError
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
/* Department ID Validation                                                   */
/* -------------------------------------------------------------------------- */

function validateDepartmentId(
  departmentId: string,
): string {
  if (
    typeof departmentId !==
    "string"
  ) {
    throw {
      message:
        "A valid Department ID is required.",

      code:
        "INVALID_DEPARTMENT_ID",
    } satisfies DepartmentServiceError;
  }

  const normalized =
    departmentId.trim();

  if (!normalized) {
    throw {
      message:
        "A valid Department ID is required.",

      code:
        "INVALID_DEPARTMENT_ID",
    } satisfies DepartmentServiceError;
  }

  return normalized;
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

  if (
    "name" in payload &&
    payload.name !== undefined
  ) {
    if (
      typeof payload.name !==
        "string" ||
      payload.name.trim()
        .length === 0
    ) {
      throw {
        message:
          "Department name cannot be empty.",

        code:
          "INVALID_DEPARTMENT_NAME",
      } satisfies DepartmentServiceError;
    }
  }

  if (
    "code" in payload &&
    payload.code !== undefined
  ) {
    if (
      typeof payload.code !==
        "string" ||
      payload.code.trim()
        .length === 0
    ) {
      throw {
        message:
          "Department code cannot be empty.",

        code:
          "INVALID_DEPARTMENT_CODE",
      } satisfies DepartmentServiceError;
    }
  }

  if (
    "departmentLeadId" in
      payload &&
    payload.departmentLeadId !==
      undefined &&
    payload.departmentLeadId !==
      null
  ) {
    if (
      typeof payload.departmentLeadId !==
        "string" ||
      payload.departmentLeadId
        .trim()
        .length === 0
    ) {
      throw {
        message:
          "Department Lead ID must be a valid employee ID.",

        code:
          "INVALID_DEPARTMENT_LEAD_ID",
      } satisfies DepartmentServiceError;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Prepare Payload                                                            */
/* -------------------------------------------------------------------------- */

function preparePayload<
  T extends
    | CreateDepartmentPayload
    | UpdateDepartmentPayload,
>(
  payload: T,
): T {
  validateDepartmentPayload(
    payload,
  );

  return {
    ...payload,
  };
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
    DEPARTMENT_ENDPOINTS.item(
      id,
    ),
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
    preparePayload(
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
    preparePayload(
      payload,
    );

  return request<Department>(
    DEPARTMENT_ENDPOINTS.item(
      id,
    ),
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
    DEPARTMENT_ENDPOINTS.item(
      id,
    ),
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