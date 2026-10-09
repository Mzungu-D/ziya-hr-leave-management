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
 * Production API:
 * https://ziya-hr-api-production.up.railway.app
 *
 * VITE_API_BASE_URL can override this value for another
 * explicitly configured environment.
 *
 * Authentication state is intentionally NOT stored in
 * localStorage/sessionStorage. The backend owns the
 * authenticated session through secure HTTP-only cookies.
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

/**
 * Authentication API endpoints.
 */
const AUTH_ENDPOINTS = {
  login: "/api/auth/login",
  logout: "/api/auth/logout",
  session: "/api/auth/session",
  refresh: "/api/auth/refresh",

  requestPasswordReset:
    "/api/auth/password-reset/request",

  resetPassword:
    "/api/auth/password-reset/confirm",

  requestOtp:
    "/api/auth/otp/request",

  verifyOtp:
    "/api/auth/otp/verify",
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
 * Request options.
 *
 * The public service methods do not require callers to supply
 * these options, but internal request handling supports AbortSignal
 * so the service can be safely extended by UI components later.
 */
interface AuthRequestOptions {
  signal?: AbortSignal;
}

/**
 * Request controller state.
 */
interface RequestController {
  controller: AbortController;
  cleanup: () => void;
  wasTimedOut: () => boolean;
}

/* -------------------------------------------------------------------------- */
/* Generic Validation Helpers                                                 */
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
/* API Configuration Validation                                                */
/* -------------------------------------------------------------------------- */

/**
 * Validate the configured API base URL before making an
 * authenticated request.
 *
 * Production authentication must never send cookies over
 * an insecure HTTP connection.
 */
function validateApiBaseUrl(): void {
  if (!API_BASE_URL) {
    throw {
      message:
        "The authentication API is not configured.",
      code:
        "API_BASE_URL_NOT_CONFIGURED",
    } satisfies AuthServiceError;
  }

  let url: URL;

  try {
    url = new URL(API_BASE_URL);
  } catch {
    throw {
      message:
        "The authentication API configuration is invalid.",
      code:
        "INVALID_API_BASE_URL",
    } satisfies AuthServiceError;
  }

  if (
    url.protocol !== "https:" &&
    import.meta.env.DEV !== true
  ) {
    throw {
      message:
        "Production authentication API must use HTTPS.",
      code:
        "INVALID_API_PROTOCOL",
    } satisfies AuthServiceError;
  }

  if (
    url.protocol !== "https:" &&
    url.protocol !== "http:"
  ) {
    throw {
      message:
        "The authentication API uses an unsupported protocol.",
      code:
        "INVALID_API_PROTOCOL",
    } satisfies AuthServiceError;
  }

  if (!url.hostname) {
    throw {
      message:
        "The authentication API hostname is invalid.",
      code:
        "INVALID_API_HOST",
    } satisfies AuthServiceError;
  }
}

/* -------------------------------------------------------------------------- */
/* URL Construction                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Build an absolute API URL.
 */
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
        "The authentication API endpoint is invalid.",
      code:
        "INVALID_API_ENDPOINT",
    } satisfies AuthServiceError;
  }

  /*
   * Prevent accidental absolute URLs from being appended
   * to the trusted API base URL.
   */
  if (
    endpoint.startsWith("//") ||
    endpoint.includes("://")
  ) {
    throw {
      message:
        "The authentication API endpoint is invalid.",
      code:
        "INVALID_API_ENDPOINT",
    } satisfies AuthServiceError;
  }

  return `${API_BASE_URL}${endpoint}`;
}

/* -------------------------------------------------------------------------- */
/* Error Normalization                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Convert unknown errors into a consistent authentication error.
 */
