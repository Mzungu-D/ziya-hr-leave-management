import { db } from "../../prisma/db.js";
import { AppError } from "../middleware/error.middleware.js";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type SystemSettingType =
  | "STRING"
  | "INTEGER"
  | "BOOLEAN"
  | "JSON";

export interface SystemSettingRecord {
  id: string;
  organizationId: string;
  key: string;
  value: string;
  type: SystemSettingType;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SystemSettingValue {
  key: string;
  value: unknown;
  type: SystemSettingType;
  description: string | null;
}

export interface UpdateSystemSettingInput {
  key: string;
  value: unknown;
  type?: SystemSettingType;
  description?: string | null;
}

/* -------------------------------------------------------------------------- */
/* Supported settings                                                         */
/* -------------------------------------------------------------------------- */

const SETTING_DEFINITIONS = {
  organization_timezone: {
    type: "STRING" as const,
    description:
      "IANA timezone used when displaying organization dates and times.",
    validate: (value: unknown): string => {
      const normalized = normalizeString(value);

      if (!normalized) {
        throw new AppError(
          400,
          "Organization timezone is required.",
          "INVALID_SETTING_VALUE",
        );
      }

      if (normalized.length > 100) {
        throw new AppError(
          400,
          "Organization timezone cannot exceed 100 characters.",
          "INVALID_SETTING_VALUE",
        );
      }

      try {
        new Intl.DateTimeFormat("en-US", {
          timeZone: normalized,
        });
      } catch {
        throw new AppError(
          400,
          "Organization timezone is invalid.",
          "INVALID_SETTING_VALUE",
        );
      }

      return normalized;
    },
  },

  organization_locale: {
    type: "STRING" as const,
    description: "Default locale used by the organization.",
    validate: (value: unknown): string => {
      const normalized = normalizeString(value);

      if (!normalized) {
        throw new AppError(
          400,
          "Organization locale is required.",
          "INVALID_SETTING_VALUE",
        );
      }

      if (
        !/^[A-Za-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(
          normalized,
        )
      ) {
        throw new AppError(
          400,
          "Organization locale is invalid.",
          "INVALID_SETTING_VALUE",
        );
      }

      try {
        new Intl.Locale(normalized);
      } catch {
        throw new AppError(
          400,
          "Organization locale is invalid.",
          "INVALID_SETTING_VALUE",
        );
      }

      return normalized;
    },
  },

  leave_year_start_month: {
    type: "INTEGER" as const,
    description:
      "Month in which the organization's leave year begins. January is 1.",
    validate: (value: unknown): string => {
      const number = normalizeInteger(value);

      if (number < 1 || number > 12) {
        throw new AppError(
          400,
          "Leave year start month must be between 1 and 12.",
          "INVALID_SETTING_VALUE",
        );
      }

      return String(number);
    },
  },

  leave_year_start_day: {
    type: "INTEGER" as const,
    description:
      "Day on which the organization's leave year begins.",
    validate: (value: unknown): string => {
      const number = normalizeInteger(value);

      if (number < 1 || number > 31) {
        throw new AppError(
          400,
          "Leave year start day must be between 1 and 31.",
          "INVALID_SETTING_VALUE",
        );
      }

      return String(number);
    },
  },

  working_days_monday: {
    type: "BOOLEAN" as const,
    description:
      "Whether Monday is a working day for leave calculations.",
    validate: normalizeBoolean,
  },

  working_days_tuesday: {
    type: "BOOLEAN" as const,
    description:
      "Whether Tuesday is a working day for leave calculations.",
    validate: normalizeBoolean,
  },

  working_days_wednesday: {
    type: "BOOLEAN" as const,
    description:
      "Whether Wednesday is a working day for leave calculations.",
    validate: normalizeBoolean,
  },

  working_days_thursday: {
    type: "BOOLEAN" as const,
    description:
      "Whether Thursday is a working day for leave calculations.",
    validate: normalizeBoolean,
  },

  working_days_friday: {
    type: "BOOLEAN" as const,
    description:
      "Whether Friday is a working day for leave calculations.",
    validate: normalizeBoolean,
  },

  working_days_saturday: {
    type: "BOOLEAN" as const,
    description:
      "Whether Saturday is a working day for leave calculations.",
    validate: normalizeBoolean,
  },

  working_days_sunday: {
    type: "BOOLEAN" as const,
    description:
      "Whether Sunday is a working day for leave calculations.",
    validate: normalizeBoolean,
  },

  max_department_concurrent_leave: {
    type: "INTEGER" as const,
    description:
      "Maximum number of employees from the same department who may be on leave at the same time.",
    validate: (value: unknown): string => {
      const number = normalizeInteger(value);

      if (number < 1 || number > 100000) {
        throw new AppError(
          400,
          "Maximum concurrent department leave must be between 1 and 100000.",
          "INVALID_SETTING_VALUE",
        );
      }

      return String(number);
    },
  },

  manager_approval_required: {
    type: "BOOLEAN" as const,
    description:
      "Whether leave requests require manager approval before HR approval.",
    validate: normalizeBoolean,
  },

  hr_approval_required: {
    type: "BOOLEAN" as const,
    description:
      "Whether leave requests require HR approval.",
    validate: normalizeBoolean,
  },

  employee_self_service_enabled: {
    type: "BOOLEAN" as const,
    description:
      "Whether employees can submit and manage their own leave requests.",
    validate: normalizeBoolean,
  },

  email_notifications_enabled: {
    type: "BOOLEAN" as const,
    description:
      "Whether system email notifications are enabled for the organization.",
    validate: normalizeBoolean,
  },

  session_timeout_minutes: {
    type: "INTEGER" as const,
    description:
      "Maximum inactivity period for authenticated sessions in minutes.",
    validate: (value: unknown): string => {
      const number = normalizeInteger(value);

      if (number < 5 || number > 43200) {
        throw new AppError(
          400,
          "Session timeout must be between 5 and 43200 minutes.",
          "INVALID_SETTING_VALUE",
        );
      }

      return String(number);
    },
  },
} as const;

type SupportedSettingKey =
  keyof typeof SETTING_DEFINITIONS;

/* -------------------------------------------------------------------------- */
/* Default settings                                                           */
/* -------------------------------------------------------------------------- */

const DEFAULT_SETTINGS: Record<
  SupportedSettingKey,
  unknown
> = {
  organization_timezone: "Africa/Nairobi",
  organization_locale: "en-KE",

  leave_year_start_month: 1,
  leave_year_start_day: 1,

  working_days_monday: true,
  working_days_tuesday: true,
  working_days_wednesday: true,
  working_days_thursday: true,
  working_days_friday: true,
  working_days_saturday: false,
  working_days_sunday: false,

  max_department_concurrent_leave: 3,

  manager_approval_required: true,
  hr_approval_required: true,

  employee_self_service_enabled: true,

  email_notifications_enabled: true,

  session_timeout_minutes: 480,
};

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                           */
/* -------------------------------------------------------------------------- */

function normalizeString(value: unknown): string {
  if (typeof value !== "string") {
    throw new AppError(
      400,
      "Setting value must be a string.",
      "INVALID_SETTING_VALUE",
    );
  }

  return value.trim();
}

function normalizeInteger(value: unknown): number {
  let normalized: number;

  if (typeof value === "number") {
    normalized = value;
  } else if (
    typeof value === "string" &&
    value.trim() !== ""
  ) {
    normalized = Number(value.trim());
  } else {
    throw new AppError(
      400,
      "Setting value must be an integer.",
      "INVALID_SETTING_VALUE",
    );
  }

  if (
    !Number.isFinite(normalized) ||
    !Number.isInteger(normalized)
  ) {
    throw new AppError(
      400,
      "Setting value must be an integer.",
      "INVALID_SETTING_VALUE",
    );
  }

  return normalized;
}

function normalizeBoolean(value: unknown): string {
  if (typeof value === "boolean") {
    return String(value);
  }

  if (
    typeof value === "string" &&
    (
      value.trim().toLowerCase() === "true" ||
      value.trim().toLowerCase() === "false"
    )
  ) {
    return value.trim().toLowerCase();
  }

  throw new AppError(
    400,
    "Setting value must be a boolean.",
    "INVALID_SETTING_VALUE",
  );
}

function normalizeJson(value: unknown): string {
  let serialized: string | undefined;

  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new AppError(
      400,
      "Setting value contains invalid JSON.",
      "INVALID_SETTING_VALUE",
    );
  }

  if (serialized === undefined) {
    throw new AppError(
      400,
      "Setting value must contain valid JSON.",
      "INVALID_SETTING_VALUE",
    );
  }

  return serialized;
}

function normalizeSettingKey(
  key: string,
): SupportedSettingKey {
  if (typeof key !== "string") {
    throw new AppError(
      400,
      "System setting key is required.",
      "INVALID_SETTING_KEY",
    );
  }

  const normalized = key.trim();

  if (
    !Object.prototype.hasOwnProperty.call(
      SETTING_DEFINITIONS,
      normalized,
    )
  ) {
    throw new AppError(
      400,
      `Unsupported system setting: ${normalized}.`,
      "UNSUPPORTED_SETTING",
    );
  }

  return normalized as SupportedSettingKey;
}

function normalizeDescription(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new AppError(
      400,
      "Setting description must be a string.",
      "INVALID_SETTING_DESCRIPTION",
    );
  }

