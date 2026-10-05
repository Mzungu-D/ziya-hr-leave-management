import type {
  Request,
  Response,
} from "express";

import { z } from "zod";

import {
  AppError,
} from "../middleware/error.middleware.js";

import {
  ACCESS_COOKIE,
  DEVICE_COOKIE,
  PENDING_AUTH_COOKIE,
  REFRESH_COOKIE,
  clearPendingAuthCookie,
  clearSessionCookies,
  setAccessCookie,
  setDeviceCookie,
  setPendingAuthCookie,
  setRefreshCookie,
} from "../utils/cookies.js";

import {
  login,
  verifyDeviceOtp,
  refreshSession,
  logout,
  getSessionUser,
  requestOtp,
  requestPasswordReset,
  confirmPasswordReset,
} from "../services/auth.service.js";

/**
 * ==========================================================================
 * Validation schemas
 * ==========================================================================
 */

/**
 * Login request.
 *
 * Exactly one identifier is required:
 * - email + password
 * - phone + password
 *
 * The controller deliberately does not accept employeeId, role,
 * organizationId, sessionId, or any other identity field from the client.
 */
const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .optional(),

    phone: z
      .string()
      .trim()
      .min(7)
      .max(30)
      .optional(),

    password: z
      .string()
      .min(1)
      .max(128),

    rememberMe: z
      .boolean()
      .default(false),
  })
  .superRefine(
    (value, context) => {
      const hasEmail =
        Boolean(value.email);

      const hasPhone =
        Boolean(value.phone);

      if (
        !hasEmail &&
        !hasPhone
      ) {
        context.addIssue({
          code:
            z.ZodIssueCode.custom,
          path: ["email"],
          message:
            "Email or phone number is required.",
        });
      }

      if (
        hasEmail &&
        hasPhone
      ) {
        context.addIssue({
          code:
            z.ZodIssueCode.custom,
          path: ["email"],
          message:
            "Provide either email or phone number, not both.",
        });
      }
    },
  );

/**
 * OTP request.
 *
 * destination is optional because some authenticated flows already have a
 * pending verification record and do not need the client to disclose the
 * destination again.
 */
const otpRequestSchema = z.object({
  destination: z
    .string()
    .trim()
    .min(1)
    .max(254)
    .optional(),

  channel: z.enum([
    "EMAIL",
    "SMS",
  ]),
});

/**
 * OTP verification.
 */
const otpVerifySchema = z.object({
  otp: z
    .string()
    .regex(
      /^\d{6}$/,
      "Verification code must contain 6 digits.",
    ),

  channel: z.enum([
    "EMAIL",
    "SMS",
  ]),

  rememberMe: z
    .boolean()
    .default(false),
});

/**
 * Password-reset request.
 */
const passwordResetRequestSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .optional(),

    phone: z
      .string()
      .trim()
      .min(7)
      .max(30)
      .optional(),
  })
  .superRefine(
    (value, context) => {
      const hasEmail =
        Boolean(value.email);

      const hasPhone =
        Boolean(value.phone);

      if (
        !hasEmail &&
        !hasPhone
      ) {
        context.addIssue({
          code:
            z.ZodIssueCode.custom,
          path: ["email"],
          message:
            "Email or phone number is required.",
        });
      }

      if (
        hasEmail &&
        hasPhone
      ) {
        context.addIssue({
          code:
            z.ZodIssueCode.custom,
          path: ["email"],
          message:
            "Provide either email or phone number, not both.",
        });
      }
    },
  );

/**
 * Password-reset confirmation.
 */
const passwordResetConfirmSchema =
  z
    .object({
      token: z
        .string()
        .trim()
        .min(32)
        .max(256),

      password: z
        .string()
        .min(12)
        .max(128),

      confirmPassword: z
        .string()
        .min(12)
        .max(128),
    })
    .refine(
      (value) =>
        value.password ===
        value.confirmPassword,
      {
        message:
          "Passwords do not match.",
        path: [
          "confirmPassword",
        ],
      },
    );

/**
 * ==========================================================================
 * Request helpers
 * ==========================================================================
 */

/**
 * Extract exactly one login/reset identifier.
 */
function getIdentifier(
  body: {
    email?: string;
    phone?: string;
  },
): string {
  if (
    body.email &&
    body.phone
  ) {
    throw new AppError(
      400,
      "Provide either email or phone number, not both.",
      "IDENTIFIER_AMBIGUOUS",
    );
  }

  if (body.email) {
    return body.email;
  }

  if (body.phone) {
    return body.phone;
  }

  throw new AppError(
    400,
    "Email or phone number is required.",
    "IDENTIFIER_REQUIRED",
  );
}

/**
 * Read a cookie only when it is actually a string.
 *
 * This prevents malformed cookie values from being passed deeper into the
 * authentication service.
 */
