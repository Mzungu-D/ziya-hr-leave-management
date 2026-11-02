import { randomUUID } from "node:crypto";

import { db } from "../../prisma/db.js";

import { env } from "../config/env.js";

import { AppError } from "../middleware/error.middleware.js";

import {
  generateOpaqueToken,
  hashOpaqueToken,
} from "../utils/crypto.js";

import {
  sendEmployeeInviteEmail,
} from "./email.service.js";

/**
 * Employee invitation service.
 *
 * Invitations reuse the existing password-reset credential flow:
 *
 * HR creates employee (PENDING)
 *        Γåô
 * invitation link is emailed
 *        Γåô
 * employee opens the link and sets a password
 *        Γåô
 * confirmPasswordReset activates the account
 *        Γåô
 * employee signs in with email + password
 *
 * Security:
 * - Only the hash of the token is stored.
 * - The raw token and link are never logged.
 * - Only PENDING employees can be invited.
 * - A new invitation invalidates every earlier one.
 * - Invitations are organization-scoped.
 */

/**
 * The purpose value is shared with password reset so that the existing
 * confirmPasswordReset workflow can activate invited accounts without a
 * second credential system.
 */
const INVITATION_PURPOSE = "PASSWORD_RESET" as const;

const RESEND_COOLDOWN_SECONDS = 60;

export interface EmployeeInvitationResult {
  sentTo: string;
  expiresAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Create a one-time activation link and email it to a pending employee.
 */
export async function sendEmployeeInvitation(
  organizationId: string,
  employeeId: string,
): Promise<EmployeeInvitationResult> {
  const normalizedOrganizationId =
    organizationId.trim();

  const normalizedEmployeeId =
    employeeId.trim();

  if (
    !normalizedOrganizationId ||
    !normalizedEmployeeId
  ) {
    throw new AppError(
      400,
      "Employee ID is required.",
      "EMPLOYEE_ID_REQUIRED",
    );
  }

  const employee =
    await db.orm.public.Employee
      .where({
        id: normalizedEmployeeId,
        organizationId:
          normalizedOrganizationId,
      })
      .first();

  if (!employee) {
    throw new AppError(
      404,
      "Employee not found.",
      "EMPLOYEE_NOT_FOUND",
    );
  }

  if (employee.status !== "PENDING") {
    throw new AppError(
      409,
      "An invitation can only be sent to employees whose account is pending activation.",
      "EMPLOYEE_NOT_PENDING",
    );
  }

  const activationWindowMs =
    env.ACTIVATION_TTL_HOURS *
    60 *
    60 *
    1000;

  const outstanding =
    await db.orm.public.OtpVerification
      .where({
        employeeId: employee.id,
        purpose: INVITATION_PURPOSE,
        consumedAt: null,
      })
      .all();

  /*
   * Issue time is derived from the expiry, so no extra column is needed.
   */
  const latestIssuedAt =
    outstanding.reduce<number>(
      (latest, item) => {
        const issuedAt =
          new Date(
            item.expiresAt,
          ).getTime() -
          activationWindowMs;

        return Number.isFinite(
          issuedAt,
        ) && issuedAt > latest
          ? issuedAt
          : latest;
      },
      0,
    );

  if (
    latestIssuedAt > 0 &&
    Date.now() - latestIssuedAt <
      RESEND_COOLDOWN_SECONDS * 1000
  ) {
    throw new AppError(
      429,
      "An invitation was sent a moment ago. Please wait a minute before sending another.",
      "INVITATION_RATE_LIMITED",
    );
  }

  /*
   * Only the newest invitation link may work.
   */
  await db.orm.public.OtpVerification
    .where({
      employeeId: employee.id,
      purpose: INVITATION_PURPOSE,
      consumedAt: null,
    })
    .updateAll({
      consumedAt: nowIso(),
    });

  const token =
    generateOpaqueToken(48);

  const verificationId =
    randomUUID();

  const expiresAt =
    new Date(
      Date.now() +
        activationWindowMs,
    ).toISOString();

  await db.orm.public.OtpVerification.create({
    id: verificationId,
    employeeId: employee.id,
    codeHash:
      hashOpaqueToken(token),
    purpose: INVITATION_PURPOSE,
    expiresAt,
    attempts: 0,
  });

  const baseUrl =
    env.APP_URL.replace(/\/+$/, "");

  const activationUrl =
    `${baseUrl}/reset-password?token=${encodeURIComponent(
      token,
    )}&invite=1`;

  try {
    await sendEmployeeInviteEmail({
      email: employee.email,
      firstName: employee.firstName,
      activationUrl,
      expiresInHours:
        env.ACTIVATION_TTL_HOURS,
    });
  } catch (error) {
    /*
     * The link never reached the employee, so discard it. This also
     * clears the resend cooldown so HR can retry immediately.
     */
    await db.orm.public.OtpVerification
      .where({
        id: verificationId,
        consumedAt: null,
      })
      .update({
        consumedAt: nowIso(),
      });

    throw error;
  }

  return {
    sentTo: employee.email,
    expiresAt,
  };
}
