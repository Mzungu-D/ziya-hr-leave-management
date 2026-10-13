import { randomUUID } from "node:crypto";
import { Pool } from "pg";

import { db } from "../../prisma/db.js";
import { AppError } from "../middleware/error.middleware.js";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_METADATA_BYTES = 50_000;

const MAX_ACTION_LENGTH = 100;
const MAX_ENTITY_TYPE_LENGTH = 100;
const MAX_ENTITY_ID_LENGTH = 200;
const MAX_SUMMARY_LENGTH = 1000;
const MAX_USER_AGENT_LENGTH = 1000;
const MAX_IP_ADDRESS_LENGTH = 100;

const databaseUrl = process.env["DATABASE_URL"]?.trim();

if (!databaseUrl) {
  throw new Error("DATABASE_URL must be configured.");
}

let parsedDatabaseUrl: URL;

try {
  parsedDatabaseUrl = new URL(databaseUrl);
} catch {
  throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
}

if (
  parsedDatabaseUrl.protocol !== "postgres:" &&
  parsedDatabaseUrl.protocol !== "postgresql:"
) {
  throw new Error("DATABASE_URL must use PostgreSQL.");
}

/**
 * Dedicated, bounded connection pool for audit-log SQL.
 * Uses the application's configured PostgreSQL connection.
 */
const auditPool = new Pool({
  connectionString: databaseUrl,
  max: 5,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  application_name: "ziya-hr-audit-logs",
});

auditPool.on("error", (error: Error) => {
  // Do not log database URLs, credentials, or audit metadata.
  console.error("Audit-log database pool error:", error.message);
});

export interface CreateAuditLogInput {
  employeeId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditLogFilters {
  action?: string;
  entityType?: string;
  actorId?: string;
  page?: number;
  pageSize?: number;
}

interface ActiveEmployee {
  id: string;
  organizationId: string;
  status: string;
  role: string;
}

interface AuditLogRow {
  id: string;
  organizationId: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string | Date;
}

interface AuditLogListRow extends AuditLogRow {
  actorFirstName: string | null;
  actorLastName: string | null;
  actorEmail: string | null;
}

function invalidInput(message: string): AppError {
  return new AppError(400, message, "INVALID_AUDIT_LOG_INPUT");
}

function requiredText(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throw invalidInput(`${field} must be text.`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw invalidInput(`${field} is required.`);
  }

  if (normalized.length > maxLength) {
    throw invalidInput(
      `${field} cannot exceed ${maxLength} characters.`,
    );
  }

  return normalized;
}

function optionalText(
  value: unknown,
  field: string,
  maxLength: number,
): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    throw invalidInput(`${field} must be text.`);
  }

  if (value.trim() === "") {
    return null;
  }

  return requiredText(value, field, maxLength);
}

function validateFilters(
  filters: AuditLogFilters,
): AuditLogFilters {
  if (
    filters === null ||
    typeof filters !== "object" ||
    Array.isArray(filters)
  ) {
    throw invalidInput("Audit-log filters must be an object.");
  }

  return filters;
}

function validatePagination(filters: AuditLogFilters) {
  const page = filters.page ?? DEFAULT_PAGE;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;

  if (!Number.isSafeInteger(page) || page < 1) {
    throw new AppError(
      400,
      "Page must be a positive integer.",
      "INVALID_PAGINATION",
    );
  }

  if (
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > MAX_PAGE_SIZE
  ) {
    throw new AppError(
      400,
      `Page size must be between 1 and ${MAX_PAGE_SIZE}.`,
      "INVALID_PAGINATION",
    );
  }

  const offset = (page - 1) * pageSize;

  if (!Number.isSafeInteger(offset)) {
    throw new AppError(
      400,
      "The requested page is too large.",
      "INVALID_PAGINATION",
    );
  }

  return { page, pageSize, offset };
}

async function getActiveEmployee(
  employeeId: string,
): Promise<ActiveEmployee> {
  const id = requiredText(employeeId, "Employee ID", 100);

  const employee = await db.orm.public.Employee
    .where({ id })
    .first();

  if (!employee || employee.status !== "ACTIVE") {
    throw new AppError(
      401,
      "Your account is not authorized to perform this action.",
      "AUDIT_ACTOR_INVALID",
    );
  }

  return employee as ActiveEmployee;
}

function validateMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (metadata == null) {
    return null;
  }

  if (
    typeof metadata !== "object" ||
    Array.isArray(metadata)
  ) {
    throw new AppError(
      400,
      "Metadata must be a JSON object or null.",
      "INVALID_AUDIT_METADATA",
    );
  }

  try {
    const serialized = JSON.stringify(metadata);

    if (
      typeof serialized !== "string" ||
      Buffer.byteLength(serialized, "utf8") > MAX_METADATA_BYTES
    ) {
      throw new Error("Metadata exceeds the size limit.");
    }

    return JSON.parse(serialized) as Record<string, unknown>;
  } catch {
    throw new AppError(
      400,
      "Metadata must be valid JSON and no larger than 50 KB.",
      "INVALID_AUDIT_METADATA",
    );
  }
}

function normalizeAction(value: unknown): string {
  return requiredText(
    value,
    "Action",
    MAX_ACTION_LENGTH,
  ).toUpperCase();
}

/**
 * Creates an audit event for an active employee.
 *
 * Organization ownership is resolved from the Employee table.
 * The client cannot choose the organization for the audit record.
 */
