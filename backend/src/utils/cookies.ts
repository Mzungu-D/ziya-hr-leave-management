import type { Response } from "express";

import {
  env,
  isProduction
} from "../config/env.js";

export const ACCESS_COOKIE =
  "__Host-ziya_hr_access";

export const REFRESH_COOKIE =
  "__Host-ziya_hr_refresh";

export const DEVICE_COOKIE =
  "__Host-ziya_hr_device";

export const PENDING_AUTH_COOKIE =
  "__Host-ziya_hr_pending";

const baseCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: env.COOKIE_SAME_SITE,
  path: "/"
} as const;

export function setAccessCookie(
  res: Response,
  token: string
): void {
  res.cookie(
    ACCESS_COOKIE,
    token,
    {
      ...baseCookieOptions,
      maxAge:
        env.ACCESS_TOKEN_TTL_MINUTES *
        60 *
        1000
    }
  );
}

export function setRefreshCookie(
  res: Response,
  token: string,
  maxAgeMs: number
): void {
  res.cookie(
    REFRESH_COOKIE,
    token,
    {
      ...baseCookieOptions,
      maxAge: maxAgeMs
    }
  );
}

export function setDeviceCookie(
  res: Response,
  deviceId: string
): void {
  res.cookie(
    DEVICE_COOKIE,
    deviceId,
    {
      ...baseCookieOptions,
      maxAge:
        365 *
        24 *
        60 *
        60 *
        1000
    }
  );
}

export function setPendingAuthCookie(
  res: Response,
  verificationId: string
): void {
  res.cookie(
    PENDING_AUTH_COOKIE,
    verificationId,
    {
      ...baseCookieOptions,
      maxAge:
        env.OTP_TTL_MINUTES *
        60 *
        1000
    }
  );
}

export function clearSessionCookies(
  res: Response
): void {
  res.clearCookie(
    ACCESS_COOKIE,
    baseCookieOptions
  );

  res.clearCookie(
    REFRESH_COOKIE,
    baseCookieOptions
  );

  res.clearCookie(
    PENDING_AUTH_COOKIE,
    baseCookieOptions
  );
}

export function clearPendingAuthCookie(
  res: Response
): void {
  res.clearCookie(
    PENDING_AUTH_COOKIE,
    baseCookieOptions
  );
}