import { randomUUID } from "node:crypto";

import { db } from "../../prisma/db.js";
import { AppError } from "../middleware/error.middleware.js";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface HolidayPublicRecord {
  id: string;
  organizationId: string;
  name: string;
  date: string;
  description: string | null;
  category: string;
  countryCode: string | null;
  regionCode: string | null;
  isReligious: boolean;
  religion: string | null;
  isRecurring: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListHolidaysParams {
  organizationId: string;
  actorId: string;
  search?: string;
  year?: number;
  category?: string;
  countryCode?: string;
  regionCode?: string;
  religion?: string;
  isReligious?: boolean;
  isRecurring?: boolean;
  isActive?: boolean;
}

export interface CreateHolidayParams {
  organizationId: string;
  actorId: string;
  name: string;
  date: string;
  description?: string | null;
  category?: string;
  countryCode?: string | null;
  regionCode?: string | null;
  isReligious?: boolean;
  religion?: string | null;
  isRecurring?: boolean;
  isActive?: boolean;
}

export interface UpdateHolidayParams {
  organizationId: string;
  actorId: string;
  holidayId: string;
  name?: string;
  date?: string;
  description?: string | null;
  category?: string;
  countryCode?: string | null;
  regionCode?: string | null;
  isReligious?: boolean;
  religion?: string | null;
  isRecurring?: boolean;
  isActive?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_CATEGORY_LENGTH = 50;
const MAX_COUNTRY_CODE_LENGTH = 2;
const MAX_REGION_CODE_LENGTH = 20;
const MAX_RELIGION_LENGTH = 50;

const SUPPORTED_RELIGIONS = new Set([
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
]);

/* -------------------------------------------------------------------------- */
/* Internal database record type                                              */
/* -------------------------------------------------------------------------- */

type DbHoliday = Awaited<
  ReturnType<typeof db.orm.public.Holiday.where>
> extends infer T
  ? T extends {
      first: () => Promise<infer R>;
    }
    ? NonNullable<R>
    : never
  : never;

/* -------------------------------------------------------------------------- */
/* Validation helpers                                                         */
/* -------------------------------------------------------------------------- */

function requireId(
  value: string | undefined | null,
  fieldName: string,
  errorCode: string,
): string {
  const normalized = value?.trim();

  if (!normalized) {
    throw new AppError(
      400,
      `${fieldName} is required.`,
      errorCode,
    );
  }

  return normalized;
}

function normalizeText(
  value: string | undefined | null,
  fieldName: string,
  maxLength: number,
): string {
  const normalized = value?.trim();

  if (!normalized) {
    throw new AppError(
      400,
      `${fieldName} is required.`,
      `${fieldName.toUpperCase().replace(/\s+/g, "_")}_REQUIRED`,
    );
  }

  if (normalized.length > maxLength) {
    throw new AppError(
      400,
      `${fieldName} cannot exceed ${maxLength} characters.`,
      `${fieldName.toUpperCase().replace(/\s+/g, "_")}_TOO_LONG`,
    );
  }

  return normalized;
}

function normalizeOptionalText(
  value: string | undefined | null,
  fieldName: string,
  maxLength: number,
): string | null {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw new AppError(
      400,
      `${fieldName} cannot exceed ${maxLength} characters.`,
      `${fieldName.toUpperCase().replace(/\s+/g, "_")}_TOO_LONG`,
    );
  }

  return normalized;
}

function normalizeCategory(
  value: string | undefined | null,
): string {
  const category =
    value?.trim().toUpperCase() ||
    "PUBLIC";

  if (category.length > MAX_CATEGORY_LENGTH) {
    throw new AppError(
      400,
      `Holiday category cannot exceed ${MAX_CATEGORY_LENGTH} characters.`,
      "HOLIDAY_CATEGORY_TOO_LONG",
    );
  }

  return category;
}

function normalizeCountryCode(
  value: string | undefined | null,
): string | null {
  if (
    value === undefined ||
    value === null ||
    !value.trim()
  ) {
    return null;
  }

  const countryCode =
    value.trim().toUpperCase();

  if (
    !/^[A-Z]{2}$/.test(countryCode)
  ) {
    throw new AppError(
      400,
      "Country code must be a valid ISO 3166-1 alpha-2 code.",
      "INVALID_COUNTRY_CODE",
    );
  }

  return countryCode;
}

function normalizeRegionCode(
  value: string | undefined | null,
): string | null {
  if (
    value === undefined ||
    value === null ||
    !value.trim()
  ) {
    return null;
  }

  const regionCode =
    value.trim().toUpperCase();

  if (
    regionCode.length >
    MAX_REGION_CODE_LENGTH
  ) {
    throw new AppError(
      400,
      `Region code cannot exceed ${MAX_REGION_CODE_LENGTH} characters.`,
      "REGION_CODE_TOO_LONG",
    );
  }

  return regionCode;
}

function normalizeReligion(
  value: string | undefined | null,
): string | null {
  if (
    value === undefined ||
    value === null ||
    !value.trim()
  ) {
    return null;
  }

  const religion =
    value.trim().toUpperCase();

  if (
    religion.length >
    MAX_RELIGION_LENGTH
  ) {
    throw new AppError(
      400,
      `Religion cannot exceed ${MAX_RELIGION_LENGTH} characters.`,
      "RELIGION_TOO_LONG",
    );
  }

  if (
    !SUPPORTED_RELIGIONS.has(
      religion,
    )
  ) {
    throw new AppError(
      400,
      "Unsupported religion.",
      "INVALID_RELIGION",
    );
  }

  return religion;
}

function normalizeDate(
  value: string | undefined | null,
  fieldName = "Holiday date",
): string {
  const normalized = value?.trim();

  if (!normalized) {
    throw new AppError(
      400,
      `${fieldName} is required.`,
      "HOLIDAY_DATE_REQUIRED",
    );
  }

  const parsed =
    new Date(normalized);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    throw new AppError(
      400,
      `${fieldName} is invalid.`,
      "INVALID_HOLIDAY_DATE",
    );
  }

  return parsed.toISOString();
}

