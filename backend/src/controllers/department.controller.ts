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
  createDepartment,
  deleteDepartment,
  getDepartment,
  listDepartments,
  updateDepartment,
} from "../services/department.service.js";

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

const departmentNameSchema =
  z
    .string()
    .trim()
    .min(1, "Department name is required.")
    .max(120, "Department name must not exceed 120 characters.");

const departmentCodeSchema =
  z
    .string()
    .trim()
    .min(1, "Department code is required.")
    .max(50, "Department code must not exceed 50 characters.")
    .regex(
      /^[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?$/,
      "Department code may contain only letters, numbers, underscores, and hyphens, and must start and end with a letter or number.",
    );

const createDepartmentSchema =
  z
    .object({
      name: departmentNameSchema,

      code: departmentCodeSchema,
    })
    .strict();

const updateDepartmentSchema =
  z
    .object({
      name:
        departmentNameSchema.optional(),

      code:
        departmentCodeSchema.optional(),
    })
    .strict()
    .refine(
      (value) =>
        value.name !== undefined ||
        value.code !== undefined,
      {
        message:
          "At least one department field must be provided.",
      },
    );

/* -------------------------------------------------------------------------- */
/* Authentication / organization context                                     */
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
/* Route parameter helpers                                                    */
/* -------------------------------------------------------------------------- */

function getDepartmentIdParam(
  req: Request,
): string {
  const rawDepartmentId =
    req.params.departmentId;

  const departmentId =
    Array.isArray(rawDepartmentId)
      ? rawDepartmentId[0]
      : rawDepartmentId;

  const normalizedDepartmentId =
    departmentId?.trim();

  if (!normalizedDepartmentId) {
    throw new AppError(
      400,
      "Department ID is required.",
      "DEPARTMENT_ID_REQUIRED",
    );
  }

  if (
    normalizedDepartmentId.length > 255
  ) {
    throw new AppError(
      400,
      "Department ID is invalid.",
      "DEPARTMENT_ID_INVALID",
    );
  }

  return normalizedDepartmentId;
}

/* -------------------------------------------------------------------------- */
/* List departments                                                           */
/* -------------------------------------------------------------------------- */

export async function listDepartmentsController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getAuthenticatedEmployeeContext(
      req,
    );

  const result =
    await listDepartments(
      context.organizationId,
    );

  res.status(200).json({
    success: true,
    data: result,
  });
}

/* -------------------------------------------------------------------------- */
/* Get department                                                             */
/* -------------------------------------------------------------------------- */

export async function getDepartmentController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getAuthenticatedEmployeeContext(
      req,
    );

  const departmentId =
    getDepartmentIdParam(req);

  const department =
    await getDepartment(
      context.organizationId,
      departmentId,
    );

  res.status(200).json({
    success: true,
    data: department,
  });
}

/* -------------------------------------------------------------------------- */
/* Create department                                                          */
/* -------------------------------------------------------------------------- */

export async function createDepartmentController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getAuthenticatedEmployeeContext(
      req,
    );

  const body =
    createDepartmentSchema.parse(
      req.body,
    );

  const department =
    await createDepartment({
      organizationId:
        context.organizationId,

      name:
        body.name,

      code:
        body.code,
    });

  res.status(201).json({
    success: true,
    data: department,
  });
}

/* -------------------------------------------------------------------------- */
/* Update department                                                          */
/* -------------------------------------------------------------------------- */

export async function updateDepartmentController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getAuthenticatedEmployeeContext(
      req,
    );

  const departmentId =
    getDepartmentIdParam(req);

  const body =
    updateDepartmentSchema.parse(
      req.body,
    );

  const department =
    await updateDepartment(
      context.organizationId,
      departmentId,
      {
        name:
          body.name,

        code:
          body.code,
      },
    );

  res.status(200).json({
    success: true,
    data: department,
  });
}

/* -------------------------------------------------------------------------- */
/* Delete department                                                          */
/* -------------------------------------------------------------------------- */

export async function deleteDepartmentController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getAuthenticatedEmployeeContext(
      req,
    );

  const departmentId =
    getDepartmentIdParam(req);

  await deleteDepartment(
    context.organizationId,
    departmentId,
  );

  res.status(200).json({
    success: true,
    data: {
      id: departmentId,
    },
  });
}