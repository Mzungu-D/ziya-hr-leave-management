import { randomUUID } from "node:crypto";

import { db } from "../../prisma/db.js";
import { AppError } from "../middleware/error.middleware.js";

/* ============================================================
 * LEAVE TYPE SERVICE
 *
 * Production responsibilities:
 *
 * - Strict tenant isolation
 * - Organization ownership validation
 * - Input normalization
 * - Stable leave-type codes
 * - Duplicate protection
 * - Safe updates
 * - Historical integrity
 * - No hard deletion of leave types
 *
 * Current database contract:
 *
 * LeaveType
 *   id
 *   organizationId
 *   name
 *   code
 *   daysPerYear
 *   isActive
 *   requiresDocument
 *   createdAt
 *   updatedAt
 *
 * LeaveBalance and LeaveRequest both reference LeaveType.
 *
 * IMPORTANT:
 * This service intentionally does NOT implement accrual,
 * carry-forward, eligibility, qualification, or workflow rules.
 * Those belong to the policy/balance engine that will be built
 * on top of this definition layer.
 * ============================================================ */


/* ============================================================
 * TYPES
 * ============================================================ */

export interface CreateLeaveTypeParams {
  organizationId: string;
  name: string;
  code: string;
  daysPerYear: number;
  isActive?: boolean;
  requiresDocument?: boolean;
}

export interface UpdateLeaveTypeParams {
  organizationId: string;
  leaveTypeId: string;
  name?: string;
  code?: string;
  daysPerYear?: number;
  isActive?: boolean;
  requiresDocument?: boolean;
}


/* ============================================================
 * NORMALIZATION
 * ============================================================ */

/**
 * Normalize human-readable text consistently.
 *
 * NFC normalization prevents visually identical Unicode
 * strings from being stored as different values.
 */
function normalizeText(
  value: string,
  fieldName: string
): string {
  if (typeof value !== "string") {
    throw new AppError(
      400,
      `${fieldName} must be a string.`,
      "INVALID_LEAVE_TYPE_INPUT"
    );
  }

  const normalized = value
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ");

  if (!normalized) {
    throw new AppError(
      400,
      `${fieldName} is required.`,
      "INVALID_LEAVE_TYPE_INPUT"
    );
  }

  /**
   * Reject control characters.
   *
   * This prevents invisible characters from entering names
   * and codes and causing confusing duplicate behaviour.
   */
  for (const character of normalized) {
    const codePoint = character.codePointAt(0);

    if (
      codePoint !== undefined &&
      (
        codePoint < 32 ||
        codePoint === 127
      )
    ) {
      throw new AppError(
        400,
        `${fieldName} contains invalid characters.`,
        "INVALID_LEAVE_TYPE_INPUT"
      );
    }
  }

  return normalized;
}


/**
 * Normalize leave type name.
 */
function normalizeLeaveTypeName(
  value: string
): string {
  const normalized = normalizeText(
    value,
    "Leave type name"
  );

  if (normalized.length > 120) {
    throw new AppError(
      400,
      "Leave type name must not exceed 120 characters.",
      "LEAVE_TYPE_NAME_TOO_LONG"
    );
  }

  return normalized;
}


/**
 * Normalize leave type code.
 *
 * Codes are deliberately strict because they become stable
 * identifiers used by administrators, reports and integrations.
 */
function normalizeLeaveTypeCode(
  value: string
): string {
  const normalized = normalizeText(
    value,
    "Leave type code"
  ).toUpperCase();

  if (normalized.length > 50) {
    throw new AppError(
      400,
      "Leave type code must not exceed 50 characters.",
      "LEAVE_TYPE_CODE_TOO_LONG"
    );
  }

  /**
   * Allowed:
   *   ANNUAL
   *   SICK
   *   MATERNITY
   *   PATERNITY
   *   STUDY_LEAVE
   *   UNPAID-LEAVE
   *   SPECIAL_01
   *
   * Not allowed:
   *   spaces
   *   punctuation
   *   leading/trailing separators
   */
  if (
    !/^[A-Z0-9](?:[A-Z0-9_-]*[A-Z0-9])?$/.test(
      normalized
    )
  ) {
    throw new AppError(
      400,
      "Leave type code may contain only letters, numbers, hyphens and underscores, and must start and end with a letter or number.",
      "INVALID_LEAVE_TYPE_CODE"
    );
  }

  return normalized;
}


/**
 * Validate the annual entitlement.
 *
 * The current schema stores this as PostgreSQL int4.
 * We therefore keep the validation within the database's
 * supported integer range without imposing an arbitrary
 * business maximum.
 */
