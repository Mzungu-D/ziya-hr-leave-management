import "dotenv/config";

import { z } from "zod";

/**
 * --------------------------------------------------------------------------
 * Environment configuration
 * --------------------------------------------------------------------------
 *
 * Runtime configuration is validated before the application starts.
 * Invalid or unsafe production configuration prevents startup.
 */

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    PORT: z.coerce
      .number()
      .int()
      .min(1)
      .max(65535)
      .default(4000),

    APP_URL: z
      .string()
      .trim()
      .url(),

    API_URL: z
      .string()
      .trim()
      .url(),

    /**
     * Database
     */
    DATABASE_URL: z
      .string()
      .trim()
      .min(1),

    /**
     * Railway Bucket / S3-compatible object storage
     */
    S3_ENDPOINT: z
      .string()
      .trim()
      .url(),

    S3_REGION: z
      .string()
      .trim()
      .min(1),

    S3_ACCESS_KEY_ID: z
      .string()
      .trim()
      .min(1),

    S3_SECRET_ACCESS_KEY: z
      .string()
      .min(1),

    S3_BUCKET_NAME: z
      .string()
      .trim()
      .min(1),

    /**
     * Authentication secrets
     */
    JWT_ACCESS_SECRET: z
      .string()
      .min(32),

    JWT_REFRESH_SECRET: z
      .string()
      .min(32),

    ACCESS_TOKEN_TTL_MINUTES: z.coerce
      .number()
      .int()
      .min(5)
      .max(60)
      .default(15),

    REFRESH_TOKEN_TTL_DAYS: z.coerce
      .number()
      .int()
      .min(1)
      .max(90)
      .default(30),

    SESSION_TTL_HOURS: z.coerce
      .number()
      .int()
      .min(1)
      .max(24)
      .default(12),

    OTP_TTL_MINUTES: z.coerce
      .number()
      .int()
      .min(2)
      .max(15)
      .default(10),

    OTP_MAX_ATTEMPTS: z.coerce
      .number()
      .int()
      .min(3)
      .max(10)
      .default(5),

    ACTIVATION_TTL_HOURS: z.coerce
      .number()
      .int()
      .min(1)
      .max(72)
      .default(24),

    PASSWORD_RESET_TTL_MINUTES: z.coerce
      .number()
      .int()
      .min(5)
      .max(60)
      .default(30),

    /**
     * Cookie policy
     *
     * "none" is required for cross-site cookie-based authentication.
     * Browsers require Secure cookies when SameSite=None is used.
     */
    COOKIE_SAME_SITE: z
      .enum(["strict", "lax", "none"])
      .default("lax"),

    /**
     * SMTP
     */
    SMTP_HOST: z
      .string()
      .trim()
      .optional(),

    SMTP_PORT: z.coerce
      .number()
      .int()
      .min(1)
      .max(65535)
      .default(587),

    SMTP_USER: z
      .string()
      .trim()
      .optional(),

    SMTP_PASSWORD: z
      .string()
      .optional(),

    SMTP_FROM: z
      .string()
      .trim()
      .email()
      .optional(),
  })
  .superRefine((config, context) => {
    /**
     * Production security requirements
     */
    if (config.NODE_ENV === "production") {
      if (
        config.JWT_ACCESS_SECRET ===
        config.JWT_REFRESH_SECRET
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["JWT_REFRESH_SECRET"],
          message:
            "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different in production.",
        });
      }

      if (
        config.JWT_ACCESS_SECRET
          .toLowerCase()
          .includes("change-me")
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["JWT_ACCESS_SECRET"],
          message:
            "A production JWT access secret must not contain a placeholder value.",
        });
      }

      if (
        config.JWT_REFRESH_SECRET
          .toLowerCase()
          .includes("change-me")
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["JWT_REFRESH_SECRET"],
          message:
            "A production JWT refresh secret must not contain a placeholder value.",
        });
      }
    }

    /**
     * SameSite=None requires HTTPS and production cookie security.
     *
     * Both URLs are parsed by Zod before this validation runs.
     */
    if (config.COOKIE_SAME_SITE === "none") {
      let appUsesHttps = false;
      let apiUsesHttps = false;

      try {
        appUsesHttps =
          new URL(config.APP_URL).protocol === "https:";
      } catch {
        appUsesHttps = false;
      }

      try {
        apiUsesHttps =
          new URL(config.API_URL).protocol === "https:";
      } catch {
        apiUsesHttps = false;
      }

      if (
        config.NODE_ENV !== "production" ||
        !appUsesHttps ||
        !apiUsesHttps
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["COOKIE_SAME_SITE"],
          message:
            "COOKIE_SAME_SITE=none requires production mode and HTTPS for both APP_URL and API_URL.",
        });
      }
    }

    /**
     * SMTP consistency
     *
     * If any SMTP setting is supplied, all required SMTP credentials
     * must be supplied.
     */
    const smtpConfigured = Boolean(
      config.SMTP_HOST ||
        config.SMTP_USER ||
        config.SMTP_PASSWORD ||
        config.SMTP_FROM,
    );

    if (smtpConfigured) {
      if (!config.SMTP_HOST) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["SMTP_HOST"],
          message:
            "SMTP_HOST is required when SMTP delivery is configured.",
        });
      }

      if (!config.SMTP_USER) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["SMTP_USER"],
          message:
            "SMTP_USER is required when SMTP delivery is configured.",
        });
      }

      if (!config.SMTP_PASSWORD) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["SMTP_PASSWORD"],
          message:
            "SMTP_PASSWORD is required when SMTP delivery is configured.",
        });
      }

      if (!config.SMTP_FROM) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["SMTP_FROM"],
          message:
            "SMTP_FROM is required when SMTP delivery is configured.",
        });
      }
    }
  });

/**
 * --------------------------------------------------------------------------
 * Parse environment once
 * --------------------------------------------------------------------------
 */

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");

  for (const issue of parsed.error.issues) {
    console.error(
      `- ${issue.path.join(".")}: ${issue.message}`,
    );
  }

  throw new Error(
    "Environment configuration is invalid. Application startup aborted.",
  );
}

/**
 * --------------------------------------------------------------------------
 * Immutable runtime configuration
 * --------------------------------------------------------------------------
 */

export const env = Object.freeze(parsed.data);

/**
 * --------------------------------------------------------------------------
 * Environment helpers
 * --------------------------------------------------------------------------
 */

export const isProduction =
  env.NODE_ENV === "production";

export const isDevelopment =
  env.NODE_ENV === "development";

export const isTest =
  env.NODE_ENV === "test";
