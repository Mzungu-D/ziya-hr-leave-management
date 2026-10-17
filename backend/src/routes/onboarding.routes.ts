import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";

import { db } from "../../prisma/db.js";
import { AppError } from "../middleware/error.middleware.js";
import { requireAuthentication } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

/**
 * Writes a tenant-scoped audit event for onboarding mutations.
 *
 * Never include employee form values, bank details, identity numbers,
 * or other sensitive personal information in audit metadata.
 */
async function auditOnboardingEvent(input: {
  req: Request;
  organizationId: string;
  actorId: string;
  action: string;
  entityId: string;
  summary: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const now = new Date().toISOString();

  await db.orm.public.AuditLog.create({
    id: randomUUID(),
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: input.action,
    entityType: "OnboardingSubmission",
    entityId: input.entityId,
    summary: input.summary,
    metadata: input.metadata ?? {},
    ipAddress: input.req.ip ?? null,
    userAgent: input.req.get("user-agent") ?? null,
    createdAt: now,
  } as never);
}

/* -------------------------------------------------------------------------- */
/* Constants and validation                                                   */
/* -------------------------------------------------------------------------- */

const router = Router();

const onboardingStatuses = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "RETURNED",
  "COMPLETED",
] as const;

type OnboardingStatus = (typeof onboardingStatuses)[number];

const objectSchema = z.record(z.string(), z.unknown());

const nonEmptyText = z.string().trim().min(1).max(500);

const employeeDataSchema = z.object({
  personalDetails: z.object({
    fullLegalName: nonEmptyText.optional(),
    preferredName: z.string().trim().max(150).optional(),
    dateOfBirth: z.string().trim().max(30).optional(),
    gender: z.string().trim().max(100).optional(),
    nationality: z.string().trim().max(100).optional(),
    nationalIdOrPassportNumber: z.string().trim().max(100).optional(),
    phone: z.string().trim().min(7).max(32).optional(),
    personalEmail: z.string().trim().email().max(320).optional(),
    townOrEstate: z.string().trim().max(200).optional(),
    physicalAddress: z.string().trim().max(500).optional(),
    postalAddress: z.string().trim().max(200).optional(),
    identificationDocumentUrl: z.string().trim().max(2048).optional(),
    photoUrl: z.string().trim().max(2048).optional(),
  }).optional(),

  statutory: z.object({
    kraPin: z.string().trim().max(100).optional(),
    nssfNumber: z.string().trim().max(100).optional(),
    shaNumber: z.string().trim().max(100).optional(),
    otherDeductionsOrReliefs: z.string().trim().max(2000).optional(),
    kraCertificateUrl: z.string().trim().max(2048).optional(),
    nssfProofUrl: z.string().trim().max(2048).optional(),
    shaProofUrl: z.string().trim().max(2048).optional(),
  }).optional(),

  payrollBanking: z.object({
    bankName: z.string().trim().max(150).optional(),
    branch: z.string().trim().max(150).optional(),
    accountName: z.string().trim().max(200).optional(),
    accountNumber: z.string().trim().max(100).optional(),
    mpesaNumber: z.string().trim().max(32).optional(),
    mpesaRegisteredName: z.string().trim().max(200).optional(),
    deductionAuthorization: z.boolean().optional(),
  }).optional(),

  emergencyContacts: z.array(
    z.object({
      fullName: nonEmptyText.optional(),
      relationship: z.string().trim().max(100).optional(),
      phone: z.string().trim().max(32).optional(),
      email: z.string().trim().email().max(320).optional(),
      address: z.string().trim().max(500).optional(),
    }),
  ).max(10).optional(),

  nextOfKin: z.array(
    z.object({
      fullName: nonEmptyText.optional(),
      relationship: z.string().trim().max(100).optional(),
      nationalIdOrDateOfBirth: z.string().trim().max(100).optional(),
      phone: z.string().trim().max(32).optional(),
      sharePercentage: z.number().min(0).max(100).optional(),
    }),
  ).max(20).optional(),

  medicalDependants: z.array(
    z.object({
      fullName: nonEmptyText.optional(),
      dateOfBirth: z.string().trim().max(30).optional(),
      identificationOrBirthCertificateNumber:
        z.string().trim().max(100).optional(),
      relationship: z.string().trim().max(100).optional(),
    }),
  ).max(20).optional(),
}).strict();

