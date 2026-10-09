/**
 * Production Policy API service.
 *
 * The frontend never supplies organizationId.
 * Tenant scope is resolved by the authenticated backend session.
 */

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  "https://ziya-hr-api-production.up.railway.app"
).replace(/\/+$/, "");

const POLICY_ENDPOINT = `${API_BASE_URL}/api/policies`;

const REQUEST_TIMEOUT_MS = 30_000;

export type PolicyStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "ARCHIVED";

export interface Policy {
  id: string;
  organizationId: string;
  title: string;
  code: string;
  description: string | null;
  content: string;
  status: PolicyStatus;
  version: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PolicySummary {
  total: number;
  draft: number;
  published: number;
  archived: number;
}

export interface CreatePolicyPayload {
  title: string;
  code: string;
  description?: string | null;
  content: string;
  status?: PolicyStatus;
  version?: number;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

export interface UpdatePolicyPayload {
  title?: string;
  code?: string;
  description?: string | null;
  content?: string;
  version?: number;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

export interface PolicyListOptions {
  status?: PolicyStatus;
  search?: string;
  signal?: AbortSignal;
}

export class PolicyServiceError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(
    message: string,
    status: number,
    code?: string,
  ) {
    super(message);
    this.name = "PolicyServiceError";
    this.status = status;
    this.code = code;
  }
}

/**
 * --------------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------------
 */

function getCookieValue(
  name: string,
): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookies = document.cookie
    .split(";")
    .map((cookie) => cookie.trim());

  const prefix = `${name}=`;

  const match = cookies.find((cookie) =>
    cookie.startsWith(prefix),
  );

  if (!match) {
    return null;
  }

