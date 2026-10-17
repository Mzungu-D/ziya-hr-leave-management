import express, {
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { env } from "./config/env.js";

import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import employeeRoutes from "./routes/employee.routes.js";
import departmentRoutes from "./routes/department.routes.js";
import leaveRoutes from "./routes/leave.routes.js";
import leaveTypeRoutes from "./routes/leave-type.routes.js";
import adminDashboardRoutes from "./routes/adminDashboard.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import policyRoutes from "./routes/policy.routes.js";
import holidayRoutes from "./routes/holiday.routes.js";
import systemSettingsRoutes from "./routes/systemSettings.routes.js";
import auditLogRoutes from "./routes/audit-log.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import onboardingRoutes from "./routes/onboarding.routes.js";

import { csrfProtection } from "./middleware/csrf.middleware.js";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js";

const app = express();

/**
 * ============================================================================
 * APPLICATION CONFIGURATION
 * ============================================================================
 */

app.disable("x-powered-by");

/**
 * Railway reverse-proxy configuration.
 * Review this if the production network topology changes.
 */
app.set("trust proxy", 1);

/**
 * ============================================================================
 * SECURITY HEADERS
 * ============================================================================
 */

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  }),
);

/**
 * ============================================================================
 * CORS
 * ============================================================================
 *
 * APP_URL must contain the exact permitted frontend origin.
 * Do not use "*" when credentials are enabled.
 */

app.use(
  cors({
    origin: env.APP_URL,
    credentials: true,
    methods: [
      "GET",
      "HEAD",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
    allowedHeaders: [
      "Accept",
      "Authorization",
      "Cache-Control",
      "Content-Type",
      "X-CSRF-Token",
      "X-Requested-With",
    ],
    optionsSuccessStatus: 204,
  }),
);

/**
 * ============================================================================
 * REQUEST PARSING
 * ============================================================================
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
 * ============================================================================
 * REQUEST PARSING ERROR HANDLING
 * ============================================================================
 *
 * Register after the parsers and before application routes.
 * Malformed JSON and oversized payloads receive safe, consistent responses.
 */

const requestParsingErrorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  next,
) => {
  if (
    error instanceof SyntaxError &&
    "body" in error
  ) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "The request body contains invalid JSON.",
      },
    });
    return;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.too.large"
  ) {
    res.status(413).json({
      success: false,
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "The request payload exceeds the allowed size.",
      },
    });
    return;
  }

  next(error);
};

app.use(requestParsingErrorHandler);

/**
 * ============================================================================
 * RESPONSE CACHE POLICY
 * ============================================================================
 *
 * Avoid browser and intermediary caching of authenticated HR information.
 */

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  next();
});

/**
 * ============================================================================
 * GLOBAL RATE LIMITING
 * ============================================================================
 *
 * This is a general API limit. Authentication and OTP endpoints should also
 * have appropriately stricter limits in their own routes.
 *
 * A shared store is required if rate limits must be consistent across
 * multiple application instances.
 */

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please try again later.",
        },
      });
    },
  }),
);

/**
 * ============================================================================
 * CSRF PROTECTION
 * ============================================================================
 *
 * Cookie parsing runs before CSRF protection.
 * The existing middleware must allow safe methods and the intended CSRF
 * token/bootstrap flow while protecting state-changing cookie-authenticated
 * requests.
 */

app.use(csrfProtection);

/**
 * ============================================================================
 * ROOT ENDPOINT
 * ============================================================================
 */

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    service: "Ziya Leave Management API",
    status: "online",
  });
});

/**
 * ============================================================================
 * HEALTH
 * ============================================================================
 */

app.use("/api/health", healthRoutes);

/**
 * ============================================================================
 * AUTHENTICATION
 * ============================================================================
 */

app.use("/api/auth", authRoutes);

/**
 * ============================================================================
 * EMPLOYEE MANAGEMENT
 * ============================================================================
 *
 * The employee router and service must enforce authentication, authorization,
 * and server-derived organization scope.
 */

app.use("/api/employees", employeeRoutes);
app.use("/api/departments", departmentRoutes);

/**
 * ============================================================================
 * LEAVE MANAGEMENT
 * ============================================================================
 *
 * Leave eligibility, balances, request validation, and approval transitions
 * must be enforced in the route/controller/service layers.
 */

app.use("/api/leave-types", leaveTypeRoutes);
app.use("/api/leave", leaveRoutes);

/**
 * ============================================================================
 * LEAVE POLICIES
 * ============================================================================
 */

app.use("/api/policies", policyRoutes);

/**
 * ============================================================================
 * HOLIDAYS
 * ============================================================================
 */

app.use("/api/holidays", holidayRoutes);

/**
 * ============================================================================
 * ADMIN REPORTS
 * ============================================================================
 *
 * Existing prefix: /api/admin/reports
 *
 * Reports must be scoped to the organization associated with the authenticated
 * employee, not an organization ID supplied by the client.
 */

app.use("/api/admin/reports", reportsRoutes);

/**
 * ============================================================================
 * SYSTEM SETTINGS
 * ============================================================================
 *
 * Existing prefix: /api/admin/settings
 *
 * Organization-specific settings must remain tenant-scoped.
 */

app.use("/api/admin/settings", systemSettingsRoutes);

/**
 * ============================================================================
 * ADMIN DASHBOARD
 * ============================================================================
 *
 * Existing prefix: /api/admin
 *
 * The dashboard router is responsible for endpoint-level authorization.
 */

app.use("/api/admin", adminDashboardRoutes);

/**
 * ============================================================================
 * AUDIT LOGS
 * ============================================================================
 *
 * Endpoint: GET /api/audit-logs
 *
 * The audit-log router must require authentication and restrict listing to
 * HR_ADMIN and SUPER_ADMIN. The service must derive the organization from
 * the authenticated employee record and must not trust a client-supplied
 * organization ID.
 */

app.use("/api/audit-logs", auditLogRoutes);

/**
 * ============================================================================
 * NOTIFICATIONS
 * ============================================================================
 *
 * Notifications must be authenticated and scoped to the organization and
 * recipient resolved by the server. The route must never trust a client-
 * supplied organization ID or recipient ID.
 */

app.use("/api/notifications", notificationRoutes);

/**
 * ============================================================================
 * EMPLOYEE ONBOARDING
 * ============================================================================
 *
 * Existing prefix: /api/onboarding
 *
 * The onboarding router must enforce authentication, employee ownership,
 * HR-only operations, and organization scope derived from the authenticated
 * employee's database record.
 *
 * Register before notFoundHandler so onboarding requests reach this router.
 */

app.use("/api/onboarding", onboardingRoutes);

/**
 * ============================================================================
 * NOT FOUND
 * ============================================================================
 *
 * This must follow all registered application routes.
 */

app.use(notFoundHandler);

/**
 * ============================================================================
 * CENTRALIZED ERROR HANDLING
 * ============================================================================
 *
 * This must be the final middleware.
 */

app.use(errorHandler);

export default app;