import { randomUUID } from "node:crypto";
import type { Request } from "express";
import { z } from "zod";

import { db } from "../../prisma/db.js";
import { AppError } from "../middleware/error.middleware.js";

/* -------------------------------------------------------------------------- */
/* Supported onboarding audit events                                          */
/* -------------------------------------------------------------------------- */

export const ONBOARDING_AUDIT_ACTIONS = [
  "ONBOARDING_DRAFT_CREATED",
  "ONBOARDING_DRAFT_UPDATED",
  "ONBOARDING_SUBMITTED",
  "ONBOARDING_REVIEW_STARTED",
  "ONBOARDING_RETURNED",
  "ONBOARDING_HR_DETAILS_UPDATED",
  "ONBOARDING_COMPLETED",
] as const;

export type OnboardingAuditAction =
  (typeof ONBOARDING_AUDIT_ACTIONS)[number];

/* -------------------------------------------------------------------------- */
/* Input validation                                                           */
/* -------------------------------------------------------------------------- */

const identifierSchema = z.string().trim().min(1).max(200);

const summarySchema = z.string().trim().min(1).max(500);

const metadataSchema = z
  .record(
    z.string().trim().min(1).max(100),
    z.union([
      z.string().max(500),
      z.number().finite(),
      z.boolean(),
      z.null(),
    ]),
  )
  .default({});

const auditInputSchema = z
  .object({
    organizationId: identifierSchema,
    actorId: identifierSchema,
    submissionId: identifierSchema,
    action: z.enum(ONBOARDING_AUDIT_ACTIONS),
    summary: summarySchema,
    metadata: metadataSchema,
  })
  .strict();

export interface OnboardingAuditInput {
  organizationId: string;
  actorId: string;
  submissionId: string;
  action: OnboardingAuditAction;
  summary: string;
  req: Request;
  metadata?: Record<
    string,
    string | number | boolean | null
  >;
}

/* -------------------------------------------------------------------------- */
/* Request metadata                                                           */
/* -------------------------------------------------------------------------- */

const MAX_IP_LENGTH = 100;
const MAX_USER_AGENT_LENGTH = 1000;

/**
 * Express req.ip is used instead of parsing X-Forwarded-For manually.
 *
 * Configure Express trust proxy only for the actual trusted proxy topology
 * used by the deployment. Never trust arbitrary client-supplied forwarding
 * headers.
 */
function getRequestIp(req: Request): string | null {
  const ip = req.ip?.trim();

  if (!ip || ip.length > MAX_IP_LENGTH) {
    return null;
  }

  return ip;
}

function getUserAgent(req: Request): string | null {
  const userAgent = req.get("user-agent")?.trim();

  if (!userAgent || userAgent.length > MAX_USER_AGENT_LENGTH) {
    return null;
  }

  return userAgent;
}

/* -------------------------------------------------------------------------- */
/* Audit writer                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Persist an onboarding audit event.
 *
 * Security rules:
 * - The caller must derive organizationId and actorId from authenticated,
 *   server-verified records.
 * - Never pass employee form contents, national IDs, KRA PINs, bank details,
 *   signatures, passwords, OTPs, document contents, or private storage keys
 *   through metadata.
 * - Do not accept an action supplied directly by an HTTP request without
 *   validating it against ONBOARDING_AUDIT_ACTIONS.
 * - An audit failure is propagated to the caller.
 *
 * Consistency limitation:
 * This function performs a separate database write. It does not make an
 * onboarding update and its audit event atomic. For atomic guarantees, both
 * writes must use the same database transaction.
 */
export async function writeOnboardingAudit(
  input: OnboardingAuditInput,
): Promise<void> {
  const parsed = auditInputSchema.safeParse({
    organizationId: input.organizationId,
    actorId: input.actorId,
    submissionId: input.submissionId,
    action: input.action,
    summary: input.summary,
    metadata: input.metadata ?? {},
  });

  if (!parsed.success) {
    throw new AppError(
      500,
      "The onboarding audit event failed validation.",
      "ONBOARDING_AUDIT_VALIDATION_FAILED",
    );
  }

  const event = parsed.data;

  try {
    await db.orm.public.AuditLog.create({
      id: randomUUID(),
      organizationId: event.organizationId,
      actorId: event.actorId,
      action: event.action,
      entityType: "ONBOARDING_SUBMISSION",
      entityId: event.submissionId,
      summary: event.summary,
      metadata: event.metadata,
      ipAddress: getRequestIp(input.req),
      userAgent: getUserAgent(input.req),
      createdAt: new Date().toISOString(),
    });
  } catch {
    /*
     * Do not expose SQL errors, database connection strings, or other
     * infrastructure details in the HTTP error.
     *
     * The original failure should also be recorded by the application's
     * centralized server-side error logging infrastructure.
     */
    throw new AppError(
      500,
      "The onboarding audit event could not be recorded.",
      "ONBOARDING_AUDIT_WRITE_FAILED",
    );
  }
}
