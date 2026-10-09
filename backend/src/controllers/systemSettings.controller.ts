import type {
  Request,
  Response,
} from "express";

import { z } from "zod";

import { db } from "../../prisma/db.js";
import { AppError } from "../middleware/error.middleware.js";

import {
  getSystemSetting,
  getSystemSettingDefinitions,
  listSystemSettings,
  resetSystemSetting,
  resetSystemSettings,
  updateSystemSetting,
  updateSystemSettings,
} from "../services/systemSettings.service.js";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface SystemSettingsContext {
  employeeId: string;
  organizationId: string;
  role: string;
}

/* -------------------------------------------------------------------------- */
/* Authentication / tenant context                                            */
/* -------------------------------------------------------------------------- */

/**
 * Loads the authenticated employee directly from the database.
 *
 * Security rules:
 *
 * - The client cannot provide organizationId.
 * - The client cannot provide employeeId.
 * - The client cannot provide role.
 * - Tenant scope comes exclusively from the authenticated employee.
 * - The employee must still exist.
 * - The employee must be ACTIVE.
 * - System Settings are restricted to HR_ADMIN and SUPER_ADMIN.
 */
async function getContext(
  req: Request,
): Promise<SystemSettingsContext> {
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

  if (employee.status !== "ACTIVE") {
    throw new AppError(
      403,
      "This employee account is not active.",
      "EMPLOYEE_ACCOUNT_INACTIVE",
    );
  }

  if (
    employee.role !== "HR_ADMIN" &&
    employee.role !== "SUPER_ADMIN"
  ) {
    throw new AppError(
      403,
      "HR administrator access is required.",
      "HR_ADMIN_ACCESS_REQUIRED",
    );
  }

  if (!employee.organizationId) {
    throw new AppError(
      403,
      "The authenticated employee is not assigned to an organization.",
      "EMPLOYEE_ORGANIZATION_MISSING",
    );
  }

  return {
    employeeId: employee.id,
    organizationId: employee.organizationId,
    role: employee.role,
  };
}

/* -------------------------------------------------------------------------- */
/* Validation schemas                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Supported setting types.
 *
 * The service remains the final authority for the expected type of each
 * individual setting key.
 */
const settingTypeSchema =
  z.enum([
    "STRING",
    "INTEGER",
    "BOOLEAN",
    "JSON",
  ]);

/**
 * System setting key.
 *
 * The service contains the authoritative allow-list. The controller keeps
 * this as a bounded string because the service is responsible for validating
 * the current supported setting definitions.
 */
const settingKeySchema =
  z
    .string()
    .trim()
    .min(
      1,
      "System setting key is required.",
    )
    .max(
      150,
      "System setting key cannot exceed 150 characters.",
    );

/**
 * Update one setting.
 *
 * organizationId is intentionally NOT part of this schema.
 */
const updateSystemSettingSchema =
  z
    .object({
      key: settingKeySchema,

      value: z.unknown(),

      type:
        settingTypeSchema.optional(),

      description:
        z
          .string()
          .trim()
          .max(
            1000,
            "Setting description cannot exceed 1000 characters.",
          )
          .nullable()
          .optional(),
    })
    .strict()
    .refine(
      (body) =>
        Object.prototype.hasOwnProperty.call(
          body,
          "value",
        ),
      {
        message:
          "System setting value is required.",
        path: ["value"],
      },
    );

/**
 * Update multiple settings.
 */
const updateSystemSettingsSchema =
  z
    .object({
      settings:
        z
          .array(
            updateSystemSettingSchema,
          )
          .min(
            1,
            "At least one system setting is required.",
          )
          .max(
            100,
            "A maximum of 100 system settings can be updated at once.",
          ),
    })
    .strict();

/**
 * Route parameter containing a setting key.
 */
const settingKeyParamsSchema =
  z
    .object({
      key: settingKeySchema,
    })
    .strict();

/* -------------------------------------------------------------------------- */
/* Request helpers                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Safely extracts a single route parameter.
 *
 * Express can expose route parameters as string|string[] depending on the
 * surrounding request typing. System Settings only accepts one key.
 */
