/**
 * Employee API Service
 *
 * Production client for organization-scoped Employee data.
 *
 * Security model:
 * - Authentication is provided by the backend session cookie.
 * - Credentials are included on every request.
 * - organizationId is never supplied by the frontend as a scope selector.
 * - The backend derives organization scope from the authenticated employee.
 * - Authenticated employee responses are never browser-cached.
 * - The backend remains the authoritative source for authorization,
 *   organization isolation, employee status, role and department rules.
 *
 * Current verified backend contract:
 *
 * GET /api/employees
 * GET /api/employees/:employeeId
 *
 * The employee list response is:
 *
 * {
 *   employees: EmployeePublicRecord[],
 *   total: number
 * }
 *
 * The backend EmployeePublicRecord contains:
 * - id
 * - organizationId
 * - employeeId
 * - firstName
 * - lastName
 * - email
 * - phone
 * - role
 * - status
 * - authenticationMethod
 * - emailVerified
 * - phoneVerified
 * - department
 * - reportsTo
 * - createdAt
 * - updatedAt
 *
 * IMPORTANT:
 * This service does not invent employee mutation endpoints.
 * Employee mutation support can be added after the exact backend
 * mutation contracts are deliberately verified.
 */

/* =========================================================
   API CONFIGURATION
========================================================= */

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

/* =========================================================
   ENDPOINTS
========================================================= */

const EMPLOYEE_ENDPOINTS = {
  collection: "/api/employees",

  item: (employeeId: string) =>
    `/api/employees/${encodeURIComponent(employeeId)}`,
} as const;

/* =========================================================
   DOMAIN TYPES
========================================================= */

export type EmployeeRole =
  | "EMPLOYEE"
  | "MANAGER"
  | "HR_ADMIN"
  | "SUPER_ADMIN";

export type EmployeeStatus =
  | "PENDING"
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED";

export type EmployeeAuthenticationMethod =
  | "PASSWORD"
  | "OTP"
  | "PASSWORD_AND_OTP";

/* =========================================================
   NESTED EMPLOYEE TYPES
========================================================= */

export interface EmployeeDepartment {
  id: string;
  name: string;
  code: string;
}

export interface EmployeeReportsTo {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: EmployeeRole;
}

/* =========================================================
   PUBLIC EMPLOYEE RECORD
========================================================= */

/**
 * Safe employee representation returned by the backend.
 *
 * Authentication secrets are intentionally absent.
 */
export interface EmployeePublicRecord {
  id: string;
  organizationId: string;
  employeeId: string;

  firstName: string;
  lastName: string;

  email: string;
  phone: string;

  role: EmployeeRole;
  status: EmployeeStatus;

  authenticationMethod:
    EmployeeAuthenticationMethod;

  emailVerified: boolean;
  phoneVerified: boolean;

  department:
    | EmployeeDepartment
    | null;

  reportsTo:
    | EmployeeReportsTo
    | null;

  createdAt: string;
  updatedAt: string;
}

/* =========================================================
   LIST RESPONSE
========================================================= */

export interface EmployeeListResult {
  employees: EmployeePublicRecord[];
  total: number;
}

/* =========================================================
   SERVICE ERROR
========================================================= */

export interface EmployeeServiceError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

/* =========================================================
   REQUEST OPTIONS
========================================================= */

export interface EmployeeRequestOptions {
  signal?: AbortSignal;
}

/* =========================================================
   API RESPONSE ENVELOPE
========================================================= */

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

/* =========================================================
   REQUEST CONTROLLER
========================================================= */

interface RequestController {
  controller: AbortController;

  cleanup: () => void;

  wasTimedOut: () => boolean;
}

/* =========================================================
   GENERIC OBJECT CHECK
========================================================= */

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null
  );
}

/* =========================================================
   ROLE VALIDATION
========================================================= */

function isEmployeeRole(
  value: unknown,
): value is EmployeeRole {
  return (
    value === "EMPLOYEE" ||
    value === "MANAGER" ||
    value === "HR_ADMIN" ||
    value === "SUPER_ADMIN"
  );
}

/* =========================================================
   STATUS VALIDATION
========================================================= */

