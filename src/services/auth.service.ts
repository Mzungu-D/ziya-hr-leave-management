import type {
  LoginCredentials,
  LoginResponse,
  LogoutResponse,
  OtpRequest,
  OtpVerification,
  PasswordResetConfirmation,
  PasswordResetRequest,
} from "../types/auth";

/**
 * Authentication service configuration.
 *
 * The frontend should never hard-code production API URLs.
 * VITE_API_BASE_URL will be supplied through the environment.
 */
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

/**
 * Authentication API endpoints.
 *
 * These paths form the frontend contract with the future HR backend.
 * They can be adjusted centrally when the backend routes are finalized.
 */
const AUTH_ENDPOINTS = {
  login: "/api/auth/login",
  logout: "/api/auth/logout",
  session: "/api/auth/session",
  refresh: "/api/auth/refresh",
  requestPasswordReset: "/api/auth/password-reset/request",
  resetPassword: "/api/auth/password-reset/confirm",
  requestOtp: "/api/auth/otp/request",
  verifyOtp: "/api/auth/otp/verify",
} as const;

/**
 * Standard API error returned by the authentication service.
 */
export interface AuthServiceError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

/**
 * Generic API response wrapper.
 */
interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: {
    message?: string;
    code?: string;
    details?: unknown;
  };
}

/**
 * Fetch configuration used by authentication requests.
 *
 * Credentials are included so that secure HTTP-only cookies can
 * be used by the backend when the authentication architecture
 * is configured that way.
 */
const defaultRequestInit: RequestInit = {
  credentials: "include",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
};

/**
 * Build an absolute API URL.
 */
function buildUrl(endpoint: string): string {
  return `${API_BASE_URL}${endpoint}`;
}

/**
 * Convert unknown errors into a consistent authentication error.
 */
function createAuthError(
  error: unknown,
  fallbackMessage: string,
): AuthServiceError {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    const candidate = error as {
      message?: unknown;
      code?: unknown;
      status?: unknown;
      details?: unknown;
    };

    return {
      message:
        typeof candidate.message === "string"
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
      details: candidate.details,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message || fallbackMessage,
    };
  }

  return {
    message: fallbackMessage,
  };
}

/**
 * Parse an API response safely.
 */
async function parseResponse<T>(
  response: Response,
): Promise<T | undefined> {
  const contentType =
    response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return undefined;
  }

  try {
    const body = (await response.json()) as ApiResponse<T>;

    if (!response.ok) {
      throw {
        message:
          body.error?.message ??
          body.message ??
          `Authentication request failed with status ${response.status}.`,
        code: body.error?.code,
        status: response.status,
        details: body.error?.details,
      } satisfies AuthServiceError;
    }

    return body.data;
  } catch (error) {
    if (!response.ok) {
      throw createAuthError(
        error,
        `Authentication request failed with status ${response.status}.`,
      );
    }

    return undefined;
  }
}

/**
 * Execute an authentication API request.
 */
async function request<T>(
  endpoint: string,
  init?: RequestInit,
): Promise<T> {
  try {
    const response = await fetch(buildUrl(endpoint), {
      ...defaultRequestInit,
      ...init,
      headers: {
        ...defaultRequestInit.headers,
        ...(init?.headers ?? {}),
      },
    });

    const data = await parseResponse<T>(response);

    if (data === undefined) {
      throw {
        message: "The authentication server returned an empty response.",
        status: response.status,
      } satisfies AuthServiceError;
    }

    return data;
  } catch (error) {
    throw createAuthError(
      error,
      "Unable to communicate with the authentication service.",
    );
  }
}

/**
 * Authenticate a user.
 *
 * The backend determines whether the user is authenticated using
 * email/password, phone/OTP, or another supported authentication
 * method.
 */
export async function login(
  credentials: LoginCredentials,
): Promise<LoginResponse> {
  return request<LoginResponse>(AUTH_ENDPOINTS.login, {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

/**
 * End the current authenticated session.
 *
 * The backend should invalidate the server-side session/refresh
 * token and clear any secure authentication cookies.
 */
export async function logout(): Promise<LogoutResponse> {
  try {
    const response = await fetch(
      buildUrl(AUTH_ENDPOINTS.logout),
      {
        ...defaultRequestInit,
        method: "POST",
      },
    );

    const data = await parseResponse<LogoutResponse>(
      response,
    );

    return (
      data ?? {
        success: response.ok,
      }
    );
  } catch (error) {
    throw createAuthError(
      error,
      "Unable to sign out securely.",
    );
  }
}

/**
 * Retrieve the currently authenticated session.
 */
export async function getCurrentSession(): Promise<LoginResponse> {
  return request<LoginResponse>(
    AUTH_ENDPOINTS.session,
    {
      method: "GET",
    },
  );
}

/**
 * Refresh an expired or soon-to-expire access session.
 *
 * Refresh-token handling should ultimately remain server-controlled
 * where possible, preferably through secure HTTP-only cookies.
 */
export async function refreshSession(): Promise<LoginResponse> {
  return request<LoginResponse>(
    AUTH_ENDPOINTS.refresh,
    {
      method: "POST",
    },
  );
}

/**
 * Request a password-reset link or OTP.
 */
export async function requestPasswordReset(
  payload: PasswordResetRequest,
): Promise<{ success: boolean; message?: string }> {
  return request<{
    success: boolean;
    message?: string;
  }>(AUTH_ENDPOINTS.requestPasswordReset, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Confirm a password reset.
 */
export async function resetPassword(
  payload: PasswordResetConfirmation,
): Promise<{ success: boolean; message?: string }> {
  if (payload.password !== payload.confirmPassword) {
    throw {
      message: "Passwords do not match.",
      code: "PASSWORD_MISMATCH",
    } satisfies AuthServiceError;
  }

  return request<{
    success: boolean;
    message?: string;
  }>(AUTH_ENDPOINTS.resetPassword, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Request an OTP through the configured channel.
 */
export async function requestOtp(
  payload: OtpRequest,
): Promise<{ success: boolean; message?: string }> {
  return request<{
    success: boolean;
    message?: string;
  }>(AUTH_ENDPOINTS.requestOtp, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Verify an OTP.
 */
export async function verifyOtp(
  payload: OtpVerification,
): Promise<LoginResponse> {
  return request<LoginResponse>(
    AUTH_ENDPOINTS.verifyOtp,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Export the endpoint configuration for testing and future
 * API integration without exposing mutable configuration.
 */
export const authService = {
  login,
  logout,
  getCurrentSession,
  refreshSession,
  requestPasswordReset,
  resetPassword,
  requestOtp,
  verifyOtp,
} as const;