function getSettingKey(
  req: Request,
): string {
  const rawKey = req.params.key;

  if (Array.isArray(rawKey)) {
    if (rawKey.length !== 1) {
      throw new AppError(
        400,
        "System setting key is invalid.",
        "INVALID_SETTING_KEY",
      );
    }

    return rawKey[0];
  }

  return rawKey;
}

/* -------------------------------------------------------------------------- */
/* Controllers                                                                */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/admin/settings
 *
 * Returns every supported system setting for the authenticated tenant.
 *
 * Defaults are returned when the tenant has not explicitly configured
 * a particular setting.
 */
export async function getSystemSettingsController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getContext(req);

  const settings =
    await listSystemSettings(
      context.employeeId,
    );

  res.status(200).json({
    success: true,
    data: settings,
  });
}

/**
 * GET /api/admin/settings/definitions
 *
 * Returns the supported System Settings definitions and their defaults.
 *
 * This allows the frontend to construct the settings UI from a controlled
 * backend contract rather than hard-coding server configuration.
 */
export async function getSystemSettingDefinitionsController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getContext(req);

  const definitions =
    await getSystemSettingDefinitions(
      context.employeeId,
    );

  res.status(200).json({
    success: true,
    data: definitions,
  });
}

/**
 * GET /api/admin/settings/:key
 *
 * Returns one setting for the authenticated tenant.
 */
export async function getSystemSettingController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getContext(req);

  const params =
    settingKeyParamsSchema.parse({
      key: getSettingKey(req),
    });

  const setting =
    await getSystemSetting(
      context.employeeId,
      params.key,
    );

  res.status(200).json({
    success: true,
    data: setting,
  });
}

/**
 * PUT /api/admin/settings/:key
 *
 * Updates one system setting.
 *
 * The route key and request-body key must match.
 *
 * This prevents accidental updates such as:
 *
 * PUT /settings/manager_approval_required
 * body: { key: "hr_approval_required", ... }
 */
export async function updateSystemSettingController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getContext(req);

  const params =
    settingKeyParamsSchema.parse({
      key: getSettingKey(req),
    });

  const body =
    updateSystemSettingSchema.parse(
      req.body,
    );

  if (body.key !== params.key) {
    throw new AppError(
      400,
      "The setting key in the URL must match the setting key in the request body.",
      "SETTING_KEY_MISMATCH",
    );
  }

  const updated =
    await updateSystemSetting(
      context.employeeId,
      {
        key: body.key,
        value: body.value,
        type: body.type,
        description:
          body.description,
      },
    );

  res.status(200).json({
    success: true,
    data: updated,
  });
}

/**
 * PUT /api/admin/settings
 *
 * Updates multiple settings atomically.
 *
 * The service layer performs the database transaction.
 */
export async function updateSystemSettingsController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getContext(req);

  const body =
    updateSystemSettingsSchema.parse(
      req.body,
    );

  const updated =
    await updateSystemSettings(
      context.employeeId,
      body.settings.map(
        (setting) => ({
          key: setting.key,
          value: setting.value,
          type: setting.type,
          description:
            setting.description,
        }),
      ),
    );

  res.status(200).json({
    success: true,
    data: updated,
  });
}

/**
 * DELETE /api/admin/settings/:key
 *
 * Removes the tenant's explicit configuration for one setting.
 *
 * The application default will subsequently be returned.
 */
export async function resetSystemSettingController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getContext(req);

  const params =
    settingKeyParamsSchema.parse({
      key: getSettingKey(req),
    });

  const setting =
    await resetSystemSetting(
      context.employeeId,
      params.key,
    );

  res.status(200).json({
    success: true,
    data: setting,
  });
}

/**
 * DELETE /api/admin/settings
 *
 * Removes all explicitly configured settings for the authenticated tenant.
 *
 * This does NOT affect another organization.
 */
export async function resetSystemSettingsController(
  req: Request,
  res: Response,
): Promise<void> {
  const context =
    await getContext(req);

  const settings =
    await resetSystemSettings(
      context.employeeId,
    );

  res.status(200).json({
    success: true,
    data: settings,
  });
}