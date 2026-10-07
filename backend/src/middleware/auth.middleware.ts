import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { AppError } from "./error.middleware.js";
import { ACCESS_COOKIE } from "../utils/cookies.js";
import { verifyAccessToken } from "../utils/tokens.js";
import { db } from "../../prisma/db.js";

export async function requireAuthentication(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const accessToken =
      req.cookies?.[ACCESS_COOKIE];

    if (
      typeof accessToken !== "string" ||
      accessToken.length === 0
    ) {
      throw new AppError(
        401,
        "Authentication required.",
        "AUTHENTICATION_REQUIRED",
      );
    }

    let payload;

    try {
      payload =
        verifyAccessToken(accessToken);
    } catch {
      throw new AppError(
        401,
        "Your authentication session is invalid or expired.",
        "AUTHENTICATION_INVALID",
      );
    }

    const session =
      await db.orm.public.UserSession
        .where({
          id: payload.sid,
          employeeId: payload.sub,
          revokedAt: null,
        })
        .first();

    if (!session) {
      throw new AppError(
        401,
        "Your authentication session is no longer valid.",
        "SESSION_INVALID",
      );
    }

    const now = Date.now();

    const sessionExpiresAt =
      new Date(session.expiresAt).getTime();

    if (
      !Number.isFinite(sessionExpiresAt) ||
      sessionExpiresAt <= now
    ) {
      const revokedAt =
        new Date(now).toISOString();

      await db.orm.public.UserSession
        .where({
          id: session.id,
          revokedAt: null,
        })
        .update({
          revokedAt,
          lastUsedAt: revokedAt,
        });

      throw new AppError(
        401,
        "Your authentication session has expired.",
        "SESSION_EXPIRED",
      );
    }

    const employee =
      await db.orm.public.Employee
        .where({
          id: payload.sub,
        })
        .first();

    if (!employee) {
      const revokedAt =
        new Date(now).toISOString();

      await db.orm.public.UserSession
        .where({
          id: session.id,
          revokedAt: null,
        })
        .update({
          revokedAt,
          lastUsedAt: revokedAt,
        });

      throw new AppError(
        401,
        "Your authentication session is no longer valid.",
        "ACCOUNT_NOT_FOUND",
      );
    }

    if (employee.status !== "ACTIVE") {
      const revokedAt =
        new Date(now).toISOString();

      await db.orm.public.UserSession
        .where({
          id: session.id,
          revokedAt: null,
        })
        .update({
          revokedAt,
          lastUsedAt: revokedAt,
        });

      throw new AppError(
        401,
        "Your account is no longer active.",
        "ACCOUNT_INACTIVE",
      );
    }

    req.auth = {
      employeeId: employee.id,
      sessionId: session.id,
      role: employee.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}