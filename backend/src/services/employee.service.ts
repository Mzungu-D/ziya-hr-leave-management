import { randomUUID } from "node:crypto";

import { db } from "../../prisma/db.js";

import { AppError } from "../middleware/error.middleware.js";

import {
  normalizeEmail,
  normalizePhone,
} from "../utils/crypto.js";

/* -------------------------------------------------------------------------- */
/* Employee-management domain values                                          */
/* -------------------------------------------------------------------------- */

export type EmployeeRole =
  | "EMPLOYEE"
  | "MANAGER"
  | "HR_ADMIN"
  | "SUPER_ADMIN";

export type EmployeeStatus =
  | "PENDING"
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED";

export type EmployeeAuthenticationMethod =
  | "PASSWORD"
  | "OTP"
  | "PASSWORD_AND_OTP";

/* -------------------------------------------------------------------------- */
/* Safe employee representation                                               */
/* -------------------------------------------------------------------------- */

/**
 * Public employee representation.
 *
 * IMPORTANT:
 * Authentication secrets are never exposed through this DTO.
 */
export interface EmployeePublicRecord {
  id: string;
  organizationId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  authenticationMethod: EmployeeAuthenticationMethod;
  emailVerified: boolean;
  phoneVerified: boolean;

  department: {
    id: string;
    name: string;
    code: string;
  } | null;

  reportsTo: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    email: string;
    role: EmployeeRole;
  } | null;

  createdAt: string;
  updatedAt: string;
}

export interface EmployeeListResult {
  employees: EmployeePublicRecord[];
  total: number;
}

/* -------------------------------------------------------------------------- */
/* Service input contracts                                                     */
/* -------------------------------------------------------------------------- */

export interface CreateEmployeeParams {
  organizationId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentId?: string | null;
  reportsToId?: string | null;
  role?: EmployeeRole;
  status?: EmployeeStatus;
  authenticationMethod?: EmployeeAuthenticationMethod;
}

export interface UpdateEmployeeParams {
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  departmentId?: string | null;
  reportsToId?: string | null;
  role?: EmployeeRole;
  status?: EmployeeStatus;
  authenticationMethod?: EmployeeAuthenticationMethod;
}

/* -------------------------------------------------------------------------- */
/* Validation constants                                                       */
/* -------------------------------------------------------------------------- */

const EMPLOYEE_ID_MIN_LENGTH = 1;
const EMPLOYEE_ID_MAX_LENGTH = 100;

const NAME_MIN_LENGTH = 1;
const NAME_MAX_LENGTH = 100;

const EMAIL_MAX_LENGTH = 320;
const PHONE_MAX_LENGTH = 32;

/**
 * Maximum number of reporting levels that can be traversed while validating
 * a reporting hierarchy.
 *
 * This is a defensive limit against malformed or pathological data.
 */
const MAX_REPORTING_HIERARCHY_DEPTH = 1000;

const ROLE_VALUES: readonly EmployeeRole[] = [
  "EMPLOYEE",
  "MANAGER",
  "HR_ADMIN",
  "SUPER_ADMIN",
];

const STATUS_VALUES: readonly EmployeeStatus[] = [
  "PENDING",
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
];

const AUTHENTICATION_METHOD_VALUES:
  readonly EmployeeAuthenticationMethod[] = [
    "PASSWORD",
    "OTP",
    "PASSWORD_AND_OTP",
  ];

/* -------------------------------------------------------------------------- */
/* Input normalization                                                         */
/* -------------------------------------------------------------------------- */

function requireOrganizationId(
  organizationId: string,
): string {
  const value = organizationId.trim();

  if (!value) {
    throw new AppError(
      400,
      "Organization ID is required.",
      "ORGANIZATION_ID_REQUIRED",
    );
  }

  return value;
}

function requireEntityId(
  value: string,
  fieldName: string,
  errorCode: string,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new AppError(
      400,
      `${fieldName} is required.`,
      errorCode,
    );
  }

  return normalized;
}

function normalizeEmployeeId(
  employeeId: string,
): string {
  const value = employeeId.trim();

  if (
    value.length < EMPLOYEE_ID_MIN_LENGTH ||
    value.length > EMPLOYEE_ID_MAX_LENGTH
  ) {
    throw new AppError(
      400,
      "Employee ID must be between 1 and 100 characters.",
      "INVALID_EMPLOYEE_ID",
    );
  }

  return value;
}

