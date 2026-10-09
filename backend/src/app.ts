import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { env } from "./config/env.js";

import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import employeeRoutes from "./routes/employee.routes.js";
import leaveRoutes from "./routes/leave.routes.js";
import adminDashboardRoutes from "./routes/adminDashboard.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import policyRoutes from "./routes/policy.routes.js";
import holidayRoutes from "./routes/holiday.routes.js";
import systemSettingsRoutes from "./routes/systemSettings.routes.js";

import { csrfProtection } from "./middleware/csrf.middleware.js";

import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js";

const app = express();

/**
 * ==========================================================================
 * APPLICATION HARDENING
 * ==========================================================================
 */

app.disable("x-powered-by");

app.set("trust proxy", 1);

/**
 * ==========================================================================
 * SECURITY HEADERS
 * ==========================================================================
 */

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  }),
);

/**
 * ==========================================================================
 * CORS
 * ==========================================================================
 *
 * Authentication uses HTTP-only cookies, therefore credentials must be
 * explicitly enabled and the frontend origin must be explicitly trusted.
 */

app.use(
  cors({
    origin: env.APP_URL,
    credentials: true,
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-CSRF-Token",
    ],
  }),
);

/**
 * ==========================================================================
 * REQUEST PARSING
 * ==========================================================================
 */

app.use(
  express.json({
    limit: "1mb",
    strict: true,
  }),
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  }),
);

app.use(cookieParser());

/**
 * ==========================================================================
 * GLOBAL RESPONSE CACHING POLICY
 * ==========================================================================
 *
 * Leave-management data contains employee and HR information.
 *
 * Responses must not be cached by:
 * - browsers
 * - proxies
 * - intermediary infrastructure
 * - shared caches
 */

app.use((_req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store",
  );

  res.setHeader(
    "Pragma",
    "no-cache",
  );

  res.setHeader(
    "Expires",
    "0",
  );

  next();
});

/**
 * ==========================================================================
 * GLOBAL RATE LIMITING
 * ==========================================================================
 *
 * Baseline application-level protection.
 *
 * Sensitive routes may apply additional route-level protection.
 */

app.use(
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit: 300,

    standardHeaders: "draft-8",

    legacyHeaders: false,

    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        code: "RATE_LIMITED",
        message:
          "Too many requests. Please try again later.",
      });
    },
  }),
);

/**
 * ==========================================================================
 * CSRF PROTECTION
 * ==========================================================================
 *
 * Must run after cookie parsing because the CSRF middleware requires
 * access to request cookies.
 */

app.use(csrfProtection);

/**
 * ==========================================================================
 * SERVICE HEALTH / ROOT ENDPOINT
 * ==========================================================================
 */

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    service:
      "Ziya Leave Management API",
    status: "online",
  });
});

/**
 * ==========================================================================
 * API ROUTES
 * ==========================================================================
 */

app.use(
  "/api/health",
  healthRoutes,
);

app.use(
  "/api/auth",
  authRoutes,
);

/**
 * ==========================================================================
 * EMPLOYEE MANAGEMENT
 * ==========================================================================
 *
 * Employee management authorization is handled inside employee.routes.ts.
 *
 * Expected authorization:
 * - Authentication
 * - HR_ADMIN
 * - SUPER_ADMIN
 *
 * Organization scope is resolved server-side from the authenticated
 * employee and is never accepted from client input.
 */

app.use(
  "/api/employees",
  employeeRoutes,
);

/**
 * ==========================================================================
 * LEAVE MANAGEMENT
 * ==========================================================================
 *
 * Authentication and authorization are handled inside leave.routes.ts.
 *
 * Organization scope is resolved server-side from the authenticated
 * employee and is never accepted from client input.
 */

app.use(
  "/api/leave",
  leaveRoutes,
);