function createAuthError(
  error: unknown,
  fallbackMessage: string,
): AuthServiceError {
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

  if (
    error instanceof Error
  ) {
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
/* HTTP Error                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Convert an unsuccessful HTTP response into a structured
 * authentication error.
 */
function createHttpError(
  response: Response,
  body?: ApiResponse<unknown>,
): AuthServiceError {
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
        : `Authentication request failed with status ${response.status}.`,

    code:
      typeof backendCode === "string" &&
      backendCode.trim().length > 0
        ? backendCode.trim()
        : undefined,

    status:
      response.status,

    details:
      backendDetails,
  };
}

/* -------------------------------------------------------------------------- */
/* JSON Response Reader                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Safely parse an API JSON response.
 *
 * Authentication endpoints should return JSON, except logout
 * which may legitimately return 204 No Content.
 */
async function readJsonResponse<T>(
  response: Response,
): Promise<ApiResponse<T> | undefined> {
  const contentType =
    response.headers.get(
      "content-type",
    ) ?? "";

  /*
   * Empty responses are allowed for logout.
   */
  if (
    response.status === 204 ||
    response.status === 205
  ) {
    return undefined;
  }

  /*
   * Authentication endpoints are expected to return JSON.
   */
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

    if (!isRecord(parsed)) {
      return undefined;
    }

    return parsed as ApiResponse<T>;
  } catch {
    return undefined;
  }
}

/* -------------------------------------------------------------------------- */
/* API Response Parsing                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Parse and validate a standard authentication response.
 */
async function parseResponse<T>(
  response: Response,
): Promise<T | undefined> {
  const body =
    await readJsonResponse<T>(
      response,
    );

  /*
   * HTTP-level failure.
   */
  if (!response.ok) {
    throw createHttpError(
      response,
      body,
    );
  }

  /*
   * Empty success responses are handled by the caller
   * where appropriate.
   */
  if (!body) {
    return undefined;
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
          : "The authentication request was not successful.",

      code:
        typeof body.code === "string" &&
        body.code.trim().length > 0
          ? body.code.trim()
          : body.error?.code ??
            "AUTHENTICATION_REQUEST_FAILED",

      status:
        response.status,

      details:
        body.error?.details,
    } satisfies AuthServiceError;
  }

  return body.data;
}

/* -------------------------------------------------------------------------- */
/* Request Controller                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Create a timeout-aware AbortController.
 *
 * This prevents a browser request from hanging indefinitely
 * if the production API becomes unreachable.
 */
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
/* Request Headers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Build headers for an authentication request.
 */
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
/* Request Body Validation                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Authentication payloads must be JSON-compatible objects.
 *
 * This deliberately does not impose field names beyond the
 * contracts defined in ../types/auth. The backend remains the
 * authoritative validator for login, OTP, and password-reset
 * semantics.
 */
function validateRequestPayload(
  payload: unknown,
): void {
  if (
    !isRecord(payload)
  ) {
    throw {
      message:
        "Authentication request data is invalid.",
      code:
        "INVALID_AUTHENTICATION_PAYLOAD",
    } satisfies AuthServiceError;
  }

  /*
   * Prevent unexpectedly huge request bodies from being
   * serialized by the browser.
   */
  let serialized: string;

  try {
    serialized =
      JSON.stringify(payload);
  } catch {
    throw {
      message:
        "Authentication request data could not be serialized.",
      code:
        "REQUEST_SERIALIZATION_ERROR",
    } satisfies AuthServiceError;
  }

  /*
   * Authentication payloads should remain small.
   *
   * This protects the client from accidental giant objects
   * being passed from UI state.
   */
  const MAX_AUTH_PAYLOAD_BYTES =
    64 * 1024;

  if (
    new TextEncoder()
      .encode(serialized)
      .byteLength >
    MAX_AUTH_PAYLOAD_BYTES
  ) {
    throw {
      message:
        "Authentication request data is too large.",
      code:
        "AUTHENTICATION_PAYLOAD_TOO_LARGE",
    } satisfies AuthServiceError;
  }
}

/* -------------------------------------------------------------------------- */
/* Authenticated API Request                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Execute an authentication API request.
 *
 * Security properties:
 * - Secure HTTP-only cookie authentication.
 * - No token storage in browser JavaScript.
 * - No Authorization header generated by the frontend.
 * - No organizationId used as a client-controlled security boundary.
 * - Timeout protection.
 * - Abort support.
 * - No browser caching for authenticated responses.
 */
