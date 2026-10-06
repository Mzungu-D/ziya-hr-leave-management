import { randomUUID } from "node:crypto";

import { db } from "../../prisma/db.js";
import { AppError } from "../middleware/error.middleware.js";

/* -------------------------------------------------------------------------- */
/* Public types                                                               */
/* -------------------------------------------------------------------------- */

export interface DepartmentPublicRecord {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentListResult {
  departments: DepartmentPublicRecord[];
  total: number;
}

export interface CreateDepartmentParams {
  organizationId: string;
  name: string;
  code: string;
}

export interface UpdateDepartmentParams {
  name?: string;
  code?: string;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const MAX_DEPARTMENT_NAME_LENGTH = 120;
const MAX_DEPARTMENT_CODE_LENGTH = 50;

/*
 * Department codes are deliberately restricted to a predictable identifier
 * format. This prevents invisible/control characters and ambiguous values
 * from entering the organization master data.
 */
const DEPARTMENT_CODE_PATTERN =
  /^[A-Z0-9](?:[A-Z0-9_-]*[A-Z0-9])?$/;

/*
 * These characters are never valid in organization master-data names.
 *
 * We still permit normal Unicode names such as:
 *
 * - Finance & Accounting
 * - Human Resources
 * - Équipe Finance
 *
 * while rejecting control characters and line separators.
 */
const CONTROL_CHARACTER_PATTERN =
  /[\u0000-\u001F\u007F\u0080-\u009F\u2028\u2029]/u;

/* -------------------------------------------------------------------------- */
/* Required identifiers                                                       */
/* -------------------------------------------------------------------------- */

function requireOrganizationId(
  organizationId: string,
): string {
  if (
    typeof organizationId !== "string"
  ) {
    throw new AppError(
      400,
      "Organization ID is required.",
      "ORGANIZATION_ID_REQUIRED",
    );
  }

  const normalized =
    organizationId.trim();

  if (!normalized) {
    throw new AppError(
      400,
      "Organization ID is required.",
      "ORGANIZATION_ID_REQUIRED",
    );
  }

  if (
    normalized.length > 255
  ) {
    throw new AppError(
      400,
      "Organization ID is invalid.",
      "ORGANIZATION_ID_INVALID",
    );
  }

  if (
    CONTROL_CHARACTER_PATTERN.test(
      normalized,
    )
  ) {
    throw new AppError(
      400,
      "Organization ID is invalid.",
      "ORGANIZATION_ID_INVALID",
    );
  }

  return normalized;
}

function requireDepartmentId(
  departmentId: string,
): string {
  if (
    typeof departmentId !== "string"
  ) {
    throw new AppError(
      400,
      "Department ID is required.",
      "DEPARTMENT_ID_REQUIRED",
    );
  }

  const normalized =
    departmentId.trim();

  if (!normalized) {
    throw new AppError(
      400,
      "Department ID is required.",
      "DEPARTMENT_ID_REQUIRED",
    );
  }

  if (
    normalized.length > 255
  ) {
    throw new AppError(
      400,
      "Department ID is invalid.",
      "DEPARTMENT_ID_INVALID",
    );
  }

  if (
    CONTROL_CHARACTER_PATTERN.test(
      normalized,
    )
  ) {
    throw new AppError(
      400,
      "Department ID is invalid.",
      "DEPARTMENT_ID_INVALID",
    );
  }

  return normalized;
}

/* -------------------------------------------------------------------------- */
/* Department name normalization                                              */
/* -------------------------------------------------------------------------- */

function normalizeDepartmentName(
  name: string,
): string {
  if (
    typeof name !== "string"
  ) {
    throw new AppError(
      400,
      "Department name is required.",
      "DEPARTMENT_NAME_REQUIRED",
    );
  }

  const normalized =
    name
      .normalize("NFC")
      .trim()
      .replace(/\s+/gu, " ");

  if (!normalized) {
    throw new AppError(
      400,
      "Department name is required.",
      "DEPARTMENT_NAME_REQUIRED",
    );
  }

  if (
    normalized.length >
    MAX_DEPARTMENT_NAME_LENGTH
  ) {
    throw new AppError(
      400,
      `Department name must not exceed ${MAX_DEPARTMENT_NAME_LENGTH} characters.`,
      "DEPARTMENT_NAME_TOO_LONG",
    );
  }

  if (
    CONTROL_CHARACTER_PATTERN.test(
      normalized,
    )
  ) {
    throw new AppError(
      400,
      "Department name contains invalid characters.",
      "DEPARTMENT_NAME_INVALID",
    );
  }

  return normalized;
}

/* -------------------------------------------------------------------------- */
/* Department code normalization                                              */
/* -------------------------------------------------------------------------- */

function normalizeDepartmentCode(
  code: string,
): string {
  if (
    typeof code !== "string"
  ) {
    throw new AppError(
      400,
      "Department code is required.",
      "DEPARTMENT_CODE_REQUIRED",
    );
  }

  const normalized =
    code
      .normalize("NFC")
      .trim()
      .toUpperCase();

  if (!normalized) {
    throw new AppError(
      400,
      "Department code is required.",
      "DEPARTMENT_CODE_REQUIRED",
    );
  }

  if (
    normalized.length >
    MAX_DEPARTMENT_CODE_LENGTH
  ) {
    throw new AppError(
      400,
      `Department code must not exceed ${MAX_DEPARTMENT_CODE_LENGTH} characters.`,
      "DEPARTMENT_CODE_TOO_LONG",
    );
  }

  if (
    !DEPARTMENT_CODE_PATTERN.test(
      normalized,
    )
  ) {
    throw new AppError(
      400,
      "Department code must contain only letters, numbers, underscores, and hyphens, and must start and end with a letter or number.",
      "DEPARTMENT_CODE_INVALID",
    );
  }

  return normalized;
}

/* -------------------------------------------------------------------------- */
/* Organization validation                                                   */
/* -------------------------------------------------------------------------- */

async function assertOrganizationExists(
  organizationId: string,
): Promise<void> {
  const organization =
    await db.orm.public.Organization
      .where({
        id: organizationId,
      })
      .first();

  if (!organization) {
    throw new AppError(
      400,
      "The organization does not exist.",
      "ORGANIZATION_NOT_FOUND",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Department lookup                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Every department lookup is organization-scoped.
 *
 * This is critical for tenant isolation. A caller can never retrieve or
 * modify a department simply by knowing its ID.
 */
async function findDepartmentById(
  organizationId: string,
  departmentId: string,
) {
  return db.orm.public.Department
    .where({
      id: departmentId,
      organizationId,
    })
    .first();
}

/* -------------------------------------------------------------------------- */
/* Duplicate protection                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Department names are not protected by a database uniqueness constraint in
 * the current production contract.
 *
 * We therefore perform an application-level duplicate check. The database
 * remains the final authority for the unique department code.
 */
async function ensureDepartmentNameAvailable(
  organizationId: string,
  name: string,
  excludeDepartmentId?: string,
): Promise<void> {
  const departments =
    await db.orm.public.Department
      .where({
        organizationId,
      })
      .all();

  const normalizedName =
    name
      .normalize("NFC")
      .trim()
      .replace(/\s+/gu, " ")
      .toLocaleLowerCase();

  const duplicate =
    departments.some(
      (department) => {
        if (
          department.id ===
          excludeDepartmentId
        ) {
          return false;
        }

        const existingName =
          department.name
            .normalize("NFC")
            .trim()
            .replace(/\s+/gu, " ")
            .toLocaleLowerCase();

        return (
          existingName ===
          normalizedName
        );
      },
    );

  if (duplicate) {
    throw new AppError(
      409,
      "A department with this name already exists in this organization.",
      "DEPARTMENT_NAME_EXISTS",
    );
  }
}

async function ensureDepartmentCodeAvailable(
  organizationId: string,
  code: string,
  excludeDepartmentId?: string,
): Promise<void> {
  const department =
    await db.orm.public.Department
      .where({
        organizationId,
        code,
      })
      .first();

  if (
    department &&
    department.id !==
      excludeDepartmentId
  ) {
    throw new AppError(
      409,
      "A department with this code already exists in this organization.",
      "DEPARTMENT_CODE_EXISTS",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Public DTO                                                                 */
/* -------------------------------------------------------------------------- */

function toPublicDepartment(
  department: {
    id: string;
    organizationId: string;
    name: string;
    code: string;
    createdAt: string;
    updatedAt: string;
  },
): DepartmentPublicRecord {
  return {
    id: department.id,
    organizationId:
      department.organizationId,
    name: department.name,
    code: department.code,
    createdAt:
      department.createdAt,
    updatedAt:
      department.updatedAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Database constraint translation                                            */
/* -------------------------------------------------------------------------- */

/**
 * The current database contract has a unique constraint on:
 *
 *   (organizationId, code)
 *
 * It does NOT have a database constraint on department name.
 *
 * We therefore translate only the constraint that actually exists.
 */
function translateDepartmentConstraintError(
  error: unknown,
): never {
  const message =
    error instanceof Error
      ? error.message
      : "";

  if (
    /Department_organizationId_code_key/i.test(
      message,
    )
  ) {
    throw new AppError(
      409,
      "A department with this code already exists in this organization.",
      "DEPARTMENT_CODE_EXISTS",
    );
  }

  /*
   * Some PostgreSQL/driver errors expose the constraint name differently.
   * Keep the matching deliberately narrow so unrelated database failures
   * are never incorrectly reported as duplicate departments.
   */
  if (
    /unique constraint/i.test(
      message,
    ) &&
    /organizationId/i.test(
      message,
    ) &&
    /code/i.test(
      message,
    )
  ) {
    throw new AppError(
      409,
      "A department with this code already exists in this organization.",
      "DEPARTMENT_CODE_EXISTS",
    );
  }

  throw error;
}

/* -------------------------------------------------------------------------- */
/* List departments                                                           */
/* -------------------------------------------------------------------------- */

export async function listDepartments(
  organizationId: string,
): Promise<DepartmentListResult> {
  const normalizedOrganizationId =
    requireOrganizationId(
      organizationId,
    );

  const departments =
    await db.orm.public.Department
      .where({
        organizationId:
          normalizedOrganizationId,
      })
      .all();

  return {
    departments:
      departments.map(
        toPublicDepartment,
      ),
    total:
      departments.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Get department                                                             */
/* -------------------------------------------------------------------------- */

export async function getDepartment(
  organizationId: string,
  departmentId: string,
): Promise<DepartmentPublicRecord> {
  const normalizedOrganizationId =
    requireOrganizationId(
      organizationId,
    );

  const normalizedDepartmentId =
    requireDepartmentId(
      departmentId,
    );

  const department =
    await findDepartmentById(
      normalizedOrganizationId,
      normalizedDepartmentId,
    );

  if (!department) {
    throw new AppError(
      404,
      "Department not found.",
      "DEPARTMENT_NOT_FOUND",
    );
  }

  return toPublicDepartment(
    department,
  );
}

/* -------------------------------------------------------------------------- */
/* Create department                                                          */
/* -------------------------------------------------------------------------- */

export async function createDepartment(
  params: CreateDepartmentParams,
): Promise<DepartmentPublicRecord> {
  const organizationId =
    requireOrganizationId(
      params.organizationId,
    );

  await assertOrganizationExists(
    organizationId,
  );

  const name =
    normalizeDepartmentName(
      params.name,
    );

  const code =
    normalizeDepartmentCode(
      params.code,
    );

  await ensureDepartmentNameAvailable(
    organizationId,
    name,
  );

  await ensureDepartmentCodeAvailable(
    organizationId,
    code,
  );

  const departmentId =
    randomUUID();

  try {
    await db.orm.public.Department
      .create({
        id: departmentId,
        organizationId,
        name,
        code,
      });
  } catch (error) {
    translateDepartmentConstraintError(
      error,
    );
  }

  const created =
    await findDepartmentById(
      organizationId,
      departmentId,
    );

  if (!created) {
    throw new AppError(
      500,
      "Department was created but could not be loaded.",
      "DEPARTMENT_CREATE_STATE_ERROR",
    );
  }

  return toPublicDepartment(
    created,
  );
}

/* -------------------------------------------------------------------------- */
/* Update department                                                          */
/* -------------------------------------------------------------------------- */

export async function updateDepartment(
  organizationId: string,
  departmentId: string,
  params: UpdateDepartmentParams,
): Promise<DepartmentPublicRecord> {
  const normalizedOrganizationId =
    requireOrganizationId(
      organizationId,
    );

  const normalizedDepartmentId =
    requireDepartmentId(
      departmentId,
    );

  const existing =
    await findDepartmentById(
      normalizedOrganizationId,
      normalizedDepartmentId,
    );

  if (!existing) {
    throw new AppError(
      404,
      "Department not found.",
      "DEPARTMENT_NOT_FOUND",
    );
  }

  const hasName =
    params.name !== undefined;

  const hasCode =
    params.code !== undefined;

  if (
    !hasName &&
    !hasCode
  ) {
    throw new AppError(
      400,
      "At least one department field must be provided.",
      "DEPARTMENT_UPDATE_EMPTY",
    );
  }

  const updateData: {
    name?: string;
    code?: string;
  } = {};

  if (hasName) {
    const name =
      normalizeDepartmentName(
        params.name as string,
      );

    await ensureDepartmentNameAvailable(
      normalizedOrganizationId,
      name,
      normalizedDepartmentId,
    );

    updateData.name = name;
  }

  if (hasCode) {
    const code =
      normalizeDepartmentCode(
        params.code as string,
      );

    await ensureDepartmentCodeAvailable(
      normalizedOrganizationId,
      code,
      normalizedDepartmentId,
    );

    updateData.code = code;
  }

  try {
    await db.orm.public.Department
      .where({
        id: normalizedDepartmentId,
        organizationId:
          normalizedOrganizationId,
      })
      .update(
        updateData,
      );
  } catch (error) {
    translateDepartmentConstraintError(
      error,
    );
  }

  const updated =
    await findDepartmentById(
      normalizedOrganizationId,
      normalizedDepartmentId,
    );

  if (!updated) {
    throw new AppError(
      500,
      "Department was updated but could not be loaded.",
      "DEPARTMENT_UPDATE_STATE_ERROR",
    );
  }

  return toPublicDepartment(
    updated,
  );
}

/* -------------------------------------------------------------------------- */
/* Delete department                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Departments are master data and should not be deleted when historical
 * records depend on them.
 *
 * We explicitly prevent deletion when:
 *
 * 1. employees are currently assigned to the department;
 * 2. leave requests reference the department.
 *
 * The database foreign key remains the final safety boundary.
 */
export async function deleteDepartment(
  organizationId: string,
  departmentId: string,
): Promise<void> {
  const normalizedOrganizationId =
    requireOrganizationId(
      organizationId,
    );

  const normalizedDepartmentId =
    requireDepartmentId(
      departmentId,
    );

  const department =
    await findDepartmentById(
      normalizedOrganizationId,
      normalizedDepartmentId,
    );

  if (!department) {
    throw new AppError(
      404,
      "Department not found.",
      "DEPARTMENT_NOT_FOUND",
    );
  }

  const assignedEmployee =
    await db.orm.public.Employee
      .where({
        organizationId:
          normalizedOrganizationId,
        departmentId:
          normalizedDepartmentId,
      })
      .first();

  if (assignedEmployee) {
    throw new AppError(
      409,
      "This department cannot be deleted while employees are assigned to it.",
      "DEPARTMENT_HAS_EMPLOYEES",
    );
  }

  const leaveRequest =
    await db.orm.public.LeaveRequest
      .where({
        departmentId:
          normalizedDepartmentId,
      })
      .first();

  if (leaveRequest) {
    throw new AppError(
      409,
      "This department cannot be deleted because it is referenced by leave history.",
      "DEPARTMENT_HAS_LEAVE_HISTORY",
    );
  }

  try {
    await db.orm.public.Department
      .where({
        id: normalizedDepartmentId,
        organizationId:
          normalizedOrganizationId,
      })
      .delete();
  } catch (error) {
    /*
     * Never expose the raw database error.
     *
     * A concurrent employee/leave assignment can appear between the
     * protection checks above and this delete. The database constraint is
     * therefore still the authoritative final protection.
     */
    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      /foreign key/i.test(
        message,
      ) ||
      /violates.*constraint/i.test(
        message,
      )
    ) {
      throw new AppError(
        409,
        "This department cannot be deleted because it is still referenced by other records.",
        "DEPARTMENT_IN_USE",
      );
    }

    throw error;
  }
}