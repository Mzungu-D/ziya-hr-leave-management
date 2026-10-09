import type {
  Request,
  Response,
} from "express";
import { z } from "zod";

import { db } from "../../prisma/db.js";
import { AppError } from "../middleware/error.middleware.js";

import {
  activateHoliday,
  createHoliday,
  deactivateHoliday,
  deleteHoliday,
  getHoliday,
  getHolidaySummary,
  listHolidays,
  updateHoliday,
} from "../services/holiday.service.js";

/* -------------------------------------------------------------------------- */
/* Authentication / tenant context                                            */
/* -------------------------------------------------------------------------- */

interface AuthContext {
  employeeId: string;
  organizationId: string;
  role: string;
}

async function getContext(
  req: Request,
): Promise<AuthContext> {
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
      "Authenticated employee not found.",
      "AUTHENTICATED_EMPLOYEE_NOT_FOUND",
    );
  }

  if (
    employee.status !== "ACTIVE"
  ) {
    throw new AppError(
      403,
      "This employee account is not active.",
      "EMPLOYEE_ACCOUNT_INACTIVE",
    );
  }

  if (
    !employee.organizationId
  ) {
    throw new AppError(
      403,
      "The authenticated employee is not assigned to an organization.",
      "EMPLOYEE_ORGANIZATION_MISSING",
    );
  }

  return {
    employeeId: employee.id,
    organizationId:
      employee.organizationId,
    role: employee.role,
  };
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const holidayCategories = [
  "PUBLIC",
  "RELIGIOUS",
  "CULTURAL",
  "NATIONAL",
  "REGIONAL",
  "COMPANY",
  "OBSERVANCE",
] as const;

const religions = [
  "CHRISTIAN",
  "ISLAM",
  "JUDAISM",
  "HINDU",
  "SIKH",
  "BUDDHIST",
  "BAHAI",
  "JAIN",
  "TAOIST",
  "OTHER",
] as const;

/* -------------------------------------------------------------------------- */
/* Validation schemas                                                         */
/* -------------------------------------------------------------------------- */

const categorySchema =
  z
    .string()
    .trim()
    .min(
      1,
      "Holiday category is required.",
    )
    .max(
      50,
      "Holiday category cannot exceed 50 characters.",
    )
    .transform(
      (value) =>
        value.toUpperCase(),
    );

const religionSchema =
  z
    .enum(religions)
    .optional()
    .nullable();

const createHolidaySchema =
  z
    .object({
      name: z
        .string()
        .trim()
        .min(
          1,
          "Holiday name is required.",
        )
        .max(
          200,
          "Holiday name cannot exceed 200 characters.",
        ),

      date: z
        .union([
          z.string().trim().min(1),
          z.date(),
        ]),

      description: z
        .string()
        .max(
          2000,
          "Holiday description cannot exceed 2000 characters.",
        )
        .nullable()
        .optional(),

      category:
        categorySchema
          .optional(),

      countryCode: z
        .string()
        .trim()
        .max(
          2,
          "Country code must contain exactly 2 characters.",
        )
        .nullable()
        .optional(),

      regionCode: z
        .string()
        .trim()
        .max(
          20,
          "Region code cannot exceed 20 characters.",
        )
        .nullable()
        .optional(),

      isReligious: z
        .boolean()
        .optional(),

      religion:
        religionSchema,

      isRecurring: z
        .boolean()
        .optional(),

      isActive: z
        .boolean()
        .optional(),
    })
    .superRefine(
      (value, ctx) => {
        if (
          value.isReligious === true &&
          !value.religion
        ) {
          ctx.addIssue({
            code: "custom",
            path: [
              "religion",
            ],
            message:
              "A religious holiday must specify a religion.",
          });
        }

        if (
          value.religion &&
          value.isReligious !== true
        ) {
          ctx.addIssue({
            code: "custom",
            path: [
              "isReligious",
            ],
            message:
              "A religion can only be specified for a religious holiday.",
          });
        }
      },
    );

