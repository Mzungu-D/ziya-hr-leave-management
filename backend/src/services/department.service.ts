import { randomUUID } from "node:crypto";

import { db } from "../../prisma/db.js";

import { AppError } from "../middleware/error.middleware.js";

/* -------------------------------------------------------------------------- */
/* Public types                                                               */
/* -------------------------------------------------------------------------- */

export interface DepartmentLeadPublicRecord {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "MANAGER" | "HR_ADMIN" | "SUPER_ADMIN";
  status: string;
}

export interface DepartmentPublicRecord {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  departmentLead: DepartmentLeadPublicRecord | null;
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
  departmentLeadId?: string | null;
}

export interface UpdateDepartmentParams {
  name?: string;
  code?: string;
  departmentLeadId?: string | null;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const MAX_DEPARTMENT_NAME_LENGTH = 120;
const MAX_DEPARTMENT_CODE_LENGTH = 50;
const MAX_DEPARTMENT_ID_LENGTH = 255;

const DEPARTMENT_CODE_PATTERN =
  /^[A-Z0-9](?:[A-Z0-9_-]*[A-Z0-9])?$/;

const CONTROL_CHARACTER_PATTERN =
  /[\u0000-\u001F\u007F\u0080-\u009F\u2028\u2029]/u;

const DEPARTMENT_LEAD_ROLES = new Set([
  "MANAGER",
  "HR_ADMIN",
  "SUPER_ADMIN",
]);

/* -------------------------------------------------------------------------- */
/* Required identifiers                                                       */
/* -------------------------------------------------------------------------- */

function requireOrganizationId(
  organizationId: string,
): string {
  if (typeof organizationId !== "string") {
    throw new AppError(
      400,
      "Organization ID is required.",
      "ORGANIZATION_ID_REQUIRED",
    );
  }

  const normalized = organizationId.trim();

  if (!normalized) {
    throw new AppError(
      400,
      "Organization ID is required.",
      "ORGANIZATION_ID_REQUIRED",
    );
  }

  if (normalized.length > MAX_DEPARTMENT_ID_LENGTH) {
    throw new AppError(
      400,
      "Organization ID is invalid.",
      "ORGANIZATION_ID_INVALID",
    );
  }

  if (CONTROL_CHARACTER_PATTERN.test(normalized)) {
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
  if (typeof departmentId !== "string") {
    throw new AppError(
      400,
      "Department ID is required.",
      "DEPARTMENT_ID_REQUIRED",
    );
  }

  const normalized = departmentId.trim();

  if (!normalized) {
    throw new AppError(
      400,
      "Department ID is required.",
      "DEPARTMENT_ID_REQUIRED",
    );
  }

  if (normalized.length > MAX_DEPARTMENT_ID_LENGTH) {
    throw new AppError(
      400,
      "Department ID is invalid.",
      "DEPARTMENT_ID_INVALID",
    );
  }

  if (CONTROL_CHARACTER_PATTERN.test(normalized)) {
    throw new AppError(
      400,
      "Department ID is invalid.",
      "DEPARTMENT_ID_INVALID",
    );
  }

  return normalized;
}

function normalizeOptionalDepartmentLeadId(
  departmentLeadId: string | null | undefined,
): string | null | undefined {
  if (departmentLeadId === undefined) {
    return undefined;
  }

  if (departmentLeadId === null) {
    return null;
  }

  if (typeof departmentLeadId !== "string") {
    throw new AppError(
      400,
      "Department lead ID is invalid.",
      "DEPARTMENT_LEAD_ID_INVALID",
    );
  }

  const normalized = departmentLeadId.trim();

  if (!normalized) {
    throw new AppError(
      400,
      "Department lead ID is invalid.",
      "DEPARTMENT_LEAD_ID_INVALID",
    );
  }

  if (normalized.length > MAX_DEPARTMENT_ID_LENGTH) {
    throw new AppError(
      400,
      "Department lead ID is invalid.",
      "DEPARTMENT_LEAD_ID_INVALID",
    );
  }

  if (CONTROL_CHARACTER_PATTERN.test(normalized)) {
    throw new AppError(
      400,
      "Department lead ID is invalid.",
      "DEPARTMENT_LEAD_ID_INVALID",
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
  if (typeof name !== "string") {
    throw new AppError(
      400,
      "Department name is required.",
      "DEPARTMENT_NAME_REQUIRED",
    );
  }

  const normalized = name
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

  if (normalized.length > MAX_DEPARTMENT_NAME_LENGTH) {
    throw new AppError(
      400,
      `Department name must not exceed ${MAX_DEPARTMENT_NAME_LENGTH} characters.`,
      "DEPARTMENT_NAME_TOO_LONG",
    );
  }

  if (CONTROL_CHARACTER_PATTERN.test(normalized)) {
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
  if (typeof code !== "string") {
    throw new AppError(
      400,
      "Department code is required.",
      "DEPARTMENT_CODE_REQUIRED",
    );
  }

  const normalized = code
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

  if (normalized.length > MAX_DEPARTMENT_CODE_LENGTH) {
    throw new AppError(
      400,
      `Department code must not exceed ${MAX_DEPARTMENT_CODE_LENGTH} characters.`,
      "DEPARTMENT_CODE_TOO_LONG",
    );
  }

  if (!DEPARTMENT_CODE_PATTERN.test(normalized)) {
    throw new AppError(
      400,
      "Department code must contain only letters, numbers, underscores, and hyphens, and must start and end with a letter or number.",
      "DEPARTMENT_CODE_INVALID",
    );
  }

  return normalized;
}

/* -------------------------------------------------------------------------- */
/* Organization validation                                                    */
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
/* Department lead validation                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Validates the department lead against the tenant and department boundaries.
 *
 * This is deliberately enforced in application code because the database
 * foreign key can verify that the Employee exists, but cannot by itself
 * enforce:
 *
 * - same organization;
 * - same department;
 * - ACTIVE status;
 * - appropriate organizational role.
 */
async function validateDepartmentLead(
  organizationId: string,
  departmentId: string,
  departmentLeadId: string | null,
): Promise<void> {
  if (departmentLeadId === null) {
    return;
  }

  const employee =
    await db.orm.public.Employee
      .where({
        id: departmentLeadId,
        organizationId,
      })
      .first();

  if (!employee) {
    throw new AppError(
      400,
      "The selected department lead does not belong to this organization.",
      "DEPARTMENT_LEAD_ORGANIZATION_MISMATCH",
    );
  }

  if (employee.departmentId !== departmentId) {
    throw new AppError(
      400,
      "The department lead must belong to the department.",
      "DEPARTMENT_LEAD_DEPARTMENT_MISMATCH",
    );
  }

  if (employee.status !== "ACTIVE") {
    throw new AppError(
      400,
      "The department lead must be an active employee.",
      "DEPARTMENT_LEAD_INACTIVE",
    );
  }

  if (!DEPARTMENT_LEAD_ROLES.has(employee.role)) {
    throw new AppError(
      400,
      "The selected employee cannot be a department lead.",
      "DEPARTMENT_LEAD_ROLE_INVALID",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Duplicate protection                                                       */
/* -------------------------------------------------------------------------- */

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

  const normalizedName = name
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase();

  const duplicate = departments.some(
    (department) => {
      if (department.id === excludeDepartmentId) {
        return false;
      }

      const existingName =
        department.name
          .normalize("NFC")
          .trim()
          .replace(/\s+/gu, " ")
          .toLocaleLowerCase();

      return existingName === normalizedName;
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
    department.id !== excludeDepartmentId
  ) {
    throw new AppError(
      409,
      "A department with this code already exists in this organization.",
      "DEPARTMENT_CODE_EXISTS",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Department lead DTO                                                        */
/* -------------------------------------------------------------------------- */

async function getDepartmentLead(
  departmentLeadId: string | null | undefined,
): Promise<DepartmentLeadPublicRecord | null> {
  if (!departmentLeadId) {
    return null;
  }

  const employee =
    await db.orm.public.Employee
      .where({
        id: departmentLeadId,
      })
      .first();

  if (!employee) {
    /*
     * The FK should normally make this impossible. Returning null keeps
     * responses safe if legacy/corrupt data is encountered.
     */
    return null;
  }

  if (!DEPARTMENT_LEAD_ROLES.has(employee.role)) {
    return null;
  }

  return {
    id: employee.id,
    employeeId: employee.employeeId,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    role: employee.role as DepartmentLeadPublicRecord["role"],
    status: employee.status,
  };
}

/* -------------------------------------------------------------------------- */
/* Public DTO                                                                 */
/* -------------------------------------------------------------------------- */

async function toPublicDepartment(
  department: {
    id: string;
    organizationId: string;
    name: string;
    code: string;
    departmentLeadId?: string | null;
    createdAt: string;
    updatedAt: string;
  },
): Promise<DepartmentPublicRecord> {
  return {
    id: department.id,
    organizationId: department.organizationId,
    name: department.name,
    code: department.code,
    departmentLead:
      await getDepartmentLead(
        department.departmentLeadId,
      ),
    createdAt: department.createdAt,
    updatedAt: department.updatedAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Database constraint translation                                             */
/* -------------------------------------------------------------------------- */

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

  if (
    /unique constraint/i.test(message) &&
    /organizationId/i.test(message) &&
    /code/i.test(message)
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
/* List departments                                                            */
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

  const publicDepartments =
    await Promise.all(
      departments.map(
        (department) =>
          toPublicDepartment(department),
      ),
    );

  return {
    departments: publicDepartments,
    total: publicDepartments.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Get department                                                              */
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
/* Create department                                                           */
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

  const departmentLeadId =
    normalizeOptionalDepartmentLeadId(
      params.departmentLeadId,
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

  /*
   * Validate the lead before creating the department.
   *
   * A lead must already belong to the department, therefore a new department
   * cannot be created with a lead in one atomic create operation unless that
   * employee is already assigned to this department.
   */
  if (departmentLeadId) {
    await validateDepartmentLead(
      organizationId,
      departmentId,
      departmentLeadId,
    );
  }

  try {
    await db.orm.public.Department
      .create({
        id: departmentId,
        organizationId,
        name,
        code,
        departmentLeadId:
          departmentLeadId ?? null,
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
/* Update department                                                           */
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

  const hasDepartmentLead =
    params.departmentLeadId !== undefined;

  if (
    !hasName &&
    !hasCode &&
    !hasDepartmentLead
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
    departmentLeadId?: string | null;
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

  if (hasDepartmentLead) {
    const departmentLeadId =
      normalizeOptionalDepartmentLeadId(
        params.departmentLeadId,
      );

    if (departmentLeadId) {
      await validateDepartmentLead(
        normalizedOrganizationId,
        normalizedDepartmentId,
        departmentLeadId,
      );
    }

    updateData.departmentLeadId =
      departmentLeadId ?? null;
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
/* Delete department                                                           */
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
 * The database foreign keys remain the final safety boundary.
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
    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      /foreign key/i.test(message) ||
      /violates.*constraint/i.test(message)
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