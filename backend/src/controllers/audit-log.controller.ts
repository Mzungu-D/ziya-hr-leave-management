
import type { Request, Response } from "express";

import { AppError } from "../middleware/error.middleware.js";
import { listAuditLogs } from "../services/audit-log.service.js";

/**
 * Ziya HR — Audit Log Controller
 *
 * Responsibilities:
 * - Validate HTTP query parameters.
 * - Read identity only from the authenticated server-side request.
 * - Delegate authorization and tenant-scoped retrieval to the service.
 * - Return a consistent, non-cacheable JSON response.
 *
 * Organization IDs are deliberately not accepted from request input.
 */

const MAX_ACTION_FILTER_LENGTH = 100;
const MAX_ENTITY_TYPE_FILTER_LENGTH = 100;
const MAX_ACTOR_ID_FILTER_LENGTH = 100;
const MAX_PAGE_SIZE = 100;

type QueryValue = unknown;

function badRequest(message: string, code: string): AppError {
  return new AppError(400, message, code);
}

function getAuthenticatedEmployeeId(req: Request): string {
  const employeeId = req.auth?.employeeId;

  if (
    typeof employeeId !== "string" ||
    employeeId.trim().length === 0
  ) {
    throw new AppError(
      401,
      "Authentication is required.",
      "AUTHENTICATION_REQUIRED",
    );
  }

  return employeeId;
}

function readOptionalString(
  value: QueryValue,
  field: string,
  maxLength: number,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  // Reject arrays, nested query objects, and other unexpected input.
  if (typeof value !== "string") {
    throw badRequest(
      `${field} must be a single text value.`,
      "INVALID_AUDIT_LOG_FILTER",
    );
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    return undefined;
  }

  if (normalized.length > maxLength) {
    throw badRequest(
      `${field} cannot exceed ${maxLength} characters.`,
      "INVALID_AUDIT_LOG_FILTER",
    );
  }

  return normalized;
}

function readPositiveInteger(
  value: QueryValue,
  field: string,
  maximum?: number,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "string" ||
    !/^[1-9]\d*$/.test(value)
  ) {
    throw badRequest(
      `${field} must be a positive integer.`,
      "INVALID_PAGINATION",
    );
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    throw badRequest(
      `${field} is outside the supported range.`,
      "INVALID_PAGINATION",
    );
  }

  if (maximum !== undefined && parsed > maximum) {
    throw badRequest(
      `${field} cannot exceed ${maximum}.`,
      "INVALID_PAGINATION",
    );
  }

  return parsed;
}

/**
 * GET /api/audit-logs
 *
 * Supported query parameters:
 * - page: positive integer, defaults to 1.
 * - pageSize: positive integer, defaults to 25, maximum 100.
 * - action: exact action filter.
 * - entityType: exact entity type filter.
 * - actorId: exact actor ID filter.
 *
 * Express 5 forwards rejected async controller promises to the
 * centralized error middleware.
 */
export async function listAuditLogsController(
  req: Request,
  res: Response,
): Promise<void> {
  const employeeId = getAuthenticatedEmployeeId(req);

  const page = readPositiveInteger(
    req.query.page,
    "Page",
  );

  const pageSize = readPositiveInteger(
    req.query.pageSize,
    "Page size",
    MAX_PAGE_SIZE,
  );

  const action = readOptionalString(
    req.query.action,
    "Action",
    MAX_ACTION_FILTER_LENGTH,
  );

  const entityType = readOptionalString(
    req.query.entityType,
    "Entity type",
    MAX_ENTITY_TYPE_FILTER_LENGTH,
  );

  const actorId = readOptionalString(
    req.query.actorId,
    "Actor ID",
    MAX_ACTOR_ID_FILTER_LENGTH,
  );

  const result = await listAuditLogs(employeeId, {
    page,
    pageSize,
    action,
    entityType,
    actorId,
  });

  res.setHeader("Cache-Control", "no-store");

  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination,
    filters: result.filters,
  });
}
