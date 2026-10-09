/**
 * Production Holiday API service.
 *
 * Tenant scope is resolved by the authenticated backend session.
 * The frontend never supplies organizationId.
 */

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  "https://ziya-hr-api-production.up.railway.app"
).replace(/\/+$/, "");

const HOLIDAY_ENDPOINT =
  `${API_BASE_URL}/api/holidays`;

const REQUEST_TIMEOUT_MS = 30_000;

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type HolidayCategory =
  | "PUBLIC"
  | "RELIGIOUS"
  | "CULTURAL"
  | "NATIONAL"
  | "REGIONAL"
  | "COMPANY"
  | "OBSERVANCE";

export type HolidayReligion =
  | "CHRISTIAN"
  | "ISLAM"
  | "JUDAISM"
  | "HINDU"
  | "SIKH"
  | "BUDDHIST"
  | "BAHAI"
  | "JAIN"
  | "TAOIST"
  | "OTHER";

export interface Holiday {
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

export interface HolidaySummary {
  total: number;
  active: number;
  inactive: number;
  recurring: number;
  religious: number;
  categories: number;
}

export interface HolidayListOptions {
  search?: string;
  year?: number;
  category?: string;
  countryCode?: string;
  regionCode?: string;
  religion?: string;
  isReligious?: boolean;
  isRecurring?: boolean;
  isActive?: boolean;
  signal?: AbortSignal;
}

export interface CreateHolidayPayload {
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

export interface UpdateHolidayPayload {
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
/* Error                                                                      */
/* -------------------------------------------------------------------------- */

export class HolidayServiceError
  extends Error
{
  readonly status: number;
  readonly code?: string;

  constructor(
    message: string,
    status: number,
    code?: string,
  ) {
    super(message);

    this.name =
      "HolidayServiceError";

    this.status = status;
    this.code = code;
  }
}

/* -------------------------------------------------------------------------- */
/* CSRF                                                                       */
/* -------------------------------------------------------------------------- */

function getCookieValue(
  name: string,
): string | null {
  if (
    typeof document ===
    "undefined"
  ) {
    return null;
  }

  const cookies =
    document.cookie
      .split(";")
      .map(
        (cookie) =>
          cookie.trim(),
      );

  const prefix =
    `${name}=`;

  const match =
    cookies.find(
      (cookie) =>
        cookie.startsWith(
          prefix,
        ),
    );

  if (!match) {
    return null;
  }

  return decodeURIComponent(
    match.slice(
      prefix.length,
    ),
  );
}

function getCsrfToken(): string | null {
  const possibleNames = [
    "csrf-token",
    "csrfToken",
    "XSRF-TOKEN",
  ];

  for (
    const name of possibleNames
  ) {
    const token =
      getCookieValue(name);

    if (token) {
      return token;
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Timeout                                                                    */
/* -------------------------------------------------------------------------- */

function createTimeoutSignal(
  externalSignal?: AbortSignal,
): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller =
    new AbortController();

  const timeout =
    window.setTimeout(
      () => {
        controller.abort();
      },
      REQUEST_TIMEOUT_MS,
    );

  const abortFromExternal =
    () => {
      controller.abort();
    };

  if (externalSignal) {
    if (
      externalSignal.aborted
    ) {
      controller.abort();
    } else {
      externalSignal.addEventListener(
        "abort",
        abortFromExternal,
        {
          once: true,
        },
      );
    }
  }

  return {
    signal:
      controller.signal,

    cleanup: () => {
      window.clearTimeout(
        timeout,
      );

      externalSignal?.removeEventListener(
        "abort",
        abortFromExternal,
      );
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Response handling                                                          */
/* -------------------------------------------------------------------------- */

async function readResponseBody(
  response: Response,
): Promise<unknown> {
  if (
    response.status === 204 ||
    response.status === 205
  ) {
    return null;
  }

  const contentType =
    response.headers.get(
      "content-type",
    ) ?? "";

  if (
    !contentType
      .toLowerCase()
      .includes(
        "application/json",
      )
  ) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractError(
  body: unknown,
  fallback: string,
): {
  message: string;
  code?: string;
} {
  if (
    body &&
    typeof body ===
      "object"
  ) {
    const record =
      body as Record<
        string,
        unknown
      >;

    const nested =
      record.error &&
      typeof record.error ===
        "object"
        ? (
            record.error as Record<
              string,
              unknown
            >
          )
        : null;

    const messageCandidates = [
      record.message,
      nested?.message,
      record.error,
    ];

    const codeCandidates = [
      record.code,
      nested?.code,
    ];

    const message =
      messageCandidates.find(
        (
          value,
        ): value is string =>
          typeof value ===
            "string" &&
          value.trim()
            .length > 0,
      ) ?? fallback;

    const code =
      codeCandidates.find(
        (
          value,
        ): value is string =>
          typeof value ===
            "string" &&
          value.trim()
            .length > 0,
      );

    return {
      message,
      code,
    };
  }

  return {
    message: fallback,
  };
}

/* -------------------------------------------------------------------------- */
/* Response validation                                                        */
/* -------------------------------------------------------------------------- */

function assertHoliday(
  value: unknown,
): Holiday {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    throw new HolidayServiceError(
      "Invalid holiday response from the server.",
      502,
      "INVALID_HOLIDAY_RESPONSE",
    );
  }

  const holiday =
    value as Partial<Holiday>;

  if (
    typeof holiday.id !==
      "string" ||
    typeof holiday.organizationId !==
      "string" ||
    typeof holiday.name !==
      "string" ||
    typeof holiday.date !==
      "string" ||
    typeof holiday.category !==
      "string" ||
    typeof holiday.isReligious !==
      "boolean" ||
    typeof holiday.isRecurring !==
      "boolean" ||
    typeof holiday.isActive !==
      "boolean"
  ) {
    throw new HolidayServiceError(
      "The server returned an invalid holiday.",
      502,
      "INVALID_HOLIDAY_RESPONSE",
    );
  }

  return holiday as Holiday;
}

function assertHolidayList(
  value: unknown,
): Holiday[] {
  if (
    !Array.isArray(value)
  ) {
    throw new HolidayServiceError(
      "Invalid holiday list response from the server.",
      502,
      "INVALID_HOLIDAY_LIST_RESPONSE",
    );
  }

  return value.map(
    assertHoliday,
  );
}

function assertHolidaySummary(
  value: unknown,
): HolidaySummary {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    throw new HolidayServiceError(
      "Invalid holiday summary response from the server.",
      502,
      "INVALID_HOLIDAY_SUMMARY_RESPONSE",
    );
  }

  const summary =
    value as Partial<HolidaySummary>;

  if (
    typeof summary.total !==
      "number" ||
    typeof summary.active !==
      "number" ||
    typeof summary.inactive !==
      "number" ||
    typeof summary.recurring !==
      "number" ||
    typeof summary.religious !==
      "number" ||
    typeof summary.categories !==
      "number"
  ) {
    throw new HolidayServiceError(
      "The server returned an invalid holiday summary.",
      502,
      "INVALID_HOLIDAY_SUMMARY_RESPONSE",
    );
  }

  return {
    total:
      summary.total,
    active:
      summary.active,
    inactive:
      summary.inactive,
    recurring:
      summary.recurring,
    religious:
      summary.religious,
    categories:
      summary.categories,
  };
}

/* -------------------------------------------------------------------------- */
/* Generic request                                                            */
/* -------------------------------------------------------------------------- */

async function request<T>(
  path: string,
  options: {
    method?:
      | "GET"
      | "POST"
      | "PATCH"
      | "DELETE";

    body?: unknown;

    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const method =
    options.method ??
    "GET";

  const {
    signal,
    cleanup,
  } =
    createTimeoutSignal(
      options.signal,
    );

  const headers: HeadersInit = {
    Accept:
      "application/json",
  };

  if (
    options.body !==
    undefined
  ) {
    headers[
      "Content-Type"
    ] = "application/json";
  }

  if (method !== "GET") {
    const csrfToken =
      getCsrfToken();

    if (csrfToken) {
      headers[
        "X-CSRF-Token"
      ] = csrfToken;
    }
  }

  try {
    const response =
      await fetch(
        path,
        {
          method,

          headers,

          credentials:
            "include",

          cache:
            "no-store",

          redirect:
            "error",

          referrerPolicy:
            "strict-origin-when-cross-origin",

          body:
            options.body ===
            undefined
              ? undefined
              : JSON.stringify(
                  options.body,
                ),

          signal,
        },
      );

    const body =
      await readResponseBody(
        response,
      );

    if (!response.ok) {
      const error =
        extractError(
          body,
          `Holiday request failed with status ${response.status}.`,
        );

      throw new HolidayServiceError(
        error.message,
        response.status,
        error.code,
      );
    }

    return body as T;
  } catch (error) {
    if (
      error instanceof
      HolidayServiceError
    ) {
      throw error;
    }

    if (
      error instanceof
        DOMException &&
      error.name ===
        "AbortError"
    ) {
      throw error;
    }

    if (
      error instanceof
      TypeError
    ) {
      throw new HolidayServiceError(
        "Unable to connect to the holiday service.",
        0,
        "NETWORK_ERROR",
      );
    }

    throw error;
  } finally {
    cleanup();
  }
}

/* -------------------------------------------------------------------------- */
/* Query builder                                                              */
/* -------------------------------------------------------------------------- */

function buildQuery(
  options: HolidayListOptions,
): string {
  const params =
    new URLSearchParams();

  if (
    options.search &&
    options.search.trim()
  ) {
    params.set(
      "search",
      options.search.trim(),
    );
  }

  if (
    options.year !==
    undefined
  ) {
    params.set(
      "year",
      String(options.year),
    );
  }

  if (
    options.category &&
    options.category.trim()
  ) {
    params.set(
      "category",
      options.category
        .trim()
        .toUpperCase(),
    );
  }

  if (
    options.countryCode &&
    options.countryCode.trim()
  ) {
    params.set(
      "countryCode",
      options.countryCode
        .trim()
        .toUpperCase(),
    );
  }

  if (
    options.regionCode &&
    options.regionCode.trim()
  ) {
    params.set(
      "regionCode",
      options.regionCode
        .trim()
        .toUpperCase(),
    );
  }

  if (
    options.religion &&
    options.religion.trim()
  ) {
    params.set(
      "religion",
      options.religion
        .trim()
        .toUpperCase(),
    );
  }

  if (
    options.isReligious !==
    undefined
  ) {
    params.set(
      "isReligious",
      String(
        options.isReligious,
      ),
    );
  }

  if (
    options.isRecurring !==
    undefined
  ) {
    params.set(
      "isRecurring",
      String(
        options.isRecurring,
      ),
    );
  }

  if (
    options.isActive !==
    undefined
  ) {
    params.set(
      "isActive",
      String(
        options.isActive,
      ),
    );
  }

  const query =
    params.toString();

  return query
    ? `?${query}`
    : "";
}

/* -------------------------------------------------------------------------- */
/* List holidays                                                              */
/* -------------------------------------------------------------------------- */

export async function listHolidays(
  options: HolidayListOptions = {},
): Promise<Holiday[]> {
  const query =
    buildQuery(options);

  const data =
    await request<unknown>(
      `${HOLIDAY_ENDPOINT}${query}`,
      {
        method: "GET",
        signal:
          options.signal,
      },
    );

  return assertHolidayList(
    data,
  );
}

/* -------------------------------------------------------------------------- */
/* Get holiday                                                                */
/* -------------------------------------------------------------------------- */

export async function getHoliday(
  holidayId: string,
  options: {
    signal?: AbortSignal;
  } = {},
): Promise<Holiday> {
  if (
    !holidayId.trim()
  ) {
    throw new HolidayServiceError(
      "Holiday ID is required.",
      400,
      "HOLIDAY_ID_REQUIRED",
    );
  }

  const data =
    await request<unknown>(
      `${HOLIDAY_ENDPOINT}/${encodeURIComponent(
        holidayId,
      )}`,
      {
        method: "GET",
        signal:
          options.signal,
      },
    );

  return assertHoliday(
    data,
  );
}

/* -------------------------------------------------------------------------- */
/* Get holiday summary                                                        */
/* -------------------------------------------------------------------------- */

export async function getHolidaySummary(
  options: {
    signal?: AbortSignal;
  } = {},
): Promise<HolidaySummary> {
  const data =
    await request<unknown>(
      `${HOLIDAY_ENDPOINT}/summary`,
      {
        method: "GET",
        signal:
          options.signal,
      },
    );

  return assertHolidaySummary(
    data,
  );
}

/* -------------------------------------------------------------------------- */
/* Create holiday                                                             */
/* -------------------------------------------------------------------------- */

export async function createHoliday(
  payload: CreateHolidayPayload,
): Promise<Holiday> {
  const data =
    await request<unknown>(
      HOLIDAY_ENDPOINT,
      {
        method: "POST",
        body: payload,
      },
    );

  return assertHoliday(
    data,
  );
}

/* -------------------------------------------------------------------------- */
/* Update holiday                                                             */
/* -------------------------------------------------------------------------- */

export async function updateHoliday(
  holidayId: string,
  payload: UpdateHolidayPayload,
): Promise<Holiday> {
  if (
    !holidayId.trim()
  ) {
    throw new HolidayServiceError(
      "Holiday ID is required.",
      400,
      "HOLIDAY_ID_REQUIRED",
    );
  }

  const data =
    await request<unknown>(
      `${HOLIDAY_ENDPOINT}/${encodeURIComponent(
        holidayId,
      )}`,
      {
        method: "PATCH",
        body: payload,
      },
    );

  return assertHoliday(
    data,
  );
}

/* -------------------------------------------------------------------------- */
/* Activate holiday                                                           */
/* -------------------------------------------------------------------------- */

export async function activateHoliday(
  holidayId: string,
): Promise<Holiday> {
  if (
    !holidayId.trim()
  ) {
    throw new HolidayServiceError(
      "Holiday ID is required.",
      400,
      "HOLIDAY_ID_REQUIRED",
    );
  }

  const data =
    await request<unknown>(
      `${HOLIDAY_ENDPOINT}/${encodeURIComponent(
        holidayId,
      )}/activate`,
      {
        method: "POST",
      },
    );

  return assertHoliday(
    data,
  );
}

/* -------------------------------------------------------------------------- */
/* Deactivate holiday                                                         */
/* -------------------------------------------------------------------------- */

export async function deactivateHoliday(
  holidayId: string,
): Promise<Holiday> {
  if (
    !holidayId.trim()
  ) {
    throw new HolidayServiceError(
      "Holiday ID is required.",
      400,
      "HOLIDAY_ID_REQUIRED",
    );
  }

  const data =
    await request<unknown>(
      `${HOLIDAY_ENDPOINT}/${encodeURIComponent(
        holidayId,
      )}/deactivate`,
      {
        method: "POST",
      },
    );

  return assertHoliday(
    data,
  );
}

/* -------------------------------------------------------------------------- */
/* Delete holiday                                                             */
/* -------------------------------------------------------------------------- */

export async function deleteHoliday(
  holidayId: string,
): Promise<void> {
  if (
    !holidayId.trim()
  ) {
    throw new HolidayServiceError(
      "Holiday ID is required.",
      400,
      "HOLIDAY_ID_REQUIRED",
    );
  }

  await request<unknown>(
    `${HOLIDAY_ENDPOINT}/${encodeURIComponent(
      holidayId,
    )}`,
    {
      method: "DELETE",
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Default export                                                             */
/* -------------------------------------------------------------------------- */

const holidayService = {
  listHolidays,
  getHoliday,
  getHolidaySummary,
  createHoliday,
  updateHoliday,
  activateHoliday,
  deactivateHoliday,
  deleteHoliday,
};

export default holidayService;