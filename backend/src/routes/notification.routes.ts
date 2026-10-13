
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

import { db } from "../../prisma/db.js";
import { AppError } from "../middleware/error.middleware.js";
import { requireAuthentication } from "../middleware/auth.middleware.js";

const router = express.Router();

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_ID_LENGTH = 100;

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
 * Bounded connection pool for notification queries.
 *
 * Uses the same database URL as the application's existing database client.
 * Never log the URL or credentials.
 */
const notificationPool = new Pool({
  connectionString: databaseUrl,
  max: 5,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  application_name: "ziya-hr-notifications",
});

notificationPool.on("error", (error: Error) => {
  console.error("Notification database pool error:", error.message);
});

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string | null;
  readAt: Date | string | null;
  createdAt: Date | string;
}

interface ActiveEmployee {
  id: string;
  organizationId: string;
  status: string;
}

function invalidInput(message: string): AppError {
  return new AppError(
    400,
    message,
    "INVALID_NOTIFICATION_INPUT",
  );
}

function requiredAuthenticatedEmployeeId(req: Request): string {
  const employeeId = req.auth?.employeeId;

  if (
    typeof employeeId !== "string" ||
    employeeId.trim().length === 0
  ) {
    throw new AppError(
      401,
      "Authentication required.",
      "AUTHENTICATION_REQUIRED",
    );
  }

  return employeeId;
}

async function getActiveEmployee(
  employeeId: string,
): Promise<ActiveEmployee> {
  const employee = await db.orm.public.Employee
    .where({ id: employeeId })
    .first();

  if (!employee || employee.status !== "ACTIVE") {
    throw new AppError(
      401,
      "Your account is no longer active.",
      "ACCOUNT_INACTIVE",
    );
  }

  return {
    id: employee.id,
    organizationId: employee.organizationId,
    status: employee.status,
  };
}

function parsePositiveInteger(
  value: unknown,
  field: string,
  fallback: number,
  maximum: number,
): number {
  if (value === undefined) {
    return fallback;
  }

  if (
    typeof value !== "string" ||
    !/^[1-9]\d*$/.test(value)
  ) {
    throw invalidInput(`${field} must be a positive integer.`);
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    throw invalidInput(
      `${field} cannot exceed ${maximum}.`,
    );
  }

  return parsed;
}

function parseNotificationId(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > MAX_ID_LENGTH
  ) {
    throw invalidInput("The notification ID is invalid.");
  }

  return value.trim();
}

function toIsoDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw new AppError(
      500,
      "A notification contains an invalid timestamp.",
      "INVALID_NOTIFICATION_TIMESTAMP",
    );
  }

  return date.toISOString();
}

function serializeNotification(row: NotificationRow) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    href: row.href,
    readAt: row.readAt === null ? null : toIsoDate(row.readAt),
    createdAt: toIsoDate(row.createdAt),
    isRead: row.readAt !== null,
  };
}

function asyncHandler(
  handler: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => Promise<void>,
) {
  return (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    void handler(req, res, next).catch(next);
  };
}

/**
 * GET /api/notifications
 *
 * Returns only notifications belonging to the authenticated employee and
 * their organization. Organization and recipient IDs are never accepted
 * from client input.
 *
 * Query:
 *   page     Optional positive integer, defaults to 1.
 *   pageSize Optional positive integer, defaults to 20; maximum 100.
 *   unread   Optional "true" or "false".
 */