function getCookie(
  req: Request,
  name: string,
): string | undefined {
  const value =
    req.cookies?.[name];

  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    return undefined;
  }

  return value;
}

/**
 * Obtain a safe user-agent value.
 */
function getUserAgent(
  req: Request,
): string | undefined {
  const userAgent =
    req.get("user-agent");

  if (
    typeof userAgent !== "string" ||
    userAgent.length === 0
  ) {
    return undefined;
  }

  return userAgent.slice(
    0,
    1024,
  );
}

/**
 * Obtain the request IP supplied by Express after proxy configuration.
 */
function getIpAddress(
  req: Request,
): string | undefined {
  if (
    typeof req.ip !== "string" ||
    req.ip.length === 0
  ) {
    return undefined;
  }

  return req.ip;
}

/**
 * ==========================================================================
 * Login
 * ==========================================================================
 *
 * Authentication flow:
 *
 * 1. Validate request.
 * 2. Pass credentials to auth service.
 * 3. If the device is not trusted, establish pending OTP state.
 * 4. Otherwise establish access/refresh cookies.
 *
 * Access and refresh tokens are NEVER returned in JSON.
 */
export async function loginController(
  req: Request,
  res: Response,
): Promise<void> {
  const body =
    loginSchema.parse(
      req.body,
    );

  const identifier =
    getIdentifier(body);

  const result =
    await login({
      identifier,

      password:
        body.password,

      rememberMe:
        body.rememberMe,

      deviceId:
        getCookie(
          req,
          DEVICE_COOKIE,
        ),

      ipAddress:
        getIpAddress(req),

      userAgent:
        getUserAgent(req),
    });

  /**
   * ------------------------------------------------------------------------
   * New/untrusted device
   * ------------------------------------------------------------------------
   */
  if (
    result.requiresOtp
  ) {
    if (
      !result.pendingVerificationId
    ) {
      throw new AppError(
        500,
        "Unable to start device verification.",
        "OTP_STATE_ERROR",
      );
    }

    setPendingAuthCookie(
      res,
      result.pendingVerificationId,
    );

    /**
     * Never expose the actual OTP or unmasked destination.
     */
    res.status(200).json({
      success: true,
      data: {
        requiresOtp: true,
        otpChannel:
          result.otpChannel,
        maskedDestination:
          result.maskedDestination,
      },
    });

    return;
  }

  /**
   * ------------------------------------------------------------------------
   * Successful authentication
   * ------------------------------------------------------------------------
   */
  if (
    !result.session ||
    !result.accessToken ||
    !result.refreshToken ||
    !result.deviceId ||
    !result.refreshCookieMaxAge
  ) {
    throw new AppError(
      500,
      "Authentication session could not be created.",
      "SESSION_CREATION_FAILED",
    );
  }

  setDeviceCookie(
    res,
    result.deviceId,
  );

  setAccessCookie(
    res,
    result.accessToken,
  );

  setRefreshCookie(
    res,
    result.refreshToken,
    result.refreshCookieMaxAge,
  );

  /**
   * A successful authenticated login invalidates any stale pending OTP
   * browser state.
   */
  clearPendingAuthCookie(res);

  res.status(200).json({
    success: true,
    data: result.session,
  });
}

/**
 * ==========================================================================
 * Logout
 * ==========================================================================
 *
 * The server-side session is revoked first.
 * Authentication cookies are then removed from the browser.
 */
export async function logoutController(
  req: Request,
  res: Response,
): Promise<void> {
  await logout(
    req.auth?.sessionId,
  );

  clearSessionCookies(res);

  res.setHeader(
    "Clear-Site-Data",
    '"cache", "storage"',
  );

  res.status(200).json({
    success: true,
    data: {
      success: true,
      message:
        "You have been signed out successfully.",
    },
  });
}

/**
 * ==========================================================================
 * Current authenticated session
 * ==========================================================================
 */
export async function sessionController(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.auth) {
    throw new AppError(
      401,
      "Authentication required.",
      "AUTHENTICATION_REQUIRED",
    );
  }

  const user =
    await getSessionUser(
      req.auth.employeeId,
    );

  res.status(200).json({
    success: true,
    data: {
      user,
      sessionId:
        req.auth.sessionId,
    },
  });
}

/**
 * ==========================================================================
 * Refresh authentication session
 * ==========================================================================
 *
 * Refresh tokens are accepted exclusively from the HTTP-only refresh cookie.
 *
 * The refresh operation is performed by the auth service, which is
 * responsible for validating and rotating the server-side session/token.
 */