const consentDataSchema = z.object({
  informationIsTrueAndComplete: z.boolean().optional(),
  consentToEmploymentDataProcessing: z.boolean().optional(),
  emergencyContactsInformed: z.boolean().optional(),
  employeeSignature: z.string().trim().max(200).optional(),
  signedAt: z.string().trim().max(50).optional(),
}).strict();

const saveDraftSchema = z.object({
  employeeData: employeeDataSchema.optional(),
  consentData: consentDataSchema.optional(),
}).strict().refine(
  (value) =>
    value.employeeData !== undefined ||
    value.consentData !== undefined,
  {
    message: "Provide employeeData or consentData to save.",
  },
);

const reviewSchema = z.object({
  action: z.enum(["UNDER_REVIEW", "RETURNED"]),
  reason: z.string().trim().max(2000).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.action === "RETURNED" && !value.reason?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["reason"],
      message: "A reason is required when returning onboarding.",
    });
  }
});

const hrDetailsSchema = z.object({
  employment: z.object({
    staffId: z.string().trim().max(100).optional(),
    startDate: z.string().trim().max(30).optional(),
    jobTitle: z.string().trim().max(200).optional(),
    departmentId: z.string().trim().max(100).nullable().optional(),
    lineManagerId: z.string().trim().max(100).nullable().optional(),
    workLocation: z.string().trim().max(200).optional(),
    probationEndDate: z.string().trim().max(30).optional(),
    probationReviewDate: z.string().trim().max(30).optional(),
  }).optional(),

  verificationChecklist: z.object({
    nationalIdOrPassportVerified: z.boolean().optional(),
    shaVerified: z.boolean().optional(),
    payrollVerified: z.boolean().optional(),
    kraVerified: z.boolean().optional(),
    bankOrMpesaVerified: z.boolean().optional(),
    staffRegisterUpdated: z.boolean().optional(),
    nssfVerified: z.boolean().optional(),
    photoVerified: z.boolean().optional(),
    orientationCompleted: z.boolean().optional(),
  }).optional(),

  equipmentAndAccess: z.array(
    z.object({
      item: nonEmptyText,
      issued: z.boolean(),
      issuedAt: z.string().trim().max(50).optional(),
      employeeAcknowledgement: z.string().trim().max(200).optional(),
    }),
  ).max(100).optional(),

  signoff: z.object({
    completedBy: z.string().trim().max(200).optional(),
    completedDate: z.string().trim().max(30).optional(),
    hrManagerName: z.string().trim().max(200).optional(),
    hrManagerSignedAt: z.string().trim().max(50).optional(),
  }).optional(),
}).strict();

/* -------------------------------------------------------------------------- */
/* Authenticated organization context                                         */
/* -------------------------------------------------------------------------- */

interface EmployeeContext {
  employeeId: string;
  organizationId: string;
  role: string;
}

async function getEmployeeContext(
  req: Request,
): Promise<EmployeeContext> {
  if (!req.auth?.employeeId) {
    throw new AppError(
      401,
      "Authentication is required.",
      "AUTHENTICATION_REQUIRED",
    );
  }

  const employee = await db.orm.public.Employee
    .where({ id: req.auth.employeeId })
    .first();

  if (!employee || employee.status !== "ACTIVE") {
    throw new AppError(
      401,
      "The authenticated employee account is not available.",
      "EMPLOYEE_ACCOUNT_UNAVAILABLE",
    );
  }

  return {
    employeeId: employee.id,
    organizationId: employee.organizationId,
    role: employee.role,
  };
}

