const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, "") ??
  "";

export type SystemSettingType =
  | "STRING"
  | "INTEGER"
  | "BOOLEAN"
  | "JSON";

export type SystemSettingValue =
  | string
  | number
  | boolean
  | Record<string, unknown>
  | unknown[]
  | null;

export interface SystemSetting {
  id: string;
  key: string;
  value: SystemSettingValue;
  type: SystemSettingType;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SystemSettingDefinition {
  key: string;
  type: SystemSettingType;
  label: string;
  description: string;
  defaultValue: SystemSettingValue;
}

export interface UpdateSystemSettingInput {
  key: string;
  value: SystemSettingValue;
  type?: SystemSettingType;
  description?: string | null;
}

export interface UpdateSystemSettingsInput {
  settings: UpdateSystemSettingInput[];
}

export interface SystemSettingsResponse {
  success: boolean;
  settings: SystemSetting[];
}

export interface SystemSettingResponse {
  success: boolean;
  setting: SystemSetting;
}

export interface SystemSettingDefinitionsResponse {
  success: boolean;
  definitions: SystemSettingDefinition[];
}

export interface SystemSettingsMessageResponse {
  success: boolean;
  message: string;
}

interface ApiErrorResponse {
  success?: boolean;
  code?: string;
  message?: string;
  errors?: unknown;
}

const SETTINGS_ENDPOINT = `${API_BASE_URL}/api/admin/settings`;

function getCsrfToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const metaToken = document
    .querySelector<HTMLMetaElement>(
      'meta[name="csrf-token"]',
    )
    ?.getAttribute("content");

  if (metaToken) {
    return metaToken;
  }

  const cookieNames = [
    "csrf-token",
    "csrfToken",
    "XSRF-TOKEN",
  ];

  for (const name of cookieNames) {
    const match = document.cookie
      .split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) =>
        cookie.startsWith(`${name}=`),
      );

    if (!match) {
      continue;
    }

    const value = match.substring(
      name.length + 1,
    );

    if (value) {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }

  return null;
}

async function parseResponse<T>(
  response: Response,
): Promise<T> {
  const contentType =
    response.headers.get("content-type") ?? "";

  const isJson =
    contentType.includes("application/json");

  const payload = isJson
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const errorPayload =
      typeof payload === "object" &&
      payload !== null
        ? (payload as ApiErrorResponse)
        : undefined;

    throw new SystemSettingsApiError(
      errorPayload?.message ??
        (typeof payload === "string" &&
        payload.trim().length > 0
          ? payload
          : "Unable to complete the system settings request."),
      response.status,
      errorPayload?.code,
      errorPayload?.errors,
    );
  }

  return payload as T;
}

class SystemSettingsApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
  ) {
    super(message);

    this.name =
      "SystemSettingsApiError";

    this.status = status;
    this.code = code;
    this.details = details;

    Object.setPrototypeOf(
      this,
      SystemSettingsApiError.prototype,
    );
  }
}

function createHeaders(
  includeJsonBody = false,
): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (includeJsonBody) {
    headers["Content-Type"] =
      "application/json";
  }

  const csrfToken =
    getCsrfToken();

  if (csrfToken) {
    headers["X-CSRF-Token"] =
      csrfToken;
  }

  return headers;
}

/**
 * ==========================================================================
 * GET ALL SYSTEM SETTINGS
 * ==========================================================================
 */

export async function getSystemSettings(): Promise<
  SystemSetting[]
> {
  const response = await fetch(
    SETTINGS_ENDPOINT,
    {
      method: "GET",
      credentials: "include",
      headers: createHeaders(),
    },
  );

  const data =
    await parseResponse<SystemSettingsResponse>(
      response,
    );

  return data.settings;
}

/**
 * ==========================================================================
 * GET SYSTEM SETTING DEFINITIONS
 * ==========================================================================
 */

export async function getSystemSettingDefinitions(): Promise<
  SystemSettingDefinition[]
> {
  const response = await fetch(
    `${SETTINGS_ENDPOINT}/definitions`,
    {
      method: "GET",
      credentials: "include",
      headers: createHeaders(),
    },
  );

  const data =
    await parseResponse<SystemSettingDefinitionsResponse>(
      response,
    );

  return data.definitions;
}

/**
 * ==========================================================================
 * GET ONE SYSTEM SETTING
 * ==========================================================================
 */

export async function getSystemSetting(
  key: string,
): Promise<SystemSetting> {
  const encodedKey =
    encodeURIComponent(key);

  const response = await fetch(
    `${SETTINGS_ENDPOINT}/${encodedKey}`,
    {
      method: "GET",
      credentials: "include",
      headers: createHeaders(),
    },
  );

  const data =
    await parseResponse<SystemSettingResponse>(
      response,
    );

  return data.setting;
}

/**
 * ==========================================================================
 * UPDATE ONE SYSTEM SETTING
 * ==========================================================================
 */

export async function updateSystemSetting(
  input: UpdateSystemSettingInput,
): Promise<SystemSetting> {
  const response = await fetch(
    SETTINGS_ENDPOINT,
    {
      method: "PUT",
      credentials: "include",
      headers: createHeaders(true),
      body: JSON.stringify(input),
    },
  );

  const data =
    await parseResponse<SystemSettingResponse>(
      response,
    );

  return data.setting;
}

/**
 * ==========================================================================
 * UPDATE MULTIPLE SYSTEM SETTINGS
 * ==========================================================================
 */

export async function updateSystemSettings(
  input: UpdateSystemSettingsInput,
): Promise<SystemSetting[]> {
  const response = await fetch(
    SETTINGS_ENDPOINT,
    {
      method: "PUT",
      credentials: "include",
      headers: createHeaders(true),
      body: JSON.stringify(input),
    },
  );

  const data =
    await parseResponse<SystemSettingsResponse>(
      response,
    );

  return data.settings;
}

/**
 * ==========================================================================
 * RESET ONE SYSTEM SETTING
 * ==========================================================================
 */

export async function resetSystemSetting(
  key: string,
): Promise<SystemSetting> {
  const encodedKey =
    encodeURIComponent(key);

  const response = await fetch(
    `${SETTINGS_ENDPOINT}/${encodedKey}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: createHeaders(),
    },
  );

  const data =
    await parseResponse<SystemSettingResponse>(
      response,
    );

  return data.setting;
}

/**
 * ==========================================================================
 * RESET ALL SYSTEM SETTINGS
 * ==========================================================================
 */

export async function resetSystemSettings(): Promise<
  SystemSetting[]
> {
  const response = await fetch(
    SETTINGS_ENDPOINT,
    {
      method: "DELETE",
      credentials: "include",
      headers: createHeaders(),
    },
  );

  const data =
    await parseResponse<SystemSettingsResponse>(
      response,
    );

  return data.settings;
}

/**
 * ==========================================================================
 * ERROR HELPERS
 * ==========================================================================
 */

export function isSystemSettingsApiError(
  error: unknown,
): error is SystemSettingsApiError {
  return (
    error instanceof
    SystemSettingsApiError
  );
}

export function getSystemSettingsErrorMessage(
  error: unknown,
): string {
  if (
    isSystemSettingsApiError(error)
  ) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to complete the system settings request.";
}

export { SystemSettingsApiError };