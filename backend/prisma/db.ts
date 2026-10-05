import "dotenv/config";

import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "./schema.d.ts";
import schemaJson from "./schema.json" with {
  type: "json",
};

/**
 * --------------------------------------------------------------------------
 * Database configuration
 * --------------------------------------------------------------------------
 *
 * DATABASE_URL is mandatory in every environment.
 *
 * We deliberately fail during application startup when the variable is
 * missing or malformed rather than allowing the application to start with
 * an undefined database connection.
 */
const DATABASE_URL =
  process.env["DATABASE_URL"]?.trim();

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not configured. The application cannot start without a database connection.",
  );
}

/**
 * Validate the configured database URL before handing it to the ORM.
 *
 * PostgreSQL connection URLs must use a PostgreSQL-compatible protocol.
 */
let databaseUrl: string;

try {
  const parsedUrl = new URL(
    DATABASE_URL,
  );

  const supportedProtocols = new Set([
    "postgres:",
    "postgresql:",
  ]);

  if (
    !supportedProtocols.has(
      parsedUrl.protocol,
    )
  ) {
    throw new Error(
      "DATABASE_URL must use the postgres:// or postgresql:// protocol.",
    );
  }

  databaseUrl = parsedUrl.toString();
} catch (error) {
  if (
    error instanceof Error &&
    error.message.startsWith(
      "DATABASE_URL must use",
    )
  ) {
    throw error;
  }

  throw new Error(
    "DATABASE_URL is invalid. Provide a valid PostgreSQL connection URL.",
  );
}

/**
 * --------------------------------------------------------------------------
 * Database client
 * --------------------------------------------------------------------------
 *
 * The ORM client is created once and exported as the application's shared
 * database access point.
 *
 * Do not create additional database clients inside controllers, services,
 * routes, or middleware.
 */
export const db =
  postgres<Contract>({
    contractJson:
      schemaJson,
    url:
      databaseUrl,
  });

/**
 * --------------------------------------------------------------------------
 * Transaction client type
 * --------------------------------------------------------------------------
 *
 * Services can use this type when a group of database operations must be
 * executed atomically.
 *
 * Example:
 *
 * await db.transaction(async (tx) => {
 *   // operations using tx
 * });
 */
export type Tx =
  Parameters<
    Parameters<
      typeof db.transaction
    >[0]
  >[0];