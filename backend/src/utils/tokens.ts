import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

const JWT_ISSUER = "ziya-hr";
const JWT_AUDIENCE = "ziya-hr-web";

export interface AccessTokenPayload extends jwt.JwtPayload {
  sub: string;
  sid: string;
  type: "access";
}

export interface RefreshTokenPayload extends jwt.JwtPayload {
  sub: string;
  sid: string;
  type: "refresh";
}

function assertIdentifier(
  value: string,
  fieldName: string,
): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string.`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

function assertPositiveInteger(
  value: number,
  fieldName: string,
): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return value;
}

function assertTokenString(token: string): string {
  if (typeof token !== "string") {
    throw new Error("Token must be a string.");
  }

  const normalized = token.trim();

  if (!normalized) {
    throw new Error("Token is required.");
  }

  return normalized;
}

export function signAccessToken(
  employeeId: string,
  sessionId: string,
): string {
  const normalizedEmployeeId = assertIdentifier(
    employeeId,
    "employeeId",
  );

  const normalizedSessionId = assertIdentifier(
    sessionId,
    "sessionId",
  );

  return jwt.sign(
    {
      sub: normalizedEmployeeId,
      sid: normalizedSessionId,
      type: "access",
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: `${assertPositiveInteger(
        env.ACCESS_TOKEN_TTL_MINUTES,
        "ACCESS_TOKEN_TTL_MINUTES",
      )}m`,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithm: "HS256",
    },
  );
}

export function signRefreshToken(
  employeeId: string,
  sessionId: string,
  ttlDays = env.REFRESH_TOKEN_TTL_DAYS,
): string {
  const normalizedEmployeeId = assertIdentifier(
    employeeId,
    "employeeId",
  );

  const normalizedSessionId = assertIdentifier(
    sessionId,
    "sessionId",
  );

  if (!Number.isFinite(ttlDays) || ttlDays <= 0) {
    throw new Error("Refresh token lifetime must be positive.");
  }

  const ttlSeconds = Math.round(ttlDays * 24 * 60 * 60);

  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error("Refresh token lifetime is invalid.");
  }

  return jwt.sign(
    {
      sub: normalizedEmployeeId,
      sid: normalizedSessionId,
      type: "refresh",
    },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: ttlSeconds,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithm: "HS256",
    },
  );
}

export function verifyAccessToken(
  token: string,
): AccessTokenPayload {
  const normalizedToken = assertTokenString(token);

  const payload = jwt.verify(
    normalizedToken,
    env.JWT_ACCESS_SECRET,
    {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ["HS256"],
    },
  );

  if (
    typeof payload === "string" ||
    payload.type !== "access" ||
    typeof payload.sub !== "string" ||
    !payload.sub.trim() ||
    typeof payload.sid !== "string" ||
    !payload.sid.trim()
  ) {
    throw new Error("Invalid access token.");
  }

  return payload as AccessTokenPayload;
}

export function verifyRefreshToken(
  token: string,
): RefreshTokenPayload {
  const normalizedToken = assertTokenString(token);

  const payload = jwt.verify(
    normalizedToken,
    env.JWT_REFRESH_SECRET,
    {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ["HS256"],
    },
  );

  if (
    typeof payload === "string" ||
    payload.type !== "refresh" ||
    typeof payload.sub !== "string" ||
    !payload.sub.trim() ||
    typeof payload.sid !== "string" ||
    !payload.sid.trim()
  ) {
    throw new Error("Invalid refresh token.");
  }

  return payload as RefreshTokenPayload;
}