function validateDaysPerYear(
  value: number
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    !Number.isSafeInteger(value)
  ) {
    throw new AppError(
      400,
      "Days per year must be a whole number.",
      "INVALID_DAYS_PER_YEAR"
    );
  }

  if (value < 0) {
    throw new AppError(
      400,
      "Days per year cannot be negative.",
      "INVALID_DAYS_PER_YEAR"
    );
  }

  /**
   * PostgreSQL int4 maximum.
   */
  if (value > 2_147_483_647) {
    throw new AppError(
      400,
      "Days per year exceeds the supported limit.",
      "INVALID_DAYS_PER_YEAR"
    );
  }

  return value;
}


/**
 * Validate boolean fields explicitly.
 */
function validateBoolean(
  value: unknown,
  fieldName: string
): boolean {
  if (typeof value !== "boolean") {
    throw new AppError(
      400,
      `${fieldName} must be a boolean.`,
      "INVALID_LEAVE_TYPE_INPUT"
    );
  }

  return value;
}


/* ============================================================
 * TENANT VALIDATION
 * ============================================================ */

/**
 * Every leave type must belong to a real organization.
 *
 * organizationId always comes from authenticated server-side
 * context. It must never be trusted from a client-supplied
 * organization identifier.
 */
async function assertOrganizationExists(
  organizationId: string
): Promise<void> {
  const normalizedOrganizationId =
    typeof organizationId === "string"
      ? organizationId.trim()
      : "";

  if (!normalizedOrganizationId) {
    throw new AppError(
      403,
      "A valid organization context is required.",
      "ORGANIZATION_CONTEXT_REQUIRED"
    );
  }

  const organization =
    await db.orm.public.Organization
      .where({
        id: normalizedOrganizationId
      })
      .first();

  if (!organization) {
    throw new AppError(
      404,
      "Organization not found.",
      "ORGANIZATION_NOT_FOUND"
    );
  }
}


/* ============================================================
 * MAPPING
 * ============================================================ */

function mapLeaveType(
  leaveType: any
) {
  return {
    id: leaveType.id,
    organizationId:
      leaveType.organizationId,
    name: leaveType.name,
    code: leaveType.code,
    daysPerYear: leaveType.daysPerYear,
    isActive: leaveType.isActive,
    requiresDocument:
      leaveType.requiresDocument,
    createdAt: leaveType.createdAt,
    updatedAt: leaveType.updatedAt
  };
}


/* ============================================================
 * GET ONE
 * ============================================================ */

export async function getLeaveType(
  organizationId: string,
  leaveTypeId: string
) {
  await assertOrganizationExists(
    organizationId
  );

  const normalizedLeaveTypeId =
    typeof leaveTypeId === "string"
      ? leaveTypeId.trim()
      : "";

  if (!normalizedLeaveTypeId) {
    throw new AppError(
      400,
      "Leave type ID is required.",
      "LEAVE_TYPE_ID_REQUIRED"
    );
  }

  /**
   * CRITICAL TENANT ISOLATION:
   *
   * The organizationId is part of the lookup.
   *
   * A user from Organization A can therefore never retrieve
   * a LeaveType belonging to Organization B even if they know
   * the LeaveType ID.
   */
  const leaveType =
    await db.orm.public.LeaveType
      .where({
        id: normalizedLeaveTypeId,
        organizationId
      })
      .first();

  if (!leaveType) {
    throw new AppError(
      404,
      "Leave type not found.",
      "LEAVE_TYPE_NOT_FOUND"
    );
  }

  return mapLeaveType(
    leaveType
  );
}


/* ============================================================
 * LIST
 * ============================================================ */

export async function listLeaveTypes(
  organizationId: string,
  options?: {
    includeInactive?: boolean;
  }
) {
  await assertOrganizationExists(
    organizationId
  );

  const includeInactive =
    options?.includeInactive === true;

  /**
   * Always constrain by organization.
   */
  const leaveTypes =
    await db.orm.public.LeaveType
      .where({
        organizationId
      })
      .all();

  const filtered =
    includeInactive
      ? leaveTypes
      : leaveTypes.filter(
          (leaveType: any) =>
            leaveType.isActive === true
        );

  /**
   * Stable server-side ordering.
   *
   * Code is used as the deterministic secondary ordering
   * because names can be changed by administrators.
   */
  filtered.sort(
    (
      a: any,
      b: any
    ) => {
      const nameComparison =
        String(a.name).localeCompare(
          String(b.name),
          undefined,
          {
            sensitivity: "base"
          }
        );

      if (nameComparison !== 0) {
        return nameComparison;
      }

      return String(a.code).localeCompare(
        String(b.code)
      );
    }
  );

  return filtered.map(
    mapLeaveType
  );
}