function isEmployeeStatus(
  value: unknown,
): value is EmployeeStatus {
  return (
    value === "PENDING" ||
    value === "ACTIVE" ||
    value === "INACTIVE" ||
    value === "SUSPENDED"
  );
}

/* =========================================================
   AUTHENTICATION METHOD VALIDATION
========================================================= */

function isEmployeeAuthenticationMethod(
  value: unknown,
): value is EmployeeAuthenticationMethod {
  return (
    value === "PASSWORD" ||
    value === "OTP" ||
    value === "PASSWORD_AND_OTP"
  );
}

/* =========================================================
   DEPARTMENT VALIDATION
========================================================= */

function isEmployeeDepartment(
  value: unknown,
): value is EmployeeDepartment {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.code === "string"
  );
}

/* =========================================================
   REPORTING EMPLOYEE VALIDATION
========================================================= */

function isEmployeeReportsTo(
  value: unknown,
): value is EmployeeReportsTo {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.employeeId === "string" &&
    typeof value.firstName === "string" &&
    typeof value.lastName === "string" &&
    typeof value.email === "string" &&
    isEmployeeRole(value.role)
  );
}

/* =========================================================
   EMPLOYEE VALIDATION
========================================================= */

function isEmployee(
  value: unknown,
): value is EmployeePublicRecord {
  if (!isRecord(value)) {
    return false;
  }

  const department =
    value.department;

  const reportsTo =
    value.reportsTo;

  return (
    typeof value.id === "string" &&

    typeof value.organizationId ===
      "string" &&

    typeof value.employeeId ===
      "string" &&

    typeof value.firstName ===
      "string" &&

    typeof value.lastName ===
      "string" &&

    typeof value.email ===
      "string" &&

    typeof value.phone ===
      "string" &&

    isEmployeeRole(
      value.role,
    ) &&

    isEmployeeStatus(
      value.status,
    ) &&

    isEmployeeAuthenticationMethod(
      value.authenticationMethod,
    ) &&

    typeof value.emailVerified ===
      "boolean" &&

    typeof value.phoneVerified ===
      "boolean" &&

    (
      department === null ||
      isEmployeeDepartment(
        department,
      )
    ) &&

    (
      reportsTo === null ||
      isEmployeeReportsTo(
        reportsTo,
      )
    ) &&

    typeof value.createdAt ===
      "string" &&

    typeof value.updatedAt ===
      "string"
  );
}

/* =========================================================
   EMPLOYEE LIST VALIDATION
========================================================= */

function isEmployeeListResult(
  value: unknown,
): value is EmployeeListResult {
  if (!isRecord(value)) {
    return false;
  }

  if (
    !Array.isArray(
      value.employees,
    )
  ) {
    return false;
  }

  if (
    typeof value.total !==
    "number"
  ) {
    return false;
  }

  if (
    !Number.isFinite(
      value.total,
    ) ||
    value.total < 0
  ) {
    return false;
  }

  return value.employees.every(
    isEmployee,
  );
}

/* =========================================================
   API URL VALIDATION
========================================================= */

function validateApiBaseUrl(): void {
  if (!API_BASE_URL) {
    throw {
      message:
        "The Leave Management API is not configured.",

      code:
        "API_BASE_URL_NOT_CONFIGURED",
    } satisfies EmployeeServiceError;
  }

  try {
    const url =
      new URL(
        API_BASE_URL,
      );

    /*
     * Production API communication must use HTTPS.
     *
     * Local development may use HTTP when Vite is running
     * in development mode.
     */
    if (
      url.protocol !==
        "https:" &&
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
    } satisfies EmployeeServiceError;
  }
}

/* =========================================================
   BUILD URL
========================================================= */

function buildUrl(
  endpoint: string,
): string {
  validateApiBaseUrl();

  return `${API_BASE_URL}${endpoint}`;
}

/* =========================================================
   NORMALIZE SERVICE ERROR
========================================================= */