async function request<T>(
  endpoint: string,
  init: RequestInit = {},
  options: AuthRequestOptions = {},
): Promise<T> {
  const url =
    buildUrl(endpoint);

  const hasJsonBody =
    init.body !== undefined &&
    init.body !== null;

  if (hasJsonBody) {
    /*
     * Bodies generated by this service are strings.
     *
     * We still protect against callers passing an invalid
     * non-string body through the internal request layer.
     */
    if (
      typeof init.body !==
      "string"
    ) {
      throw {
        message:
          "Authentication request body must be JSON.",
        code:
          "INVALID_REQUEST_BODY",
      } satisfies AuthServiceError;
    }
  }

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
        url,
        {
          ...init,

          method:
            init.method ??
            "GET",

          /*
           * Authentication state is managed by
           * secure HTTP-only cookies.
           */
          credentials:
            "include",

          headers:
            buildHeaders(
              hasJsonBody,
            ),

          signal:
            controller.signal,

          /*
           * Never cache authentication/session responses.
           */
          cache:
            "no-store",

          redirect:
            "follow",

          /*
           * Explicitly prevent accidental
           * referrer leakage of authentication
           * endpoint information.
           */
          referrerPolicy:
            "strict-origin-when-cross-origin",
        },
      );

    const data =
      await parseResponse<T>(
        response,
      );

    if (
      data === undefined
    ) {
      throw {
        message:
          "The authentication server returned an empty response.",
        status:
          response.status,

        code:
          "EMPTY_AUTHENTICATION_RESPONSE",
      } satisfies AuthServiceError;
    }

    return data;
  } catch (error) {
    /*
     * Timeout/cancellation handling.
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
            "The authentication request was cancelled.",
          code:
            "REQUEST_CANCELLED",
        } satisfies AuthServiceError;
      }

      if (
        wasTimedOut()
      ) {
        throw {
          message:
            "The authentication request timed out. Please try again.",
          code:
            "REQUEST_TIMEOUT",
        } satisfies AuthServiceError;
      }

      throw {
        message:
          "The authentication request was cancelled.",
        code:
          "REQUEST_CANCELLED",
      } satisfies AuthServiceError;
    }

    /*
     * Network errors normally surface from fetch as
     * TypeError in browsers.
     */
    if (
      error instanceof TypeError
    ) {
      throw {
        message:
          "Unable to connect to the authentication service. Please check your connection and try again.",
        code:
          "NETWORK_ERROR",
      } satisfies AuthServiceError;
    }

    /*
     * Preserve structured API errors.
     */
    throw createAuthError(
      error,
      "Unable to communicate with the authentication service.",
    );
  } finally {
    cleanup();
  }
}

/* -------------------------------------------------------------------------- */
/* Login                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Authenticate a user.
 *
 * The backend remains authoritative for:
 * - email/password authentication
 * - phone/OTP authentication
 * - first-device verification
 * - remembered-device/session policy
 * - account status
 * - organization membership
 * - role/permission loading
 */
