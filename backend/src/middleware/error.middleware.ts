import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response,
} from "express";

import { randomUUID } from "node:crypto";

import { ZodError } from "zod";

/**
 * --------------------------------------------------------------------------
 * Application Error
 * --------------------------------------------------------------------------
 *
 * AppError represents an expected application failure.
 *
 * These errors are safe to expose to the client because the message and
 * error code are deliberately created by the application.
 *
 * Unexpected infrastructure/database/programming errors must NOT be wrapped
 * in AppError merely to expose their internal message.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    message: string,
    code = "REQUEST_ERROR",
  ) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Object.setPrototypeOf(
      this,
      new.target.prototype,
    );

    Error.captureStackTrace?.(
      this,
      new.target,
    );
  }
}

/**
 * --------------------------------------------------------------------------
 * Constants
 * --------------------------------------------------------------------------
 */

const DEFAULT_STATUS_CODE = 500;

const DEFAULT_ERROR_CODE =
  "INTERNAL_SERVER_ERROR";

const DEFAULT_ERROR_MESSAGE =
  "An unexpected server error occurred.";

const VALIDATION_STATUS_CODE = 400;

const MAX_SAFE_STATUS_CODE = 599;

const MIN_ERROR_STATUS_CODE = 400;

/**
 * --------------------------------------------------------------------------
 * Request ID
 * --------------------------------------------------------------------------
 *
 * Every failed request receives a server-generated request ID.
 *
 * We deliberately generate the ID on the server rather than trusting an
 * arbitrary client-supplied correlation ID.
 */
const REQUEST_ID_HEADER = "X-Request-Id";

function getRequestId(
  req: Request,
): string {
  const existingRequestId =
    req.get(REQUEST_ID_HEADER);

  if (
    existingRequestId &&
    /^[a-zA-Z0-9._:-]{1,128}$/.test(
      existingRequestId,
    )
  ) {
    return existingRequestId;
  }

  return randomUUID();
}

/**
 * --------------------------------------------------------------------------
 * Status code validation
 * --------------------------------------------------------------------------
 */

function normalizeStatusCode(
  statusCode: unknown,
): number {
  if (
    typeof statusCode === "number" &&
    Number.isInteger(statusCode) &&
    statusCode >= MIN_ERROR_STATUS_CODE &&
    statusCode <= MAX_SAFE_STATUS_CODE
  ) {
    return statusCode;
  }

  return DEFAULT_STATUS_CODE;
}

/**
 * --------------------------------------------------------------------------
 * Error type guards
 * --------------------------------------------------------------------------
 */

function isAppError(
  error: unknown,
): error is AppError {
  return error instanceof AppError;
}

function isError(
  error: unknown,
): error is Error {
  return error instanceof Error;
}

/**
 * --------------------------------------------------------------------------
 * HTTP/parser error detection
 * --------------------------------------------------------------------------
 *
 * Express/body-parser errors can arrive as ordinary Error objects with
 * additional properties attached to them.
 */
interface HttpLikeError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
  code?: string;
  expose?: boolean;
  body?: unknown;
  limit?: number;
  length?: number;
}

function isHttpLikeError(
  error: unknown,
): error is HttpLikeError {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  );
}

function getHttpLikeStatus(
  error: HttpLikeError,
): number | undefined {
  if (
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }

  if (
    typeof error.status === "number"
  ) {
    return error.status;
  }

  return undefined;
}

/**
 * --------------------------------------------------------------------------
 * Safe error logging
 * --------------------------------------------------------------------------
 *
 * Never send this information to the client.
 *
 * The server log contains enough information to diagnose a production
 * failure while avoiding logging request bodies, cookies, authorization
 * headers, passwords, OTPs, or other sensitive request data.
 */
function logUnexpectedError(
  error: unknown,
  req: Request,
  requestId: string,
): void {
  const normalizedError =
    isError(error)
      ? error
      : new Error(
          typeof error === "string"
            ? error
            : "Unknown non-Error throwable",
        );

  console.error(
    JSON.stringify({
      level: "error",
      event: "unhandled_application_error",
      requestId,
      method: req.method,
      path: req.path,
      userAgent:
        req.get("user-agent") ??
        undefined,
      error: {
        name:
          normalizedError.name,
        message:
          normalizedError.message,
        stack:
          normalizedError.stack,
      },
      timestamp:
        new Date().toISOString(),
    }),
  );
}

/**
 * --------------------------------------------------------------------------
 * Validation issue normalization
 * --------------------------------------------------------------------------
 *
 * Zod issues are safe to return because they contain validation metadata,
 * not the submitted request values.
 */
function getValidationIssues(
  error: ZodError,
) {
  return error.issues.map(
    (issue) => ({
      path: issue.path,
      code: issue.code,
      message: issue.message,
    }),
  );
}

/**
 * --------------------------------------------------------------------------
 * 404 handler
 * --------------------------------------------------------------------------
 *
 * Must be registered after all application routes and before the centralized
 * error handler.
 */
export function notFoundHandler(
  req: Request,
  res: Response,
): void {
  if (res.headersSent) {
    return;
  }

  const requestId =
    getRequestId(req);

  res.setHeader(
    REQUEST_ID_HEADER,
    requestId,
  );

  res.status(404).json({
    success: false,
    code: "NOT_FOUND",
    message: "The requested resource was not found.",
    requestId,
  });
}

/**
 * --------------------------------------------------------------------------
 * Centralized error handler
 * --------------------------------------------------------------------------
 *
 * This function is intentionally the final error boundary of the API.
 */