function normalizeName(
  value: string,
  fieldName: string,
): string {
  const normalized = value
    .trim()
    .replace(/\s+/g, " ");

  if (
    normalized.length < NAME_MIN_LENGTH ||
    normalized.length > NAME_MAX_LENGTH
  ) {
    throw new AppError(
      400,
      `${fieldName} must be between 1 and 100 characters.`,
      "INVALID_EMPLOYEE_NAME",
    );
  }

  return normalized;
}

function normalizeEmployeeEmail(
  email: string,
): string {
  const normalized = normalizeEmail(email);

  if (
    !normalized ||
    normalized.length > EMAIL_MAX_LENGTH ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    throw new AppError(
      400,
      "A valid email address is required.",
      "INVALID_EMPLOYEE_EMAIL",
    );
  }

  return normalized;
}

function normalizeEmployeePhone(
  phone: string,
): string {
  const normalized = normalizePhone(phone);

  if (
    !normalized ||
    normalized.length > PHONE_MAX_LENGTH ||
    !/^\+?[0-9]{8,15}$/.test(normalized)
  ) {
    throw new AppError(
      400,
      "A valid international phone number is required.",
      "INVALID_EMPLOYEE_PHONE",
    );
  }

  return normalized;
}

/* -------------------------------------------------------------------------- */
/* Enum validation                                                            */
/* -------------------------------------------------------------------------- */

function validateRole(
  role: EmployeeRole,
): EmployeeRole {
  if (!ROLE_VALUES.includes(role)) {
    throw new AppError(
      400,
      "Invalid employee role.",
      "INVALID_EMPLOYEE_ROLE",
    );
  }

  return role;
}

function validateStatus(
  status: EmployeeStatus,
): EmployeeStatus {
  if (!STATUS_VALUES.includes(status)) {
    throw new AppError(
      400,
      "Invalid employee account status.",
      "INVALID_EMPLOYEE_STATUS",
    );
  }

  return status;
}

function validateAuthenticationMethod(
  method: EmployeeAuthenticationMethod,
): EmployeeAuthenticationMethod {
  if (
    !AUTHENTICATION_METHOD_VALUES.includes(method)
  ) {
    throw new AppError(
      400,
      "Invalid authentication method.",
      "INVALID_AUTHENTICATION_METHOD",
    );
  }

  return method;
}

/* -------------------------------------------------------------------------- */
/* Database record typing                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The generated ORM is the source of truth for employee records.
 *
 * The return type is derived from the existing employee query so this
 * service remains aligned with the generated schema contract.
 */
async function findEmployeeById(
  organizationId: string,
  id: string,
) {
  return db.orm.public.Employee
    .include("department")
    .include("reportsTo")
    .where({
      id,
      organizationId,
    })
    .first();
}

type EmployeeWithRelations =
  NonNullable<
    Awaited<
      ReturnType<typeof findEmployeeById>
    >
  >;

/* -------------------------------------------------------------------------- */
/* Safe DTO mapping                                                           */
/* -------------------------------------------------------------------------- */

