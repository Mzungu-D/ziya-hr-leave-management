import type {
  Request,
  Response,
} from "express";

import { z } from "zod";

import { db } from "../../prisma/db.js";

import {
  AppError,
} from "../middleware/error.middleware.js";

import {
  assignDepartment,
  assignReportingManager,
  assignRole,
  createEmployee,
  getEmployee,
  listEmployees,
  updateAccountStatus,
  updateEmployee,
} from "../services/employee.service.js";

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

const employeeRoleSchema =
  z.enum([
    "EMPLOYEE",
    "MANAGER",
    "HR_ADMIN",
    "SUPER_ADMIN",
  ]);

const employeeStatusSchema =
  z.enum([
    "PENDING",
    "ACTIVE",
    "INACTIVE",
    "SUSPENDED",
  ]);

const authenticationMethodSchema =
  z.enum([
    "PASSWORD",
    "OTP",
    "PASSWORD_AND_OTP",
  ]);

const createEmployeeSchema =
  z.object({
    employeeId:
      z.string()
        .trim()
        .min(1)
        .max(100),

    firstName:
      z.string()
        .trim()
        .min(1)
        .max(100),

    lastName:
      z.string()
        .trim()
        .min(1)
        .max(100),

    email:
      z.string()
        .trim()
        .email()
        .max(320),

    phone:
      z.string()
        .trim()
        .min(7)
        .max(32),

    departmentId:
      z.string()
        .trim()
        .min(1)
        .nullable()
        .optional(),

    reportsToId:
      z.string()
        .trim()
        .min(1)
        .nullable()
        .optional(),

    role:
      employeeRoleSchema
        .optional(),

    status:
      employeeStatusSchema
        .optional(),

    authenticationMethod:
      authenticationMethodSchema
        .optional(),
  });

const updateEmployeeSchema =
  z.object({
    employeeId:
      z.string()
        .trim()
        .min(1)
        .max(100)
        .optional(),

    firstName:
      z.string()
        .trim()
        .min(1)
        .max(100)
        .optional(),

    lastName:
      z.string()
        .trim()
        .min(1)
        .max(100)
        .optional(),

    email:
      z.string()
        .trim()
        .email()
        .max(320)
        .optional(),

    phone:
      z.string()
        .trim()
        .min(7)
        .max(32)
        .optional(),

    departmentId:
      z.string()
        .trim()
        .min(1)
        .nullable()
        .optional(),

    reportsToId:
      z.string()
        .trim()
        .min(1)
        .nullable()
        .optional(),

    role:
      employeeRoleSchema
        .optional(),

    status:
      employeeStatusSchema
        .optional(),

    authenticationMethod:
      authenticationMethodSchema
        .optional(),
  });

const departmentAssignmentSchema =
  z.object({
    departmentId:
      z.string()
        .trim()
        .min(1)
        .nullable(),
  });

const reportingManagerSchema =
  z.object({
    reportsToId:
      z.string()
        .trim()
        .min(1)
        .nullable(),
  });

const roleAssignmentSchema =
  z.object({
    role:
      employeeRoleSchema,
  });

const accountStatusSchema =
  z.object({
    status:
      employeeStatusSchema,
  });

/* -------------------------------------------------------------------------- */
/* Authentication / organization context                                      */
/* -------------------------------------------------------------------------- */

interface AuthenticatedEmployeeContext {
  employeeId: string;
  organizationId: string;
  role:
    | "EMPLOYEE"
    | "MANAGER"
    | "HR_ADMIN"
    | "SUPER_ADMIN";
}

async function getAuthenticatedEmployeeContext(
  req: Request,
): Promise<AuthenticatedEmployeeContext> {
  if (!req.auth) {
    throw new AppError(
      401,
      "Authentication required.",
      "AUTHENTICATION_REQUIRED",
    );
  }

  const employee =
    await db.orm.public.Employee
      .where({
        id: req.auth.employeeId,
      })
      .first();

  if (!employee) {
    throw new AppError(
      401,
      "The authenticated employee account could not be found.",
      "AUTHENTICATED_EMPLOYEE_NOT_FOUND",
    );
  }

  if (employee.status !== "ACTIVE") {
    throw new AppError(
      403,
      "This employee account is not active.",
      "EMPLOYEE_ACCOUNT_INACTIVE",
    );
  }

  return {
    employeeId:
      employee.id,

    organizationId:
      employee.organizationId,

    role:
      employee.role as AuthenticatedEmployeeContext["role"],
  };
}

/* -------------------------------------------------------------------------- */
/* Route parameter helpers                                                     */
/* -------------------------------------------------------------------------- */