export const errorHandler: ErrorRequestHandler =
  (
    error: unknown,
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    /**
     * If Express has already started writing the response, control must be
     * handed back to Express rather than attempting to send a second response.
     */
    if (res.headersSent) {
      next(error);
      return;
    }

    const requestId =
      getRequestId(req);

    res.setHeader(
      REQUEST_ID_HEADER,
      requestId,
    );

    /**
     * ----------------------------------------------------------------------
     * Zod validation errors
     * ----------------------------------------------------------------------
     */
    if (error instanceof ZodError) {
      res.status(
        VALIDATION_STATUS_CODE,
      ).json({
        success: false,
        code: "VALIDATION_ERROR",
        message:
          "The request contains invalid data.",
        issues:
          getValidationIssues(error),
        requestId,
      });

      return;
    }

    /**
     * ----------------------------------------------------------------------
     * Expected application errors
     * ----------------------------------------------------------------------
     */
    if (isAppError(error)) {
      const statusCode =
        normalizeStatusCode(
          error.statusCode,
        );

      res.status(statusCode).json({
        success: false,
        code:
          error.code ||
          "REQUEST_ERROR",
        message:
          error.message ||
          "The request could not be completed.",
        requestId,
      });

      return;
    }

    /**
     * ----------------------------------------------------------------------
     * Body/parser errors
     * ----------------------------------------------------------------------
     *
     * Malformed JSON should return a useful client error without exposing
     * parser internals.
     */
    if (
      isHttpLikeError(error) &&
      error.type ===
        "entity.parse.failed"
    ) {
      res.status(400).json({
        success: false,
        code: "INVALID_JSON",
        message:
          "The request body contains invalid JSON.",
        requestId,
      });

      return;
    }

    /**
     * ----------------------------------------------------------------------
     * Request body too large
     * ----------------------------------------------------------------------
     */
    if (
      isHttpLikeError(error) &&
      (
        error.type ===
          "entity.too.large" ||
        error.code ===
          "LIMIT_REQUEST_SIZE"
      )
    ) {
      res.status(413).json({
        success: false,
        code: "REQUEST_TOO_LARGE",
        message:
          "The request body is too large.",
        requestId,
      });

      return;
    }

    /**
     * ----------------------------------------------------------------------
     * Unsupported/invalid request encoding
     * ----------------------------------------------------------------------
     */
    if (
      isHttpLikeError(error) &&
      (
        error.type ===
          "encoding.unsupported" ||
        error.type ===
          "charset.unsupported"
      )
    ) {
      res.status(415).json({
        success: false,
        code: "UNSUPPORTED_ENCODING",
        message:
          "The request encoding is not supported.",
        requestId,
      });

      return;
    }

    /**
     * ----------------------------------------------------------------------
     * Invalid content type
     * ----------------------------------------------------------------------
     */
    if (
      isHttpLikeError(error) &&
      error.type ===
        "entity.unsupported"
    ) {
      res.status(415).json({
        success: false,
        code: "UNSUPPORTED_CONTENT_TYPE",
        message:
          "The request content type is not supported.",
        requestId,
      });

      return;
    }

    /**
     * ----------------------------------------------------------------------
     * CORS errors
     * ----------------------------------------------------------------------
     *
     * The actual CORS middleware remains responsible for deciding which
     * origins are allowed. This handler only converts an unexpected CORS
     * rejection into a safe API response.
     */
    if (
      isHttpLikeError(error) &&
      error.code ===
        "CORS_ORIGIN_NOT_ALLOWED"
    ) {
      res.status(403).json({
        success: false,
        code: "CORS_ORIGIN_NOT_ALLOWED",
        message:
          "The request origin is not permitted.",
        requestId,
      });

      return;
    }

    /**
     * ----------------------------------------------------------------------
     * Client connection aborted
     * ----------------------------------------------------------------------
     *
     * There is no useful response to send when the client has already
     * disconnected.
     */
    if (
      isHttpLikeError(error) &&
      (
        error.code ===
          "ECONNABORTED" ||
        error.code ===
          "ECONNRESET"
      )
    ) {
      logUnexpectedError(
        error,
        req,
        requestId,
      );

      return;
    }

    /**
     * ----------------------------------------------------------------------
     * Known HTTP-style errors
     * ----------------------------------------------------------------------
     *
     * Some Express-compatible middleware may throw an error containing a
     * valid HTTP status. Only safe generic messages are exposed.
     */
    if (
      isHttpLikeError(error)
    ) {
      const statusCode =
        getHttpLikeStatus(error);

      if (
        statusCode !== undefined &&
        statusCode >= 400 &&
        statusCode <= 499
      ) {
        res.status(statusCode).json({
          success: false,
          code:
            typeof error.code ===
              "string" &&
            /^[A-Z0-9_:-]+$/.test(
              error.code,
            )
              ? error.code
              : "REQUEST_ERROR",
          message:
            error.expose === true
              ? error.message
              : "The request could not be completed.",
          requestId,
        });

        return;
      }
    }

    /**
     * ----------------------------------------------------------------------
     * Unexpected server error
     * ----------------------------------------------------------------------
     *
     * This is the most important security boundary.
     *
     * Never expose:
     * - stack traces
     * - SQL statements
     * - database connection strings
     * - Prisma/ORM internals
     * - filesystem paths
     * - environment variables
     * - JWT secrets
     * - cookies
     * - passwords
     * - OTP values
     * - infrastructure details
     */
    logUnexpectedError(
      error,
      req,
      requestId,
    );

    res.status(
      DEFAULT_STATUS_CODE,
    ).json({
      success: false,
      code:
        DEFAULT_ERROR_CODE,
      message:
        DEFAULT_ERROR_MESSAGE,
      requestId,
    });
  };