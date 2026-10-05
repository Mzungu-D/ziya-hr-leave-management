import app from "./app.js";

import { env } from "./config/env.js";

import { db } from "../prisma/db.js";

/**
 * --------------------------------------------------------------------------
 * Server lifecycle state
 * --------------------------------------------------------------------------
 */

let shuttingDown = false;

/**
 * --------------------------------------------------------------------------
 * HTTP server
 * --------------------------------------------------------------------------
 */

const server = app.listen(
  env.PORT,
  () => {
    console.log(
      `Ziya Leave Management API running on ${env.API_URL}`,
    );
  },
);

server.on(
  "error",
  (error) => {
    console.error(
      "HTTP server error:",
      error,
    );

    process.exit(1);
  },
);

/**
 * --------------------------------------------------------------------------
 * Graceful shutdown
 * --------------------------------------------------------------------------
 *
 * Railway and other production platforms send SIGTERM when a service is
 * being stopped or redeployed.
 *
 * The shutdown sequence:
 *
 * 1. Prevent duplicate shutdown attempts.
 * 2. Stop accepting new HTTP connections.
 * 3. Allow active connections to finish.
 * 4. Close the database connection.
 * 5. Exit successfully.
 *
 * If the database cannot be closed cleanly, the process exits with a
 * non-zero status so the hosting platform can detect the failure.
 */
async function shutdown(
  signal: string,
): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  console.log(
    `${signal} received. Starting graceful shutdown...`,
  );

  /**
   * Stop accepting new connections.
   */
  server.close(
    async (serverError) => {
      if (serverError) {
        console.error(
          "HTTP server failed during shutdown:",
          serverError,
        );

        try {
          await db.close();
        } catch (databaseError) {
          console.error(
            "Error while closing database connection:",
            databaseError,
          );
        }

        process.exit(1);
      }

      try {
        await db.close();

        console.log(
          "Database connection closed.",
        );

        console.log(
          "Ziya Leave Management API shut down cleanly.",
        );

        process.exit(0);
      } catch (error) {
        console.error(
          "Error while closing database connection:",
          error,
        );

        process.exit(1);
      }
    },
  );
}

/**
 * --------------------------------------------------------------------------
 * Process signal handlers
 * --------------------------------------------------------------------------
 */

process.once(
  "SIGTERM",
  () => {
    void shutdown("SIGTERM");
  },
);

process.once(
  "SIGINT",
  () => {
    void shutdown("SIGINT");
  },
);

/**
 * --------------------------------------------------------------------------
 * Unexpected process failures
 * --------------------------------------------------------------------------
 *
 * These are not recoverable application-level errors.
 *
 * Continuing to serve requests after an uncaught exception or unhandled
 * promise rejection can leave the process in an unknown state. The process
 * therefore shuts down after attempting to close the database connection.
 */
process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "Uncaught exception:",
      error,
    );

    void shutdown(
      "uncaughtException",
    );
  },
);

process.on(
  "unhandledRejection",
  (reason) => {
    console.error(
      "Unhandled promise rejection:",
      reason,
    );

    void shutdown(
      "unhandledRejection",
    );
  },
);