import { Router } from "express";

import {
  loginController,
  logoutController,
  sessionController,
  refreshController,
  requestOtpController,
  verifyOtpController,
  requestPasswordResetController,
  confirmPasswordResetController,
} from "../controllers/auth.controller.js";

import {
  requireAuthentication,
} from "../middleware/auth.middleware.js";

const router = Router();

/**
 * Authentication routes.
 *
 * Security model:
 * - Authentication state is maintained through HTTP-only cookies.
 * - Access to authenticated resources is enforced by
 *   requireAuthentication.
 * - Refresh does not require an access-token session because
 *   it authenticates using the HTTP-only refresh cookie.
 * - OTP and password-reset endpoints use their own short-lived,
 *   server-issued cookies/tokens as implemented by the auth service.
 */

/**
 * POST /api/auth/login
 *
 * Authenticate an employee using:
 * - email + password, or
 * - phone + password.
 *
 * A successful trusted-device login establishes the authenticated
 * session and HTTP-only cookies.
 *
 * An untrusted-device login establishes a pending authentication
 * flow and returns requiresOtp=true.
 */
router.post(
  "/login",
  loginController,
);

/**
 * POST /api/auth/logout
 *
 * Terminates the current authenticated session.
 *
 * Authentication is required so a caller cannot arbitrarily
 * revoke another employee's session through this endpoint.
 */
router.post(
  "/logout",
  requireAuthentication,
  logoutController,
);

/**
 * GET /api/auth/session
 *
 * Returns the authenticated employee/session information.
 *
 * Authentication is required.
 */
router.get(
  "/session",
  requireAuthentication,
  sessionController,
);

/**
 * POST /api/auth/refresh
 *
 * Rotates the authenticated session's access/refresh credentials
 * using the HTTP-only refresh cookie.
 *
 * This endpoint intentionally does not use requireAuthentication
 * because an expired access token is expected during normal
 * refresh-token operation.
 */
router.post(
  "/refresh",
  refreshController,
);

/**
 * POST /api/auth/otp/request
 *
 * Requests or resends the OTP required to complete an
 * authentication flow.
 *
 * The controller validates the pending-authentication context
 * and delegates OTP creation/delivery to the authentication
 * service.
 */
router.post(
  "/otp/request",
  requestOtpController,
);

/**
 * POST /api/auth/otp/verify
 *
 * Verifies the OTP for a pending authentication flow and,
 * when successful, establishes the authenticated session.
 */
router.post(
  "/otp/verify",
  verifyOtpController,
);

/**
 * POST /api/auth/password-reset/request
 *
 * Starts the password-reset process.
 *
 * The endpoint intentionally does not require authentication
 * because it is used when an employee cannot authenticate.
 */
router.post(
  "/password-reset/request",
  requestPasswordResetController,
);

/**
 * POST /api/auth/password-reset/confirm
 *
 * Completes a password reset using the server-issued reset
 * credential.
 *
 * The controller/service is responsible for validating the
 * reset credential, updating the password, consuming the
 * credential,
 * and revoking existing sessions where applicable.
 */
router.post(
  "/password-reset/confirm",
  confirmPasswordResetController,
);

export default router;