/* -------------------------------------------------------------------------- */
/* General helpers                                                             */
/* -------------------------------------------------------------------------- */

function getSubmissionId(req: Request): string {
  const value = req.params.submissionId;
  const id = Array.isArray(value) ? value[0] : value;

  if (!id?.trim()) {
    throw new AppError(
      400,
      "An onboarding submission ID is required.",
      "ONBOARDING_ID_REQUIRED",
    );
  }

  return id.trim();
}

function getPagination(req: Request): {
  page: number;
  pageSize: number;
} {
  const parse = (
    value: unknown,
    fallback: number,
    max: number,
  ) => {
    const raw = Array.isArray(value) ? value[0] : value;
    const number = Number(raw);

    return Number.isInteger(number) && number > 0
      ? Math.min(number, max)
      : fallback;
  };

  return {
    page: parse(req.query.page, 1, 1_000_000),
    pageSize: parse(req.query.pageSize, 20, 100),
  };
}

async function getOwnSubmission(
  context: EmployeeContext,
) {
  return db.orm.public.OnboardingSubmission
    .where({
      organizationId: context.organizationId,
      employeeId: context.employeeId,
    })
    .first();
}

async function getScopedSubmission(
  organizationId: string,
  submissionId: string,
) {
  const submission = await db.orm.public.OnboardingSubmission
    .where({
      id: submissionId,
      organizationId,
    })
    .first();

  if (!submission) {
    throw new AppError(
      404,
      "The onboarding submission was not found.",
      "ONBOARDING_NOT_FOUND",
    );
  }

  return submission;
}

function ensureStatus(
  current: string,
  allowed: readonly OnboardingStatus[],
): void {
  if (!allowed.includes(current as OnboardingStatus)) {
    throw new AppError(
      409,
      `This action is not allowed while onboarding is ${current}.`,
      "ONBOARDING_INVALID_STATE",
    );
  }
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return {};
}

/* -------------------------------------------------------------------------- */
/* Employee submission validation                                             */
/* -------------------------------------------------------------------------- */

