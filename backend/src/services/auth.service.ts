import {
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import {
  db,
  type Tx,
} from "../../prisma/db.js";

import {
  env,
} from "../config/env.js";

import {
  AppError,
} from "../middleware/error.middleware.js";

import {
  generateOpaqueToken,
  generateOtp,
  hashOpaqueToken,
  hashOtp,
  hashPassword,
  normalizeEmail,
  normalizePhone,
  verifyPassword,
} from "../utils/crypto.js";

import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/tokens.js";

import {
  sendLoginOtpEmail,
  sendPasswordResetEmail,
} from "./email.service.js";

import type {
  AuthResponse,
  AuthenticatedUser,
  LoginResult,
} from "../types/auth.types.js";

/**
 * Authentication service.
 *
 * Production responsibilities:
 *
 * - Employee lookup by email or phone
 * - Password authentication
 * - Account-status enforcement
 * - Trusted-device verification
 * - Device OTP generation and verification
 * - Server-side authentication sessions
 * - Access/refresh token generation
 * - Refresh-token rotation
 * - Session revocation
 * - Current-session lookup
 * - Password-reset workflow
 *
 * Security principles:
 *
 * - Passwords are never stored in plaintext.
 * - Refresh tokens are stored only as hashes.
 * - OTP codes are stored only as hashes.
 * - Password-reset tokens are stored only as hashes.
 * - Authentication sessions are persisted server-side.
 * - Authentication failures use safe messages.
 * - OTPs are time-limited and attempt-limited.
 * - Refresh tokens are rotated.
 * - Password resets revoke active sessions.
 * - Authentication credentials are delivered through HTTP-only
 *   cookies by the controller layer.
 */

const DEVICE_OTP_PURPOSE = "DEVICE_VERIFICATION" as const;
const PASSWORD_RESET_PURPOSE = "PASSWORD_RESET" as const;

const AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED";
const ACCOUNT_NOT_ACTIVATED = "ACCOUNT_NOT_ACTIVATED";
const AUTHENTICATION_STATE_ERROR = "AUTHENTICATION_STATE_ERROR";
const OTP_INVALID = "OTP_INVALID";
const SESSION_EXPIRED = "SESSION_EXPIRED";
const SESSION_REVOKED = "SESSION_REVOKED";
const ACCOUNT_INACTIVE = "ACCOUNT_INACTIVE";
const RESET_TOKEN_INVALID = "RESET_TOKEN_INVALID";

function nowIso(): string {
  return new Date().toISOString();
}

function addMinutes(minutes: number): string {
  return new Date(
    Date.now() + minutes * 60 * 1000,
  ).toISOString();
}

function addDays(days: number): string {
  return new Date(
    Date.now() + days * 24 * 60 * 60 * 1000,
  ).toISOString();
}

function timestamp(value: string): number {
  return new Date(value).getTime();
}

function isFuture(value: string): boolean {
  const parsed = timestamp(value);

  return Number.isFinite(parsed) && parsed > Date.now();
}

/**
 * Constant-time comparison for hash strings.
 */
function secureHashEqual(
  first: string,
  second: string,
): boolean {
  if (!first || !second) {
    return false;
  }

  const firstBuffer = Buffer.from(first, "utf8");
  const secondBuffer = Buffer.from(second, "utf8");

  if (firstBuffer.length !== secondBuffer.length) {
    return false;
  }

  try {
    return timingSafeEqual(
      firstBuffer,
      secondBuffer,
    );
  } catch {
    return false;
  }
}

/**
 * Mask an email address before returning it to the client.
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");

  if (!local || !domain) {
    return "***";
  }

  if (local.length === 1) {
    return `*@${domain}`;
  }

  const visible =
    local.length <= 2
      ? local.charAt(0)
      : local.slice(0, 2);

  return `${visible}***@${domain}`;
}

/**
 * Mask a phone number before returning it to the client.
 */
function maskPhone(phone: string): string {
  if (phone.length <= 4) {
    return "****";
  }

  return (
    "*".repeat(
      Math.max(0, phone.length - 4),
    ) + phone.slice(-4)
  );
}

/**
 * Find an employee using an email address or phone number.
 *
 * Input normalization is handled before querying the database.
 */
async function findEmployeeByIdentifier(
  identifier: string,
) {
  const trimmed = identifier.trim();

  if (!trimmed) {
    return null;
  }

  const normalizedEmail = normalizeEmail(trimmed);

  const byEmail =
    await db.orm.public.Employee
      .include("department")
      .where({
        email: normalizedEmail,
      })
      .first();

  if (byEmail) {
    return byEmail;
  }

  const normalizedPhone = normalizePhone(trimmed);

  return db.orm.public.Employee
    .include("department")
    .where({
      phone: normalizedPhone,
    })
    .first();
}

/**
 * Find employee by normalized email.
 */
async function findEmployeeByEmail(email: string) {
  return db.orm.public.Employee
    .include("department")
    .where({
      email: normalizeEmail(email),
    })
    .first();
}

/**
 * Convert a database employee record to the public
 * authenticated-user contract.
 */
function toAuthenticatedUser(
  employee: Awaited<
    ReturnType<typeof findEmployeeByIdentifier>
  >,
): AuthenticatedUser {
  if (!employee) {
    throw new AppError(
      401,
      "Authentication failed.",
      AUTHENTICATION_FAILED,
    );
  }

  return {
    id: employee.id,
    employeeId: employee.employeeId,
    organizationId: employee.organizationId,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    phone: employee.phone,
    role: employee.role as AuthenticatedUser["role"],
    accountStatus:
      employee.status as AuthenticatedUser["accountStatus"],
    departmentId:
      employee.departmentId ?? undefined,
    departmentName:
      employee.department?.name ?? undefined,
    emailVerified: employee.emailVerified,
    phoneVerified: employee.phoneVerified,
    lastLoginAt:
      employee.lastLoginAt ?? undefined,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  };
}

/**
 * Ensure an employee can authenticate.
 *
 * Deliberately uses the same authentication error for:
 *
 * - nonexistent account
 * - inactive account
 * - suspended account
 * - account without a password
 *
 * This reduces account-enumeration risk.
 */
function assertActiveEmployee(
  employee: Awaited<
    ReturnType<typeof findEmployeeByIdentifier>
  >,
): asserts employee {
  if (!employee) {
    throw new AppError(
      401,
      "Invalid email, phone number, or password.",
      AUTHENTICATION_FAILED,
    );
  }

  if (employee.status !== "ACTIVE") {
    throw new AppError(
      401,
      "Invalid email, phone number, or password.",
      AUTHENTICATION_FAILED,
    );
  }

  if (!employee.passwordHash) {
    throw new AppError(
      401,
      "Invalid email, phone number, or password.",
      AUTHENTICATION_FAILED,
    );
  }
}

/**
 * Determine whether a device is currently trusted.
 *
 * A device is trusted only when it is associated with an
 * active, non-expired server-side session.
 */
async function isTrustedDevice(
  employeeId: string,
  deviceId?: string,
): Promise<boolean> {
  if (!deviceId?.trim()) {
    return false;
  }

  const sessions =
    await db.orm.public.UserSession
      .where({
        employeeId,
        deviceFingerprint: deviceId,
        revokedAt: null,
      })
      .all();

  const currentTime = Date.now();

  return sessions.some((session) => {
    const expiresAt = timestamp(
      session.expiresAt,
    );

    return (
      Number.isFinite(expiresAt) &&
      expiresAt > currentTime
    );
  });
}

/**
 * Create a server-side authentication session.
 *
 * Only the hash of the refresh token is persisted.
 * The plaintext refresh token is returned to the controller
 * solely so it can be placed into an HTTP-only cookie.
 */
async function createSession(
  tx: Tx,
  params: {
    employeeId: string;
    deviceFingerprint: string;
    ipAddress?: string;
    userAgent?: string;
    rememberMe: boolean;
  },
) {
  const sessionId = randomUUID();

  const ttlDays = params.rememberMe
    ? env.REFRESH_TOKEN_TTL_DAYS
    : Math.min(
        env.REFRESH_TOKEN_TTL_DAYS,
        env.SESSION_TTL_HOURS / 24,
      );

  const safeTtlDays = Math.max(
    1 / (24 * 60),
    ttlDays,
  );

  const refreshToken = signRefreshToken(
    params.employeeId,
    sessionId,
    safeTtlDays,
  );

  const accessToken = signAccessToken(
    params.employeeId,
    sessionId,
  );

  const refreshTokenHash =
    hashOpaqueToken(refreshToken);

  const expiresAt = addDays(safeTtlDays);

  await tx.orm.public.UserSession.create({
    id: sessionId,
    employeeId: params.employeeId,
    refreshTokenHash,
    deviceFingerprint:
      params.deviceFingerprint,
    ipAddress:
      params.ipAddress ?? null,
    userAgent:
      params.userAgent ?? null,
    expiresAt,
    lastUsedAt: nowIso(),
  });

  return {
    sessionId,
    accessToken,
    refreshToken,
    expiresAt,
    refreshCookieMaxAge: Math.max(
      1,
      Math.round(
        safeTtlDays *
          24 *
          60 *
          60 *
          1000,
      ),
    ),
  };
}

/**
 * Create a session outside an existing transaction.
 */
async function createSessionForEmployee(
  employeeId: string,
  params: {
    deviceFingerprint: string;
    ipAddress?: string;
    userAgent?: string;
    rememberMe: boolean;
  },
) {
  return db.transaction(
    async (tx) =>
      createSession(
        tx,
        {
          employeeId,
          ...params,
        },
      ),
  );
}

/**
 * Invalidate existing active device-verification OTPs.
 *
 * Only one active device OTP is permitted for an employee
 * at a time.
 */
async function invalidateExistingDeviceOtps(
  employeeId: string,
): Promise<void> {
  await db.orm.public.OtpVerification
    .where({
      employeeId,
      purpose: DEVICE_OTP_PURPOSE,
      consumedAt: null,
    })
    .updateAll({
      consumedAt: nowIso(),
    });
}

/**
 * Create a new device verification OTP.
 *
 * OTP delivery is currently email-only because the actual
 * backend SMS provider has not been configured.
 */
async function createDeviceOtp(
  employeeId: string,
  email: string,
): Promise<{
  verificationId: string;
  maskedDestination: string;
}> {
  await invalidateExistingDeviceOtps(
    employeeId,
  );

  const otp = generateOtp();
  const verificationId = randomUUID();

  const expiresAt = addMinutes(
    env.OTP_TTL_MINUTES,
  );

  await db.orm.public.OtpVerification.create({
    id: verificationId,
    employeeId,
    codeHash: hashOtp(
      employeeId,
      otp,
    ),
    purpose: DEVICE_OTP_PURPOSE,
    expiresAt,
    attempts: 0,
  });

  await sendLoginOtpEmail(
    email,
    otp,
  );

  return {
    verificationId,
    maskedDestination: maskEmail(email),
  };
}

/**
 * Authenticate an employee.
 *
 * Password verification always occurs before trusted-device
 * evaluation.
 */
export async function login(
  params: {
    identifier: string;
    password: string;
    rememberMe: boolean;
    deviceId?: string;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<LoginResult> {
  const employee =
    await findEmployeeByIdentifier(
      params.identifier,
    );

  assertActiveEmployee(employee);

  if (!employee.passwordHash) {
    throw new AppError(
      401,
      "Invalid email, phone number, or password.",
      AUTHENTICATION_FAILED,
    );
  }

  const validPassword =
    await verifyPassword(
      params.password,
      employee.passwordHash,
    );

  if (!validPassword) {
    throw new AppError(
      401,
      "Invalid email, phone number, or password.",
      AUTHENTICATION_FAILED,
    );
  }

  const trusted =
    await isTrustedDevice(
      employee.id,
      params.deviceId,
    );

  const requiresOtp =
    employee.authenticationMethod ===
      "PASSWORD_AND_OTP" &&
    !trusted;

  if (requiresOtp) {
    const otp =
      await createDeviceOtp(
        employee.id,
        employee.email,
      );

    return {
      requiresOtp: true,
      otpChannel: "EMAIL",
      maskedDestination:
        otp.maskedDestination,
      pendingVerificationId:
        otp.verificationId,
    };
  }

  const deviceId =
    params.deviceId?.trim() ||
    randomUUID();

  const session =
    await createSessionForEmployee(
      employee.id,
      {
        deviceFingerprint: deviceId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        rememberMe: params.rememberMe,
      },
    );

  const lastLoginAt = nowIso();

  await db.orm.public.Employee
    .where({
      id: employee.id,
    })
    .update({
      lastLoginAt,
    });

  const updatedEmployee =
    await findEmployeeByEmail(
      employee.email,
    );

  if (!updatedEmployee) {
    throw new AppError(
      500,
      "Unable to load authenticated account.",
      AUTHENTICATION_STATE_ERROR,
    );
  }

  return {
    requiresOtp: false,
    session: {
      user:
        toAuthenticatedUser(
          updatedEmployee,
        ),
      expiresAt:
        session.expiresAt,
      issuedAt: lastLoginAt,
      sessionId:
        session.sessionId,
      authenticationMethod:
        employee.authenticationMethod as
          | "PASSWORD"
          | "OTP"
          | "PASSWORD_AND_OTP",
    },
    accessToken:
      session.accessToken,
    refreshToken:
      session.refreshToken,
    deviceId,
    refreshCookieMaxAge:
      session.refreshCookieMaxAge,
  };
}

/**
 * Verify a device OTP and establish an authenticated session.
 */
export async function verifyDeviceOtp(
  params: {
    verificationId: string;
    otp: string;
    deviceId?: string;
    rememberMe: boolean;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<{
  session: AuthResponse;
  deviceId: string;
  accessToken: string;
  refreshToken: string;
  refreshCookieMaxAge: number;
}> {
  const verification =
    await db.orm.public.OtpVerification
      .where({
        id: params.verificationId,
      })
      .first();

  if (
    !verification ||
    verification.purpose !==
      DEVICE_OTP_PURPOSE ||
    verification.consumedAt ||
    !isFuture(
      verification.expiresAt,
    ) ||
    verification.attempts >=
      env.OTP_MAX_ATTEMPTS
  ) {
    throw new AppError(
      401,
      "The verification code is invalid or expired.",
      OTP_INVALID,
    );
  }

  const employee =
    await db.orm.public.Employee
      .include("department")
      .where({
        id: verification.employeeId,
      })
      .first();

  if (
    !employee ||
    employee.status !== "ACTIVE"
  ) {
    throw new AppError(
      401,
      "The verification code is invalid or expired.",
      OTP_INVALID,
    );
  }

  const expectedHash =
    hashOtp(
      employee.id,
      params.otp,
    );

  if (
    !secureHashEqual(
      expectedHash,
      verification.codeHash,
    )
  ) {
    const nextAttempts =
      verification.attempts + 1;

    await db.orm.public.OtpVerification
      .where({
        id: verification.id,
      })
      .update({
        attempts: nextAttempts,
      });

    throw new AppError(
      401,
      "The verification code is invalid or expired.",
      OTP_INVALID,
    );
  }

  const deviceId =
    params.deviceId?.trim() ||
    randomUUID();

  const issuedAt = nowIso();

  const session =
    await db.transaction(
      async (tx) => {
        /**
         * Consume the OTP and establish the session
         * in the same transaction.
         */
        await tx.orm.public.OtpVerification
          .where({
            id: verification.id,
            consumedAt: null,
          })
          .update({
            consumedAt: issuedAt,
          });

        await tx.orm.public.Employee
          .where({
            id: employee.id,
          })
          .update({
            lastLoginAt: issuedAt,
          });

        return createSession(
          tx,
          {
            employeeId: employee.id,
            deviceFingerprint:
              deviceId,
            ipAddress:
              params.ipAddress,
            userAgent:
              params.userAgent,
            rememberMe:
              params.rememberMe,
          },
        );
      },
    );

  const updatedEmployee =
    await findEmployeeByEmail(
      employee.email,
    );

  if (!updatedEmployee) {
    throw new AppError(
      500,
      "Unable to complete authentication.",
      AUTHENTICATION_STATE_ERROR,
    );
  }

  return {
    session: {
      user:
        toAuthenticatedUser(
          updatedEmployee,
        ),
      expiresAt:
        session.expiresAt,
      issuedAt,
      sessionId:
        session.sessionId,
      authenticationMethod:
        employee.authenticationMethod as
          | "PASSWORD"
          | "OTP"
          | "PASSWORD_AND_OTP",
    },
    deviceId,
    accessToken:
      session.accessToken,
    refreshToken:
      session.refreshToken,
    refreshCookieMaxAge:
      session.refreshCookieMaxAge,
  };
}

/**
 * Refresh an authentication session.
 *
 * Refresh-token rotation:
 *
 * 1. Verify JWT signature.
 * 2. Locate server-side session.
 * 3. Verify session is active.
 * 4. Verify refresh-token hash.
 * 5. Verify employee is active.
 * 6. Revoke old session.
 * 7. Create a new session.
 *
 * The old refresh token cannot be reused after rotation.
 */
export async function refreshSession(
  refreshToken: string,
  ipAddress?: string,
  userAgent?: string,
) {
  let payload;

  try {
    payload =
      verifyRefreshToken(
        refreshToken,
      );
  } catch {
    throw new AppError(
      401,
      "Your session has expired. Please sign in again.",
      SESSION_EXPIRED,
    );
  }

  const oldSession =
    await db.orm.public.UserSession
      .where({
        id: payload.sid,
        employeeId: payload.sub,
      })
      .first();

  if (
    !oldSession ||
    oldSession.revokedAt ||
    !isFuture(
      oldSession.expiresAt,
    )
  ) {
    throw new AppError(
      401,
      "Your session has expired. Please sign in again.",
      SESSION_EXPIRED,
    );
  }

  const suppliedHash =
    hashOpaqueToken(
      refreshToken,
    );

  if (
    !secureHashEqual(
      suppliedHash,
      oldSession.refreshTokenHash,
    )
  ) {
    /**
     * A refresh token mismatch can indicate token theft.
     * Revoke this session immediately.
     */
    await db.orm.public.UserSession
      .where({
        id: oldSession.id,
        revokedAt: null,
      })
      .update({
        revokedAt: nowIso(),
        lastUsedAt: nowIso(),
      });

    throw new AppError(
      401,
      "Your session is no longer valid.",
      SESSION_REVOKED,
    );
  }

  const employee =
    await db.orm.public.Employee
      .include("department")
      .where({
        id: payload.sub,
      })
      .first();

  if (
    !employee ||
    employee.status !== "ACTIVE"
  ) {
    await db.orm.public.UserSession
      .where({
        id: oldSession.id,
        revokedAt: null,
      })
      .update({
        revokedAt: nowIso(),
        lastUsedAt: nowIso(),
      });

    throw new AppError(
      401,
      "Your account is no longer active.",
      ACCOUNT_INACTIVE,
    );
  }

  const issuedAt = nowIso();

  /**
   * Never extend the original session lifetime during refresh.
   */
  const remainingMilliseconds =
    Math.max(
      1,
      timestamp(
        oldSession.expiresAt,
      ) - Date.now(),
    );

  const remainingDays =
    remainingMilliseconds /
    (
      24 *
      60 *
      60 *
      1000
    );

  const refreshTtlDays =
    Math.max(
      1 / (24 * 60),
      Math.min(
        env.REFRESH_TOKEN_TTL_DAYS,
        remainingDays,
      ),
    );

  const newSession =
    await db.transaction(
      async (tx) => {
        await tx.orm.public.UserSession
          .where({
            id: oldSession.id,
            revokedAt: null,
          })
          .update({
            revokedAt: issuedAt,
            lastUsedAt: issuedAt,
          });

        return createSession(
          tx,
          {
            employeeId:
              employee.id,
            deviceFingerprint:
              oldSession.deviceFingerprint ??
              randomUUID(),
            ipAddress:
              ipAddress ??
              oldSession.ipAddress ??
              undefined,
            userAgent:
              userAgent ??
              oldSession.userAgent ??
              undefined,
            rememberMe:
              refreshTtlDays >=
              env.REFRESH_TOKEN_TTL_DAYS,
          },
        );
      },
    );

  /**
   * Preserve the original absolute expiry.
   *
   * createSession generates its own expiry, so clamp the
   * resulting cookie lifetime to the remaining original
   * lifetime.
   */
  const absoluteExpiry =
    timestamp(
      oldSession.expiresAt,
    );

  const generatedExpiry =
    timestamp(
      newSession.expiresAt,
    );

  const effectiveExpiry = Math.min(
    absoluteExpiry,
    generatedExpiry,
  );

  const effectiveCookieMaxAge =
    Math.max(
      1,
      effectiveExpiry - Date.now(),
    );

  const newEmployee =
    await findEmployeeByEmail(
      employee.email,
    );

  if (!newEmployee) {
    throw new AppError(
      500,
      "Unable to complete authentication refresh.",
      AUTHENTICATION_STATE_ERROR,
    );
  }

  return {
    session: {
      user:
        toAuthenticatedUser(
          newEmployee,
        ),
      expiresAt:
        new Date(
          effectiveExpiry,
        ).toISOString(),
      issuedAt,
      sessionId:
        newSession.sessionId,
      authenticationMethod:
        employee.authenticationMethod as
          | "PASSWORD"
          | "OTP"
          | "PASSWORD_AND_OTP",
    },
    accessToken:
      newSession.accessToken,
    refreshToken:
      newSession.refreshToken,
    deviceId:
      oldSession.deviceFingerprint ??
      undefined,
    refreshCookieMaxAge:
      effectiveCookieMaxAge,
  };
}

/**
 * Revoke one authentication session.
 */
export async function logout(
  sessionId?: string,
): Promise<void> {
  if (!sessionId) {
    return;
  }

  const timestampNow = nowIso();

  await db.orm.public.UserSession
    .where({
      id: sessionId,
      revokedAt: null,
    })
    .update({
      revokedAt: timestampNow,
      lastUsedAt: timestampNow,
    });
}

/**
 * Retrieve the current authenticated employee.
 */
export async function getSessionUser(
  employeeId: string,
): Promise<AuthenticatedUser> {
  const employee =
    await db.orm.public.Employee
      .include("department")
      .where({
        id: employeeId,
      })
      .first();

  if (
    !employee ||
    employee.status !== "ACTIVE"
  ) {
    throw new AppError(
      401,
      "Your account is no longer active.",
      ACCOUNT_INACTIVE,
    );
  }

  return toAuthenticatedUser(
    employee,
  );
}

/**
 * Request/resend a device verification OTP.
 *
 * SMS is intentionally rejected until an SMS provider is
 * configured on the backend.
 */
export async function requestOtp(
  params: {
    verificationId?: string;
    destination?: string;
    channel: "EMAIL" | "SMS";
  },
): Promise<{
  success: true;
  message: string;
  verificationId?: string;
}> {
  if (params.channel !== "EMAIL") {
    throw new AppError(
      503,
      "SMS verification is not configured yet.",
      "SMS_SERVICE_UNAVAILABLE",
    );
  }

  /**
   * Resend within an existing authentication flow.
   */
  if (params.verificationId) {
    const existing =
      await db.orm.public.OtpVerification
        .where({
          id: params.verificationId,
        })
        .first();

    if (
      existing &&
      existing.purpose ===
        DEVICE_OTP_PURPOSE &&
      !existing.consumedAt
    ) {
      const employee =
        await db.orm.public.Employee
          .where({
            id: existing.employeeId,
          })
          .first();

      if (
        employee &&
        employee.status === "ACTIVE"
      ) {
        const otp =
          await createDeviceOtp(
            employee.id,
            employee.email,
          );

        return {
          success: true,
          message:
            "A new verification code has been sent.",
          verificationId:
            otp.verificationId,
        };
      }
    }
  }

  /**
   * Do not reveal whether an account exists.
   */
  if (!params.destination) {
    return {
      success: true,
      message:
        "If the account is eligible, a verification code has been sent.",
    };
  }

  const employee =
    await findEmployeeByIdentifier(
      params.destination,
    );

  if (
    employee &&
    employee.status === "ACTIVE"
  ) {
    const otp =
      await createDeviceOtp(
        employee.id,
        employee.email,
      );

    return {
      success: true,
      message:
        "A verification code has been sent.",
      verificationId:
        otp.verificationId,
    };
  }

  return {
    success: true,
    message:
      "If the account is eligible, a verification code has been sent.",
  };
}

/**
 * Request a password reset.
 *
 * The method intentionally reveals nothing about whether
 * the requested account exists.
 */
export async function requestPasswordReset(
  identifier: string,
): Promise<void> {
  const employee =
    await findEmployeeByIdentifier(
      identifier,
    );

  if (
    !employee ||
    employee.status !== "ACTIVE"
  ) {
    return;
  }

  /**
   * Invalidate previous password-reset tokens.
   */
  await db.orm.public.OtpVerification
    .where({
      employeeId: employee.id,
      purpose: PASSWORD_RESET_PURPOSE,
      consumedAt: null,
    })
    .updateAll({
      consumedAt: nowIso(),
    });

  const token =
    generateOpaqueToken(48);

  const verificationId =
    randomUUID();

  const expiresAt =
    addMinutes(
      env.PASSWORD_RESET_TTL_MINUTES,
    );

  await db.orm.public.OtpVerification.create({
    id: verificationId,
    employeeId: employee.id,
    codeHash:
      hashOpaqueToken(token),
    purpose: PASSWORD_RESET_PURPOSE,
    expiresAt,
    attempts: 0,
  });

  const resetUrl =
    `${env.APP_URL}/reset-password?token=${encodeURIComponent(
      token,
    )}`;

  await sendPasswordResetEmail(
    employee.email,
    resetUrl,
  );
}

/**
 * Confirm a password reset.
 *
 * The raw reset token is never persisted.
 * Only its hash is stored.
 *
 * Password update, token consumption and session revocation
 * are performed in one transaction.
 */
export async function confirmPasswordReset(
  params: {
    token: string;
    password: string;
    confirmPassword: string;
  },
): Promise<void> {
  if (
    params.password !==
    params.confirmPassword
  ) {
    throw new AppError(
      400,
      "Passwords do not match.",
      "PASSWORD_MISMATCH",
    );
  }

  const token =
    params.token.trim();

  if (!token) {
    throw new AppError(
      400,
      "The password reset link is invalid or expired.",
      RESET_TOKEN_INVALID,
    );
  }

  const tokenHash =
    hashOpaqueToken(token);

  const verification =
    await db.orm.public.OtpVerification
      .where({
        purpose: PASSWORD_RESET_PURPOSE,
        consumedAt: null,
        codeHash: tokenHash,
      })
      .first();

  if (
    !verification ||
    !isFuture(
      verification.expiresAt,
    )
  ) {
    throw new AppError(
      400,
      "The password reset link is invalid or expired.",
      RESET_TOKEN_INVALID,
    );
  }

  const employee =
    await db.orm.public.Employee
      .where({
        id: verification.employeeId,
      })
      .first();

  if (!employee) {
    throw new AppError(
      400,
      "The password reset link is invalid or expired.",
      RESET_TOKEN_INVALID,
    );
  }

  const newPasswordHash =
    await hashPassword(
      params.password,
    );

  const consumedAt = nowIso();

  await db.transaction(
    async (tx) => {
      /**
       * Consume the reset credential.
       */
      await tx.orm.public.OtpVerification
        .where({
          id: verification.id,
          consumedAt: null,
        })
        .update({
          consumedAt,
        });

      /**
       * Update the employee password.
       *
       * Resetting the password activates an invited account
       * because activation and password creation are completed
       * through this controlled workflow.
       */
      await tx.orm.public.Employee
        .where({
          id: employee.id,
        })
        .update({
          passwordHash:
            newPasswordHash,
          status: "ACTIVE",
          emailVerified:
            employee.emailVerified,
          phoneVerified:
            employee.phoneVerified,
        });

      /**
       * Revoke every existing active session.
       *
       * This prevents previously issued credentials from
       * remaining usable after a password compromise.
       */
      await tx.orm.public.UserSession
        .where({
          employeeId: employee.id,
          revokedAt: null,
        })
        .updateAll({
          revokedAt: consumedAt,
          lastUsedAt: consumedAt,
        });
    },
  );
}