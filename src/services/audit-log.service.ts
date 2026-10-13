
/**
 * Ziya HR — Audit Logs API Service
 *
 * Production frontend client for organization-scoped audit logs.
 *
 * Security:
 * - Authentication is provided by the backend session cookie.
 * - Credentials are included in requests.
 * - Organization IDs are never accepted as client filters.
 * - Authorization and tenant isolation are enforced by the backend.
 * - Responses are not cached.
 */

const DEFAULT_API_BASE_URL =
  "https://ziya-hr-api-production.up.railway.app";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
)
  .trim()
  .replace(/\/+$/, "");

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_PAGE_SIZE = 100;
const MAX_FILTER_LENGTH = 100;
const AUDIT_LOGS_ENDPOINT = "/api/audit-logs";

export interface AuditLog {
  id: string;
  organizationId: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  actorFirstName: string | null;
  actorLastName: string | null;
  actorEmail: string | null;
}

export interface AuditLogFilters {
  action?: string;
  entityType?: string;
  actorId?: string;
}

export interface AuditLogPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface AuditLogListResult {
  data: AuditLog[];
  pagination: AuditLogPagination;
  filters: AuditLogFilters;
}

export interface ListAuditLogsOptions extends AuditLogFilters {
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}

export interface AuditLogServiceError {
  message: string;
  code?: string;
  status?: number;
}

interface ApiAuditLogResponse {
  success: true;
  data: AuditLog[];
  pagination: AuditLogPagination;
  filters: AuditLogFilters;
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

function createError(
  message: string,
  code?: string,
  status?: number,
): AuditLogServiceError {
  return {
    message,
    ...(code ? { code } : {}),
    ...(status !== undefined ? { status } : {}),
  };
}

function validateApiBaseUrl(): void {
  if (!API_BASE_URL) {
    throw createError(
      "The Leave Management API is not configured.",
      "API_BASE_URL_NOT_CONFIGURED",
    );
  }

  let url: URL;

  try {
    url = new URL(API_BASE_URL);
  } catch {
    throw createError(
      "The Leave Management API URL is invalid.",
      "INVALID_API_BASE_URL",
    );
  }

  if (
    url.protocol !== "https:" &&
    import.meta.env.DEV !== true
  ) {
    throw createError(
      "The production API must use HTTPS.",
      "INSECURE_API_BASE_URL",
    );
  }

  if (url.username || url.password) {
    throw createError(
      "Credentials must not be embedded in the API URL.",
      "INVALID_API_BASE_URL",
    );
  }
}

function validatePositiveInteger(
  value: number | undefined,
  field: string,
  maximum?: number,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    (maximum !== undefined && value > maximum)
  ) {
    throw createError(
      `${field} must be a valid positive integer.`,
      "INVALID_AUDIT_LOG_INPUT",
    );
  }

  return value;
}

function normalizeFilter(
  value: string | undefined,
  field: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw createError(
      `${field} must be text.`,
      "INVALID_AUDIT_LOG_INPUT",
    );
  }

  const normalized = value.trim();

  if (!normalized) {
    return undefined;
  }

  if (normalized.length > MAX_FILTER_LENGTH) {
    throw createError(
      `${field} cannot exceed ${MAX_FILTER_LENGTH} characters.`,
      "INVALID_AUDIT_LOG_INPUT",
    );
  }

  return normalized;
}

function isNullableString(
  value: unknown,
): value is string | null {
  return value === null || typeof value === "string";
}

function isAuditLog(
  value: unknown,
): value is AuditLog {
  if (!isRecord(value)) {
    return false;
  }

  const metadata = value.metadata;

  return (
    typeof value.id === "string" &&
    typeof value.organizationId === "string" &&
    isNullableString(value.actorId) &&
    typeof value.action === "string" &&
    typeof value.entityType === "string" &&
    isNullableString(value.entityId) &&
    typeof value.summary === "string" &&
    (metadata === null || isRecord(metadata)) &&
    isNullableString(value.ipAddress) &&
    isNullableString(value.userAgent) &&
    typeof value.createdAt === "string" &&
    !Number.isNaN(Date.parse(value.createdAt)) &&
    isNullableString(value.actorFirstName) &&
    isNullableString(value.actorLastName) &&
    isNullableString(value.actorEmail)
  );
}

function isPagination(
  value: unknown,
): value is AuditLogPagination {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Number.isSafeInteger(value.page) &&
    Number(value.page) >= 1 &&
    Number.isSafeInteger(value.pageSize) &&
    Number(value.pageSize) >= 1 &&
    Number(value.pageSize) <= MAX_PAGE_SIZE &&
    Number.isSafeInteger(value.total) &&
    Number(value.total) >= 0 &&
    Number.isSafeInteger(value.totalPages) &&
    Number(value.totalPages) >= 0 &&
    typeof value.hasMore === "boolean"
  );
}