const updateHolidaySchema =
  z
    .object({
      name: z
        .string()
        .trim()
        .min(
          1,
          "Holiday name is required.",
        )
        .max(
          200,
          "Holiday name cannot exceed 200 characters.",
        )
        .optional(),

      date: z
        .union([
          z.string().trim().min(1),
          z.date(),
        ])
        .optional(),

      description: z
        .string()
        .max(
          2000,
          "Holiday description cannot exceed 2000 characters.",
        )
        .nullable()
        .optional(),

      category:
        categorySchema
          .optional(),

      countryCode: z
        .string()
        .trim()
        .max(
          2,
          "Country code must contain exactly 2 characters.",
        )
        .nullable()
        .optional(),

      regionCode: z
        .string()
        .trim()
        .max(
          20,
          "Region code cannot exceed 20 characters.",
        )
        .nullable()
        .optional(),

      isReligious: z
        .boolean()
        .optional(),

      religion:
        religionSchema,

      isRecurring: z
        .boolean()
        .optional(),

      isActive: z
        .boolean()
        .optional(),
    })
    .refine(
      (value) =>
        Object.keys(value).length > 0,
      {
        message:
          "At least one holiday field must be provided.",
      },
    );

/* -------------------------------------------------------------------------- */
/* Query validation                                                           */
/* -------------------------------------------------------------------------- */

function optionalBooleanQuery(
  value:
    | string
    | undefined,
): boolean | undefined {
  if (
    value === undefined
  ) {
    return undefined;
  }

  const normalized =
    value
      .trim()
      .toLowerCase();

  if (
    normalized === "true"
  ) {
    return true;
  }

  if (
    normalized === "false"
  ) {
    return false;
  }

  throw new AppError(
    400,
    "Boolean query parameters must be true or false.",
    "INVALID_BOOLEAN_QUERY_PARAMETER",
  );
}

function optionalYearQuery(
  value:
    | string
    | undefined,
): number | undefined {
  if (
    value === undefined
  ) {
    return undefined;
  }

  const normalized =
    value.trim();

  if (
    !/^\d{4}$/.test(
      normalized,
    )
  ) {
    throw new AppError(
      400,
      "Year must be a valid four-digit year.",
      "INVALID_HOLIDAY_YEAR",
    );
  }

  return Number(normalized);
}

const listHolidaysQuerySchema =
  z.object({
    search: z
      .string()
      .trim()
      .max(
        200,
        "Search cannot exceed 200 characters.",
      )
      .optional(),

    year: z
      .string()
      .trim()
      .optional(),

    category: z
      .string()
      .trim()
      .max(50)
      .optional(),

    countryCode: z
      .string()
      .trim()
      .max(2)
      .optional(),

    regionCode: z
      .string()
      .trim()
      .max(20)
      .optional(),

    religion:
      z
        .enum(religions)
        .optional(),

    isReligious: z
      .string()
      .trim()
      .optional(),

    isRecurring: z
      .string()
      .trim()
      .optional(),

    isActive: z
      .string()
      .trim()
      .optional(),
  });

/* -------------------------------------------------------------------------- */
/* Route parameter validation                                                 */
/* -------------------------------------------------------------------------- */

function getHolidayId(
  req: Request,
): string {
  const value =
    Array.isArray(
      req.params.holidayId,
    )
      ? req.params.holidayId[0]
      : req.params.holidayId;

  if (!value?.trim()) {
    throw new AppError(
      400,
      "Holiday ID is required.",
      "HOLIDAY_ID_REQUIRED",
    );
  }

  return value.trim();
}

/* -------------------------------------------------------------------------- */
/* Controllers                                                                */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/holidays
 *
 * Lists holidays belonging to the
 * authenticated employee's organization only.
 */