function createServiceError(
  error: unknown,
  fallbackMessage: string,
): EmployeeServiceError {
  if (
    isRecord(error)
  ) {
    const message =
      typeof error.message ===
        "string" &&
      error.message.trim()
        .length > 0
        ? error.message.trim()
        : fallbackMessage;

    const code =
      typeof error.code ===
        "string" &&
      error.code.trim()
        .length > 0
        ? error.code.trim()
        : undefined;

    const status =
      typeof error.status ===
        "number" &&
      Number.isFinite(
        error.status,
      )
        ? error.status
        : undefined;

    return {
      message,
      code,
      status,
      details:
        error.details,
    };
  }

  if (
    error instanceof Error
  ) {
    return {
      message:
        error.message.trim()
          .length > 0
          ? error.message.trim()
          : fallbackMessage,
    };
  }

  return {
    message:
      fallbackMessage,
  };
}

/* =========================================================
   HTTP ERROR
========================================================= */

function createHttpError(
  response: Response,
  body?: ApiResponse<unknown>,
): EmployeeServiceError {
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
      typeof backendMessage ===
        "string" &&
      backendMessage.trim()
        .length > 0
        ? backendMessage.trim()
        : `Employee request failed with status ${response.status}.`,

    code:
      typeof backendCode ===
        "string" &&
      backendCode.trim()
        .length > 0
        ? backendCode.trim()
        : undefined,

    status:
      response.status,

    details:
      backendDetails,
  };
}

/* =========================================================
   READ JSON RESPONSE
========================================================= */

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

/* =========================================================
   RESPONSE PARSER
========================================================= */

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
        "The Employee server returned an invalid response.",

      status:
        response.status,

      code:
        "INVALID_API_RESPONSE",
    } satisfies EmployeeServiceError;
  }

  /*
   * Explicit API-level failure.
   */
  if (
    body.success !==
      undefined &&
    body.success !== true
  ) {
    throw {
      message:
        typeof body.message ===
          "string" &&
        body.message.trim()
          .length > 0
          ? body.message.trim()
          : "The Employee request was not successful.",

      code:
        typeof body.code ===
          "string"
          ? body.code
          : "API_REQUEST_FAILED",

      status:
        response.status,
    } satisfies EmployeeServiceError;
  }

  /*
   * Successful responses must contain data.
   */
  if (
    body.data ===
    undefined
  ) {
    throw {
      message:
        "The Employee server returned a response without data.",

      status:
        response.status,

      code:
        "INVALID_API_RESPONSE",
    } satisfies EmployeeServiceError;
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
        "The Employee server returned data in an unexpected format.",

      status:
        response.status,

      code:
        "INVALID_API_RESPONSE",
    } satisfies EmployeeServiceError;
  }

  return body.data;
}

/* =========================================================
   REQUEST CONTROLLER
========================================================= */

function createRequestController(
  callerSignal?: AbortSignal,
): RequestController {
  const controller =
    new AbortController();

  let timedOut =
    false;

  const timeoutId =
    globalThis.setTimeout(
      () => {
        timedOut =
          true;

        controller.abort();
      },
      REQUEST_TIMEOUT_MS,
    );

  let callerAbortHandler:
    | (() => void)
    | undefined;

  if (
    callerSignal
  ) {
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

/* =========================================================
   REQUEST HEADERS
========================================================= */

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

  if (
    hasJsonBody
  ) {
    headers[
      "Content-Type"
    ] =
      "application/json";
  }

  return headers;
}

/* =========================================================
   GENERIC AUTHENTICATED REQUEST
========================================================= */

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
           * Employee data is authenticated,
           * organization-specific information.
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
            "The Employee request was cancelled.",

          code:
            "REQUEST_CANCELLED",
        } satisfies EmployeeServiceError;
      }

      if (
        wasTimedOut()
      ) {
        throw {
          message:
            "The Employee request timed out. Please try again.",

          code:
            "REQUEST_TIMEOUT",
        } satisfies EmployeeServiceError;
      }

      throw {
        message:
          "The Employee request was cancelled.",

        code:
          "REQUEST_CANCELLED",
      } satisfies EmployeeServiceError;
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
      } satisfies EmployeeServiceError;
    }

    /*
     * Preserve structured API errors.
     */
    throw createServiceError(
      error,
      "Unable to communicate with the Employee service.",
    );
  } finally {
    cleanup();
  }
}

/* =========================================================
   EMPLOYEE ID VALIDATION
========================================================= */