function isAuditLogResponse(
  value: unknown,
): value is ApiAuditLogResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.success === true &&
    Array.isArray(value.data) &&
    value.data.every(isAuditLog) &&
    isPagination(value.pagination) &&
    isRecord(value.filters)
  );
}

async function readResponseBody(
  response: Response,
): Promise<unknown> {
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
    return await response.json();
  } catch {
    return undefined;
  }
}

function parseHttpError(
  response: Response,
  body: unknown,
): AuditLogServiceError {
  const record = isRecord(body) ? body : undefined;

  const nestedError =
    record && isRecord(record.error)
      ? record.error
      : undefined;

  const message =
    typeof nestedError?.message === "string"
      ? nestedError.message
      : typeof record?.message === "string"
        ? record.message
        : response.status === 401
          ? "Your session has expired. Please sign in again."
          : response.status === 403
            ? "You do not have permission to view audit logs."
            : `The audit-log request failed (${response.status}).`;

  const code =
    typeof nestedError?.code === "string"
      ? nestedError.code
      : typeof record?.code === "string"
        ? record.code
        : undefined;

  return createError(
    message,
    code,
    response.status,
  );
}

function validateOptions(
  options: ListAuditLogsOptions,
): void {
  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options)
  ) {
    throw createError(
      "Audit-log request options are invalid.",
      "INVALID_AUDIT_LOG_INPUT",
    );
  }
}

export async function listAuditLogs(
  options: ListAuditLogsOptions = {},
): Promise<AuditLogListResult> {
  validateOptions(options);
  validateApiBaseUrl();

  const page =
    validatePositiveInteger(options.page, "Page") ?? 1;

  const pageSize =
    validatePositiveInteger(
      options.pageSize,
      "Page size",
      MAX_PAGE_SIZE,
    ) ?? 25;

  const action = normalizeFilter(
    options.action,
    "Action filter",
  );

  const entityType = normalizeFilter(
    options.entityType,
    "Entity type filter",
  );

  const actorId = normalizeFilter(
    options.actorId,
    "Actor ID filter",
  );

  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  if (action) {
    query.set("action", action.toUpperCase());
  }

  if (entityType) {
    query.set("entityType", entityType);
  }

  if (actorId) {
    query.set("actorId", actorId);
  }

  const controller = new AbortController();
  const callerSignal = options.signal;

  let timedOut = false;

  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  const onCallerAbort = (): void => {
    controller.abort();
  };

  try {
    if (callerSignal?.aborted) {
      throw createError(
        "The audit-log request was cancelled.",
        "REQUEST_CANCELLED",
      );
    }

    callerSignal?.addEventListener(
      "abort",
      onCallerAbort,
      { once: true },
    );

    const response = await fetch(
      `${API_BASE_URL}${AUDIT_LOGS_ENDPOINT}?${query.toString()}`,
      {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      },
    );

    const body = await readResponseBody(response);

    if (!response.ok) {
      throw parseHttpError(response, body);
    }

    if (!isAuditLogResponse(body)) {
      throw createError(
        "The server returned audit-log data in an unexpected format.",
        "INVALID_API_RESPONSE",
        response.status,
      );
    }

    return {
      data: body.data,
      pagination: body.pagination,
      filters: body.filters,
    };
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "AbortError"
    ) {
      if (callerSignal?.aborted) {
        throw createError(
          "The audit-log request was cancelled.",
          "REQUEST_CANCELLED",
        );
      }

      if (timedOut) {
        throw createError(
          "The audit-log request timed out. Please try again.",
          "REQUEST_TIMEOUT",
        );
      }
    }

    if (
      isRecord(error) &&
      typeof error.message === "string"
    ) {
      throw createError(
        error.message,
        typeof error.code === "string"
          ? error.code
          : undefined,
        typeof error.status === "number"
          ? error.status
          : undefined,
      );
    }

    if (error instanceof TypeError) {
      throw createError(
        "Unable to connect to the Leave Management API. Check your connection and try again.",
        "NETWORK_ERROR",
      );
    }

    throw createError(
      "Unable to retrieve audit logs.",
      "AUDIT_LOG_REQUEST_FAILED",
    );
  } finally {
    globalThis.clearTimeout(timeoutId);

    callerSignal?.removeEventListener(
      "abort",
      onCallerAbort,
    );
  }
}

export const auditLogService = {
  listAuditLogs,
} as const;
