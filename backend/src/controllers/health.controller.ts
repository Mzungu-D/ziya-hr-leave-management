import type {
  Request,
  Response,
} from "express";

import { db } from "../../prisma/db.js";

/**
 * Health-check response contract.
 */
interface HealthResponse {
  success: boolean;
  service: string;
  status: "healthy" | "unhealthy";
  timestamp: string;
  checks: {
    database: "healthy" | "unhealthy";
  };
}

/**
 * Health-check endpoint.
 *
 * This endpoint is intentionally unauthenticated so Railway and other
 * infrastructure can determine whether the API is operational.
 *
 * A service is considered healthy only when the application process is
 * running AND the database can successfully execute a lightweight query.
 */
export async function healthCheck(
  _req: Request,
  res: Response,
): Promise<void> {
  const timestamp =
    new Date().toISOString();

  let databaseStatus:
    | "healthy"
    | "unhealthy" =
    "healthy";

  try {
    /**
     * Execute a minimal database operation.
     *
     * This verifies that the API can communicate with PostgreSQL rather
     * than merely confirming that the Node.js process is alive.
     */
    await db.orm.public.Organization
      .where({})
      .first();
  } catch (error) {
    databaseStatus =
      "unhealthy";

    console.error(
      "Health check database failure:",
      error,
    );
  }

  const healthy =
    databaseStatus ===
    "healthy";

  const response: HealthResponse = {
    success: healthy,
    service:
      "Ziya Leave Management API",
    status: healthy
      ? "healthy"
      : "unhealthy",
    timestamp,
    checks: {
      database:
        databaseStatus,
    },
  };

  res
    .status(
      healthy
        ? 200
        : 503,
    )
    .json(response);
}