  const normalized = value.trim();

  if (normalized.length > 1000) {
    throw new AppError(
      400,
      "Setting description cannot exceed 1000 characters.",
      "INVALID_SETTING_DESCRIPTION",
    );
  }

  return normalized || null;
}

function timestamp(
  value: string | Date,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(
      500,
      "Invalid system setting timestamp.",
      "INVALID_SETTING_TIMESTAMP",
    );
  }

  return date.toISOString();
}

function serializeStoredValue(
  value: string,
  type: SystemSettingType,
): unknown {
  switch (type) {
    case "STRING":
      return value;

    case "INTEGER": {
      const parsed = Number(value);

      return Number.isInteger(parsed)
        ? parsed
        : value;
    }

    case "BOOLEAN":
      if (value === "true") {
        return true;
      }

      if (value === "false") {
        return false;
      }

      return value;

    case "JSON":
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }

    default:
      return value;
  }
}

/**
 * Prisma 8's update operation can return null.
 *
 * This helper deliberately handles that case instead of using a type cast.
 */
function serializeSetting(
  setting: {
    id: string;
    organizationId: string;
    key: string;
    value: string;
    type: SystemSettingType;
    description: string | null;
    createdAt: string | Date;
    updatedAt: string | Date;
  } | null,
): SystemSettingRecord {
  if (!setting) {
    throw new AppError(
      500,
      "The system setting could not be updated.",
      "SYSTEM_SETTING_UPDATE_FAILED",
    );
  }

  return {
    id: setting.id,
    organizationId: setting.organizationId,
    key: setting.key,
    value: setting.value,
    type: setting.type,
    description: setting.description,
    createdAt: timestamp(setting.createdAt),
    updatedAt: timestamp(setting.updatedAt),
  };
}