export async function createAuditLog(
  input: CreateAuditLogInput,
): Promise<AuditLogRow> {
  if (
    input === null ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw invalidInput("Audit-log input is required.");
  }

  const employee = await getActiveEmployee(input.employeeId);

  const action = normalizeAction(input.action);

  const entityType = requiredText(
    input.entityType,
    "Entity type",
    MAX_ENTITY_TYPE_LENGTH,
  );

  const summary = requiredText(
    input.summary,
    "Summary",
    MAX_SUMMARY_LENGTH,
  );

  const entityId = optionalText(
    input.entityId,
    "Entity ID",
    MAX_ENTITY_ID_LENGTH,
  );

  const ipAddress = optionalText(
    input.ipAddress,
    "IP address",
    MAX_IP_ADDRESS_LENGTH,
  );

  const userAgent = optionalText(
    input.userAgent,
    "User agent",
    MAX_USER_AGENT_LENGTH,
  );

  const metadata = validateMetadata(input.metadata);
  const id = randomUUID();

  const result = await auditPool.query<AuditLogRow>(
    `
      INSERT INTO "public"."AuditLog" (
        "id",
        "organizationId",
        "actorId",
        "action",
        "entityType",
        "entityId",
        "summary",
        "metadata",
        "ipAddress",
        "userAgent"
      )
      SELECT
        $1,
        e."organizationId",
        e."id",
        $3,
        $4,
        $5,
        $6,
        $7::jsonb,
        $8,
        $9
      FROM "public"."Employee" AS e
      WHERE e."id" = $2
        AND e."organizationId" = $10
        AND e."status" = 'ACTIVE'
      RETURNING
        "id",
        "organizationId",
        "actorId",
        "action",
        "entityType",
        "entityId",
        "summary",
        "metadata",
        "ipAddress",
        "userAgent",
        "createdAt"
    `,
    [
      id,
      employee.id,
      action,
      entityType,
      entityId,
      summary,
      metadata === null ? null : JSON.stringify(metadata),
      ipAddress,
      userAgent,
      employee.organizationId,
    ],
  );

  if (result.rowCount !== 1 || !result.rows[0]) {
    throw new AppError(
      401,
      "The audit actor is no longer active or authorized.",
      "AUDIT_ACTOR_INVALID",
    );
  }

  return result.rows[0];
}

/**
 * Lists audit events belonging exclusively to the active employee's
 * organization. Viewing logs requires HR_ADMIN or SUPER_ADMIN.
 */
export async function listAuditLogs(
  employeeId: string,
  filters: AuditLogFilters = {},
) {
  const employee = await getActiveEmployee(employeeId);

  if (
    employee.role !== "HR_ADMIN" &&
    employee.role !== "SUPER_ADMIN"
  ) {
    throw new AppError(
      403,
      "You do not have permission to view audit logs.",
      "AUDIT_LOG_ACCESS_DENIED",
    );
  }

  validateFilters(filters);

  const { page, pageSize, offset } =
    validatePagination(filters);

  const conditions: string[] = [
    'a."organizationId" = $1',
  ];

  const values: Array<string | number> = [
    employee.organizationId,
  ];

  function addFilter(
    column: "action" | "entityType" | "actorId",
    value: unknown,
    field: string,
    maxLength: number,
    uppercase = false,
  ): void {
    if (value === undefined || value === null) {
      return;
    }

    if (typeof value !== "string") {
      throw invalidInput(`${field} must be text.`);
    }

    if (value.trim() === "") {
      return;
    }

    let normalized = requiredText(value, field, maxLength);

    if (uppercase) {
      normalized = normalized.toUpperCase();
    }

    values.push(normalized);

    // Column names come exclusively from this fixed allowlist.
    conditions.push(`a."${column}" = $${values.length}`);
  }

  addFilter(
    "action",
    filters.action,
    "Action filter",
    MAX_ACTION_LENGTH,
    true,
  );

  addFilter(
    "entityType",
    filters.entityType,
    "Entity type filter",
    MAX_ENTITY_TYPE_LENGTH,
  );

  addFilter(
    "actorId",
    filters.actorId,
    "Actor ID filter",
    100,
  );

  const whereSql = conditions.join(" AND ");

  const countResult = await auditPool.query<{ total: string }>(
    `
      SELECT COUNT(*)::text AS "total"
      FROM "public"."AuditLog" AS a
      WHERE ${whereSql}
    `,
    values,
  );

  const total = Number(countResult.rows[0]?.total ?? "0");

  if (!Number.isSafeInteger(total) || total < 0) {
    throw new Error("The audit-log count returned an invalid value.");
  }

  const dataValues: Array<string | number> = [
    ...values,
    pageSize,
    offset,
  ];

  const limitParameter = dataValues.length - 1;
  const offsetParameter = dataValues.length;

  const dataResult = await auditPool.query<AuditLogListRow>(
    `
      SELECT
        a."id",
        a."organizationId",
        a."actorId",
        a."action",
        a."entityType",
        a."entityId",
        a."summary",
        a."metadata",
        a."ipAddress",
        a."userAgent",
        a."createdAt",
        e."firstName" AS "actorFirstName",
        e."lastName" AS "actorLastName",
        e."email" AS "actorEmail"
      FROM "public"."AuditLog" AS a
      LEFT JOIN "public"."Employee" AS e
        ON e."id" = a."actorId"
       AND e."organizationId" = a."organizationId"
      WHERE ${whereSql}
      ORDER BY a."createdAt" DESC, a."id" DESC
      LIMIT $${limitParameter}
      OFFSET $${offsetParameter}
    `,
    dataValues,
  );

  return {
    data: dataResult.rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasMore: offset + dataResult.rows.length < total,
    },
    filters: {
      action: filters.action ?? null,
      entityType: filters.entityType ?? null,
      actorId: filters.actorId ?? null,
    },
  };
}

/**
 * Allows graceful shutdown to release this service's database connections.
 * Call from the application's existing shutdown handler if one exists.
 */
export async function closeAuditLogPool(): Promise<void> {
  await auditPool.end();
}