function validateEmployeeId(
  employeeId: string,
): string {
  if (
    typeof employeeId !==
    "string"
  ) {
    throw {
      message:
        "A valid Employee ID is required.",

      code:
        "INVALID_EMPLOYEE_ID",
    } satisfies EmployeeServiceError;
  }

  const normalized =
    employeeId.trim();

  if (
    !normalized
  ) {
    throw {
      message:
        "A valid Employee ID is required.",

      code:
        "INVALID_EMPLOYEE_ID",
    } satisfies EmployeeServiceError;
  }

  return normalized;
}

/* =========================================================
   LIST EMPLOYEES
========================================================= */

/**
 * Retrieve all employees belonging to the
 * authenticated user's organization.
 *
 * IMPORTANT:
 * No organizationId is accepted from the frontend.
 *
 * The backend derives organization scope from
 * the authenticated employee/session.
 */
export async function listEmployees(
  options: EmployeeRequestOptions = {},
): Promise<EmployeeListResult> {
  return request<EmployeeListResult>(
    EMPLOYEE_ENDPOINTS.collection,
    {
      method:
        "GET",

      signal:
        options.signal,

      validator:
        isEmployeeListResult,
    },
  );
}

/* =========================================================
   GET EMPLOYEE
========================================================= */

/**
 * Retrieve one employee.
 *
 * The backend remains responsible for ensuring
 * that the requested employee belongs to the
 * authenticated user's organization.
 */
export async function getEmployee(
  employeeId: string,
  options: EmployeeRequestOptions = {},
): Promise<EmployeePublicRecord> {
  const id =
    validateEmployeeId(
      employeeId,
    );

  return request<EmployeePublicRecord>(
    EMPLOYEE_ENDPOINTS.item(
      id,
    ),
    {
      method:
        "GET",

      signal:
        options.signal,

      validator:
        isEmployee,
    },
  );
}

/* =========================================================
   DEPARTMENT-LEAD ELIGIBILITY
========================================================= */

/**
 * Roles that the backend Department Lead validation
 * currently permits:
 *
 * - MANAGER
 * - HR_ADMIN
 * - SUPER_ADMIN
 */
export const DEPARTMENT_LEAD_ROLES: readonly EmployeeRole[] =
  [
    "MANAGER",
    "HR_ADMIN",
    "SUPER_ADMIN",
  ] as const;

/**
 * Return employees who are eligible to be displayed
 * as Department Lead candidates for a particular
 * department.
 *
 * This is a UI/reference-data helper only.
 *
 * The backend remains authoritative and MUST revalidate:
 * - organization
 * - department membership
 * - active status
 * - permitted role
 *
 * No security decision is delegated to this helper.
 */
export function getEligibleDepartmentLeads(
  employees: EmployeePublicRecord[],
  departmentId: string,
): EmployeePublicRecord[] {
  const normalizedDepartmentId =
    departmentId.trim();

  if (
    !normalizedDepartmentId
  ) {
    return [];
  }

  return employees.filter(
    (employee) =>
      employee.status ===
        "ACTIVE" &&

      DEPARTMENT_LEAD_ROLES.includes(
        employee.role,
      ) &&

      employee.department?.id ===
        normalizedDepartmentId,
  );
}

/* =========================================================
   EMPLOYEE DISPLAY HELPERS
========================================================= */

/**
 * Build a safe display name without assuming
 * any additional employee fields.
 */
export function getEmployeeDisplayName(
  employee: EmployeePublicRecord,
): string {
  return [
    employee.firstName.trim(),
    employee.lastName.trim(),
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Build a short initials representation for
 * employee avatars where a profile image is
 * not available.
 */
export function getEmployeeInitials(
  employee: EmployeePublicRecord,
): string {
  const first =
    employee.firstName
      .trim()
      .charAt(0);

  const last =
    employee.lastName
      .trim()
      .charAt(0);

  return `${first}${last}`
    .toUpperCase();
}

/* =========================================================
   SERVICE OBJECT
========================================================= */

export const employeeService = {
  listEmployees,
  getEmployee,
  getEligibleDepartmentLeads,
  getEmployeeDisplayName,
  getEmployeeInitials,
} as const;