function toPublicEmployee(
  employee: EmployeeWithRelations,
): EmployeePublicRecord {
  return {
    id: employee.id,

    organizationId: employee.organizationId,

    employeeId: employee.employeeId,

    firstName: employee.firstName,

    lastName: employee.lastName,

    email: employee.email,

    phone: employee.phone,

    role: employee.role as EmployeeRole,

    status: employee.status as EmployeeStatus,

    authenticationMethod:
      employee.authenticationMethod as EmployeeAuthenticationMethod,

    emailVerified: employee.emailVerified,

    phoneVerified: employee.phoneVerified,

    department: employee.department
      ? {
          id: employee.department.id,
          name: employee.department.name,
          code: employee.department.code,
        }
      : null,

    reportsTo: employee.reportsTo
      ? {
          id: employee.reportsTo.id,
          employeeId: employee.reportsTo.employeeId,
          firstName: employee.reportsTo.firstName,
          lastName: employee.reportsTo.lastName,
          email: employee.reportsTo.email,
          role: employee.reportsTo.role as EmployeeRole,
        }
      : null,

    createdAt: employee.createdAt,

    updatedAt: employee.updatedAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Organization validation                                                    */
/* -------------------------------------------------------------------------- */

async function validateOrganization(
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
/* Duplicate protection                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Email is globally unique in the database.
 *
 * We intentionally do not scope this check by organization because the
 * database itself treats employee email as globally unique.
 */
async function ensureEmailAvailable(
  email: string,
  excludeEmployeeId?: string,
): Promise<void> {
  const employee =
    await db.orm.public.Employee
      .where({
        email,
      })
      .first();

  if (
    employee &&
    employee.id !== excludeEmployeeId
  ) {
    throw new AppError(
      409,
      "An employee with this email address already exists.",
      "EMPLOYEE_EMAIL_EXISTS",
    );
  }
}

/**
 * Phone is globally unique in the database.
 */
async function ensurePhoneAvailable(
  phone: string,
  excludeEmployeeId?: string,
): Promise<void> {
  const employee =
    await db.orm.public.Employee
      .where({
        phone,
      })
      .first();

  if (
    employee &&
    employee.id !== excludeEmployeeId
  ) {
    throw new AppError(
      409,
      "An employee with this phone number already exists.",
      "EMPLOYEE_PHONE_EXISTS",
    );
  }
}

/**
 * Employee IDs are unique inside an organization.
 */
async function ensureEmployeeIdAvailable(
  organizationId: string,
  employeeId: string,
  excludeEmployeeId?: string,
): Promise<void> {
  const employee =
    await db.orm.public.Employee
      .where({
        organizationId,
        employeeId,
      })
      .first();

  if (
    employee &&
    employee.id !== excludeEmployeeId
  ) {
    throw new AppError(
      409,
      "This employee ID is already assigned in the organization.",
      "EMPLOYEE_ID_EXISTS",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Department validation                                                      */
/* -------------------------------------------------------------------------- */

async function validateDepartment(
  organizationId: string,
  departmentId: string | null,
): Promise<void> {
  if (!departmentId) {
    return;
  }

  const department =
    await db.orm.public.Department
      .where({
        id: departmentId,
        organizationId,
      })
      .first();

  if (!department) {
    throw new AppError(
      400,
      "The selected department does not belong to this organization.",
      "INVALID_DEPARTMENT",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Reporting hierarchy validation                                             */
/* -------------------------------------------------------------------------- */

async function validateReportsTo(
  organizationId: string,
  employeeId: string,
  reportsToId: string | null,
): Promise<void> {
  if (!reportsToId) {
    return;
  }

  if (reportsToId === employeeId) {
    throw new AppError(
      400,
      "An employee cannot report to themselves.",
      "INVALID_REPORTING_MANAGER",
    );
  }

  const manager =
    await db.orm.public.Employee
      .where({
        id: reportsToId,
        organizationId,
      })
      .first();

  if (!manager) {
    throw new AppError(
      400,
      "The selected reporting manager does not belong to this organization.",
      "INVALID_REPORTING_MANAGER",
    );
  }

  if (manager.status !== "ACTIVE") {
    throw new AppError(
      400,
      "An inactive employee cannot be assigned as a reporting manager.",
      "REPORTING_MANAGER_INACTIVE",
    );
  }

  if (
    manager.role !== "MANAGER" &&
    manager.role !== "HR_ADMIN" &&
    manager.role !== "SUPER_ADMIN"
  ) {
    throw new AppError(
      400,
      "The selected reporting manager must have a management or HR role.",
      "INVALID_REPORTING_MANAGER_ROLE",
    );
  }

  const visited = new Set<string>();

  let currentId: string | null = reportsToId;

  let depth = 0;

  while (currentId) {
    depth += 1;

    if (depth > MAX_REPORTING_HIERARCHY_DEPTH) {
      throw new AppError(
        400,
        "The reporting hierarchy exceeds the maximum supported depth.",
        "REPORTING_HIERARCHY_TOO_DEEP",
      );
    }

    if (visited.has(currentId)) {
      throw new AppError(
        400,
        "The reporting hierarchy contains a circular relationship.",
        "REPORTING_CYCLE_DETECTED",
      );
    }

    visited.add(currentId);

    if (currentId === employeeId) {
      throw new AppError(
        400,
        "This reporting assignment would create a circular reporting hierarchy.",
        "REPORTING_CYCLE_DETECTED",
      );
    }

    const current: {
      reportsToId: string | null;
    } | null =
      await db.orm.public.Employee
        .where({
          id: currentId,
          organizationId,
        })
        .first();

    if (!current) {
      throw new AppError(
        400,
        "The reporting hierarchy contains an invalid employee reference.",
        "INVALID_REPORTING_HIERARCHY",
      );
    }

    currentId = current.reportsToId;
  }
}

/* -------------------------------------------------------------------------- */
/* Authentication-state validation                                            */
/* -------------------------------------------------------------------------- */

/**
 * Password-based authentication cannot be activated without a password hash.
 *
 * Employee creation intentionally starts in PENDING state because credentials
 * are established through the activation workflow.
 */
function validateActiveAuthenticationState(
  status: EmployeeStatus,
  authenticationMethod: EmployeeAuthenticationMethod,
  passwordHash: string | null,
): void {
  if (status !== "ACTIVE") {
    return;
  }

  const requiresPassword =
    authenticationMethod === "PASSWORD" ||
    authenticationMethod === "PASSWORD_AND_OTP";

  if (requiresPassword && !passwordHash) {
    throw new AppError(
      400,
      "A password must be established before a password-based account can become active.",
      "PASSWORD_CREDENTIAL_REQUIRED",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* SUPER_ADMIN continuity protection                                          */
/* -------------------------------------------------------------------------- */

/**
 * Never allow an organization to lose its final active SUPER_ADMIN.
 *
 * This protects the organization from becoming administratively orphaned.
 *
 * The check is deliberately based on the final intended state of the
 * employee, so combined role/status updates are handled correctly.
 */
async function ensureSuperAdminContinuity(
  organizationId: string,
  existingEmployee: {
    id: string;
    role: string;
    status: string;
  },
  nextRole: EmployeeRole,
  nextStatus: EmployeeStatus,
): Promise<void> {
  const currentlyActiveSuperAdmin =
    existingEmployee.role === "SUPER_ADMIN" &&
    existingEmployee.status === "ACTIVE";

  const willRemainActiveSuperAdmin =
    nextRole === "SUPER_ADMIN" &&
    nextStatus === "ACTIVE";

  if (
    !currentlyActiveSuperAdmin ||
    willRemainActiveSuperAdmin
  ) {
    return;
  }

  const activeSuperAdmins =
    await db.orm.public.Employee
      .where({
        organizationId,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
      })
      .all();

  const remainingSuperAdmins =
    activeSuperAdmins.filter(
      (employee) =>
        employee.id !== existingEmployee.id,
    );

  if (remainingSuperAdmins.length === 0) {
    throw new AppError(
      409,
      "The organization's last active SUPER_ADMIN cannot be removed or deactivated.",
      "LAST_SUPER_ADMIN_PROTECTED",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Session security                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Revoke all active sessions for an employee after a security-sensitive
 * employee change.
 */
async function revokeEmployeeSessions(
  employeeId: string,
): Promise<void> {
  const now = new Date().toISOString();

  await db.orm.public.UserSession
    .where({
      employeeId,
      revokedAt: null,
    })
    .updateAll({
      revokedAt: now,
      lastUsedAt: now,
    });
}

/* -------------------------------------------------------------------------- */
/* Database constraint error translation                                       */
/* -------------------------------------------------------------------------- */

function translateEmployeeConstraintError(
  error: unknown,
): never {
  const message =
    error instanceof Error
      ? error.message
      : "";

  if (/Employee_email_key/i.test(message)) {
    throw new AppError(
      409,
      "An employee with this email address already exists.",
      "EMPLOYEE_EMAIL_EXISTS",
    );
  }

  if (/Employee_phone_key/i.test(message)) {
    throw new AppError(
      409,
      "An employee with this phone number already exists.",
      "EMPLOYEE_PHONE_EXISTS",
    );
  }

  if (
    /Employee_organizationId_employeeId_key/i.test(
      message,
    )
  ) {
    throw new AppError(
      409,
      "This employee ID is already assigned in the organization.",
      "EMPLOYEE_ID_EXISTS",
    );
  }

  throw error;
}

/* -------------------------------------------------------------------------- */
/* Employee listing                                                           */
/* -------------------------------------------------------------------------- */

/**
 * List all employees belonging to one organization.
 *
 * Organization scope is mandatory and is applied directly to the database
 * query.
 */
export async function listEmployees(
  organizationId: string,
): Promise<EmployeeListResult> {
  const normalizedOrganizationId =
    requireOrganizationId(organizationId);

  const employees =
    await db.orm.public.Employee
      .include("department")
      .include("reportsTo")
      .where({
        organizationId:
          normalizedOrganizationId,
      })
      .all();

  return {
    employees: employees.map(
      toPublicEmployee,
    ),
    total: employees.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Employee details                                                           */
/* -------------------------------------------------------------------------- */

export async function getEmployee(
  organizationId: string,
  employeeId: string,
): Promise<EmployeePublicRecord> {
  const normalizedOrganizationId =
    requireOrganizationId(organizationId);

  const normalizedEmployeeId =
    requireEntityId(
      employeeId,
      "Employee ID",
      "EMPLOYEE_ID_REQUIRED",
    );

  const employee =
    await findEmployeeById(
      normalizedOrganizationId,
      normalizedEmployeeId,
    );

  if (!employee) {
    throw new AppError(
      404,
      "Employee not found.",
      "EMPLOYEE_NOT_FOUND",
    );
  }

  return toPublicEmployee(employee);
}

/* -------------------------------------------------------------------------- */
/* Employee creation                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Create an employee.
 *
 * Production lifecycle:
 *
 * HR creates employee
 *        ↓
 * employee is PENDING
 *        ↓
 * activation workflow establishes credentials
 *        ↓
 * employee becomes ACTIVE
 *
 * Credentials are deliberately not created by this service.
 */
export async function createEmployee(
  params: CreateEmployeeParams,
): Promise<EmployeePublicRecord> {
  const organizationId =
    requireOrganizationId(
      params.organizationId,
    );

  await validateOrganization(
    organizationId,
  );

  const employeeId =
    normalizeEmployeeId(
      params.employeeId,
    );

  const firstName =
    normalizeName(
      params.firstName,
      "First name",
    );

  const lastName =
    normalizeName(
      params.lastName,
      "Last name",
    );

  const email =
    normalizeEmployeeEmail(
      params.email,
    );

  const phone =
    normalizeEmployeePhone(
      params.phone,
    );

  const role =
    validateRole(
      params.role ?? "EMPLOYEE",
    );

  const status =
    validateStatus(
      params.status ?? "PENDING",
    );

  const authenticationMethod =
    validateAuthenticationMethod(
      params.authenticationMethod ??
        "PASSWORD_AND_OTP",
    );

  /*
   * Ordinary employee creation must start in PENDING state.
   *
   * This prevents an employee from being inserted as ACTIVE while the
   * activation workflow has not established credentials.
   */
  if (status !== "PENDING") {
    throw new AppError(
      400,
      "New employees must start in PENDING status and be activated through the employee activation workflow.",
      "EMPLOYEE_MUST_START_PENDING",
    );
  }

  const departmentId =
    params.departmentId?.trim() || null;

  const reportsToId =
    params.reportsToId?.trim() || null;

  await ensureEmailAvailable(email);

  await ensurePhoneAvailable(phone);

  await ensureEmployeeIdAvailable(
    organizationId,
    employeeId,
  );

  await validateDepartment(
    organizationId,
    departmentId,
  );

  /*
   * Generate the real database ID before validating the reporting hierarchy.
   */
  const newEmployeeId = randomUUID();

  await validateReportsTo(
    organizationId,
    newEmployeeId,
    reportsToId,
  );

  let createdEmployee:
    Awaited<
      ReturnType<
        typeof db.orm.public.Employee.create
      >
    >;

  try {
    createdEmployee =
      await db.orm.public.Employee.create({
        id: newEmployeeId,

        organizationId,

        departmentId,

        reportsToId,

        employeeId,

        firstName,

        lastName,

        email,

        phone,

        /*
         * Credentials are established by the activation/authentication
         * workflow rather than ordinary HR employee creation.
         */
        passwordHash: null,

        role,

        status,

        authenticationMethod,

        emailVerified: false,

        phoneVerified: false,
      });
  } catch (error) {
    translateEmployeeConstraintError(
      error,
    );
  }

  const created =
    await findEmployeeById(
      organizationId,
      createdEmployee.id,
    );

  if (!created) {
    throw new AppError(
      500,
      "Employee was created but could not be loaded.",
      "EMPLOYEE_CREATE_STATE_ERROR",
    );
  }

  return toPublicEmployee(created);
}

/* -------------------------------------------------------------------------- */
/* Employee update                                                            */
/* -------------------------------------------------------------------------- */

export async function updateEmployee(
  organizationId: string,
  id: string,
  params: UpdateEmployeeParams,
): Promise<EmployeePublicRecord> {
  const normalizedOrganizationId =
    requireOrganizationId(
      organizationId,
    );

  const normalizedId =
    requireEntityId(
      id,
      "Employee ID",
      "EMPLOYEE_ID_REQUIRED",
    );

  const existing =
    await findEmployeeById(
      normalizedOrganizationId,
      normalizedId,
    );

  if (!existing) {
    throw new AppError(
      404,
      "Employee not found.",
      "EMPLOYEE_NOT_FOUND",
    );
  }

  const updateData: Record<
    string,
    unknown
  > = {};

  let securitySensitiveChange = false;

  /* ------------------------------------------------------------------------ */
  /* Employee ID                                                              */
  /* ------------------------------------------------------------------------ */

  if (params.employeeId !== undefined) {
    const employeeId =
      normalizeEmployeeId(
        params.employeeId,
      );

    await ensureEmployeeIdAvailable(
      normalizedOrganizationId,
      employeeId,
      existing.id,
    );

    updateData.employeeId =
      employeeId;
  }

  /* ------------------------------------------------------------------------ */
  /* First name                                                               */
  /* ------------------------------------------------------------------------ */

  if (params.firstName !== undefined) {
    updateData.firstName =
      normalizeName(
        params.firstName,
        "First name",
      );
  }

  /* ------------------------------------------------------------------------ */
  /* Last name                                                                */
  /* ------------------------------------------------------------------------ */

  if (params.lastName !== undefined) {
    updateData.lastName =
      normalizeName(
        params.lastName,
        "Last name",
      );
  }

  /* ------------------------------------------------------------------------ */
  /* Email                                                                     */
  /* ------------------------------------------------------------------------ */

  if (params.email !== undefined) {
    const email =
      normalizeEmployeeEmail(
        params.email,
      );

    await ensureEmailAvailable(
      email,
      existing.id,
    );

    updateData.email = email;

    /*
     * Changing the email invalidates the previous verification state.
     */
    updateData.emailVerified = false;

    securitySensitiveChange = true;
  }

  /* ------------------------------------------------------------------------ */
  /* Phone                                                                     */
  /* ------------------------------------------------------------------------ */

  if (params.phone !== undefined) {
    const phone =
      normalizeEmployeePhone(
        params.phone,
      );

    await ensurePhoneAvailable(
      phone,
      existing.id,
    );

    updateData.phone = phone;

    /*
     * Changing the phone invalidates the previous verification state.
     */
    updateData.phoneVerified = false;

    securitySensitiveChange = true;
  }

  /* ------------------------------------------------------------------------ */
  /* Department                                                                */
  /* ------------------------------------------------------------------------ */

  if (params.departmentId !== undefined) {
    const departmentId =
      params.departmentId?.trim() || null;

    await validateDepartment(
      normalizedOrganizationId,
      departmentId,
    );

    updateData.departmentId =
      departmentId;
  }

  /* ------------------------------------------------------------------------ */
  /* Role                                                                      */
  /* ------------------------------------------------------------------------ */

  const nextRole =
    params.role !== undefined
      ? validateRole(params.role)
      : (existing.role as EmployeeRole);

  /* ------------------------------------------------------------------------ */
  /* Status                                                                    */
  /* ------------------------------------------------------------------------ */

  const nextStatus =
    params.status !== undefined
      ? validateStatus(params.status)
      : (existing.status as EmployeeStatus);

  /*
   * The last active SUPER_ADMIN must always remain available.
   */
  await ensureSuperAdminContinuity(
    normalizedOrganizationId,
    {
      id: existing.id,
      role: existing.role,
      status: existing.status,
    },
    nextRole,
    nextStatus,
  );

  if (params.role !== undefined) {
    updateData.role = nextRole;

    if (nextRole !== existing.role) {
      securitySensitiveChange = true;
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Authentication method                                                    */
  /* ------------------------------------------------------------------------ */

  const nextAuthenticationMethod =
    params.authenticationMethod !== undefined
      ? validateAuthenticationMethod(
          params.authenticationMethod,
        )
      : (existing.authenticationMethod as EmployeeAuthenticationMethod);

  if (params.authenticationMethod !== undefined) {
    updateData.authenticationMethod =
      nextAuthenticationMethod;

    if (
      nextAuthenticationMethod !==
      existing.authenticationMethod
    ) {
      securitySensitiveChange = true;
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Active authentication state                                              */
  /* ------------------------------------------------------------------------ */

  validateActiveAuthenticationState(
    nextStatus,
    nextAuthenticationMethod,
    existing.passwordHash,
  );

  /* ------------------------------------------------------------------------ */
  /* Status                                                                    */
  /* ------------------------------------------------------------------------ */

  if (params.status !== undefined) {
    updateData.status = nextStatus;

    if (nextStatus !== existing.status) {
      securitySensitiveChange = true;
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Reporting manager                                                        */
  /* ------------------------------------------------------------------------ */

  if (params.reportsToId !== undefined) {
    const reportsToId =
      params.reportsToId?.trim() || null;

    await validateReportsTo(
      normalizedOrganizationId,
      existing.id,
      reportsToId,
    );

    updateData.reportsToId =
      reportsToId;
  }

  /* ------------------------------------------------------------------------ */
  /* Nothing to update                                                        */
  /* ------------------------------------------------------------------------ */

  if (
    Object.keys(updateData).length === 0
  ) {
    return toPublicEmployee(existing);
  }

  /* ------------------------------------------------------------------------ */
  /* Persist update                                                           */
  /* ------------------------------------------------------------------------ */

  try {
    await db.orm.public.Employee
      .where({
        id: existing.id,

        organizationId:
          normalizedOrganizationId,
      })
      .update(updateData as never);
  } catch (error) {
    translateEmployeeConstraintError(
      error,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Security session invalidation                                             */
  /* ------------------------------------------------------------------------ */

  if (securitySensitiveChange) {
    await revokeEmployeeSessions(
      existing.id,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Reload authoritative state                                               */
  /* ------------------------------------------------------------------------ */

  const updated =
    await findEmployeeById(
      normalizedOrganizationId,
      existing.id,
    );

  if (!updated) {
    throw new AppError(
      500,
      "Employee was updated but could not be loaded.",
      "EMPLOYEE_UPDATE_STATE_ERROR",
    );
  }

  return toPublicEmployee(updated);
}

/* -------------------------------------------------------------------------- */
/* Explicit department assignment                                             */
/* -------------------------------------------------------------------------- */

export async function assignDepartment(
  organizationId: string,
  employeeId: string,
  departmentId: string | null,
): Promise<EmployeePublicRecord> {
  return updateEmployee(
    organizationId,
    employeeId,
    {
      departmentId,
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Explicit reporting-manager assignment                                      */
/* -------------------------------------------------------------------------- */

export async function assignReportingManager(
  organizationId: string,
  employeeId: string,
  reportsToId: string | null,
): Promise<EmployeePublicRecord> {
  return updateEmployee(
    organizationId,
    employeeId,
    {
      reportsToId,
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Explicit role assignment                                                   */
/* -------------------------------------------------------------------------- */

export async function assignRole(
  organizationId: string,
  employeeId: string,
  role: EmployeeRole,
): Promise<EmployeePublicRecord> {
  return updateEmployee(
    organizationId,
    employeeId,
    {
      role,
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Account-status management                                                  */
/* -------------------------------------------------------------------------- */

export async function updateAccountStatus(
  organizationId: string,
  employeeId: string,
  status: EmployeeStatus,
): Promise<EmployeePublicRecord> {
  return updateEmployee(
    organizationId,
    employeeId,
    {
      status,
    },
  );
}