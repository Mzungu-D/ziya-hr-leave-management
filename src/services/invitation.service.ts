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

export interface EmployeeInvitationResult {
  sentTo: string;
  expiresAt: string;
}

interface ApiResponse {
  success?: boolean;
  message?: string;
  data?: unknown;
  error?: {
    message?: string;
  };
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isInvitationResult(
  value: unknown,
): value is EmployeeInvitationResult {
  return (
    isRecord(value) &&
    typeof value.sentTo === "string" &&
    typeof value.expiresAt === "string"
  );
}

export async function sendEmployeeInvitation(
  employeeId: string,
): Promise<EmployeeInvitationResult> {
  const normalizedEmployeeId = employeeId.trim();

  if (!normalizedEmployeeId) {
    throw new Error("Employee ID is required.");
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    30_000,
  );

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/employees/${encodeURIComponent(
        normalizedEmployeeId,
      )}/invitation`,
      {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      },
    );

    const parsed: unknown = await response
      .json()
      .catch(() => undefined);

    const body: ApiResponse | undefined =
      isRecord(parsed)
        ? parsed as ApiResponse
        : undefined;

    if (!response.ok) {
      throw new Error(
        body?.error?.message ||
          body?.message ||
          `Invitation request failed (${response.status}).`,
      );
    }

    if (
      body?.success !== true ||
      !isInvitationResult(body.data)
    ) {
      throw new Error(
        "The server returned an invalid invitation response.",
      );
    }

    return body.data;
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      throw new Error(
        "The invitation request timed out. Please try again.",
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