export async function login(
  credentials: LoginCredentials,
): Promise<LoginResponse> {
  validateRequestPayload(
    credentials,
  );

  return request<LoginResponse>(
    AUTH_ENDPOINTS.login,
    {
      method:
        "POST",

      body:
        JSON.stringify(
          credentials,
        ),
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Logout                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * End the current authenticated session.
 *
 * The backend invalidates the server-side session/refresh
 * token and clears secure authentication cookies.
 *
 * A successful 204 response is accepted because logout does
 * not require a response body to be considered successful.
 */
export async function logout(): Promise<LogoutResponse> {
  try {
    const url =
      buildUrl(
        AUTH_ENDPOINTS.logout,
      );

    const {
      controller,
      cleanup,
      wasTimedOut,
    } =
      createRequestController();

    try {
      const response =
        await fetch(
          url,
          {
            method:
              "POST",

            credentials:
              "include",

            headers:
              buildHeaders(
                false,
              ),

            signal:
              controller.signal,

            cache:
              "no-store",

            redirect:
              "follow",

            referrerPolicy:
              "strict-origin-when-cross-origin",
          },
        );

      const data =
        await parseResponse<LogoutResponse>(
          response,
        );

      /*
       * Logout can legitimately return 204 No Content.
       */
      if (
        data === undefined
      ) {
        return {
          success:
            response.ok,
        };
      }

      return data;
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name ===
          "AbortError"
      ) {
        if (
          wasTimedOut()
        ) {
          throw {
            message:
              "Signing out timed out. Please try again.",
            code:
              "LOGOUT_TIMEOUT",
          } satisfies AuthServiceError;
        }

        throw {
          message:
            "The sign-out request was cancelled.",
          code:
            "LOGOUT_CANCELLED",
        } satisfies AuthServiceError;
      }

      if (
        error instanceof TypeError
      ) {
        throw {
          message:
            "Unable to connect to the authentication service while signing out.",
          code:
            "NETWORK_ERROR",
        } satisfies AuthServiceError;
      }

      throw error;
    } finally {
      cleanup();
    }
  } catch (error) {
    throw createAuthError(
      error,
      "Unable to sign out securely.",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Current Session                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Retrieve the currently authenticated session.
 *
 * The backend determines the session from the secure
 * HTTP-only authentication cookie.
 */
export async function getCurrentSession(): Promise<LoginResponse> {
  return request<LoginResponse>(
    AUTH_ENDPOINTS.session,
    {
      method:
        "GET",
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Refresh Session                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Refresh an expired or soon-to-expire access session.
 *
 * Refresh-token handling remains entirely server-controlled
 * through secure HTTP-only cookies.
 */
export async function refreshSession(): Promise<LoginResponse> {
  return request<LoginResponse>(
    AUTH_ENDPOINTS.refresh,
    {
      method:
        "POST",
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Password Reset Request                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Request a password-reset link or OTP.
 *
 * The backend is responsible for:
 * - account lookup
 * - anti-enumeration behavior
 * - rate limiting
 * - reset-token generation
 * - expiration
 * - delivery
 */
export async function requestPasswordReset(
  payload: PasswordResetRequest,
): Promise<{
  success: boolean;
  message?: string;
}> {
  validateRequestPayload(
    payload,
  );

  return request<{
    success: boolean;
    message?: string;
  }>(
    AUTH_ENDPOINTS.requestPasswordReset,
    {
      method:
        "POST",

      body:
        JSON.stringify(
          payload,
        ),
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Password Reset Confirmation                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Confirm a password reset.
 *
 * The browser performs the basic confirmation check for
 * immediate UX feedback, while the backend remains the
 * authoritative security boundary.
 */
export async function resetPassword(
  payload: PasswordResetConfirmation,
): Promise<{
  success: boolean;
  message?: string;
}> {
  validateRequestPayload(
    payload,
  );

  if (
    payload.password !==
    payload.confirmPassword
  ) {
    throw {
      message:
        "Passwords do not match.",
      code:
        "PASSWORD_MISMATCH",
    } satisfies AuthServiceError;
  }

  return request<{
    success: boolean;
    message?: string;
  }>(
    AUTH_ENDPOINTS.resetPassword,
    {
      method:
        "POST",

      body:
        JSON.stringify(
          payload,
        ),
    },
  );
}

/* -------------------------------------------------------------------------- */
/* OTP Request                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Request an OTP through the configured authentication
 * channel.
 *
 * The backend remains responsible for:
 * - rate limiting
 * - OTP generation
 * - OTP expiration
 * - delivery
 * - attempt limits
 * - account enumeration protection
 */
export async function requestOtp(
  payload: OtpRequest,
): Promise<{
  success: boolean;
  message?: string;
}> {
  validateRequestPayload(
    payload,
  );

  return request<{
    success: boolean;
    message?: string;
  }>(
    AUTH_ENDPOINTS.requestOtp,
    {
      method:
        "POST",

      body:
        JSON.stringify(
          payload,
        ),
    },
  );
}

/* -------------------------------------------------------------------------- */
/* OTP Verification                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Verify an OTP.
 *
 * Successful authentication state is established by the
 * backend using secure HTTP-only cookies.
 */
export async function verifyOtp(
  payload: OtpVerification,
): Promise<LoginResponse> {
  validateRequestPayload(
    payload,
  );

  return request<LoginResponse>(
    AUTH_ENDPOINTS.verifyOtp,
    {
      method:
        "POST",

      body:
        JSON.stringify(
          payload,
        ),
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Authentication Service                                                      */
/* -------------------------------------------------------------------------- */

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