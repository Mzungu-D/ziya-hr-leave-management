import type {
  Request,
  Response,
} from "express";

import rateLimit, { ipKeyGenerator } from "express-rate-limit";

/**
 * --------------------------------------------------------------------------
 * Profile-picture upload rate limiting
 * --------------------------------------------------------------------------
 *
 * Profile-picture uploads are authenticated, state-changing operations and
 * therefore receive a substantially stricter limit than the application's
 * global request limiter.
 *
 * The limiter is keyed by the authenticated employee rather than only by IP.
 * This prevents users behind the same corporate/NAT address from consuming
 * one another's upload quota.
 *
 * Authentication MUST execute before this middleware.
 */

const WINDOW_MS =
  15 * 60 * 1000;

const MAX_UPLOADS_PER_WINDOW =
  10;

export const profilePictureUploadRateLimit =
  rateLimit({
    windowMs:
      WINDOW_MS,

    limit:
      MAX_UPLOADS_PER_WINDOW,

    standardHeaders:
      "draft-8",

    legacyHeaders:
      false,

    /**
     * req.auth is populated by requireAuthentication.
     *
     * The fallback exists only as a defensive boundary. An unauthenticated
     * request should already have been rejected by the authentication
     * middleware before reaching this limiter.
     */
    keyGenerator: (
      req: Request,
    ): string => {
      const employeeId =
        req.auth?.employeeId;

      if (
        typeof employeeId ===
          "string" &&
        employeeId.trim()
          .length > 0
      ) {
        return `employee:${employeeId.trim()}`;
      }

      /**
       * express-rate-limit provides req.ip after Express proxy handling.
       *
       * This fallback prevents all unauthenticated requests from sharing
       * one undefined key if middleware ordering is accidentally changed.
       */
      return req.ip ? `ip:${ipKeyGenerator(req.ip)}` : "ip:unknown";
    },

    handler: (
      _req: Request,
      res: Response,
    ): void => {
      res
        .status(429)
        .json({
          success:
            false,

          code:
            "PROFILE_PICTURE_RATE_LIMITED",

          message:
            "Too many profile picture upload attempts. Please try again later.",
        });
    },

    /**
     * Failed uploads count toward the limit.
     *
     * This is intentional because malformed or abusive upload attempts
     * still consume server resources before validation completes.
     */
    skipSuccessfulRequests:
      false,

    /**
     * Keep all requests in the limiter window, including failures.
     */
    skipFailedRequests:
      false,
  });