  return decodeURIComponent(
    match.slice(prefix.length),
  );
}

function getCsrfToken(): string | null {
  const possibleNames = [
    "csrf-token",
    "csrfToken",
    "XSRF-TOKEN",
  ];

  for (const name of possibleNames) {
    const token = getCookieValue(name);

    if (token) {
      return token;
    }
  }

  return null;
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
      externalSignal.addEventListener(
        "abort",
        abortFromExternal,
        { once: true },
      );
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

async function readResponseBody(
  response: Response,
): Promise<unknown> {
  if (
    response.status === 204 ||
    response.status === 205
  ) {
    return null;
  }

  const contentType =
    response.headers.get("content-type") ?? "";

  if (
    !contentType
      .toLowerCase()
      .includes("application/json")
  ) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractError(
  body: unknown,
  fallback: string,
): {
  message: string;
  code?: string;
} {
  if (
    body &&
    typeof body === "object"
  ) {
    const record = body as Record<
      string,
      unknown
    >;

    const nested =
      record.error &&
      typeof record.error === "object"
        ? (record.error as Record<
            string,
            unknown
          >)
        : null;

    const messageCandidates = [
      record.message,
      nested?.message,
      record.error,
    ];

    const codeCandidates = [
      record.code,
      nested?.code,
    ];

    const message =
      messageCandidates.find(
        (value): value is string =>
          typeof value === "string" &&
          value.trim().length > 0,
      ) ?? fallback;

    const code =
      codeCandidates.find(
        (value): value is string =>
          typeof value === "string" &&
          value.trim().length > 0,
      );

    return {
      message,
      code,
    };
  }

  return {
    message: fallback,
  };
}

function assertPolicy(
  value: unknown,
): Policy {
  if (
    !value ||
    typeof value !== "object"
  ) {
    throw new PolicyServiceError(
      "Invalid policy response from the server.",
      502,
      "INVALID_POLICY_RESPONSE",
    );
  }

  const policy =
    value as Partial<Policy>;

  if (
    typeof policy.id !== "string" ||
    typeof policy.title !== "string" ||
    typeof policy.code !== "string" ||
    typeof policy.content !== "string" ||
    typeof policy.status !== "string"
  ) {
    throw new PolicyServiceError(
      "The server returned an invalid policy.",
      502,
      "INVALID_POLICY_RESPONSE",
    );
  }

  return policy as Policy;
}

function assertPolicyList(
  value: unknown,
): Policy[] {
  if (!Array.isArray(value)) {
    throw new PolicyServiceError(
      "Invalid policy list response from the server.",
      502,
      "INVALID_POLICY_LIST_RESPONSE",
    );
  }

  return value.map(assertPolicy);
}

function assertPolicySummary(
  value: unknown,
): PolicySummary {
  if (
    !value ||
    typeof value !== "object"
  ) {
    throw new PolicyServiceError(
      "Invalid policy summary response from the server.",
      502,
      "INVALID_POLICY_SUMMARY_RESPONSE",
    );
  }

  const summary =
    value as Partial<PolicySummary>;

  if (
    typeof summary.total !== "number" ||
    typeof summary.draft !== "number" ||
    typeof summary.published !== "number" ||
    typeof summary.archived !== "number"
  ) {
    throw new PolicyServiceError(
      "The server returned an invalid policy summary.",
      502,
      "INVALID_POLICY_SUMMARY_RESPONSE",
    );
  }

  return {
    total: summary.total,
    draft: summary.draft,
    published: summary.published,
    archived: summary.archived,
  };
}

/**
 * --------------------------------------------------------------------------
 * Generic request
 * --------------------------------------------------------------------------
 */

async function request<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const method = options.method ?? "GET";

  const {
    signal,
    cleanup,
  } = createTimeoutSignal(
    options.signal,
  );

  const headers: HeadersInit = {
    Accept: "application/json",
  };

  if (
    options.body !== undefined
  ) {
    headers["Content-Type"] =
      "application/json";
  }

  if (method !== "GET") {
    const csrfToken = getCsrfToken();

    if (csrfToken) {
      headers["X-CSRF-Token"] =
        csrfToken;
    }
  }

  try {
    const response = await fetch(
      path,
      {
        method,
        headers,
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        referrerPolicy:
          "strict-origin-when-cross-origin",
        body:
          options.body === undefined
            ? undefined
            : JSON.stringify(
                options.body,
              ),
        signal,
      },
    );

    const body =
      await readResponseBody(
        response,
      );

    if (!response.ok) {
      const error =
        extractError(
          body,
          `Policy request failed with status ${response.status}.`,
        );

      throw new PolicyServiceError(
        error.message,
        response.status,
        error.code,
      );
    }

    return body as T;
  } catch (error) {
    if (
      error instanceof PolicyServiceError
    ) {
      throw error;
    }

    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      throw error;
    }

    if (
      error instanceof TypeError
    ) {
      throw new PolicyServiceError(
        "Unable to connect to the policy service.",
        0,
        "NETWORK_ERROR",
      );
    }

    throw error;
  } finally {
    cleanup();
  }
}

/**
 * --------------------------------------------------------------------------
 * List policies
 * --------------------------------------------------------------------------
 */

export async function listPolicies(
  options: PolicyListOptions = {},
): Promise<Policy[]> {
  const params =
    new URLSearchParams();

  if (options.status) {
    params.set(
      "status",
      options.status,
    );
  }

  if (
    options.search &&
    options.search.trim()
  ) {
    params.set(
      "search",
      options.search.trim(),
    );
  }

  const query =
    params.toString();

  const endpoint = query
    ? `${POLICY_ENDPOINT}?${query}`
    : POLICY_ENDPOINT;

  const data =
    await request<unknown>(
      endpoint,
      {
        method: "GET",
        signal: options.signal,
      },
    );

  return assertPolicyList(data);
}

/**
 * --------------------------------------------------------------------------
 * Get one policy
 * --------------------------------------------------------------------------
 */

export async function getPolicy(
  policyId: string,
  options: {
    signal?: AbortSignal;
  } = {},
): Promise<Policy> {
  if (!policyId.trim()) {
    throw new PolicyServiceError(
      "Policy ID is required.",
      400,
      "POLICY_ID_REQUIRED",
    );
  }

  const data =
    await request<unknown>(
      `${POLICY_ENDPOINT}/${encodeURIComponent(
        policyId,
      )}`,
      {
        method: "GET",
        signal: options.signal,
      },
    );

  return assertPolicy(data);
}

/**
 * --------------------------------------------------------------------------
 * Get policy summary
 * --------------------------------------------------------------------------
 */

export async function getPolicySummary(
  options: {
    signal?: AbortSignal;
  } = {},
): Promise<PolicySummary> {
  const data =
    await request<unknown>(
      `${POLICY_ENDPOINT}/summary`,
      {
        method: "GET",
        signal: options.signal,
      },
    );

  return assertPolicySummary(data);
}

/**
 * --------------------------------------------------------------------------
 * Create policy
 * --------------------------------------------------------------------------
 */

export async function createPolicy(
  payload: CreatePolicyPayload,
): Promise<Policy> {
  const data =
    await request<unknown>(
      POLICY_ENDPOINT,
      {
        method: "POST",
        body: payload,
      },
    );

  return assertPolicy(data);
}

/**
 * --------------------------------------------------------------------------
 * Update policy
 * --------------------------------------------------------------------------
 */

export async function updatePolicy(
  policyId: string,
  payload: UpdatePolicyPayload,
): Promise<Policy> {
  if (!policyId.trim()) {
    throw new PolicyServiceError(
      "Policy ID is required.",
      400,
      "POLICY_ID_REQUIRED",
    );
  }

  const data =
    await request<unknown>(
      `${POLICY_ENDPOINT}/${encodeURIComponent(
        policyId,
      )}`,
      {
        method: "PATCH",
        body: payload,
      },
    );

  return assertPolicy(data);
}

/**
 * --------------------------------------------------------------------------
 * Publish policy
 * --------------------------------------------------------------------------
 */

export async function publishPolicy(
  policyId: string,
): Promise<Policy> {
  if (!policyId.trim()) {
    throw new PolicyServiceError(
      "Policy ID is required.",
      400,
      "POLICY_ID_REQUIRED",
    );
  }

  const data =
    await request<unknown>(
      `${POLICY_ENDPOINT}/${encodeURIComponent(
        policyId,
      )}/publish`,
      {
        method: "POST",
      },
    );

  return assertPolicy(data);
}

/**
 * --------------------------------------------------------------------------
 * Archive policy
 * --------------------------------------------------------------------------
 */

export async function archivePolicy(
  policyId: string,
): Promise<Policy> {
  if (!policyId.trim()) {
    throw new PolicyServiceError(
      "Policy ID is required.",
      400,
      "POLICY_ID_REQUIRED",
    );
  }

  const data =
    await request<unknown>(
      `${POLICY_ENDPOINT}/${encodeURIComponent(
        policyId,
      )}/archive`,
      {
        method: "POST",
      },
    );

  return assertPolicy(data);
}

/**
 * --------------------------------------------------------------------------
 * Restore policy
 * --------------------------------------------------------------------------
 */

export async function restorePolicy(
  policyId: string,
): Promise<Policy> {
  if (!policyId.trim()) {
    throw new PolicyServiceError(
      "Policy ID is required.",
      400,
      "POLICY_ID_REQUIRED",
    );
  }

  const data =
    await request<unknown>(
      `${POLICY_ENDPOINT}/${encodeURIComponent(
        policyId,
      )}/restore`,
      {
        method: "POST",
      },
    );

  return assertPolicy(data);
}

/**
 * --------------------------------------------------------------------------
 * Delete policy
 * --------------------------------------------------------------------------
 */

export async function deletePolicy(
  policyId: string,
): Promise<void> {
  if (!policyId.trim()) {
    throw new PolicyServiceError(
      "Policy ID is required.",
      400,
      "POLICY_ID_REQUIRED",
    );
  }

  await request<unknown>(
    `${POLICY_ENDPOINT}/${encodeURIComponent(
      policyId,
    )}`,
    {
      method: "DELETE",
    },
  );
}

/**
 * --------------------------------------------------------------------------
 * Default service export
 * --------------------------------------------------------------------------
 */

const policyService = {
  listPolicies,
  getPolicy,
  getPolicySummary,
  createPolicy,
  updatePolicy,
  publishPolicy,
  archivePolicy,
  restorePolicy,
  deletePolicy,
};

export default policyService;