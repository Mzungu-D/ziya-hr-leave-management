import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleOff,
  Globe2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  activateHoliday,
  createHoliday,
  deactivateHoliday,
  deleteHoliday,
  getHolidaySummary,
  listHolidays,
  updateHoliday,
  type Holiday,
  type HolidaySummary,
} from "../../services/holiday.service";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const CATEGORIES = [
  "PUBLIC",
  "RELIGIOUS",
  "CULTURAL",
  "NATIONAL",
  "REGIONAL",
  "COMPANY",
  "OBSERVANCE",
] as const;

const RELIGIONS = [
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

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEK_DAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

type HolidayFormState = {
  name: string;
  date: string;
  description: string;
  category: string;
  countryCode: string;
  regionCode: string;
  isReligious: boolean;
  religion: string;
  isRecurring: boolean;
  isActive: boolean;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function createEmptyForm(
  date = "",
): HolidayFormState {
  return {
    name: "",
    date,
    description: "",
    category: "PUBLIC",
    countryCode: "",
    regionCode: "",
    isReligious: false,
    religion: "",
    isRecurring: false,
    isActive: true,
  };
}

function formatDate(
  value: string,
): string {
  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat(
    "en-KE",
    {
      dateStyle: "medium",
    },
  ).format(date);
}

function formatCategory(
  value: string,
): string {
  return value
    .toLowerCase()
    .replace(
      /_/g,
      " ",
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

function formatReligion(
  value: string | null,
): string {
  if (!value) {
    return "";
  }

  return value
    .toLowerCase()
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

function toDateInputValue(
  value: string,
): string {
  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "";
  }

  const year =
    date.getUTCFullYear();

  const month =
    String(
      date.getUTCMonth() + 1,
    ).padStart(2, "0");

  const day =
    String(
      date.getUTCDate(),
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getCalendarDays(
  year: number,
  month: number,
): Array<
  | {
      type: "empty";
      key: string;
    }
  | {
      type: "day";
      key: string;
      day: number;
      date: string;
    }
> {
  const firstDay =
    new Date(
      Date.UTC(
        year,
        month,
        1,
      ),
    ).getUTCDay();

  const daysInMonth =
    new Date(
      Date.UTC(
        year,
        month + 1,
        0,
      ),
    ).getUTCDate();

  const cells: Array<
    | {
        type: "empty";
        key: string;
      }
    | {
        type: "day";
        key: string;
        day: number;
        date: string;
      }
  > = [];

  for (
    let index = 0;
    index < firstDay;
    index += 1
  ) {
    cells.push({
      type: "empty",
      key: `empty-${index}`,
    });
  }

  for (
    let day = 1;
    day <= daysInMonth;
    day += 1
  ) {
    const date =
      `${year}-${String(
        month + 1,
      ).padStart(
        2,
        "0",
      )}-${String(day).padStart(
        2,
        "0",
      )}`;

    cells.push({
      type: "day",
      key: date,
      day,
      date,
    });
  }

  return cells;
}

function getHolidayDateKey(
  value: string,
): string {
  return toDateInputValue(
    value,
  );
}

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message;
  }

  return fallback;
}

/* -------------------------------------------------------------------------- */
/* Small components                                                           */
/* -------------------------------------------------------------------------- */

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: number;
  description: string;
  icon: typeof CalendarDays;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {value.toLocaleString()}
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
            {description}
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Icon
            size={20}
            strokeWidth={2}
          />
        </div>
      </div>
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="h-4 w-32 rounded bg-slate-200" />
      <div className="mt-4 h-10 w-full rounded bg-slate-100" />
      <div className="mt-3 h-10 w-3/4 rounded bg-slate-100" />
    </div>
  );
}

function StatusBadge({
  active,
}: {
  active: boolean;
}) {
  return active ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      <CheckCircle2
        size={13}
      />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
      <CircleOff
        size={13}
      />
      Inactive
    </span>
  );
}

function CategoryBadge({
  category,
}: {
  category: string;
}) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
      {formatCategory(
        category,
      )}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Form modal                                                                 */
/* -------------------------------------------------------------------------- */

function HolidayFormModal({
  holiday,
  initialDate,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  holiday: Holiday | null;
  initialDate: string;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (
    form: HolidayFormState,
  ) => Promise<void>;
}) {
  const [
    form,
    setForm,
  ] = useState<HolidayFormState>(
    () =>
      holiday
        ? {
            name: holiday.name,
            date: toDateInputValue(
              holiday.date,
            ),
            description:
              holiday.description ??
              "",
            category:
              holiday.category,
            countryCode:
              holiday.countryCode ??
              "",
            regionCode:
              holiday.regionCode ??
              "",
            isReligious:
              holiday.isReligious,
            religion:
              holiday.religion ??
              "",
            isRecurring:
              holiday.isRecurring,
            isActive:
              holiday.isActive,
          }
        : createEmptyForm(
            initialDate,
          ),
  );

  useEffect(() => {
    setForm(
      holiday
        ? {
            name: holiday.name,
            date: toDateInputValue(
              holiday.date,
            ),
            description:
              holiday.description ??
              "",
            category:
              holiday.category,
            countryCode:
              holiday.countryCode ??
              "",
            regionCode:
              holiday.regionCode ??
              "",
            isReligious:
              holiday.isReligious,
            religion:
              holiday.religion ??
              "",
            isRecurring:
              holiday.isRecurring,
            isActive:
              holiday.isActive,
          }
        : createEmptyForm(
            initialDate,
          ),
    );
  }, [
    holiday,
    initialDate,
  ]);

  const isEditing =
    holiday !== null;

  const handleChange = <
    K extends keyof HolidayFormState,
  >(
    key: K,
    value: HolidayFormState[K],
  ) => {
    setForm(
      (current) => ({
        ...current,
        [key]: value,
      }),
    );
  };

  const handleReligiousChange =
    (
      checked: boolean,
    ) => {
      setForm(
        (current) => ({
          ...current,
          isReligious:
            checked,
          religion:
            checked
              ? current.religion
              : "",
          category:
            checked
              ? "RELIGIOUS"
              : current.category ===
                  "RELIGIOUS"
                ? "PUBLIC"
                : current.category,
        }),
      );
    };

  const submit = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    await onSubmit(form);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="holiday-form-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div>
            <h2
              id="holiday-form-title"
              className="text-lg font-bold text-slate-900"
            >
              {isEditing
                ? "Edit Holiday"
                : "Add Holiday"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {isEditing
                ? "Update the holiday information."
                : "Add a holiday to your organization's calendar."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={submit}
          className="space-y-5 p-5 sm:p-6"
        >
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0"
              />

              <span>
                {error}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Holiday name
              </span>

              <input
                type="text"
                value={form.name}
                onChange={(event) =>
                  handleChange(
                    "name",
                    event.target.value,
                  )
                }
                maxLength={200}
                required
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#d8a415] focus:ring-2 focus:ring-[#d8a415]/20"
                placeholder="e.g. Christmas Day"
              />
            </label>

            <label>
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Date
              </span>

              <input
                type="date"
                value={form.date}
                onChange={(event) =>
                  handleChange(
                    "date",
                    event.target.value,
                  )
                }
                required
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#d8a415] focus:ring-2 focus:ring-[#d8a415]/20"
              />
            </label>

            <label>
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Category
              </span>

              <select
                value={form.category}
                onChange={(event) =>
                  handleChange(
                    "category",
                    event.target.value,
                  )
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#d8a415] focus:ring-2 focus:ring-[#d8a415]/20"
              >
                {CATEGORIES.map(
                  (category) => (
                    <option
                      key={category}
                      value={category}
                    >
                      {formatCategory(
                        category,
                      )}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Description
              </span>

              <textarea
                value={
                  form.description
                }
                onChange={(event) =>
                  handleChange(
                    "description",
                    event.target.value,
                  )
                }
                maxLength={2000}
                rows={3}
                className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#d8a415] focus:ring-2 focus:ring-[#d8a415]/20"
                placeholder="Optional description"
              />
            </label>

            <label>
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Country code
              </span>

              <input
                type="text"
                value={
                  form.countryCode
                }
                onChange={(event) =>
                  handleChange(
                    "countryCode",
                    event.target.value
                      .toUpperCase(),
                  )
                }
                maxLength={2}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm uppercase text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#d8a415] focus:ring-2 focus:ring-[#d8a415]/20"
                placeholder="KE"
              />
            </label>

            <label>
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Region code
              </span>

              <input
                type="text"
                value={
                  form.regionCode
                }
                onChange={(event) =>
                  handleChange(
                    "regionCode",
                    event.target.value
                      .toUpperCase(),
                  )
                }
                maxLength={20}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 uppercase text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#d8a415] focus:ring-2 focus:ring-[#d8a415]/20"
                placeholder="Optional"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <input
                id="holiday-religious"
                type="checkbox"
                checked={
                  form.isReligious
                }
                onChange={(event) =>
                  handleReligiousChange(
                    event.target.checked,
                  )
                }
                className="mt-1 h-4 w-4 rounded border-slate-300 text-[#d8a415] focus:ring-[#d8a415]"
              />

              <div className="min-w-0 flex-1">
                <label
                  htmlFor="holiday-religious"
                  className="cursor-pointer text-sm font-semibold text-slate-800"
                >
                  Religious holiday
                </label>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Mark this holiday as
                  religious and select
                  the relevant religion.
                </p>
              </div>
            </div>

            {form.isReligious && (
              <div className="mt-4">
                <label>
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Religion
                  </span>

                  <select
                    value={
                      form.religion
                    }
                    onChange={(event) =>
                      handleChange(
                        "religion",
                        event.target.value,
                      )
                    }
                    required
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#d8a415] focus:ring-2 focus:ring-[#d8a415]/20"
                  >
                    <option value="">
                      Select religion
                    </option>

                    {RELIGIONS.map(
                      (religion) => (
                        <option
                          key={religion}
                          value={religion}
                        >
                          {formatReligion(
                            religion,
                          )}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <input
                type="checkbox"
                checked={
                  form.isRecurring
                }
                onChange={(event) =>
                  handleChange(
                    "isRecurring",
                    event.target.checked,
                  )
                }
                className="mt-1 h-4 w-4 rounded border-slate-300 text-[#d8a415] focus:ring-[#d8a415]"
              />

              <span>
                <span className="block text-sm font-semibold text-slate-800">
                  Recurring holiday
                </span>

                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  Indicates that the holiday
                  repeats.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <input
                type="checkbox"
                checked={
                  form.isActive
                }
                onChange={(event) =>
                  handleChange(
                    "isActive",
                    event.target.checked,
                  )
                }
                className="mt-1 h-4 w-4 rounded border-slate-300 text-[#d8a415] focus:ring-[#d8a415]"
              />

              <span>
                <span className="block text-sm font-semibold text-slate-800">
                  Active
                </span>

                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  Active holidays are included
                  in calendar operations.
                </span>
              </span>
            </label>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#d8a415] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c4970f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && (
                <RefreshCw
                  size={16}
                  className="animate-spin"
                />
              )}

              {saving
                ? "Saving..."
                : isEditing
                  ? "Save Changes"
                  : "Add Holiday"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Delete modal                                                               */
/* -------------------------------------------------------------------------- */

function DeleteHolidayModal({
  holiday,
  deleting,
  error,
  onClose,
  onConfirm,
}: {
  holiday: Holiday;
  deleting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-holiday-title"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
          <Trash2 size={20} />
        </div>

        <h2
          id="delete-holiday-title"
          className="mt-4 text-lg font-bold text-slate-900"
        >
          Delete holiday?
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          You are about to permanently
          delete{" "}
          <span className="font-semibold text-slate-700">
            {holiday.name}
          </span>
          . This action cannot be
          undone.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() =>
              void onConfirm()
            }
            disabled={deleting}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting && (
              <RefreshCw
                size={16}
                className="animate-spin"
              />
            )}

            {deleting
              ? "Deleting..."
              : "Delete Holiday"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main page                                                                  */
/* -------------------------------------------------------------------------- */

export function HolidaysCalendar() {
  const currentDate =
    new Date();

  const [
    calendarYear,
    setCalendarYear,
  ] = useState(
    currentDate.getFullYear(),
  );

  const [
    calendarMonth,
    setCalendarMonth,
  ] = useState(
    currentDate.getMonth(),
  );

  const [
    holidays,
    setHolidays,
  ] = useState<
    Holiday[]
  >([]);

  const [
    summary,
    setSummary,
  ] = useState<
    HolidaySummary | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState("");

  const [
    activeFilter,
    setActiveFilter,
  ] = useState<
    "" | "true" | "false"
  >("true");

  const [
    selectedHoliday,
    setSelectedHoliday,
  ] = useState<
    Holiday | null
  >(null);

  const [
    formOpen,
    setFormOpen,
  ] = useState(false);

  const [
    deleteTarget,
    setDeleteTarget,
  ] = useState<
    Holiday | null
  >(null);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  const [
    actionError,
    setActionError,
  ] = useState<
    string | null
  >(null);

  const loadData =
    useCallback(
      async (
        isRefresh = false,
      ) => {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(null);

        try {
          const [
            holidayResult,
            summaryResult,
          ] =
            await Promise.all([
              listHolidays({
                year:
                  calendarYear,
                search:
                  search.trim() ||
                  undefined,
                category:
                  categoryFilter ||
                  undefined,
                isActive:
                  activeFilter ===
                  ""
                    ? undefined
                    : activeFilter ===
                        "true",
              }),

              getHolidaySummary(),
            ]);

          setHolidays(
            holidayResult,
          );

          setSummary(
            summaryResult,
          );
        } catch (err) {
          setError(
            getErrorMessage(
              err,
              "Unable to load holidays.",
            ),
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        calendarYear,
        search,
        categoryFilter,
        activeFilter,
      ],
    );

  useEffect(() => {
    const controller =
      new AbortController();

    void loadData();

    return () => {
      controller.abort();
    };
  }, [loadData]);

  const calendarDays =
    useMemo(
      () =>
        getCalendarDays(
          calendarYear,
          calendarMonth,
        ),
      [
        calendarYear,
        calendarMonth,
      ],
    );

  const holidaysByDate =
    useMemo(() => {
      const map =
        new Map<
          string,
          Holiday[]
        >();

      for (
        const holiday of holidays
      ) {
        const key =
          getHolidayDateKey(
            holiday.date,
          );

        const existing =
          map.get(key) ?? [];

        existing.push(
          holiday,
        );

        map.set(
          key,
          existing,
        );
      }

      return map;
    }, [holidays]);

  const filteredHolidays =
    useMemo(
      () =>
        [...holidays].sort(
          (a, b) =>
            new Date(
              a.date,
            ).getTime() -
            new Date(
              b.date,
            ).getTime(),
        ),
      [holidays],
    );

  const previousMonth =
    () => {
      if (
        calendarMonth === 0
      ) {
        setCalendarMonth(11);
        setCalendarYear(
          (year) =>
            year - 1,
        );
      } else {
        setCalendarMonth(
          (month) =>
            month - 1,
        );
      }
    };

  const nextMonth =
    () => {
      if (
        calendarMonth === 11
      ) {
        setCalendarMonth(0);
        setCalendarYear(
          (year) =>
            year + 1,
        );
      } else {
        setCalendarMonth(
          (month) =>
            month + 1,
        );
      }
    };

  const goToToday =
    () => {
      setCalendarYear(
        currentDate.getFullYear(),
      );

      setCalendarMonth(
        currentDate.getMonth(),
      );
    };

  const openCreate =
    (date = "") => {
      setActionError(null);
      setSelectedHoliday(null);
      setFormOpen(true);

      if (date) {
        setTimeout(() => {
          const input =
            document.querySelector<HTMLInputElement>(
              'input[type="date"]',
            );

          input?.focus();
        }, 0);
      }
    };

  const openEdit = (
    holiday: Holiday,
  ) => {
    setActionError(null);
    setSelectedHoliday(
      holiday,
    );
    setFormOpen(true);
  };

  const closeForm =
    () => {
      if (saving) {
        return;
      }

      setFormOpen(false);
      setSelectedHoliday(
        null,
      );
      setActionError(null);
    };

  const handleSubmit =
    async (
      form: HolidayFormState,
    ) => {
      setSaving(true);
      setActionError(null);

      try {
        const payload = {
          name: form.name.trim(),
          date: form.date,
          description:
            form.description.trim() ||
            null,
          category:
            form.category
              .trim()
              .toUpperCase(),
          countryCode:
            form.countryCode.trim() ||
            null,
          regionCode:
            form.regionCode.trim() ||
            null,
          isReligious:
            form.isReligious,
          religion:
            form.isReligious
              ? form.religion
                  .trim()
                  .toUpperCase() ||
                null
              : null,
          isRecurring:
            form.isRecurring,
          isActive:
            form.isActive,
        };

        if (
          selectedHoliday
        ) {
          await updateHoliday(
            selectedHoliday.id,
            payload,
          );
        } else {
          await createHoliday(
            payload,
          );
        }

        setFormOpen(false);
        setSelectedHoliday(
          null,
        );

        await loadData(
          true,
        );
      } catch (err) {
        setActionError(
          getErrorMessage(
            err,
            "Unable to save the holiday.",
          ),
        );
      } finally {
        setSaving(false);
      }
    };

  const handleToggle =
    async (
      holiday: Holiday,
    ) => {
      setActionError(null);

      try {
        if (
          holiday.isActive
        ) {
          await deactivateHoliday(
            holiday.id,
          );
        } else {
          await activateHoliday(
            holiday.id,
          );
        }

        await loadData(
          true,
        );
      } catch (err) {
        setActionError(
          getErrorMessage(
            err,
            "Unable to update the holiday status.",
          ),
        );
      }
    };

  const handleDelete =
    async () => {
      if (
        !deleteTarget
      ) {
        return;
      }

      setDeleting(true);
      setActionError(null);

      try {
        await deleteHoliday(
          deleteTarget.id,
        );

        setDeleteTarget(
          null,
        );

        await loadData(
          true,
        );
      } catch (err) {
        setActionError(
          getErrorMessage(
            err,
            "Unable to delete the holiday.",
          ),
        );
      } finally {
        setDeleting(false);
      }
    };

  return (
    <main className="w-full min-w-0 overflow-x-hidden">
      <div className="mx-auto w-full min-w-0 max-w-[1920px] space-y-5 sm:space-y-6">
        {/* Header */}
        <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">
                  Holidays &amp;
                  Calendar
                </h1>

                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  <Globe2
                    size={13}
                  />
                  Organization
                  Calendar
                </span>
              </div>

              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                Manage public, national,
                regional, company, cultural,
                observance and religious
                holidays for your organization.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() =>
                  void loadData(
                    true,
                  )
                }
                disabled={
                  loading ||
                  refreshing
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  size={17}
                  className={
                    refreshing
                      ? "animate-spin"
                      : ""
                  }
                />

                {refreshing
                  ? "Refreshing..."
                  : "Refresh"}
              </button>

              <button
                type="button"
                onClick={() =>
                  openCreate()
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#d8a415] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c4970f]"
              >
                <Plus
                  size={18}
                />
                Add Holiday
              </button>
            </div>
          </div>
        </header>

        {/* Error */}
        {error && (
          <section
            role="alert"
            className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                size={20}
                className="mt-0.5 shrink-0"
              />

              <div>
                <p className="font-semibold">
                  Unable to load holidays
                </p>

                <p className="mt-1 text-sm">
                  {error}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadData(
                  true,
                )
              }
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100"
            >
              <RefreshCw
                size={16}
              />
              Retry
            </button>
          </section>
        )}

        {/* Action error */}
        {actionError && (
          <section
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
          >
            <AlertCircle
              size={19}
              className="mt-0.5 shrink-0"
            />

            <span>
              {actionError}
            </span>

            <button
              type="button"
              onClick={() =>
                setActionError(
                  null,
                )
              }
              className="ml-auto shrink-0 text-amber-700 hover:text-amber-900"
              aria-label="Dismiss"
            >
              <X size={17} />
            </button>
          </section>
        )}

        {/* Summary */}
        {loading &&
        !summary ? (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <LoadingBlock />
            <LoadingBlock />
            <LoadingBlock />
            <LoadingBlock />
          </section>
        ) : (
          <section className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total Holidays"
              value={
                summary?.total ??
                0
              }
              description="Configured holidays"
              icon={
                CalendarDays
              }
            />

            <StatCard
              title="Active"
              value={
                summary?.active ??
                0
              }
              description="Currently active"
              icon={
                CheckCircle2
              }
            />

            <StatCard
              title="Religious"
              value={
                summary?.religious ??
                0
              }
              description="Religious observances"
              icon={
                Sparkles
              }
            />

            <StatCard
              title="Recurring"
              value={
                summary?.recurring ??
                0
              }
              description="Recurring holidays"
              icon={
                ShieldCheck
              }
            />
          </section>
        )}

        {/* Calendar */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {MONTH_NAMES[
                  calendarMonth
                ]}{" "}
                {calendarYear}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                View holidays by date.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={
                  previousMonth
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                aria-label="Previous month"
              >
                <ChevronLeft
                  size={18}
                />
              </button>

              <button
                type="button"
                onClick={
                  goToToday
                }
                className="min-h-10 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Today
              </button>

              <button
                type="button"
                onClick={
                  nextMonth
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                aria-label="Next month"
              >
                <ChevronRight
                  size={18}
                />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                {WEEK_DAYS.map(
                  (day) => (
                    <div
                      key={day}
                      className="px-2 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500"
                    >
                      {day}
                    </div>
                  ),
                )}
              </div>

              <div className="grid grid-cols-7">
                {calendarDays.map(
                  (cell) => {
                    if (
                      cell.type ===
                      "empty"
                    ) {
                      return (
                        <div
                          key={
                            cell.key
                          }
                          className="min-h-[120px] border-b border-r border-slate-100 bg-slate-50/50"
                        />
                      );
                    }

                    const dayHolidays =
                      holidaysByDate.get(
                        cell.date,
                      ) ?? [];

                    const today =
                      toDateInputValue(
                        new Date().toISOString(),
                      ) ===
                      cell.date;

                    return (
                      <div
                        key={
                          cell.key
                        }
                        className={[
                          "group min-h-[120px] border-b border-r border-slate-100 p-2 transition hover:bg-slate-50",
                          today
                            ? "bg-amber-50/40"
                            : "",
                        ].join(
                          " ",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={[
                              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                              today
                                ? "bg-[#d8a415] text-white"
                                : "text-slate-600",
                            ].join(
                              " ",
                            )}
                          >
                            {
                              cell.day
                            }
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              openCreate(
                                cell.date,
                              )
                            }
                            className="hidden h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 group-hover:flex"
                            aria-label={`Add holiday on ${cell.date}`}
                          >
                            <Plus
                              size={15}
                            />
                          </button>
                        </div>

                        <div className="mt-2 space-y-1.5">
                          {dayHolidays
                            .slice(
                              0,
                              3,
                            )
                            .map(
                              (
                                holiday,
                              ) => (
                                <button
                                  type="button"
                                  key={
                                    holiday.id
                                  }
                                  onClick={() =>
                                    openEdit(
                                      holiday,
                                    )
                                  }
                                  className="block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left shadow-sm transition hover:border-[#d8a415] hover:shadow"
                                >
                                  <p className="truncate text-[11px] font-semibold text-slate-800">
                                    {
                                      holiday.name
                                    }
                                  </p>

                                  <div className="mt-1 flex items-center gap-1">
                                    <span className="truncate text-[9px] font-medium text-slate-400">
                                      {formatCategory(
                                        holiday.category,
                                      )}
                                    </span>

                                    {!holiday.isActive && (
                                      <span className="text-[9px] text-slate-400">
                                        •
                                        inactive
                                      </span>
                                    )}
                                  </div>
                                </button>
                              ),
                            )}

                          {dayHolidays.length >
                            3 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSearch(
                                  cell.date,
                                );
                              }}
                              className="text-[10px] font-semibold text-[#b88900] hover:underline"
                            >
                              +
                              {dayHolidays.length -
                                3}{" "}
                              more
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Filters + list */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Holiday Directory
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Search and manage configured holidays.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="relative">
                  <span className="sr-only">
                    Search holidays
                  </span>

                  <Search
                    size={17}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="search"
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value,
                      )
                    }
                    placeholder="Search holidays"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#d8a415] focus:ring-2 focus:ring-[#d8a415]/20"
                  />
                </label>

                <label>
                  <span className="sr-only">
                    Filter by category
                  </span>

                  <select
                    value={
                      categoryFilter
                    }
                    onChange={(event) =>
                      setCategoryFilter(
                        event.target.value,
                      )
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#d8a415] focus:ring-2 focus:ring-[#d8a415]/20"
                  >
                    <option value="">
                      All categories
                    </option>

                    {CATEGORIES.map(
                      (category) => (
                        <option
                          key={category}
                          value={category}
                        >
                          {formatCategory(
                            category,
                          )}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  <span className="sr-only">
                    Filter by status
                  </span>

                  <select
                    value={
                      activeFilter
                    }
                    onChange={(event) =>
                      setActiveFilter(
                        event.target
                          .value as
                          | ""
                          | "true"
                          | "false",
                      )
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#d8a415] focus:ring-2 focus:ring-[#d8a415]/20"
                  >
                    <option value="true">
                      Active holidays
                    </option>

                    <option value="">
                      All statuses
                    </option>

                    <option value="false">
                      Inactive holidays
                    </option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 p-4 sm:p-5">
              <LoadingBlock />
              <LoadingBlock />
            </div>
          ) : filteredHolidays.length ===
            0 ? (
            <div className="px-5 py-14 text-center sm:px-6">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <CalendarDays
                  size={25}
                />
              </div>

              <h3 className="mt-4 text-base font-bold text-slate-900">
                No holidays found
              </h3>

              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
                No holidays match the
                current filters for{" "}
                {calendarYear}.
              </p>

              <button
                type="button"
                onClick={() =>
                  openCreate()
                }
                className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#d8a415] px-4 text-sm font-semibold text-white transition hover:bg-[#c4970f]"
              >
                <Plus
                  size={16}
                />
                Add Holiday
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredHolidays.map(
                (holiday) => (
                  <div
                    key={
                      holiday.id
                    }
                    className="flex flex-col gap-4 p-4 transition hover:bg-slate-50/70 sm:p-5 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        openEdit(
                          holiday,
                        )
                      }
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-bold text-slate-900">
                          {
                            holiday.name
                          }
                        </h3>

                        <StatusBadge
                          active={
                            holiday.isActive
                          }
                        />

                        <CategoryBadge
                          category={
                            holiday.category
                          }
                        />

                        {holiday.isReligious && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">
                            <Sparkles
                              size={
                                12
                              }
                            />
                            {formatReligion(
                              holiday.religion,
                            )}
                          </span>
                        )}

                        {holiday.isRecurring && (
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            Recurring
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>
                          {formatDate(
                            holiday.date,
                          )}
                        </span>

                        {holiday.countryCode && (
                          <span>
                            Country:{" "}
                            {
                              holiday.countryCode
                            }
                          </span>
                        )}

                        {holiday.regionCode && (
                          <span>
                            Region:{" "}
                            {
                              holiday.regionCode
                            }
                          </span>
                        )}
                      </div>

                      {holiday.description && (
                        <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-500">
                          {
                            holiday.description
                          }
                        </p>
                      )}
                    </button>

                    <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          void handleToggle(
                            holiday,
                          )
                        }
                        className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        {holiday.isActive
                          ? "Deactivate"
                          : "Activate"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openEdit(
                            holiday,
                          )
                        }
                        className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget(
                            holiday,
                          )
                        }
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100"
                        aria-label={`Delete ${holiday.name}`}
                      >
                        <Trash2
                          size={16}
                        />
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </section>
      </div>

      {/* Create / edit modal */}
      {formOpen && (
        <HolidayFormModal
          holiday={
            selectedHoliday
          }
          initialDate=""
          saving={saving}
          error={
            actionError
          }
          onClose={
            closeForm
          }
          onSubmit={
            handleSubmit
          }
        />
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <DeleteHolidayModal
          holiday={
            deleteTarget
          }
          deleting={
            deleting
          }
          error={
            actionError
          }
          onClose={() =>
            setDeleteTarget(
              null,
            )
          }
          onConfirm={
            handleDelete
          }
        />
      )}
    </main>
  );
}

export default HolidaysCalendar;