function getDefaultSettingValue(
  key: SupportedSettingKey,
): string {
  const definition =
    SETTING_DEFINITIONS[key];

  const defaultValue =
    DEFAULT_SETTINGS[key];

  if (definition.type === "STRING") {
    return definition.validate(
      defaultValue,
    );
  }

  if (definition.type === "INTEGER") {
    return definition.validate(
      defaultValue,
    );
  }

  if (definition.type === "BOOLEAN") {
    return definition.validate(
      defaultValue,
    );
  }

  return normalizeJson(defaultValue);
}

/* -------------------------------------------------------------------------- */
/* Authentication / tenant context                                            */
/* -------------------------------------------------------------------------- */

async function getAuthenticatedAdmin(
  employeeId: string,
) {
  const normalizedEmployeeId =
    typeof employeeId === "string"
      ? employeeId.trim()
      : "";

  if (!normalizedEmployeeId) {
    throw new AppError(
      401,
      "Authentication required.",
      "AUTHENTICATION_REQUIRED",
    );
  }

  const employee =
    await db.orm.public.Employee
      .where({
        id: normalizedEmployeeId,
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

  const organization =
    await db.orm.public.Organization
      .where({
        id: employee.organizationId,
      })
      .first();

  if (!organization) {
    throw new AppError(
      403,
      "The employee organization could not be found.",
      "ORGANIZATION_NOT_FOUND",
    );
  }

  return {
    employee,
    organization,
  };
}

/* -------------------------------------------------------------------------- */
/* Public service functions                                                   */
/* -------------------------------------------------------------------------- */

/**
 * List all supported settings for the authenticated tenant.
 *
 * Tenant context is resolved exclusively from the authenticated employee.
 * No organizationId is accepted from the caller.
 */
export async function listSystemSettings(
  employeeId: string,
): Promise<SystemSettingValue[]> {
  const { organization } =
    await getAuthenticatedAdmin(
      employeeId,
    );

  const settings =
    await db.orm.public.SystemSetting
      .where({
        organizationId:
          organization.id,
      })
      .all();

  const configuredByKey =
    new Map<string, SystemSettingRecord>();

  for (const setting of settings) {
    configuredByKey.set(
      setting.key,
      serializeSetting(setting),
    );
  }

  return (
    Object.keys(
      SETTING_DEFINITIONS,
    ) as SupportedSettingKey[]
  ).map((key) => {
    const configured =
      configuredByKey.get(key);

    if (configured) {
      return {
        key: configured.key,
        value: serializeStoredValue(
          configured.value,
          configured.type,
        ),
        type: configured.type,
        description:
          configured.description ??
          SETTING_DEFINITIONS[key]
            .description,
      };
    }

    const definition =
      SETTING_DEFINITIONS[key];

    const defaultValue =
      getDefaultSettingValue(key);

    return {
      key,
      value: serializeStoredValue(
        defaultValue,
        definition.type,
      ),
      type: definition.type,
      description:
        definition.description,
    };
  });
}

/**
 * Get one setting for the authenticated tenant.
 */
export async function getSystemSetting(
  employeeId: string,
  key: string,
): Promise<SystemSettingValue> {
  const { organization } =
    await getAuthenticatedAdmin(
      employeeId,
    );

  const normalizedKey =
    normalizeSettingKey(key);

  const setting =
    await db.orm.public.SystemSetting
      .where({
        organizationId:
          organization.id,
        key: normalizedKey,
      })
      .first();

  if (setting) {
    return {
      key: setting.key,
      value: serializeStoredValue(
        setting.value,
        setting.type,
      ),
      type: setting.type,
      description:
        setting.description ??
        SETTING_DEFINITIONS[
          normalizedKey
        ].description,
    };
  }

  const definition =
    SETTING_DEFINITIONS[
      normalizedKey
    ];

  const defaultValue =
    getDefaultSettingValue(
      normalizedKey,
    );

  return {
    key: normalizedKey,
    value: serializeStoredValue(
      defaultValue,
      definition.type,
    ),
    type: definition.type,
    description:
      definition.description,
  };
}

/**
 * Update one system setting.
 *
 * The organization is ALWAYS derived from the authenticated employee.
 */
export async function updateSystemSetting(
  employeeId: string,
  input: UpdateSystemSettingInput,
): Promise<SystemSettingRecord> {
  const { organization } =
    await getAuthenticatedAdmin(
      employeeId,
    );

  if (
    !input ||
    typeof input !== "object"
  ) {
    throw new AppError(
      400,
      "System setting data is required.",
      "INVALID_SETTING_DATA",
    );
  }

  const normalizedKey =
    normalizeSettingKey(input.key);

  const definition =
    SETTING_DEFINITIONS[
      normalizedKey
    ];

  if (
    input.type !== undefined &&
    input.type !== definition.type
  ) {
    throw new AppError(
      400,
      `Setting "${normalizedKey}" must use type ${definition.type}.`,
      "SETTING_TYPE_MISMATCH",
    );
  }

  const normalizedValue =
    definition.validate(
      input.value,
    );

  const description =
    normalizeDescription(
      input.description,
    );

  const existing =
    await db.orm.public.SystemSetting
      .where({
        organizationId:
          organization.id,
        key: normalizedKey,
      })
      .first();

  if (existing) {
    const updated =
      await db.orm.public.SystemSetting
        .where({
          id: existing.id,
          organizationId:
            organization.id,
        })
        .update({
          value: normalizedValue,
          type: definition.type,
          description:
            description ??
            existing.description ??
            definition.description,
        });

    return serializeSetting(
      updated,
    );
  }

  const created =
    await db.orm.public.SystemSetting
      .create({
        organizationId:
          organization.id,
        key: normalizedKey,
        value: normalizedValue,
        type: definition.type,
        description:
          description ??
          definition.description,
      });

  return serializeSetting(
    created,
  );
}

/**
 * Update multiple system settings atomically.
 */
export async function updateSystemSettings(
  employeeId: string,
  inputs: UpdateSystemSettingInput[],
): Promise<SystemSettingRecord[]> {
  const { organization } =
    await getAuthenticatedAdmin(
      employeeId,
    );

  if (!Array.isArray(inputs)) {
    throw new AppError(
      400,
      "System settings must be provided as an array.",
      "INVALID_SETTINGS_DATA",
    );
  }

  if (inputs.length === 0) {
    throw new AppError(
      400,
      "At least one system setting is required.",
      "EMPTY_SETTINGS_UPDATE",
    );
  }

  if (inputs.length > 100) {
    throw new AppError(
      400,
      "A maximum of 100 system settings can be updated at once.",
      "TOO_MANY_SETTINGS",
    );
  }

  const normalizedInputs =
    inputs.map((input) => {
      if (
        !input ||
        typeof input !== "object"
      ) {
        throw new AppError(
          400,
          "Invalid system setting.",
          "INVALID_SETTING_DATA",
        );
      }

      const key =
        normalizeSettingKey(
          input.key,
        );

      const definition =
        SETTING_DEFINITIONS[key];

      if (
        input.type !== undefined &&
        input.type !== definition.type
      ) {
        throw new AppError(
          400,
          `Setting "${key}" must use type ${definition.type}.`,
          "SETTING_TYPE_MISMATCH",
        );
      }

      return {
        key,
        value:
          definition.validate(
            input.value,
          ),
        type:
          definition.type,
        description:
          normalizeDescription(
            input.description,
          ),
        defaultDescription:
          definition.description,
      };
    });

  const keys =
    normalizedInputs.map(
      (item) => item.key,
    );

  if (
    new Set(keys).size !== keys.length
  ) {
    throw new AppError(
      400,
      "The same system setting cannot be supplied more than once.",
      "DUPLICATE_SETTING_KEYS",
    );
  }

  return db.transaction(
    async (tx) => {
      const results: SystemSettingRecord[] =
        [];

      for (
        const input of normalizedInputs
      ) {
        const existing =
          await tx.orm.public.SystemSetting
            .where({
              organizationId:
                organization.id,
              key: input.key,
            })
            .first();

        if (existing) {
          const updated =
            await tx.orm.public.SystemSetting
              .where({
                id: existing.id,
                organizationId:
                  organization.id,
              })
              .update({
                value: input.value,
                type: input.type,
                description:
                  input.description ??
                  existing.description ??
                  input.defaultDescription,
              });

          results.push(
            serializeSetting(
              updated,
            ),
          );

          continue;
        }

        const created =
          await tx.orm.public.SystemSetting
            .create({
              organizationId:
                organization.id,
              key: input.key,
              value: input.value,
              type: input.type,
              description:
                input.description ??
                input.defaultDescription,
            });

        results.push(
          serializeSetting(
            created,
          ),
        );
      }

      return results;
    },
  );
}

/**
 * Reset one tenant setting to its application default.
 */
export async function resetSystemSetting(
  employeeId: string,
  key: string,
): Promise<SystemSettingValue> {
  const { organization } =
    await getAuthenticatedAdmin(
      employeeId,
    );

  const normalizedKey =
    normalizeSettingKey(key);

  const existing =
    await db.orm.public.SystemSetting
      .where({
        organizationId:
          organization.id,
        key: normalizedKey,
      })
      .first();

  if (existing) {
    await db.orm.public.SystemSetting
      .where({
        id: existing.id,
        organizationId:
          organization.id,
      })
      .delete();
  }

  return getSystemSetting(
    employeeId,
    normalizedKey,
  );
}

/**
 * Reset every configured system setting for the authenticated tenant.
 */
export async function resetSystemSettings(
  employeeId: string,
): Promise<SystemSettingValue[]> {
  const { organization } =
    await getAuthenticatedAdmin(
      employeeId,
    );

  await db.orm.public.SystemSetting
    .where({
      organizationId:
        organization.id,
    })
    .deleteAll();

  return listSystemSettings(
    employeeId,
  );
}

/**
 * Return the supported settings and their defaults.
 */
export async function getSystemSettingDefinitions(
  employeeId: string,
) {
  await getAuthenticatedAdmin(
    employeeId,
  );

  return (
    Object.keys(
      SETTING_DEFINITIONS,
    ) as SupportedSettingKey[]
  ).map((key) => {
    const definition =
      SETTING_DEFINITIONS[key];

    return {
      key,
      type: definition.type,
      description:
        definition.description,
      defaultValue:
        serializeStoredValue(
          getDefaultSettingValue(key),
          definition.type,
        ),
    };
  });
}