function requireCompleteEmployeeSubmission(
  employeeData: unknown,
  consentData: unknown,
): void {
  const employee = employeeDataSchema.safeParse(employeeData);
  const consent = consentDataSchema.safeParse(consentData);

  if (!employee.success || !consent.success) {
    throw new AppError(
      422,
      "Correct the onboarding information before submitting.",
      "ONBOARDING_VALIDATION_FAILED",
    );
  }

  const personal = employee.data.personalDetails;
  const statutory = employee.data.statutory;
  const payroll = employee.data.payrollBanking;
  const contacts = employee.data.emergencyContacts ?? [];
  const kin = employee.data.nextOfKin ?? [];

  const missing: string[] = [];

  if (!personal?.fullLegalName?.trim()) {
    missing.push("full legal name");
  }

  if (!personal?.dateOfBirth?.trim()) {
    missing.push("date of birth");
  }

  if (!personal?.gender?.trim()) {
    missing.push("gender");
  }

  if (!personal?.nationality?.trim()) {
    missing.push("nationality");
  }

  if (!personal?.nationalIdOrPassportNumber?.trim()) {
    missing.push("National ID or passport number");
  }

  if (!personal?.phone?.trim()) {
    missing.push("phone number");
  }

  if (!personal?.personalEmail?.trim()) {
    missing.push("personal email");
  }

  if (!personal?.physicalAddress?.trim()) {
    missing.push("physical address");
  }

  if (!statutory?.kraPin?.trim()) {
    missing.push("KRA PIN");
  }

  if (!statutory?.nssfNumber?.trim()) {
    missing.push("NSSF number");
  }

  if (!statutory?.shaNumber?.trim()) {
    missing.push("SHA number");
  }

  if (!payroll?.bankName?.trim() && !payroll?.mpesaNumber?.trim()) {
    missing.push("bank details or M-Pesa number");
  }

  if (contacts.length < 2) {
    missing.push("at least two emergency contacts");
  }

  if (!kin.length) {
    missing.push("next-of-kin information");
  }

  if (consent.data.informationIsTrueAndComplete !== true) {
    missing.push("truth and completeness declaration");
  }

  if (consent.data.consentToEmploymentDataProcessing !== true) {
    missing.push("data-processing consent");
  }

  if (consent.data.emergencyContactsInformed !== true) {
    missing.push("emergency-contact declaration");
  }

  if (!consent.data.employeeSignature?.trim()) {
    missing.push("employee signature");
  }

  if (!consent.data.signedAt?.trim()) {
    missing.push("signature date");
  }

  if (missing.length) {
    throw new AppError(
      422,
      `Complete the following required information: ${missing.join(", ")}.`,
      "ONBOARDING_REQUIRED_FIELDS_MISSING",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* HR completion validation                                                    */
/* -------------------------------------------------------------------------- */

function requireCompleteHrSection(hrData: unknown): void {
  const parsed = z.object({
    employment: z.object({
      staffId: nonEmptyText,
      startDate: nonEmptyText,
      jobTitle: nonEmptyText,
      departmentId: nonEmptyText,
      lineManagerId: z.string().trim().min(1).nullable(),
      workLocation: nonEmptyText,
      probationEndDate: nonEmptyText,
      probationReviewDate: nonEmptyText,
    }),

    verificationChecklist: z.object({
      nationalIdOrPassportVerified: z.literal(true),
      shaVerified: z.literal(true),
      payrollVerified: z.literal(true),
      kraVerified: z.literal(true),
      bankOrMpesaVerified: z.literal(true),
      staffRegisterUpdated: z.literal(true),
      nssfVerified: z.literal(true),
      photoVerified: z.literal(true),
      orientationCompleted: z.literal(true),
    }),

    signoff: z.object({
      completedBy: nonEmptyText,
      completedDate: nonEmptyText,
      hrManagerName: nonEmptyText,
      hrManagerSignedAt: nonEmptyText,
    }),
  }).safeParse(hrData);

  if (!parsed.success) {
    throw new AppError(
      422,
      "Complete the HR employment details, all verification checklist items, and HR sign-off before finalizing onboarding.",
      "ONBOARDING_HR_SECTION_INCOMPLETE",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* GET /api/onboarding/me                                                     */
/* Employee: retrieve or initialize own draft                                 */
/* -------------------------------------------------------------------------- */

router.get(
  "/me",
  requireAuthentication,
  async (req: Request, res: Response): Promise<void> => {
    const context = await getEmployeeContext(req);
    let submission = await getOwnSubmission(context);

    if (!submission) {
      const now = new Date().toISOString();
      const createdId = randomUUID();

      await db.orm.public.OnboardingSubmission.create({
        id: createdId,
        organizationId: context.organizationId,
        employeeId: context.employeeId,
        status: "DRAFT",
        employeeData: {},
        consentData: {},
        hrData: {},
        submittedAt: null,
        reviewedAt: null,
        reviewedById: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      } as never);

      await auditOnboardingEvent({
        req,
        organizationId: context.organizationId,
        actorId: context.employeeId,
        action: "ONBOARDING_DRAFT_CREATED",
        entityId: createdId,
        summary: "Employee onboarding draft created.",
      });

      submission = await getOwnSubmission(context);
    }

    if (!submission) {
      throw new AppError(
        500,
        "The onboarding draft could not be loaded.",
        "ONBOARDING_DRAFT_LOAD_FAILED",
      );
    }

    res.status(200).json({
      success: true,
      data: submission,
    });
  },
);

/* -------------------------------------------------------------------------- */
/* PATCH /api/onboarding/me                                                   */
/* Employee: save own draft                                                   */
/* -------------------------------------------------------------------------- */

router.patch(
  "/me",
  requireAuthentication,
  async (req: Request, res: Response): Promise<void> => {
    const context = await getEmployeeContext(req);
    const body = saveDraftSchema.parse(req.body);

    let submission = await getOwnSubmission(context);

    if (!submission) {
      const now = new Date().toISOString();
      const createdId = randomUUID();

      await db.orm.public.OnboardingSubmission.create({
        id: createdId,
        organizationId: context.organizationId,
        employeeId: context.employeeId,
        status: "DRAFT",
        employeeData: {},
        consentData: {},
        hrData: {},
        submittedAt: null,
        reviewedAt: null,
        reviewedById: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      } as never);

      await auditOnboardingEvent({
        req,
        organizationId: context.organizationId,
        actorId: context.employeeId,
        action: "ONBOARDING_DRAFT_CREATED",
        entityId: createdId,
        summary: "Employee onboarding draft created.",
      });

      submission = await getOwnSubmission(context);
    }

    if (!submission) {
      throw new AppError(
        500,
        "The onboarding draft could not be initialized.",
        "ONBOARDING_DRAFT_INITIALIZATION_FAILED",
      );
    }

    ensureStatus(submission.status, ["DRAFT", "RETURNED"]);

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.employeeData !== undefined) {
      updateData.employeeData = body.employeeData;
    }

    if (body.consentData !== undefined) {
      updateData.consentData = body.consentData;
    }

    await db.orm.public.OnboardingSubmission
      .where({
        id: submission.id,
        organizationId: context.organizationId,
        employeeId: context.employeeId,
      })
      .update(updateData as never);

    await auditOnboardingEvent({
      req,
      organizationId: context.organizationId,
      actorId: context.employeeId,
      action: "ONBOARDING_DRAFT_UPDATED",
      entityId: submission.id,
      summary: "Employee onboarding draft updated.",
      metadata: {
        employeeDataUpdated: body.employeeData !== undefined,
        consentDataUpdated: body.consentData !== undefined,
      },
    });

    const updated = await getOwnSubmission(context);

    res.status(200).json({
      success: true,
      message: "Onboarding draft saved successfully.",
      data: updated,
    });
  },
);

/* -------------------------------------------------------------------------- */
/* POST /api/onboarding/me/submit                                             */
/* Employee: submit completed form                                            */
/* -------------------------------------------------------------------------- */

router.post(
  "/me/submit",
  requireAuthentication,
  async (req: Request, res: Response): Promise<void> => {
    const context = await getEmployeeContext(req);
    const submission = await getOwnSubmission(context);

    if (!submission) {
      throw new AppError(
        409,
        "Save your onboarding information before submitting.",
        "ONBOARDING_DRAFT_REQUIRED",
      );
    }

    ensureStatus(submission.status, ["DRAFT", "RETURNED"]);

    requireCompleteEmployeeSubmission(
      submission.employeeData,
      submission.consentData,
    );

    const now = new Date().toISOString();

    await db.orm.public.OnboardingSubmission
      .where({
        id: submission.id,
        organizationId: context.organizationId,
        employeeId: context.employeeId,
      })
      .update({
        status: "SUBMITTED",
        submittedAt: now,
        reviewedAt: null,
        reviewedById: null,
        updatedAt: now,
      } as never);

    await auditOnboardingEvent({
      req,
      organizationId: context.organizationId,
      actorId: context.employeeId,
      action: "ONBOARDING_SUBMITTED",
      entityId: submission.id,
      summary: "Employee submitted onboarding for HR review.",
    });

    const updated = await getOwnSubmission(context);

    res.status(200).json({
      success: true,
      message: "Your onboarding form has been submitted for HR review.",
      data: updated,
    });
  },
);

/* -------------------------------------------------------------------------- */
/* GET /api/onboarding                                                        */
/* HR: list submissions for the current organization                          */
/* -------------------------------------------------------------------------- */

router.get(
  "/",
  requireAuthentication,
  requireRole("HR_ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    const context = await getEmployeeContext(req);
    const { page, pageSize } = getPagination(req);

    const statusValue = req.query.status;
    const status = Array.isArray(statusValue)
      ? statusValue[0]
      : statusValue;

    if (
      status !== undefined &&
      (
        typeof status !== "string" ||
        !onboardingStatuses.includes(status as OnboardingStatus)
      )
    ) {
      throw new AppError(
        400,
        "The requested onboarding status is invalid.",
        "ONBOARDING_STATUS_INVALID",
      );
    }

    const submissions = await db.orm.public.OnboardingSubmission
      .where({
        organizationId: context.organizationId,
      })
      .all();

    const filtered = status
      ? submissions.filter((item) => item.status === status)
      : submissions;

    filtered.sort((a, b) => {
      const aDate = new Date(a.updatedAt).getTime();
      const bDate = new Date(b.updatedAt).getTime();

      return bDate - aDate;
    });

    const start = (page - 1) * pageSize;

    res.status(200).json({
      success: true,
      data: filtered.slice(start, start + pageSize),
      pagination: {
        page,
        pageSize,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / pageSize),
      },
    });
  },
);

/* -------------------------------------------------------------------------- */
/* GET /api/onboarding/:submissionId                                          */
/* HR: view a submission within the current organization                      */
/* -------------------------------------------------------------------------- */

router.get(
  "/:submissionId",
  requireAuthentication,
  requireRole("HR_ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    const context = await getEmployeeContext(req);

    const submission = await getScopedSubmission(
      context.organizationId,
      getSubmissionId(req),
    );

    res.status(200).json({
      success: true,
      data: submission,
    });
  },
);

/* -------------------------------------------------------------------------- */
/* POST /api/onboarding/:submissionId/review                                  */
/* HR: start review or return submission                                      */
/* -------------------------------------------------------------------------- */

router.post(
  "/:submissionId/review",
  requireAuthentication,
  requireRole("HR_ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    const context = await getEmployeeContext(req);
    const submissionId = getSubmissionId(req);
    const body = reviewSchema.parse(req.body);

    const submission = await getScopedSubmission(
      context.organizationId,
      submissionId,
    );

    ensureStatus(
      submission.status,
      ["SUBMITTED", "UNDER_REVIEW"],
    );

    const existingHrData = parseJsonObject(submission.hrData);
    const now = new Date().toISOString();

    const nextHrData = {
      ...existingHrData,
      review: {
        action: body.action,
        reason: body.reason?.trim() ?? null,
        reviewedById: context.employeeId,
        reviewedAt: now,
      },
    };

    await db.orm.public.OnboardingSubmission
      .where({
        id: submissionId,
        organizationId: context.organizationId,
      })
      .update({
        status: body.action,
        hrData: nextHrData,
        reviewedAt: now,
        reviewedById: context.employeeId,
        updatedAt: now,
      } as never);

    await auditOnboardingEvent({
      req,
      organizationId: context.organizationId,
      actorId: context.employeeId,
      action:
        body.action === "RETURNED"
          ? "ONBOARDING_RETURNED"
          : "ONBOARDING_REVIEW_STARTED",
      entityId: submissionId,
      summary:
        body.action === "RETURNED"
          ? "HR returned onboarding for correction."
          : "HR started onboarding review.",
      metadata: {
        reasonProvided: Boolean(body.reason?.trim()),
      },
    });

    const updated = await getScopedSubmission(
      context.organizationId,
      submissionId,
    );

    res.status(200).json({
      success: true,
      message:
        body.action === "RETURNED"
          ? "Onboarding has been returned to the employee for correction."
          : "Onboarding is now under HR review.",
      data: updated,
    });
  },
);

/* -------------------------------------------------------------------------- */
/* PATCH /api/onboarding/:submissionId/hr-details                             */
/* HR: maintain employment and verification details                           */
/* -------------------------------------------------------------------------- */

router.patch(
  "/:submissionId/hr-details",
  requireAuthentication,
  requireRole("HR_ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    const context = await getEmployeeContext(req);
    const submissionId = getSubmissionId(req);
    const body = hrDetailsSchema.parse(req.body);

    const submission = await getScopedSubmission(
      context.organizationId,
      submissionId,
    );

    ensureStatus(submission.status, ["UNDER_REVIEW"]);

    const existingHrData = parseJsonObject(submission.hrData);

    const mergedHrData: Record<string, unknown> = {
      ...existingHrData,
    };

    if (body.employment !== undefined) {
      mergedHrData.employment = {
        ...parseJsonObject(existingHrData.employment),
        ...body.employment,
      };
    }

    if (body.verificationChecklist !== undefined) {
      mergedHrData.verificationChecklist = {
        ...parseJsonObject(existingHrData.verificationChecklist),
        ...body.verificationChecklist,
      };
    }

    if (body.equipmentAndAccess !== undefined) {
      mergedHrData.equipmentAndAccess = body.equipmentAndAccess;
    }

    if (body.signoff !== undefined) {
      mergedHrData.signoff = {
        ...parseJsonObject(existingHrData.signoff),
        ...body.signoff,
      };
    }

    await db.orm.public.OnboardingSubmission
      .where({
        id: submissionId,
        organizationId: context.organizationId,
      })
      .update({
        hrData: mergedHrData,
        updatedAt: new Date().toISOString(),
      } as never);

    await auditOnboardingEvent({
      req,
      organizationId: context.organizationId,
      actorId: context.employeeId,
      action: "ONBOARDING_HR_DETAILS_UPDATED",
      entityId: submissionId,
      summary:
        "HR updated employment, verification, equipment, or sign-off details.",
      metadata: {
        employmentUpdated: body.employment !== undefined,
        verificationChecklistUpdated:
          body.verificationChecklist !== undefined,
        equipmentAndAccessUpdated:
          body.equipmentAndAccess !== undefined,
        signoffUpdated: body.signoff !== undefined,
      },
    });

    const updated = await getScopedSubmission(
      context.organizationId,
      submissionId,
    );

    res.status(200).json({
      success: true,
      message: "HR onboarding details saved successfully.",
      data: updated,
    });
  },
);

/* -------------------------------------------------------------------------- */
/* POST /api/onboarding/:submissionId/complete                               */
/* HR: finalize onboarding                                                    */
/* -------------------------------------------------------------------------- */

router.post(
  "/:submissionId/complete",
  requireAuthentication,
  requireRole("HR_ADMIN", "SUPER_ADMIN"),
  async (req: Request, res: Response): Promise<void> => {
    const context = await getEmployeeContext(req);
    const submissionId = getSubmissionId(req);

    const submission = await getScopedSubmission(
      context.organizationId,
      submissionId,
    );

    ensureStatus(submission.status, ["UNDER_REVIEW"]);

    requireCompleteHrSection(submission.hrData);

    const now = new Date().toISOString();
    const existingHrData = parseJsonObject(submission.hrData);
    const existingSignoff = parseJsonObject(existingHrData.signoff);

    const finalizedHrData = {
      ...existingHrData,
      signoff: {
        ...existingSignoff,
        finalizedById: context.employeeId,
        finalizedAt: now,
      },
    };

    await db.orm.public.OnboardingSubmission
      .where({
        id: submissionId,
        organizationId: context.organizationId,
      })
      .update({
        status: "COMPLETED",
        hrData: finalizedHrData,
        completedAt: now,
        reviewedAt: now,
        reviewedById: context.employeeId,
        updatedAt: now,
      } as never);

    await auditOnboardingEvent({
      req,
      organizationId: context.organizationId,
      actorId: context.employeeId,
      action: "ONBOARDING_COMPLETED",
      entityId: submissionId,
      summary: "HR completed employee onboarding.",
    });

    const updated = await getScopedSubmission(
      context.organizationId,
      submissionId,
    );

    res.status(200).json({
      success: true,
      message: "Employee onboarding has been completed successfully.",
      data: updated,
    });
  },
);

export default router;