function getEmployeeIdParam(
  req: Request,
): string {
  const rawEmployeeId =
    req.params.employeeId;

  const employeeId =
    Array.isArray(rawEmployeeId)
      ? rawEmployeeId[0]
      : rawEmployeeId;

  const normalizedEmployeeId =
    employeeId?.trim();

  if (!normalizedEmployeeId) {
    throw new AppError(
      400,
      "Employee ID is required.",
      "EMPLOYEE_ID_REQUIRED",
    );
  }

  return normalizedEmployeeId;
}

/* -------------------------------------------------------------------------- */
/* List employees                                                             */
/* -------------------------------------------------------------------------- */

export async function listEmployeesController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getAuthenticatedEmployeeContext(
      req,
    );

  const result =
    await listEmployees(
      context.organizationId,
    );

  res.status(200).json({
    success: true,
    data: result,
  });
}

/* -------------------------------------------------------------------------- */
/* Get employee                                                               */
/* -------------------------------------------------------------------------- */

export async function getEmployeeController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getAuthenticatedEmployeeContext(
      req,
    );

  const employeeId =
    getEmployeeIdParam(req);

  const employee =
    await getEmployee(
      context.organizationId,
      employeeId,
    );

  res.status(200).json({
    success: true,
    data: employee,
  });
}

/* -------------------------------------------------------------------------- */
/* Create employee                                                            */
/* -------------------------------------------------------------------------- */

export async function createEmployeeController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getAuthenticatedEmployeeContext(
      req,
    );

  const body =
    createEmployeeSchema.parse(
      req.body,
    );

  const employee =
    await createEmployee({
      organizationId:
        context.organizationId,

      employeeId:
        body.employeeId,

      firstName:
        body.firstName,

      lastName:
        body.lastName,

      email:
        body.email,

      phone:
        body.phone,

      departmentId:
        body.departmentId,

      reportsToId:
        body.reportsToId,

      role:
        body.role,

      status:
        body.status,

      authenticationMethod:
        body.authenticationMethod,
    });

  res.status(201).json({
    success: true,
    data: employee,
  });
}

/* -------------------------------------------------------------------------- */
/* Update employee                                                            */
/* -------------------------------------------------------------------------- */

export async function updateEmployeeController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getAuthenticatedEmployeeContext(
      req,
    );

  const employeeId =
    getEmployeeIdParam(req);

  const body =
    updateEmployeeSchema.parse(
      req.body,
    );

  const employee =
    await updateEmployee(
      context.organizationId,
      employeeId,
      body,
    );

  res.status(200).json({
    success: true,
    data: employee,
  });
}

/* -------------------------------------------------------------------------- */
/* Department assignment                                                      */
/* -------------------------------------------------------------------------- */

export async function assignDepartmentController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getAuthenticatedEmployeeContext(
      req,
    );

  const employeeId =
    getEmployeeIdParam(req);

  const body =
    departmentAssignmentSchema.parse(
      req.body,
    );

  const employee =
    await assignDepartment(
      context.organizationId,
      employeeId,
      body.departmentId,
    );

  res.status(200).json({
    success: true,
    data: employee,
  });
}

/* -------------------------------------------------------------------------- */
/* Reporting manager assignment                                               */
/* -------------------------------------------------------------------------- */

export async function assignReportingManagerController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getAuthenticatedEmployeeContext(
      req,
    );

  const employeeId =
    getEmployeeIdParam(req);

  const body =
    reportingManagerSchema.parse(
      req.body,
    );

  const employee =
    await assignReportingManager(
      context.organizationId,
      employeeId,
      body.reportsToId,
    );

  res.status(200).json({
    success: true,
    data: employee,
  });
}

/* -------------------------------------------------------------------------- */
/* Role assignment                                                            */
/* -------------------------------------------------------------------------- */

export async function assignRoleController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getAuthenticatedEmployeeContext(
      req,
    );

  const employeeId =
    getEmployeeIdParam(req);

  const body =
    roleAssignmentSchema.parse(
      req.body,
    );

  const employee =
    await assignRole(
      context.organizationId,
      employeeId,
      body.role,
    );

  res.status(200).json({
    success: true,
    data: employee,
  });
}

/* -------------------------------------------------------------------------- */
/* Account status                                                              */
/* -------------------------------------------------------------------------- */

export async function updateAccountStatusController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getAuthenticatedEmployeeContext(
      req,
    );

  const employeeId =
    getEmployeeIdParam(req);

  const body =
    accountStatusSchema.parse(
      req.body,
    );

  const employee =
    await updateAccountStatus(
      context.organizationId,
      employeeId,
      body.status,
    );

  res.status(200).json({
    success: true,
    data: employee,
  });
}