/**
 * Convenience method for employee-facing leave selection.
 *
 * Only active leave types are returned.
 */
export async function listActiveLeaveTypes(
  organizationId: string
) {
  return listLeaveTypes(
    organizationId,
    {
      includeInactive: false
    }
  );
}


/* ============================================================
 * DUPLICATE NAME CHECK
 * ============================================================ */

/**
 * The database currently guarantees uniqueness for:
 *
 *   (organizationId, code)
 *
 * It does not guarantee normalized name uniqueness.
 *
 * We therefore protect names at the application layer.
 */
async function ensureUniqueLeaveTypeName(
  organizationId: string,
  normalizedName: string,
  excludeLeaveTypeId?: string
): Promise<void> {
  const leaveTypes =
    await db.orm.public.LeaveType
      .where({
        organizationId
      })
      .all();

  const normalizedTarget =
    normalizedName
      .normalize("NFC")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase();

  const duplicate =
    leaveTypes.find(
      (leaveType: any) => {
        if (
          excludeLeaveTypeId &&
          leaveType.id ===
            excludeLeaveTypeId
        ) {
          return false;
        }

        const existingName =
          String(
            leaveType.name
          )
            .normalize("NFC")
            .trim()
            .replace(/\s+/g, " ")
            .toLocaleLowerCase();

        return (
          existingName ===
          normalizedTarget
        );
      }
    );

  if (duplicate) {
    throw new AppError(
      409,
      "A leave type with this name already exists in this organization.",
      "LEAVE_TYPE_NAME_ALREADY_EXISTS"
    );
  }
}


/* ============================================================
 * CREATE
 * ============================================================ */

export async function createLeaveType(
  params: CreateLeaveTypeParams
) {
  await assertOrganizationExists(
    params.organizationId
  );

  const organizationId =
    params.organizationId.trim();

  const name =
    normalizeLeaveTypeName(
      params.name
    );

  const code =
    normalizeLeaveTypeCode(
      params.code
    );

  const daysPerYear =
    validateDaysPerYear(
      params.daysPerYear
    );

  const isActive =
    params.isActive === undefined
      ? true
      : validateBoolean(
          params.isActive,
          "isActive"
        );

  const requiresDocument =
    params.requiresDocument === undefined
      ? false
      : validateBoolean(
          params.requiresDocument,
          "requiresDocument"
        );

  await ensureUniqueLeaveTypeName(
    organizationId,
    name
  );

  /**
   * Explicit tenant-scoped duplicate check.
   *
   * This provides a clean application error before the
   * database constraint is reached.
   */
  const existingCode =
    await db.orm.public.LeaveType
      .where({
        organizationId,
        code
      })
      .first();

  if (existingCode) {
    throw new AppError(
      409,
      "A leave type with this code already exists in this organization.",
      "LEAVE_TYPE_CODE_ALREADY_EXISTS"
    );
  }

  const now =
    new Date().toISOString();

  try {
    const leaveType =
      await db.orm.public.LeaveType
        .create({
          id: randomUUID(),
          organizationId,
          name,
          code,
          daysPerYear,
          isActive,
          requiresDocument,
          createdAt: now,
          updatedAt: now
        });

    return mapLeaveType(
      leaveType
    );
  } catch (error) {
    /**
     * Protect against concurrent requests.
     *
     * The application-level duplicate check above cannot
     * eliminate a race between two simultaneous requests.
     *
     * The database unique constraint remains authoritative.
     */
    if (
      isUniqueConstraintError(
        error
      )
    ) {
      throw new AppError(
        409,
        "A leave type with this code already exists in this organization.",
        "LEAVE_TYPE_CODE_ALREADY_EXISTS"
      );
    }

    throw error;
  }
}


/* ============================================================
 * UPDATE
 * ============================================================ */