export async function refreshController(
  req: Request,
  res: Response,
): Promise<void> {
  const refreshToken =
    getCookie(
      req,
      REFRESH_COOKIE,
    );

  if (!refreshToken) {
    clearSessionCookies(res);

    throw new AppError(
      401,
      "Refresh authentication required.",
      "REFRESH_TOKEN_REQUIRED",
    );
  }

  const result =
    await refreshSession(
      refreshToken,
      getIpAddress(req),
      getUserAgent(req),
    );

  /**
   * Rotate both authentication cookies.
   */
  setAccessCookie(
    res,
    result.accessToken,
  );

  setRefreshCookie(
    res,
    result.refreshToken,
    result.refreshCookieMaxAge,
  );

  /**
   * Preserve/refresh the trusted-device cookie when the rotated session
   * contains a device identity.
   */
  if (
    result.deviceId
  ) {
    setDeviceCookie(
      res,
      result.deviceId,
    );
  }

  res.status(200).json({
    success: true,
    data: result.session,
  });
}

/**
 * ==========================================================================
 * Request OTP
 * ==========================================================================
 */
export async function requestOtpController(
  req: Request,
  res: Response,
): Promise<void> {
  const body =
    otpRequestSchema.parse(
      req.body,
    );

  const verificationId =
    getCookie(
      req,
      PENDING_AUTH_COOKIE,
    );

  const result =
    await requestOtp({
      verificationId,

      destination:
        body.destination,

      channel:
        body.channel,
    });

  if (
    result.verificationId
  ) {
    setPendingAuthCookie(
      res,
      result.verificationId,
    );
  }

  res.status(200).json({
    success: true,
    data: {
      success: true,
      message:
        result.message,
    },
  });
}

/**
 * ==========================================================================
 * Verify device OTP
 * ==========================================================================
 *
 * The pending-authentication cookie is mandatory.
 *
 * SMS remains deliberately unavailable until the backend SMS provider is
 * configured by the authentication service.
 */
export async function verifyOtpController(
  req: Request,
  res: Response,
): Promise<void> {
  const body =
    otpVerifySchema.parse(
      req.body,
    );

  if (
    body.channel !==
    "EMAIL"
  ) {
    throw new AppError(
      503,
      "SMS verification is not configured yet.",
      "SMS_SERVICE_UNAVAILABLE",
    );
  }

  const verificationId =
    getCookie(
      req,
      PENDING_AUTH_COOKIE,
    );

  if (!verificationId) {
    throw new AppError(
      401,
      "The verification session has expired.",
      "OTP_SESSION_EXPIRED",
    );
  }

  const result =
    await verifyDeviceOtp({
      verificationId,

      otp:
        body.otp,

      deviceId:
        getCookie(
          req,
          DEVICE_COOKIE,
        ),

      rememberMe:
        body.rememberMe,

      ipAddress:
        getIpAddress(req),

      userAgent:
        getUserAgent(req),
    });

  /**
   * Successful verification establishes the trusted device and session.
   */
  if (
    !result.deviceId ||
    !result.accessToken ||
    !result.refreshToken ||
    !result.refreshCookieMaxAge ||
    !result.session
  ) {
    throw new AppError(
      500,
      "Authentication session could not be created.",
      "SESSION_CREATION_FAILED",
    );
  }

  setDeviceCookie(
    res,
    result.deviceId,
  );

  setAccessCookie(
    res,
    result.accessToken,
  );

  setRefreshCookie(
    res,
    result.refreshToken,
    result.refreshCookieMaxAge,
  );

  /**
   * The verification flow is complete.
   */
  clearPendingAuthCookie(res);

  res.status(200).json({
    success: true,
    data: result.session,
  });
}

/**
 * ==========================================================================
 * Password reset request
 * ==========================================================================
 *
 * The response deliberately does not disclose whether an account exists.
 */
export async function requestPasswordResetController(
  req: Request,
  res: Response,
): Promise<void> {
  const body =
    passwordResetRequestSchema.parse(
      req.body,
    );

  const identifier =
    getIdentifier(body);

  await requestPasswordReset(
    identifier,
  );

  res.status(200).json({
    success: true,
    data: {
      success: true,
      message:
        "If the account exists, password reset instructions have been sent.",
    },
  });
}

/**
 * ==========================================================================
 * Password reset confirmation
 * ==========================================================================
 *
 * The service is responsible for:
 * - validating the reset token
 * - changing the password
 * - consuming the reset token
 * - revoking existing sessions
 *
 * The controller additionally clears any authentication cookies still held
 * by this browser.
 */
export async function confirmPasswordResetController(
  req: Request,
  res: Response,
): Promise<void> {
  const body =
    passwordResetConfirmSchema.parse(
      req.body,
    );

  await confirmPasswordReset(
    body,
  );

  clearSessionCookies(res);

  res.status(200).json({
    success: true,
    data: {
      success: true,
      message:
        "Your password has been reset successfully. Please sign in again.",
    },
  });
}