router.get(
  "/",
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const employeeId = requiredAuthenticatedEmployeeId(req);
    const employee = await getActiveEmployee(employeeId);

    const page = parsePositiveInteger(
      req.query.page,
      "Page",
      DEFAULT_PAGE,
      Number.MAX_SAFE_INTEGER,
    );

    const pageSize = parsePositiveInteger(
      req.query.pageSize,
      "Page size",
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
    );

    const unreadFilter = req.query.unread;

    if (
      unreadFilter !== undefined &&
      unreadFilter !== "true" &&
      unreadFilter !== "false"
    ) {
      throw invalidInput(
        'The unread filter must be "true" or "false".',
      );
    }

    const offset = (page - 1) * pageSize;

    if (!Number.isSafeInteger(offset)) {
      throw invalidInput("The requested page is out of range.");
    }

    const values: unknown[] = [
      employee.organizationId,
      employee.id,
    ];

    let filterSql = "";

    if (unreadFilter === "true") {
      filterSql = ' AND "readAt" IS NULL';
    } else if (unreadFilter === "false") {
      filterSql = ' AND "readAt" IS NOT NULL';
    }

    const countResult = await notificationPool.query<{
      total: string;
    }>(
      `
        SELECT COUNT(*)::text AS total
        FROM public."Notification"
        WHERE "organizationId" = $1
          AND "recipientId" = $2
          ${filterSql}
      `,
      values,
    );

    const total = Number(countResult.rows[0]?.total ?? "0");

    const result = await notificationPool.query<NotificationRow>(
      `
        SELECT
          "id",
          "type",
          "title",
          "message",
          "href",
          "readAt",
          "createdAt"
        FROM public."Notification"
        WHERE "organizationId" = $1
          AND "recipientId" = $2
          ${filterSql}
        ORDER BY "createdAt" DESC, "id" DESC
        LIMIT $3
        OFFSET $4
      `,
      [...values, pageSize, offset],
    );

    const unreadResult = await notificationPool.query<{
      count: string;
    }>(
      `
        SELECT COUNT(*)::text AS count
        FROM public."Notification"
        WHERE "organizationId" = $1
          AND "recipientId" = $2
          AND "readAt" IS NULL
      `,
      [employee.organizationId, employee.id],
    );

    const unreadCount = Number(
      unreadResult.rows[0]?.count ?? "0",
    );

    res.status(200).json({
      success: true,
      data: result.rows.map(serializeNotification),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasMore: offset + result.rows.length < total,
      },
      unreadCount,
    });
  }),
);

/**
 * GET /api/notifications/unread-count
 *
 * Returns the authenticated employee's current unread notification count.
 */
router.get(
  "/unread-count",
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const employeeId = requiredAuthenticatedEmployeeId(req);
    const employee = await getActiveEmployee(employeeId);

    const result = await notificationPool.query<{
      count: string;
    }>(
      `
        SELECT COUNT(*)::text AS count
        FROM public."Notification"
        WHERE "organizationId" = $1
          AND "recipientId" = $2
          AND "readAt" IS NULL
      `,
      [employee.organizationId, employee.id],
    );

    res.status(200).json({
      success: true,
      unreadCount: Number(result.rows[0]?.count ?? "0"),
    });
  }),
);

/**
 * PATCH /api/notifications/read-all
 *
 * Marks all unread notifications belonging to the authenticated employee
 * in their organization as read.
 */
router.patch(
  "/read-all",
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const employeeId = requiredAuthenticatedEmployeeId(req);
    const employee = await getActiveEmployee(employeeId);
    const readAt = new Date().toISOString();

    const result = await notificationPool.query(
      `
        UPDATE public."Notification"
        SET "readAt" = $3
        WHERE "organizationId" = $1
          AND "recipientId" = $2
          AND "readAt" IS NULL
      `,
      [employee.organizationId, employee.id, readAt],
    );

    res.status(200).json({
      success: true,
      message: "Notifications marked as read.",
      updatedCount: result.rowCount ?? 0,
      readAt,
    });
  }),
);

/**
 * PATCH /api/notifications/:notificationId/read
 *
 * Marks a single notification as read. Ownership and organization are part
 * of the UPDATE predicate to prevent cross-employee and cross-tenant access.
 */
router.patch(
  "/:notificationId/read",
  requireAuthentication,
  asyncHandler(async (req, res) => {
    const employeeId = requiredAuthenticatedEmployeeId(req);
    const employee = await getActiveEmployee(employeeId);
    const notificationId = parseNotificationId(
      req.params.notificationId,
    );

    const readAt = new Date().toISOString();

    const result = await notificationPool.query<NotificationRow>(
      `
        UPDATE public."Notification"
        SET "readAt" = COALESCE("readAt", $4)
        WHERE "id" = $1
          AND "organizationId" = $2
          AND "recipientId" = $3
        RETURNING
          "id",
          "type",
          "title",
          "message",
          "href",
          "readAt",
          "createdAt"
      `,
      [
        notificationId,
        employee.organizationId,
        employee.id,
        readAt,
      ],
    );

    const notification = result.rows[0];

    if (!notification) {
      throw new AppError(
        404,
        "Notification not found.",
        "NOTIFICATION_NOT_FOUND",
      );
    }

    res.status(200).json({
      success: true,
      data: serializeNotification(notification),
    });
  }),
);

export default router;