function normalizeBoolean(
  value: boolean | undefined,
  defaultValue: boolean,
): boolean {
  return value === undefined
    ? defaultValue
    : Boolean(value);
}

function normalizeYear(
  value: number | undefined,
): number | null {
  if (
    value === undefined
  ) {
    return null;
  }

  if (
    !Number.isInteger(value) ||
    value < 1900 ||
    value > 2200
  ) {
    throw new AppError(
      400,
      "Year must be a valid four-digit year.",
      "INVALID_HOLIDAY_YEAR",
    );
  }

  return value;
}

/* -------------------------------------------------------------------------- */
/* Organization validation                                                    */
/* -------------------------------------------------------------------------- */

async function ensureOrganization(
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
      404,
      "Organization not found.",
      "ORGANIZATION_NOT_FOUND",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Tenant-scoped holiday lookup                                               */
/* -------------------------------------------------------------------------- */

async function getHolidayInOrganization(
  organizationId: string,
  holidayId: string,
): Promise<DbHoliday> {
  const holiday =
    await db.orm.public.Holiday
      .where({
        id: holidayId,
        organizationId,
      })
      .first();

  if (!holiday) {
    throw new AppError(
      404,
      "Holiday not found.",
      "HOLIDAY_NOT_FOUND",
    );
  }

  return holiday as DbHoliday;
}

/* -------------------------------------------------------------------------- */
/* DTO                                                                        */
/* -------------------------------------------------------------------------- */

function toPublicHoliday(
  holiday: DbHoliday,
): HolidayPublicRecord {
  return {
    id: holiday.id,
    organizationId:
      holiday.organizationId,
    name: holiday.name,
    date: holiday.date,
    description:
      holiday.description,
    category: holiday.category,
    countryCode:
      holiday.countryCode,
    regionCode:
      holiday.regionCode,
    isReligious:
      holiday.isReligious,
    religion:
      holiday.religion,
    isRecurring:
      holiday.isRecurring,
    isActive:
      holiday.isActive,
    createdAt:
      holiday.createdAt,
    updatedAt:
      holiday.updatedAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

export async function createHoliday(
  params: CreateHolidayParams,
): Promise<HolidayPublicRecord> {
  const organizationId =
    requireId(
      params.organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  requireId(
    params.actorId,
    "Actor ID",
    "ACTOR_ID_REQUIRED",
  );

  await ensureOrganization(
    organizationId,
  );

  const name =
    normalizeText(
      params.name,
      "Holiday name",
      MAX_NAME_LENGTH,
    );

  const date =
    normalizeDate(
      params.date,
    );

  const description =
    normalizeOptionalText(
      params.description,
      "Holiday description",
      MAX_DESCRIPTION_LENGTH,
    );

  const category =
    normalizeCategory(
      params.category,
    );

  const countryCode =
    normalizeCountryCode(
      params.countryCode,
    );

  const regionCode =
    normalizeRegionCode(
      params.regionCode,
    );

  const isReligious =
    normalizeBoolean(
      params.isReligious,
      false,
    );

  const religion =
    normalizeReligion(
      params.religion,
    );

  if (
    religion &&
    !isReligious
  ) {
    throw new AppError(
      400,
      "A religion can only be specified for a religious holiday.",
      "RELIGION_REQUIRES_RELIGIOUS_HOLIDAY",
    );
  }

  if (
    isReligious &&
    !religion
  ) {
    throw new AppError(
      400,
      "A religious holiday must specify a religion.",
      "RELIGION_REQUIRED",
    );
  }

  const isRecurring =
    normalizeBoolean(
      params.isRecurring,
      false,
    );

  const isActive =
    normalizeBoolean(
      params.isActive,
      true,
    );

  const existing =
    await db.orm.public.Holiday
      .where({
        organizationId,
        name,
        date,
      })
      .first();

  if (existing) {
    throw new AppError(
      409,
      "A holiday with the same name and date already exists in this organization.",
      "HOLIDAY_ALREADY_EXISTS",
    );
  }

  const now =
    new Date().toISOString();

  try {
    const holiday =
      await db.orm.public.Holiday.create(
        {
          id: randomUUID(),
          organizationId,
          name,
          date,
          description,
          category,
          countryCode,
          regionCode,
          isReligious,
          religion,
          isRecurring,
          isActive,
          createdAt: now,
          updatedAt: now,
        },
      );

    return toPublicHoliday(
      holiday as DbHoliday,
    );
  } catch (error) {
    if (
      error instanceof AppError
    ) {
      throw error;
    }

    throw new AppError(
      409,
      "The holiday could not be created because it conflicts with an existing holiday.",
      "HOLIDAY_CREATE_CONFLICT",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* List                                                                       */
/* -------------------------------------------------------------------------- */

export async function listHolidays(
  params: ListHolidaysParams,
): Promise<HolidayPublicRecord[]> {
  const organizationId =
    requireId(
      params.organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  requireId(
    params.actorId,
    "Actor ID",
    "ACTOR_ID_REQUIRED",
  );

  await ensureOrganization(
    organizationId,
  );

  const holidays =
    await db.orm.public.Holiday
      .where({
        organizationId,
      })
      .all();

  const search =
    params.search
      ?.trim()
      .toLowerCase() || "";

  const year =
    normalizeYear(
      params.year,
    );

  const category =
    params.category
      ?.trim()
      .toUpperCase() || null;

  const countryCode =
    normalizeCountryCode(
      params.countryCode,
    );

  const regionCode =
    normalizeRegionCode(
      params.regionCode,
    );

  const religion =
    normalizeReligion(
      params.religion,
    );

  const filtered =
    holidays
      .filter(
        (holiday) => {
          if (
            search &&
            ![
              holiday.name,
              holiday.description ??
                "",
              holiday.category,
              holiday.countryCode ??
                "",
              holiday.regionCode ??
                "",
              holiday.religion ??
                "",
            ]
              .join(" ")
              .toLowerCase()
              .includes(search)
          ) {
            return false;
          }

          if (
            year !== null
          ) {
            const holidayYear =
              new Date(
                holiday.date,
              ).getUTCFullYear();

            if (
              holidayYear !== year
            ) {
              return false;
            }
          }

          if (
            category &&
            holiday.category !==
              category
          ) {
            return false;
          }

          if (
            countryCode &&
            holiday.countryCode !==
              countryCode
          ) {
            return false;
          }

          if (
            regionCode &&
            holiday.regionCode !==
              regionCode
          ) {
            return false;
          }

          if (
            religion &&
            holiday.religion !==
              religion
          ) {
            return false;
          }

          if (
            params.isReligious !==
              undefined &&
            holiday.isReligious !==
              params.isReligious
          ) {
            return false;
          }

          if (
            params.isRecurring !==
              undefined &&
            holiday.isRecurring !==
              params.isRecurring
          ) {
            return false;
          }

          if (
            params.isActive !==
              undefined &&
            holiday.isActive !==
              params.isActive
          ) {
            return false;
          }

          return true;
        },
      )
      .sort(
        (a, b) =>
          new Date(a.date).getTime() -
          new Date(b.date).getTime(),
      );

  return filtered.map(
    (holiday) =>
      toPublicHoliday(
        holiday as DbHoliday,
      ),
  );
}

/* -------------------------------------------------------------------------- */
/* Get one                                                                    */
/* -------------------------------------------------------------------------- */

export async function getHoliday(
  organizationId: string,
  actorId: string,
  holidayId: string,
): Promise<HolidayPublicRecord> {
  const normalizedOrganizationId =
    requireId(
      organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  requireId(
    actorId,
    "Actor ID",
    "ACTOR_ID_REQUIRED",
  );

  const normalizedHolidayId =
    requireId(
      holidayId,
      "Holiday ID",
      "HOLIDAY_ID_REQUIRED",
    );

  const holiday =
    await getHolidayInOrganization(
      normalizedOrganizationId,
      normalizedHolidayId,
    );

  return toPublicHoliday(
    holiday,
  );
}

/* -------------------------------------------------------------------------- */
/* Update                                                                     */
/* -------------------------------------------------------------------------- */

export async function updateHoliday(
  params: UpdateHolidayParams,
): Promise<HolidayPublicRecord> {
  const organizationId =
    requireId(
      params.organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  requireId(
    params.actorId,
    "Actor ID",
    "ACTOR_ID_REQUIRED",
  );

  const holidayId =
    requireId(
      params.holidayId,
      "Holiday ID",
      "HOLIDAY_ID_REQUIRED",
    );

  const existing =
    await getHolidayInOrganization(
      organizationId,
      holidayId,
    );

  const updateData:
    Record<string, unknown> = {};

  let nextName =
    existing.name;

  let nextDate =
    existing.date;

  let nextIsReligious =
    existing.isReligious;

  let nextReligion =
    existing.religion;

  if (
    params.name !== undefined
  ) {
    nextName =
      normalizeText(
        params.name,
        "Holiday name",
        MAX_NAME_LENGTH,
      );

    updateData.name =
      nextName;
  }

  if (
    params.date !== undefined
  ) {
    nextDate =
      normalizeDate(
        params.date,
      );

    updateData.date =
      nextDate;
  }

  if (
    params.description !==
    undefined
  ) {
    updateData.description =
      normalizeOptionalText(
        params.description,
        "Holiday description",
        MAX_DESCRIPTION_LENGTH,
      );
  }

  if (
    params.category !==
    undefined
  ) {
    updateData.category =
      normalizeCategory(
        params.category,
      );
  }

  if (
    params.countryCode !==
    undefined
  ) {
    updateData.countryCode =
      normalizeCountryCode(
        params.countryCode,
      );
  }

  if (
    params.regionCode !==
    undefined
  ) {
    updateData.regionCode =
      normalizeRegionCode(
        params.regionCode,
      );
  }

  if (
    params.isReligious !==
    undefined
  ) {
    nextIsReligious =
      params.isReligious;

    updateData.isReligious =
      nextIsReligious;
  }

  if (
    params.religion !==
    undefined
  ) {
    nextReligion =
      normalizeReligion(
        params.religion,
      );

    updateData.religion =
      nextReligion;
  }

  if (
    nextReligion &&
    !nextIsReligious
  ) {
    throw new AppError(
      400,
      "A religion can only be specified for a religious holiday.",
      "RELIGION_REQUIRES_RELIGIOUS_HOLIDAY",
    );
  }

  if (
    nextIsReligious &&
    !nextReligion
  ) {
    throw new AppError(
      400,
      "A religious holiday must specify a religion.",
      "RELIGION_REQUIRED",
    );
  }

  if (
    params.isRecurring !==
    undefined
  ) {
    updateData.isRecurring =
      params.isRecurring;
  }

  if (
    params.isActive !==
    undefined
  ) {
    updateData.isActive =
      params.isActive;
  }

  const duplicate =
    await db.orm.public.Holiday
      .where({
        organizationId,
        name: nextName,
        date: nextDate,
      })
      .first();

  if (
    duplicate &&
    duplicate.id !== existing.id
  ) {
    throw new AppError(
      409,
      "A holiday with the same name and date already exists in this organization.",
      "HOLIDAY_ALREADY_EXISTS",
    );
  }

  if (
    Object.keys(updateData)
      .length === 0
  ) {
    return toPublicHoliday(
      existing,
    );
  }

  updateData.updatedAt =
    new Date().toISOString();

  const updated =
    await db.orm.public.Holiday
      .where({
        id: existing.id,
      })
      .update(updateData);

  return toPublicHoliday(
    updated as DbHoliday,
  );
}

/* -------------------------------------------------------------------------- */
/* Activate                                                                   */
/* -------------------------------------------------------------------------- */

export async function activateHoliday(
  organizationId: string,
  actorId: string,
  holidayId: string,
): Promise<HolidayPublicRecord> {
  return updateHoliday({
    organizationId,
    actorId,
    holidayId,
    isActive: true,
  });
}

/* -------------------------------------------------------------------------- */
/* Deactivate                                                                 */
/* -------------------------------------------------------------------------- */

export async function deactivateHoliday(
  organizationId: string,
  actorId: string,
  holidayId: string,
): Promise<HolidayPublicRecord> {
  return updateHoliday({
    organizationId,
    actorId,
    holidayId,
    isActive: false,
  });
}

/* -------------------------------------------------------------------------- */
/* Delete                                                                     */
/* -------------------------------------------------------------------------- */

export async function deleteHoliday(
  organizationId: string,
  actorId: string,
  holidayId: string,
): Promise<void> {
  const normalizedOrganizationId =
    requireId(
      organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  requireId(
    actorId,
    "Actor ID",
    "ACTOR_ID_REQUIRED",
  );

  const normalizedHolidayId =
    requireId(
      holidayId,
      "Holiday ID",
      "HOLIDAY_ID_REQUIRED",
    );

  const existing =
    await getHolidayInOrganization(
      normalizedOrganizationId,
      normalizedHolidayId,
    );

  await db.orm.public.Holiday
    .where({
      id: existing.id,
    })
    .delete();
}

/* -------------------------------------------------------------------------- */
/* Summary                                                                    */
/* -------------------------------------------------------------------------- */

export async function getHolidaySummary(
  organizationId: string,
  actorId: string,
) {
  const normalizedOrganizationId =
    requireId(
      organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  requireId(
    actorId,
    "Actor ID",
    "ACTOR_ID_REQUIRED",
  );

  await ensureOrganization(
    normalizedOrganizationId,
  );

  const holidays =
    await db.orm.public.Holiday
      .where({
        organizationId:
          normalizedOrganizationId,
      })
      .all();

  const active =
    holidays.filter(
      (holiday) =>
        holiday.isActive,
    ).length;

  const inactive =
    holidays.length -
    active;

  const recurring =
    holidays.filter(
      (holiday) =>
        holiday.isRecurring,
    ).length;

  const religious =
    holidays.filter(
      (holiday) =>
        holiday.isReligious,
    ).length;

  const categories =
    new Set(
      holidays.map(
        (holiday) =>
          holiday.category,
      ),
    ).size;

  return {
    total: holidays.length,
    active,
    inactive,
    recurring,
    religious,
    categories,
  };
}