import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { AppError } from "./error.middleware.js";
import { ACCESS_COOKIE } from "../utils/cookies.js";
import { verifyAccessToken } from "../utils/tokens.js";
import { db } from "../../prisma/db.js";

const AUTHENTICATION_REQUIRED = "AUTHENTICATION_REQUIRED";
const AUTHENTICATION_INVALID = "AUTHENTICATION_INVALID";
const SESSION_INVALID = "SESSION_INVALID";
const SESSION_EXPIRED = "SESSION_EXPIRED";
const ACCOUNT_NOT_FOUND = "ACCOUNT_NOT_FOUND";
const ACCOUNT_INACTIVE = "ACCOUNT_INACTIVE";

function getAccessToken(
  req: Request,
): string {
  const token = req.cookies?.[ACCESS_COOKIE];

  if (
    typeof token !== "string" ||
    token.trim().length === 0
  ) {
    throw new AppError(
      401,
      "Authentication required.",
      AUTHENTICATION_REQUIRED,
    );
  }

  return token;
}

function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

function isExpired(
  expiresAt: unknown,
  now: number,
): boolean {
  const expirationTime =
    new Date(String(expiresAt)).getTime();

  return (
    !Number.isFinite(expirationTime) ||
    expirationTime <= now
  );
}

async function revokeSession(
  sessionId: string,
  timestamp: string,
): Promise<void> {
  await db.orm.public.UserSession
    .where({
      id: sessionId,
      revokedAt: null,
    })
    .update({
      revokedAt: timestamp,
      lastUsedAt: timestamp,
    });
}

async function revokeInvalidSession(
  sessionId: string,
): Promise<void> {
  try {
    await revokeSession(
      sessionId,
      getCurrentTimestamp(),
    );
  } catch {
    /*
     * The original authentication failure must not be replaced with
     * an internal database error.
     *
     * The session is already being treated as invalid. A later request
     * will perform the same validation and attempt the revocation again.
     */
  }
}

export async function requireAuthentication(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    /*
     * ----------------------------------------------------------------------
     * 1. Read the access token exclusively from the HTTP-only cookie.
     * ----------------------------------------------------------------------
     *
     * The client cannot supply an alternative employee ID or session ID
     * through query parameters, request bodies, or custom headers.
     */
    const accessToken = getAccessToken(req);

    /*
     * ----------------------------------------------------------------------
     * 2. Cryptographically verify the access token.
     * ----------------------------------------------------------------------
     *
     * verifyAccessToken() is responsible for validating:
     * - signature
     * - issuer
     * - audience
     * - token type
     * - employee subject
     * - session ID
     * - JWT expiration
     */
    let payload;

    try {
      payload = verifyAccessToken(accessToken);
    } catch {
      throw new AppError(
        401,
        "Your authentication session is invalid or expired.",
        AUTHENTICATION_INVALID,
      );
    }

    /*
     * ----------------------------------------------------------------------
     * 3. Validate the server-side session.
     * ----------------------------------------------------------------------
     *
     * JWT validity alone is not sufficient.
     *
     * The session must:
     * - exist
     * - belong to the employee contained in the token
     * - not have been revoked
     */
    let session;

    try {
      session =
        await db.orm.public.UserSession
          .where({
            id: payload.sid,
            employeeId: payload.sub,
            revokedAt: null,
          })
          .first();
    } catch {
      throw new AppError(
        503,
        "Authentication service is temporarily unavailable.",
        "AUTHENTICATION_SERVICE_UNAVAILABLE",
      );
    }

    if (!session) {
      throw new AppError(
        401,
        "Your authentication session is no longer valid.",
        SESSION_INVALID,
      );
    }

    /*
     * ----------------------------------------------------------------------
     * 4. Validate server-side session expiration.
     * ----------------------------------------------------------------------
     *
     * The database session lifetime is authoritative in addition to the
     * JWT expiration.
     */
    const now = Date.now();

    if (
      isExpired(
        session.expiresAt,
        now,
      )
    ) {
      await revokeInvalidSession(
        session.id,
      );

      throw new AppError(
        401,
        "Your authentication session has expired.",
        SESSION_EXPIRED,
      );
    }

    /*
     * ----------------------------------------------------------------------
     * 5. Load the current employee account.
     * ----------------------------------------------------------------------
     *
     * The employee is loaded on every authenticated request so that account
     * deactivation or suspension takes effect immediately rather than only
     * after the JWT expires.
     */
    let employee;

    try {
      employee =
        await db.orm.public.Employee
          .where({
            id: payload.sub,
          })
          .first();
    } catch {
      throw new AppError(
        503,
        "Authentication service is temporarily unavailable.",
        "AUTHENTICATION_SERVICE_UNAVAILABLE",
      );
    }

    if (!employee) {
      await revokeInvalidSession(
        session.id,
      );

      throw new AppError(
        401,
        "Your authentication session is no longer valid.",
        ACCOUNT_NOT_FOUND,
      );
    }

    /*
     * ----------------------------------------------------------------------
     * 6. Enforce current account status.
     * ----------------------------------------------------------------------
     *
     * An administrator can deactivate or suspend an account while an access
     * token is still technically valid. The account status therefore has to
     * be checked against the database on every authenticated request.
     */
    if (employee.status !== "ACTIVE") {
      await revokeInvalidSession(
        session.id,
      );

      throw new AppError(
        401,
        "Your account is no longer active.",
        ACCOUNT_INACTIVE,
      );
    }

    /*
     * ----------------------------------------------------------------------
     * 7. Confirm the authenticated identity.
     * ----------------------------------------------------------------------
     *
     * The role comes from the database-backed employee record rather than
     * being trusted from client input.
     */
    req.auth = {
      employeeId: employee.id,
      sessionId: session.id,
      role: employee.role,
    };

    /*
     * ----------------------------------------------------------------------
     * 8. Update session activity.
     * ----------------------------------------------------------------------
     *
     * lastUsedAt is maintained server-side so active sessions have an
     * auditable last-use timestamp.
     *
     * Failure to update this non-critical audit field must not invalidate an
     * otherwise valid authenticated request.
     */
    try {
      await db.orm.public.UserSession
        .where({
          id: session.id,
          employeeId: employee.id,
          revokedAt: null,
        })
        .update({
          lastUsedAt: getCurrentTimestamp(),
        });
    } catch {
      /*
       * Authentication has already been successfully established.
       * lastUsedAt is operational metadata and should not cause an otherwise
       * valid request to fail.
       */
    }

    next();
  } catch (error) {
    next(error);
  }
}