/**
 * ==========================================================================
 * POLICY MANAGEMENT
 * ==========================================================================
 *
 * Protected inside policy.routes.ts with:
 *
 * - Authentication
 * - HR_ADMIN
 * - SUPER_ADMIN
 *
 * Organization scope is derived server-side.
 *
 * Available endpoints:
 *
 * GET    /api/policies
 * GET    /api/policies/summary
 * GET    /api/policies/:policyId
 * POST   /api/policies
 * PATCH  /api/policies/:policyId
 * DELETE /api/policies/:policyId
 * POST   /api/policies/:policyId/publish
 * POST   /api/policies/:policyId/archive
 * POST   /api/policies/:policyId/restore
 */

app.use(
  "/api/policies",
  policyRoutes,
);

/**
 * ==========================================================================
 * HOLIDAY MANAGEMENT
 * ==========================================================================
 *
 * Protected inside holiday.routes.ts with:
 *
 * - Authentication
 * - HR_ADMIN
 * - SUPER_ADMIN
 *
 * Organization scope is derived server-side.
 *
 * Available endpoints:
 *
 * GET    /api/holidays
 * GET    /api/holidays/summary
 * GET    /api/holidays/:holidayId
 * POST   /api/holidays
 * PATCH  /api/holidays/:holidayId
 * DELETE /api/holidays/:holidayId
 * POST   /api/holidays/:holidayId/activate
 * POST   /api/holidays/:holidayId/deactivate
 */

app.use(
  "/api/holidays",
  holidayRoutes,
);

/**
 * ==========================================================================
 * REPORTS & ANALYTICS
 * ==========================================================================
 *
 * Protected inside reports.routes.ts with:
 *
 * - Authentication
 * - HR_ADMIN
 * - SUPER_ADMIN
 *
 * CRITICAL TENANT SECURITY:
 *
 * organizationId is NEVER accepted from:
 *
 * - query parameters
 * - route parameters
 * - request body
 * - custom headers
 * - frontend state
 *
 * The reports service resolves the organization exclusively from the
 * authenticated employee.
 *
 * Available endpoints:
 *
 * GET /api/admin/reports
 *
 * Optional:
 * /api/admin/reports?year=2026
 *
 * Custom date range:
 * /api/admin/reports?year=2026&from=2026-01-01&to=2026-12-31
 *
 * GET /api/admin/reports/range
 *
 * Required:
 * /api/admin/reports/range?from=2026-01-01&to=2026-06-30
 *
 * GET /api/admin/reports/annual/:year
 *
 * Example:
 * /api/admin/reports/annual/2026
 */

app.use(
  "/api/admin/reports",
  reportsRoutes,
);

/**
 * ==========================================================================
 * SYSTEM SETTINGS
 * ==========================================================================
 *
 * Protected inside systemSettings.routes.ts with:
 *
 * - Authentication
 * - HR_ADMIN
 * - SUPER_ADMIN
 *
 * CRITICAL TENANT SECURITY:
 *
 * organizationId is NEVER accepted from:
 *
 * - query parameters
 * - route parameters
 * - request body
 * - custom headers
 * - frontend state
 *
 * The System Settings service resolves the organization exclusively from
 * the authenticated employee.
 *
 * Available endpoints:
 *
 * GET    /api/admin/settings
 * GET    /api/admin/settings/definitions
 * GET    /api/admin/settings/:key
 * PUT    /api/admin/settings
 * PUT    /api/admin/settings/:key
 * DELETE /api/admin/settings/:key
 * DELETE /api/admin/settings
 */

app.use(
  "/api/admin/settings",
  systemSettingsRoutes,
);

/**
 * ==========================================================================
 * ADMIN DASHBOARD
 * ==========================================================================
 *
 * Dashboard access and role authorization are handled inside
 * adminDashboard.routes.ts.
 *
 * Available endpoint:
 *
 * GET /api/admin/dashboard
 */

app.use(
  "/api/admin",
  adminDashboardRoutes,
);

/**
 * ==========================================================================
 * 404 HANDLING
 * ==========================================================================
 *
 * Any route that has not been registered above reaches this middleware.
 */

app.use(
  notFoundHandler,
);

/**
 * ==========================================================================
 * CENTRALIZED ERROR HANDLING
 * ==========================================================================
 *
 * This must remain the final middleware in the application pipeline.
 */

app.use(
  errorHandler,
);

export default app;