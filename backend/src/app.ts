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

import { csrfProtection } from "./middleware/csrf.middleware.js";

import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js";

const app = express();

/**
 * --------------------------------------------------------------------------
 * Application hardening
 * --------------------------------------------------------------------------
 */

app.disable("x-powered-by");

app.set("trust proxy", 1);

/**
 * --------------------------------------------------------------------------
 * Security headers
 * --------------------------------------------------------------------------
 */

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  }),
);

/**
 * --------------------------------------------------------------------------
 * CORS
 * --------------------------------------------------------------------------
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
 * --------------------------------------------------------------------------
 * Request parsing
 * --------------------------------------------------------------------------
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
 * --------------------------------------------------------------------------
 * Response caching policy
 * --------------------------------------------------------------------------
 *
 * Leave-management data contains employee and HR information and should not
 * be cached by browsers, proxies, or intermediary infrastructure.
 */

app.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  next();
});

/**
 * --------------------------------------------------------------------------
 * Global rate limiting
 * --------------------------------------------------------------------------
 *
 * This is the baseline application-level limiter.
 *
 * Authentication endpoints and other sensitive endpoints can additionally
 * apply stricter limits at their route level.
 */

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
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
 * --------------------------------------------------------------------------
 * CSRF protection
 * --------------------------------------------------------------------------
 *
 * This must run after cookie parsing because the protection middleware
 * requires access to request cookies.
 */

app.use(csrfProtection);

/**
 * --------------------------------------------------------------------------
 * Service health/root endpoint
 * --------------------------------------------------------------------------
 */

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    service: "Ziya Leave Management API",
    status: "online",
  });
});

/**
 * --------------------------------------------------------------------------
 * API routes
 * --------------------------------------------------------------------------
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
 * --------------------------------------------------------------------------
 * Employee management
 * --------------------------------------------------------------------------
 *
 * Employee management is protected inside employee.routes.ts with:
 *
 * - Authentication
 * - HR_ADMIN authorization
 * - SUPER_ADMIN authorization
 *
 * The employee controller derives organizationId from the authenticated
 * employee in the database. It is never accepted from client input.
 */

app.use(
  "/api/employees",
  employeeRoutes,
);

/**
 * --------------------------------------------------------------------------
 * Leave management
 * --------------------------------------------------------------------------
 *
 * Authentication and role authorization are handled inside
 * leave.routes.ts.
 *
 * Organization scope is derived server-side from the authenticated
 * employee and is never accepted from client input.
 */

app.use(
  "/api/leave",
  leaveRoutes,
);

/**
 * --------------------------------------------------------------------------
 * 404 handling
 * --------------------------------------------------------------------------
 *
 * Any route that has not been registered above reaches this middleware.
 */


app.use(
  "/api/admin",
  adminDashboardRoutes,
);
app.use(notFoundHandler);

/**
 * --------------------------------------------------------------------------
 * Centralized error handling
 * --------------------------------------------------------------------------
 *
 * This must remain the final middleware in the application pipeline.
 */

app.use(errorHandler);

export default app;