export async function listHolidaysController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getContext(req);

  const query =
    listHolidaysQuerySchema.parse(
      req.query,
    );

  const holidays =
    await listHolidays({
      organizationId:
        context.organizationId,

      actorId:
        context.employeeId,

      search:
        query.search,

      year:
        optionalYearQuery(
          query.year,
        ),

      category:
        query.category,

      countryCode:
        query.countryCode,

      regionCode:
        query.regionCode,

      religion:
        query.religion,

      isReligious:
        optionalBooleanQuery(
          query.isReligious,
        ),

      isRecurring:
        optionalBooleanQuery(
          query.isRecurring,
        ),

      isActive:
        optionalBooleanQuery(
          query.isActive,
        ),
    });

  res.status(200).json({
    success: true,
    data: holidays,
  });
}

/**
 * GET /api/holidays/:holidayId
 *
 * Retrieves one holiday from the
 * authenticated tenant.
 */
export async function getHolidayController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getContext(req);

  const holiday =
    await getHoliday(
      context.organizationId,
      context.employeeId,
      getHolidayId(req),
    );

  res.status(200).json({
    success: true,
    data: holiday,
  });
}

/**
 * POST /api/holidays
 *
 * Creates a holiday inside the
 * authenticated organization.
 *
 * organizationId is deliberately
 * NOT accepted from the client.
 */
export async function createHolidayController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getContext(req);

  const body =
    createHolidaySchema.parse(
      req.body,
    );

  const holiday =
    await createHoliday({
      organizationId:
        context.organizationId,

      actorId:
        context.employeeId,

      name:
        body.name,

      date:
        body.date instanceof Date
          ? body.date.toISOString()
          : body.date,

      description:
        body.description,

      category:
        body.category,

      countryCode:
        body.countryCode,

      regionCode:
        body.regionCode,

      isReligious:
        body.isReligious,

      religion:
        body.religion,

      isRecurring:
        body.isRecurring,

      isActive:
        body.isActive,
    });

  res.status(201).json({
    success: true,
    data: holiday,
  });
}

/**
 * PATCH /api/holidays/:holidayId
 *
 * Updates an existing holiday.
 */
export async function updateHolidayController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getContext(req);

  const body =
    updateHolidaySchema.parse(
      req.body,
    );

  const holiday =
    await updateHoliday({
      organizationId:
        context.organizationId,

      actorId:
        context.employeeId,

      holidayId:
        getHolidayId(req),

      name:
        body.name,

      date:
        body.date instanceof Date
          ? body.date.toISOString()
          : body.date,

      description:
        body.description,

      category:
        body.category,

      countryCode:
        body.countryCode,

      regionCode:
        body.regionCode,

      isReligious:
        body.isReligious,

      religion:
        body.religion,

      isRecurring:
        body.isRecurring,

      isActive:
        body.isActive,
    });

  res.status(200).json({
    success: true,
    data: holiday,
  });
}

/**
 * POST /api/holidays/:holidayId/activate
 *
 * Activates a holiday.
 */
export async function activateHolidayController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getContext(req);

  const holiday =
    await activateHoliday(
      context.organizationId,
      context.employeeId,
      getHolidayId(req),
    );

  res.status(200).json({
    success: true,
    data: holiday,
  });
}

/**
 * POST /api/holidays/:holidayId/deactivate
 *
 * Deactivates a holiday without
 * deleting its historical record.
 */
export async function deactivateHolidayController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getContext(req);

  const holiday =
    await deactivateHoliday(
      context.organizationId,
      context.employeeId,
      getHolidayId(req),
    );

  res.status(200).json({
    success: true,
    data: holiday,
  });
}

/**
 * DELETE /api/holidays/:holidayId
 *
 * Permanently deletes a holiday.
 */
export async function deleteHolidayController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getContext(req);

  await deleteHoliday(
    context.organizationId,
    context.employeeId,
    getHolidayId(req),
  );

  res.status(204).send();
}

/**
 * GET /api/holidays/summary
 *
 * Returns tenant-scoped holiday statistics.
 */
export async function getHolidaySummaryController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getContext(req);

  const summary =
    await getHolidaySummary(
      context.organizationId,
      context.employeeId,
    );

  res.status(200).json({
    success: true,
    data: summary,
  });
}