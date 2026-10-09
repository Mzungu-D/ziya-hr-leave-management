import type { Request, Response } from "express";

import { AppError } from "../middleware/error.middleware.js";
import {
  getAnnualReports,
  getReportsAnalytics,
  getReportsForDateRange,
} from "../services/reports.service.js";

/* ==========================================================================
   ZIYA HR — REPORTS & ANALYTICS CONTROLLER

   Production requirements:
   - Authentication identity comes only from req.auth
   - organizationId is never accepted from the client
   - Tenant is resolved by the reports service
   - HR_ADMIN / SUPER_ADMIN authorization is enforced by the service
   - No sensitive HR report caching
   - Centralized Express error middleware handles service errors
   ========================================================================== */

/* --------------------------------------------------------------------------
   Constants
   -------------------------------------------------------------------------- */

const REPORT_CACHE_CONTROL =
  "private, no-store, no-cache, must-revalidate, proxy-revalidate";

const REPORT_PRAGMA = "no-cache";

/* --------------------------------------------------------------------------
   Request helpers
   -------------------------------------------------------------------------- */

function getAuthenticatedEmployeeId(
  req: Request,
): string {
  if (!req.auth) {
    throw new AppError(
      401,
      "Authentication required.",
      "AUTHENTICATION_REQUIRED",
    );
  }

  const employeeId =
    typeof req.auth.employeeId === "string"
      ? req.auth.employeeId.trim()
      : "";

  if (!employeeId) {
    throw new AppError(
      401,
      "Authenticated employee identity is missing.",
      "AUTHENTICATED_EMPLOYEE_ID_MISSING",
    );
  }

  return employeeId;
}

function parseOptionalYear(
  value: unknown,
): number | undefined {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    throw new AppError(
      400,
      "Report year must be a valid number.",
      "INVALID_REPORT_YEAR",
    );
  }

  const raw =
    String(value).trim();

  if (!/^\d{4}$/.test(raw)) {
    throw new AppError(
      400,
      "Report year must be a four-digit year.",
      "INVALID_REPORT_YEAR",
    );
  }

  const year =
    Number(raw);

  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2100
  ) {
    throw new AppError(
      400,
      "Report year must be between 2000 and 2100.",
      "INVALID_REPORT_YEAR",
    );
  }

  return year;
}

function parseOptionalDate(
  value: unknown,
  fieldName: string,
): string | undefined {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new AppError(
      400,
      `${fieldName} must be a valid ISO date.`,
      "INVALID_REPORT_DATE",
    );
  }

  const normalized =
    value.trim();

  if (!normalized) {
    return undefined;
  }

  const parsed =
    new Date(normalized);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    throw new AppError(
      400,
      `${fieldName} must be a valid ISO date.`,
      "INVALID_REPORT_DATE",
    );
  }

  return normalized;
}

/* --------------------------------------------------------------------------
   Report response headers
   -------------------------------------------------------------------------- */

function applyReportHeaders(
  res: Response,
): void {
  /*
   * HR reports contain tenant-specific employee and leave information.
   * Never allow browser, proxy, or intermediary caching.
   */
  res.setHeader(
    "Cache-Control",
    REPORT_CACHE_CONTROL,
  );

  res.setHeader(
    "Pragma",
    REPORT_PRAGMA,
  );

  res.setHeader(
    "Expires",
    "0",
  );

  /*
   * Authentication is session/cookie based. Explicitly vary responses
   * by authentication context.
   */
  res.setHeader(
    "Vary",
    "Cookie, Authorization",
  );
}

/* --------------------------------------------------------------------------
   GET /api/admin/reports
   -------------------------------------------------------------------------- */

/**
 * Returns the complete HR reports and analytics dataset.
 *
 * Supported query parameters:
 *
 * ?year=2026
 *
 * or:
 *
 * ?year=2026&from=2026-01-01&to=2026-12-31
 *
 * organizationId is deliberately NOT accepted.
 *
 * The authenticated employee determines the organization.
 */
export async function getReportsController(
  req: Request,
  res: Response,
): Promise<void> {
  const employeeId =
    getAuthenticatedEmployeeId(req);

  const year =
    parseOptionalYear(
      req.query.year,
    );

  const from =
    parseOptionalDate(
      req.query.from,
      "from",
    );

  const to =
    parseOptionalDate(
      req.query.to,
      "to",
    );

  /*
   * A date range requires both boundaries.
   */
  if (
    (from && !to) ||
    (!from && to)
  ) {
    throw new AppError(
      400,
      "Both from and to dates are required when using a custom date range.",
      "INCOMPLETE_REPORT_DATE_RANGE",
    );
  }

  applyReportHeaders(res);

  const reports =
    await getReportsAnalytics(
      employeeId,
      {
        year,
        from,
        to,
      },
    );

  res.status(200).json({
    success: true,
    data: reports,
  });
}

/* --------------------------------------------------------------------------
   GET /api/admin/reports/annual/:year
   -------------------------------------------------------------------------- */

/**
 * Returns reports for a specific calendar year.
 *
 * The year comes from the route parameter.
 *
 * Tenant context still comes exclusively from req.auth.
 */
export async function getAnnualReportsController(
  req: Request,
  res: Response,
): Promise<void> {
  const employeeId =
    getAuthenticatedEmployeeId(req);

  const year =
    parseOptionalYear(
      req.params.year,
    );

  if (year === undefined) {
    throw new AppError(
      400,
      "A report year is required.",
      "REPORT_YEAR_REQUIRED",
    );
  }

  applyReportHeaders(res);

  const reports =
    await getAnnualReports(
      employeeId,
      year,
    );

  res.status(200).json({
    success: true,
    data: reports,
  });
}

/* --------------------------------------------------------------------------
   GET /api/admin/reports/range
   -------------------------------------------------------------------------- */

/**
 * Returns reports for an explicit date range.
 *
 * Required:
 *
 * ?from=2026-01-01&to=2026-06-30
 *
 * organizationId is never accepted from the client.
 */
export async function getReportsForDateRangeController(
  req: Request,
  res: Response,
): Promise<void> {
  const employeeId =
    getAuthenticatedEmployeeId(req);

  const from =
    parseOptionalDate(
      req.query.from,
      "from",
    );

  const to =
    parseOptionalDate(
      req.query.to,
      "to",
    );

  if (!from || !to) {
    throw new AppError(
      400,
      "Both from and to dates are required.",
      "REPORT_DATE_RANGE_REQUIRED",
    );
  }

  applyReportHeaders(res);

  const reports =
    await getReportsForDateRange(
      employeeId,
      from,
      to,
    );

  res.status(200).json({
    success: true,
    data: reports,
  });
}