export async function updateLeaveType(
  params: UpdateLeaveTypeParams
) {
  await assertOrganizationExists(
    params.organizationId
  );

  const organizationId =
    params.organizationId.trim();

  const leaveTypeId =
    typeof params.leaveTypeId ===
      "string"
      ? params.leaveTypeId.trim()
      : "";

  if (!leaveTypeId) {
    throw new AppError(
      400,
      "Leave type ID is required.",
      "LEAVE_TYPE_ID_REQUIRED"
    );
  }

  /**
   * Tenant-scoped lookup.
   *
   * This prevents cross-organization updates.
   */
  const existing =
    await db.orm.public.LeaveType
      .where({
        id: leaveTypeId,
        organizationId
      })
      .first();

  if (!existing) {
    throw new AppError(
      404,
      "Leave type not found.",
      "LEAVE_TYPE_NOT_FOUND"
    );
  }

  /**
   * Build update data only from explicitly supplied fields.
   *
   * This prevents PATCH requests from unintentionally
   * overwriting fields with undefined values.
   */
  const updateData: Record<
    string,
    unknown
  > = {};

  if (
    params.name !== undefined
  ) {
    const name =
      normalizeLeaveTypeName(
        params.name
      );

    await ensureUniqueLeaveTypeName(
      organizationId,
      name,
      leaveTypeId
    );

    updateData.name =
      name;
  }

  if (
    params.code !== undefined
  ) {
    const code =
      normalizeLeaveTypeCode(
        params.code
      );

    /**
     * Only check another record.
     */
    const duplicateCode =
      await db.orm.public.LeaveType
        .where({
          organizationId,
          code
        })
        .first();

    if (
      duplicateCode &&
      duplicateCode.id !==
        leaveTypeId
    ) {
      throw new AppError(
        409,
        "A leave type with this code already exists in this organization.",
        "LEAVE_TYPE_CODE_ALREADY_EXISTS"
      );
    }

    updateData.code =
      code;
  }

  if (
    params.daysPerYear !==
    undefined
  ) {
    updateData.daysPerYear =
      validateDaysPerYear(
        params.daysPerYear
      );
  }

  if (
    params.isActive !==
    undefined
  ) {
    updateData.isActive =
      validateBoolean(
        params.isActive,
        "isActive"
      );
  }

  if (
    params.requiresDocument !==
    undefined
  ) {
    updateData.requiresDocument =
      validateBoolean(
        params.requiresDocument,
        "requiresDocument"
      );
  }

  /**
   * Nothing changed.
   *
   * Returning the current resource is safer than issuing
   * an unnecessary database write.
   */
  if (
    Object.keys(
      updateData
    ).length === 0
  ) {
    return mapLeaveType(
      existing
    );
  }

  updateData.updatedAt =
    new Date().toISOString();

  try {
    const updated =
      await db.orm.public.LeaveType
        .where({
          id: leaveTypeId,
          organizationId
        })
        .update(
          updateData
        );

    return mapLeaveType(
      updated
    );
  } catch (error) {
    if (
      isUniqueConstraintError(
        error
      )
    ) {
      throw new AppError(
        409,
        "A leave type with this code already exists in this organization.",
        "LEAVE_TYPE_CODE_ALREADY_EXISTS"
      );
    }

    throw error;
  }
}


/* ============================================================
 * DEACTIVATE
 * ============================================================ */

/**
 * Leave types are referenced by LeaveBalance and LeaveRequest.
 *
 * We therefore deliberately do not hard-delete them.
 *
 * Deactivation preserves historical records while preventing
 * the leave type from being offered for new employee requests.
 */
export async function deactivateLeaveType(
  organizationId: string,
  leaveTypeId: string
) {
  return updateLeaveType({
    organizationId,
    leaveTypeId,
    isActive: false
  });
}


/* ============================================================
 * REACTIVATE
 * ============================================================ */

export async function activateLeaveType(
  organizationId: string,
  leaveTypeId: string
) {
  return updateLeaveType({
    organizationId,
    leaveTypeId,
    isActive: true
  });
}


/* ============================================================
 * DATABASE ERROR HELPERS
 * ============================================================ */

function isUniqueConstraintError(
  error: unknown
): boolean {
  if (
    typeof error !== "object" ||
    error === null
  ) {
    return false;
  }

  const candidate =
    error as {
      code?: unknown;
      meta?: {
        constraint?: unknown;
        target?: unknown;
      };
    };

  /**
   * Prisma-style unique constraint.
   */
  if (
    candidate.code ===
    "P2002"
  ) {
    return true;
  }

  /**
   * Current LeaveType database contract:
   *
   * LeaveType_organizationId_code_key
   *
   * We only translate an error when it clearly identifies
   * that constraint. Other database errors must propagate
   * to the global error middleware instead of being hidden.
   */
  const constraint =
    candidate.meta?.constraint;

  if (
    constraint ===
    "LeaveType_organizationId_code_key"
  ) {
    return true;
  }

  const target =
    candidate.meta?.target;

  if (
    Array.isArray(target) &&
    target.includes(
      "organizationId"
    ) &&
    target.includes(
      "code"
    )
  ) {
    return true;
  }

  return false;
}