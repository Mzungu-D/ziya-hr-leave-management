import {
  Archive,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Edit3,
  FileCheck2,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  X,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  activateLeaveType,
  createLeaveType,
  deactivateLeaveType,
  listLeaveTypes,
  updateLeaveType,
} from "../../services/leave-type.service";

import type {
  CreateLeaveTypePayload,
  LeaveType,
  LeaveTypeServiceError,
  UpdateLeaveTypePayload,
} from "../../services/leave-type.service";

type StatusFilter = "all" | "active" | "inactive";

type FormMode = "create" | "edit" | null;

type StatusAction = "activate" | "deactivate" | null;

interface LeaveTypeForm {
  name: string;
  code: string;
  daysPerYear: string;
  requiresDocument: boolean;
}

interface FormErrors {
  name?: string;
  code?: string;
  daysPerYear?: string;
}

const EMPTY_FORM: LeaveTypeForm = {
  name: "",
  code: "",
  daysPerYear: "",
  requiresDocument: false,
};

const MAX_NAME_LENGTH = 120;
const MAX_CODE_LENGTH = 50;
const MAX_DAYS_PER_YEAR = 2_147_483_647;

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    const candidate =
      error as LeaveTypeServiceError;

    if (
      typeof candidate.message === "string" &&
      candidate.message.trim()
    ) {
      return candidate.message;
    }
  }

  return fallback;
}

function getErrorCode(
  error: unknown,
): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error
  ) {
    const candidate =
      error as LeaveTypeServiceError;

    return typeof candidate.code === "string"
      ? candidate.code
      : undefined;
  }

  return undefined;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(date);
}

function validateForm(
  form: LeaveTypeForm,
): FormErrors {
  const errors: FormErrors = {};

  const name = form.name.trim();
  const code = form.code.trim();
  const days = form.daysPerYear.trim();

  if (!name) {
    errors.name =
      "Leave Type name is required.";
  } else if (
    name.length > MAX_NAME_LENGTH
  ) {
    errors.name =
      `Name cannot exceed ${MAX_NAME_LENGTH} characters.`;
  }

  if (!code) {
    errors.code =
      "Leave Type code is required.";
  } else if (
    code.length > MAX_CODE_LENGTH
  ) {
    errors.code =
      `Code cannot exceed ${MAX_CODE_LENGTH} characters.`;
  } else if (
    !/^[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?$/.test(
      code,
    )
  ) {
    errors.code =
      "Use letters, numbers, hyphens or underscores. The code cannot start or end with a separator.";
  }

  if (!days) {
    errors.daysPerYear =
      "Days per year is required.";
  } else {
    const value = Number(days);

    if (!Number.isSafeInteger(value)) {
      errors.daysPerYear =
        "Days per year must be a whole number.";
    } else if (value < 0) {
      errors.daysPerYear =
        "Days per year cannot be negative.";
    } else if (
      value > MAX_DAYS_PER_YEAR
    ) {
      errors.daysPerYear =
        "Days per year exceeds the allowed limit.";
    }
  }

  return errors;
}

function StatusBadge({
  active,
}: {
  active: boolean;
}) {
  return active ? (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
      <CheckCircle2
        size={13}
        aria-hidden="true"
      />
      Active
    </span>
  ) : (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-500/10">
      <Archive
        size={13}
        aria-hidden="true"
      />
      Inactive
    </span>
  );
}

function DocumentStatus({
  required,
}: {
  required: boolean;
}) {
  return required ? (
    <span className="inline-flex max-w-full items-center gap-1.5 text-xs font-semibold text-slate-700">
      <FileCheck2
        size={15}
        className="shrink-0 text-[#b88900]"
        aria-hidden="true"
      />
      Required
    </span>
  ) : (
    <span className="inline-flex max-w-full items-center gap-1.5 text-xs font-medium text-slate-500">
      <FileText
        size={15}
        className="shrink-0 text-slate-400"
        aria-hidden="true"
      />
      Not required
    </span>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  description,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>

          <p className="mt-1 break-words text-xs leading-5 text-slate-500">
            {description}
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200">
          {icon}
        </div>
      </div>
    </div>
  );
}

function LeaveTypeFormModal({
  mode,
  form,
  errors,
  selectedLeaveType,
  submitting,
  onClose,
  onChange,
  onSubmit,
}: {
  mode: "create" | "edit";
  form: LeaveTypeForm;
  errors: FormErrors;
  selectedLeaveType: LeaveType | null;
  submitting: boolean;
  onClose: () => void;
  onChange: (
    field: keyof LeaveTypeForm,
    value: string | boolean,
  ) => void;
  onSubmit: () => void;
}) {
  const editing = mode === "edit";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !submitting
        ) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-type-form-title"
        className="flex max-h-[96vh] w-full min-w-0 flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[92vh] sm:max-w-xl sm:rounded-2xl"
      >
        <div className="shrink-0 border-b border-slate-200 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#b88900]">
                {editing ? (
                  <Edit3
                    size={14}
                    className="shrink-0"
                  />
                ) : (
                  <Plus
                    size={14}
                    className="shrink-0"
                  />
                )}

                <span className="truncate">
                  Leave Configuration
                </span>
              </div>

              <h2
                id="leave-type-form-title"
                className="mt-1 break-words text-xl font-bold tracking-tight text-slate-900"
              >
                {editing
                  ? "Edit Leave Type"
                  : "Create Leave Type"}
              </h2>

              <p className="mt-1 break-words text-sm leading-5 text-slate-500">
                {editing
                  ? "Update the configuration for this Leave Type."
                  : "Create a Leave Type employees can use when requesting leave."}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Close Leave Type form"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="space-y-5">
            <div>
              <label
                htmlFor="leave-type-name"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Leave Type name
              </label>

              <input
                id="leave-type-name"
                type="text"
                value={form.name}
                maxLength={MAX_NAME_LENGTH}
                autoComplete="off"
                disabled={submitting}
                onChange={(event) =>
                  onChange(
                    "name",
                    event.target.value,
                  )
                }
                placeholder="e.g. Annual Leave"
                className={`h-11 w-full min-w-0 rounded-xl border bg-white px-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 ${
                  errors.name
                    ? "border-red-300 ring-2 ring-red-100"
                    : "border-slate-200 hover:border-slate-300 focus:border-[#c89b20] focus:ring-2 focus:ring-[#c89b20]/10"
                } disabled:cursor-not-allowed disabled:bg-slate-50`}
              />

              {errors.name && (
                <p className="mt-1.5 break-words text-xs font-medium text-red-600">
                  {errors.name}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="leave-type-code"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Leave Type code
              </label>

              <input
                id="leave-type-code"
                type="text"
                value={form.code}
                maxLength={MAX_CODE_LENGTH}
                autoComplete="off"
                disabled={submitting}
                onChange={(event) =>
                  onChange(
                    "code",
                    event.target.value.toUpperCase(),
                  )
                }
                placeholder="e.g. ANNUAL"
                className={`h-11 w-full min-w-0 rounded-xl border bg-white px-3.5 text-sm font-medium tracking-wide text-slate-800 outline-none transition placeholder:font-normal placeholder:text-slate-400 ${
                  errors.code
                    ? "border-red-300 ring-2 ring-red-100"
                    : "border-slate-200 hover:border-slate-300 focus:border-[#c89b20] focus:ring-2 focus:ring-[#c89b20]/10"
                } disabled:cursor-not-allowed disabled:bg-slate-50`}
              />

              {errors.code ? (
                <p className="mt-1.5 break-words text-xs font-medium text-red-600">
                  {errors.code}
                </p>
              ) : (
                <p className="mt-1.5 break-words text-xs text-slate-400">
                  Use letters, numbers, hyphens or underscores.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="leave-type-days"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Days per year
              </label>

              <input
                id="leave-type-days"
                type="number"
                min={0}
                max={MAX_DAYS_PER_YEAR}
                step={1}
                inputMode="numeric"
                value={form.daysPerYear}
                disabled={submitting}
                onChange={(event) =>
                  onChange(
                    "daysPerYear",
                    event.target.value,
                  )
                }
                placeholder="e.g. 21"
                className={`h-11 w-full min-w-0 rounded-xl border bg-white px-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 ${
                  errors.daysPerYear
                    ? "border-red-300 ring-2 ring-red-100"
                    : "border-slate-200 hover:border-slate-300 focus:border-[#c89b20] focus:ring-2 focus:ring-[#c89b20]/10"
                } disabled:cursor-not-allowed disabled:bg-slate-50`}
              />

              {errors.daysPerYear && (
                <p className="mt-1.5 break-words text-xs font-medium text-red-600">
                  {errors.daysPerYear}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-slate-800">
                    Supporting document
                  </p>

                  <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                    Require employees to provide a supporting document
                    when requesting this Leave Type.
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={
                    form.requiresDocument
                  }
                  disabled={submitting}
                  onClick={() =>
                    onChange(
                      "requiresDocument",
                      !form.requiresDocument,
                    )
                  }
                  className={`relative flex h-6 w-11 shrink-0 items-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                    form.requiresDocument
                      ? "bg-[#d8a415]"
                      : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      form.requiresDocument
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div className="mt-3 flex min-w-0 items-center gap-2 text-xs font-medium">
                {form.requiresDocument ? (
                  <>
                    <Check
                      size={14}
                      className="shrink-0 text-emerald-600"
                    />
                    <span className="break-words text-emerald-700">
                      Supporting document required
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle
                      size={14}
                      className="shrink-0 text-slate-400"
                    />
                    <span className="break-words text-slate-500">
                      Supporting document not required
                    </span>
                  </>
                )}
              </div>
            </div>

            {editing &&
              selectedLeaveType && (
                <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                  <div className="flex min-w-0 flex-col gap-1.5 text-xs sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium text-slate-500">
                      Last updated
                    </span>

                    <span className="font-semibold text-slate-700">
                      {formatDate(
                        selectedLeaveType.updatedAt,
                      )}
                    </span>
                  </div>
                </div>
              )}
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#d8a415] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c2940f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {submitting ? (
                <>
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                  {editing
                    ? "Saving..."
                    : "Creating..."}
                </>
              ) : (
                <>
                  {editing ? (
                    <Check size={16} />
                  ) : (
                    <Plus size={16} />
                  )}

                  {editing
                    ? "Save Changes"
                    : "Create Leave Type"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusConfirmation({
  leaveType,
  action,
  submitting,
  onClose,
  onConfirm,
}: {
  leaveType: LeaveType;
  action: "activate" | "deactivate";
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const activate =
    action === "activate";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-3 backdrop-blur-[2px] sm:p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-type-confirm-title"
        className="w-full min-w-0 max-w-md rounded-2xl bg-white p-4 shadow-2xl sm:p-6"
      >
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              activate
                ? "bg-emerald-50 text-emerald-600"
                : "bg-amber-50 text-[#b88900]"
            }`}
          >
            {activate ? (
              <ToggleRight size={22} />
            ) : (
              <ToggleLeft size={22} />
            )}
          </div>

          <div className="min-w-0">
            <h2
              id="leave-type-confirm-title"
              className="break-words text-base font-bold text-slate-900"
            >
              {activate
                ? "Activate Leave Type?"
                : "Deactivate Leave Type?"}
            </h2>

            <p className="mt-1.5 break-words text-sm leading-6 text-slate-500">
              {activate
                ? `“${leaveType.name}” will become available as an active Leave Type.`
                : `“${leaveType.name}” will become unavailable as an active Leave Type.`}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <span className="shrink-0 text-xs text-slate-500">
              Code
            </span>

            <span className="min-w-0 break-all text-right text-xs font-bold tracking-wide text-slate-700">
              {leaveType.code}
            </span>
          </div>

          <div className="mt-2 flex min-w-0 items-center justify-between gap-3">
            <span className="shrink-0 text-xs text-slate-500">
              Annual entitlement
            </span>

            <span className="text-right text-xs font-semibold text-slate-700">
              {leaveType.daysPerYear}{" "}
              {leaveType.daysPerYear === 1
                ? "day"
                : "days"}
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className={`inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${
              activate
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-[#b88900] hover:bg-[#9e7600]"
            }`}
          >
            {submitting ? (
              <Loader2
                size={16}
                className="animate-spin"
              />
            ) : activate ? (
              <Check size={16} />
            ) : (
              <Archive size={16} />
            )}

            {submitting
              ? "Updating..."
              : activate
                ? "Activate"
                : "Deactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LeaveTypes() {
  const [leaveTypes, setLeaveTypes] =
    useState<LeaveType[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const [formMode, setFormMode] =
    useState<FormMode>(null);

  const [
    selectedLeaveType,
    setSelectedLeaveType,
  ] = useState<LeaveType | null>(
    null,
  );

  const [form, setForm] =
    useState<LeaveTypeForm>(
      EMPTY_FORM,
    );

  const [formErrors, setFormErrors] =
    useState<FormErrors>({});

  const [submitting, setSubmitting] =
    useState(false);

  const [statusAction, setStatusAction] =
    useState<StatusAction>(null);

  const [
    statusSubmitting,
    setStatusSubmitting,
  ] = useState(false);

  const requestControllerRef =
    useRef<AbortController | null>(
      null,
    );

  const loadLeaveTypes =
    useCallback(
      async (silent = false) => {
        requestControllerRef.current?.abort();

        const controller =
          new AbortController();

        requestControllerRef.current =
          controller;

        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(null);

        try {
          const data =
            await listLeaveTypes(
              true,
              {
                signal:
                  controller.signal,
              },
            );

          if (
            controller.signal.aborted
          ) {
            return;
          }

          setLeaveTypes(data);
        } catch (requestError) {
          if (
            controller.signal.aborted
          ) {
            return;
          }

          if (
            requestError instanceof
              DOMException &&
            requestError.name ===
              "AbortError"
          ) {
            return;
          }

          if (
            getErrorCode(
              requestError,
            ) === "REQUEST_CANCELLED"
          ) {
            return;
          }

          setError(
            getErrorMessage(
              requestError,
              "Unable to load Leave Types. Please try again.",
            ),
          );
        } finally {
          if (
            requestControllerRef.current ===
            controller
          ) {
            requestControllerRef.current =
              null;
          }

          if (
            !controller.signal.aborted
          ) {
            if (silent) {
              setRefreshing(false);
            } else {
              setLoading(false);
            }
          }
        }
      },
      [],
    );

  useEffect(() => {
    void loadLeaveTypes();

    return () => {
      requestControllerRef.current?.abort();
      requestControllerRef.current =
        null;
    };
  }, [loadLeaveTypes]);

  const statistics = useMemo(() => {
    const active =
      leaveTypes.filter(
        (item) => item.isActive,
      ).length;

    const documentRequired =
      leaveTypes.filter(
        (item) =>
          item.requiresDocument,
      ).length;

    return {
      total: leaveTypes.length,
      active,
      inactive:
        leaveTypes.length - active,
      documentRequired,
    };
  }, [leaveTypes]);

  const filteredLeaveTypes =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return leaveTypes
        .filter((item) => {
          if (
            statusFilter ===
              "active" &&
            !item.isActive
          ) {
            return false;
          }

          if (
            statusFilter ===
              "inactive" &&
            item.isActive
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          return (
            item.name
              .toLowerCase()
              .includes(query) ||
            item.code
              .toLowerCase()
              .includes(query)
          );
        })
        .sort((a, b) => {
          if (
            a.isActive !==
            b.isActive
          ) {
            return a.isActive
              ? -1
              : 1;
          }

          return a.name.localeCompare(
            b.name,
          );
        });
    }, [
      leaveTypes,
      search,
      statusFilter,
    ]);

  const openCreate = () => {
    setSelectedLeaveType(null);
    setForm({
      ...EMPTY_FORM,
    });
    setFormErrors({});
    setFormMode("create");
    setError(null);
  };

  const openEdit = (
    leaveType: LeaveType,
  ) => {
    setSelectedLeaveType(
      leaveType,
    );

    setForm({
      name: leaveType.name,
      code: leaveType.code,
      daysPerYear: String(
        leaveType.daysPerYear,
      ),
      requiresDocument:
        leaveType.requiresDocument,
    });

    setFormErrors({});
    setFormMode("edit");
    setError(null);
  };

  const closeForm = () => {
    if (submitting) {
      return;
    }

    setFormMode(null);
    setSelectedLeaveType(null);
    setForm({
      ...EMPTY_FORM,
    });
    setFormErrors({});
  };

  const handleFormChange = (
    field: keyof LeaveTypeForm,
    value: string | boolean,
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setFormErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  };

  const handleSubmit = async () => {
    const errors =
      validateForm(form);

    setFormErrors(errors);

    if (
      Object.keys(errors).length > 0
    ) {
      return;
    }

    const payload = {
      name: form.name.trim(),
      code: form.code
        .trim()
        .toUpperCase(),
      daysPerYear: Number(
        form.daysPerYear,
      ),
      requiresDocument:
        form.requiresDocument,
    };

    setSubmitting(true);
    setError(null);

    try {
      if (formMode === "create") {
        const created =
          await createLeaveType(
            payload satisfies CreateLeaveTypePayload,
          );

        setLeaveTypes(
          (current) => [
            ...current,
            created,
          ],
        );

        closeForm();
        return;
      }

      if (
        formMode === "edit" &&
        selectedLeaveType
      ) {
        const updated =
          await updateLeaveType(
            selectedLeaveType.id,
            payload satisfies UpdateLeaveTypePayload,
          );

        setLeaveTypes(
          (current) =>
            current.map((item) =>
              item.id === updated.id
                ? updated
                : item,
            ),
        );

        closeForm();
      }
    } catch (requestError) {
      const code =
        getErrorCode(
          requestError,
        );

      if (
        code ===
        "LEAVE_TYPE_CODE_EXISTS"
      ) {
        setFormErrors({
          code:
            "This Leave Type code is already in use.",
        });
      } else if (
        code ===
        "LEAVE_TYPE_NAME_EXISTS"
      ) {
        setFormErrors({
          name:
            "A Leave Type with this name already exists.",
        });
      } else {
        setError(
          getErrorMessage(
            requestError,
            "Unable to save the Leave Type. Please try again.",
          ),
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openStatusAction = (
    leaveType: LeaveType,
    action:
      | "activate"
      | "deactivate",
  ) => {
    setSelectedLeaveType(
      leaveType,
    );
    setStatusAction(action);
    setError(null);
  };

  const closeStatusAction = () => {
    if (statusSubmitting) {
      return;
    }

    setSelectedLeaveType(null);
    setStatusAction(null);
  };

  const handleStatusAction =
    async () => {
      if (
        !selectedLeaveType ||
        !statusAction
      ) {
        return;
      }

      setStatusSubmitting(true);
      setError(null);

      try {
        const updated =
          statusAction === "activate"
            ? await activateLeaveType(
                selectedLeaveType.id,
              )
            : await deactivateLeaveType(
                selectedLeaveType.id,
              );

        setLeaveTypes(
          (current) =>
            current.map((item) =>
              item.id === updated.id
                ? updated
                : item,
            ),
        );

        closeStatusAction();
      } catch (requestError) {
        setError(
          getErrorMessage(
            requestError,
            `Unable to ${
              statusAction ===
              "activate"
                ? "activate"
                : "deactivate"
            } the Leave Type. Please try again.`,
          ),
        );
      } finally {
        setStatusSubmitting(false);
      }
    };

  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden pb-8 sm:space-y-6">
      {/* Page header */}
      <section className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#b88900]">
            <CalendarDays
              size={14}
              className="shrink-0"
            />
            <span className="truncate">
              Leave Configuration
            </span>
          </div>

          <h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Leave Types
          </h1>

          <p className="mt-1 max-w-3xl break-words text-sm leading-6 text-slate-500">
            Configure the types of leave available to employees,
            including annual entitlement and supporting document
            requirements.
          </p>
        </div>

        <div className="flex w-full min-w-0 shrink-0 flex-col gap-2 sm:flex-row xl:w-auto">
          <button
            type="button"
            onClick={() =>
              void loadLeaveTypes(true)
            }
            disabled={
              refreshing || loading
            }
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1 xl:w-auto xl:flex-none"
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? "animate-spin"
                  : undefined
              }
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#d8a415] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c2940f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2 sm:flex-1 xl:w-auto xl:flex-none"
          >
            <Plus size={16} />
            Create Leave Type
          </button>
        </div>
      </section>

      {/* Error */}
      {error && (
        <section
          role="alert"
          className="min-w-0 rounded-2xl border border-red-200 bg-red-50 p-4"
        >
          <div className="flex min-w-0 items-start gap-3">
            <XCircle
              size={20}
              className="mt-0.5 shrink-0 text-red-600"
            />

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-800">
                Unable to complete the request
              </p>

              <p className="mt-1 break-words text-sm leading-5 text-red-700">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setError(null)
              }
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-100 hover:text-red-700"
              aria-label="Dismiss error"
            >
              <X size={15} />
            </button>
          </div>
        </section>
      )}

      {/* Statistics */}
      <section
        aria-label="Leave Type statistics"
        className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryCard
          icon={
            <FileText size={19} />
          }
          label="Total Leave Types"
          value={statistics.total}
          description="Configured for your organization"
        />

        <SummaryCard
          icon={
            <CheckCircle2
              size={19}
              className="text-emerald-600"
            />
          }
          label="Active"
          value={statistics.active}
          description="Currently available"
        />

        <SummaryCard
          icon={
            <Archive size={19} />
          }
          label="Inactive"
          value={statistics.inactive}
          description="Currently unavailable"
        />

        <SummaryCard
          icon={
            <FileCheck2
              size={19}
              className="text-[#b88900]"
            />
          }
          label="Documents Required"
          value={
            statistics.documentRequired
          }
          description="Types requiring documents"
        />
      </section>

      {/* Management */}
      <section className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4 sm:p-5">
          <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <h2 className="break-words text-base font-bold text-slate-900 sm:text-lg">
                Leave Type Configuration
              </h2>

              <p className="mt-1 break-words text-xs leading-5 text-slate-500 sm:text-sm">
                Manage active and inactive Leave Types for your organization.
              </p>
            </div>

            <div className="flex min-w-0 w-full flex-col gap-2 sm:flex-row xl:w-auto">
              <div className="relative min-w-0 flex-1 xl:w-72 xl:flex-none">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Search leave types..."
                  aria-label="Search Leave Types"
                  className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#c89b20] focus:bg-white focus:ring-2 focus:ring-[#c89b20]/10"
                />
              </div>

              <div className="relative min-w-0 w-full sm:flex-1 xl:w-36 xl:flex-none">
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target
                        .value as StatusFilter,
                    )
                  }
                  aria-label="Filter Leave Types by status"
                  className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 pr-9 text-sm font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-[#c89b20] focus:bg-white focus:ring-2 focus:ring-[#c89b20]/10"
                >
                  <option value="all">
                    All statuses
                  </option>
                  <option value="active">
                    Active
                  </option>
                  <option value="inactive">
                    Inactive
                  </option>
                </select>

                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div
            className="flex min-h-[280px] flex-col items-center justify-center px-5 py-12 sm:min-h-[320px]"
            role="status"
            aria-live="polite"
          >
            <Loader2
              size={28}
              className="animate-spin text-[#b88900]"
            />

            <p className="mt-4 text-sm font-semibold text-slate-700">
              Loading Leave Types...
            </p>

            <p className="mt-1 text-center text-xs text-slate-400">
              Retrieving your organization&apos;s configuration.
            </p>
          </div>
        ) : filteredLeaveTypes.length ===
          0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center px-4 py-12 text-center sm:min-h-[320px] sm:px-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-200">
              {search ||
              statusFilter !==
                "all" ? (
                <Search size={24} />
              ) : (
                <FileText size={24} />
              )}
            </div>

            <h3 className="mt-4 break-words text-sm font-bold text-slate-800">
              {search ||
              statusFilter !==
                "all"
                ? "No Leave Types found"
                : "No Leave Types configured"}
            </h3>

            <p className="mt-1 max-w-md break-words text-sm leading-6 text-slate-500">
              {search ||
              statusFilter !==
                "all"
                ? "Try changing your search or status filter."
                : "Create a Leave Type to make it available for employee leave requests."}
            </p>

            {!search &&
              statusFilter ===
                "all" && (
                <button
                  type="button"
                  onClick={openCreate}
                  className="mt-5 inline-flex min-h-10 max-w-full items-center justify-center gap-2 rounded-xl bg-[#d8a415] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c2940f]"
                >
                  <Plus size={16} />
                  Create Leave Type
                </button>
              )}
          </div>
        ) : (
          <>
            {/* Small screens through small laptops: cards */}
            <div className="divide-y divide-slate-100 xl:hidden">
              {filteredLeaveTypes.map(
                (leaveType) => (
                  <article
                    key={leaveType.id}
                    className="min-w-0 p-4 sm:p-5"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200">
                        <CalendarDays
                          size={18}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-start gap-2">
                          <h3 className="min-w-0 flex-1 break-words text-sm font-bold text-slate-900">
                            {leaveType.name}
                          </h3>

                          <StatusBadge
                            active={
                              leaveType.isActive
                            }
                          />
                        </div>

                        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
                          <span className="max-w-full break-all rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold tracking-wide text-slate-600">
                            {leaveType.code}
                          </span>

                          <span className="text-xs text-slate-400">
                            {leaveType.daysPerYear}{" "}
                            {leaveType.daysPerYear ===
                            1
                              ? "day"
                              : "days"}{" "}
                            per year
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Documents
                        </p>

                        <div className="mt-1.5 min-w-0">
                          <DocumentStatus
                            required={
                              leaveType.requiresDocument
                            }
                          />
                        </div>
                      </div>

                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Updated
                        </p>

                        <p className="mt-1.5 break-words text-xs font-semibold text-slate-700">
                          {formatDate(
                            leaveType.updatedAt,
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() =>
                          openEdit(
                            leaveType,
                          )
                        }
                        className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20]"
                      >
                        <Edit3 size={14} />
                        Edit
                      </button>

                      {leaveType.isActive ? (
                        <button
                          type="button"
                          onClick={() =>
                            openStatusAction(
                              leaveType,
                              "deactivate",
                            )
                          }
                          className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-amber-50 hover:text-[#9e7600] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20]"
                        >
                          <ToggleLeft
                            size={14}
                          />
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            openStatusAction(
                              leaveType,
                              "activate",
                            )
                          }
                          className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        >
                          <ToggleRight
                            size={14}
                          />
                          Activate
                        </button>
                      )}
                    </div>
                  </article>
                ),
              )}
            </div>

            {/* Large laptop / desktop: table */}
            <div className="hidden min-w-0 overflow-x-auto xl:block">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Leave Type
                    </th>

                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Code
                    </th>

                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Annual Entitlement
                    </th>

                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Documents
                    </th>

                    <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Status
                    </th>

                    <th className="px-5 py-3.5 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredLeaveTypes.map(
                    (leaveType) => (
                      <tr
                        key={leaveType.id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200">
                              <CalendarDays
                                size={18}
                              />
                            </div>

                            <div className="min-w-0">
                              <p className="break-words text-sm font-semibold text-slate-800">
                                {leaveType.name}
                              </p>

                              <p className="mt-0.5 text-xs text-slate-400">
                                Updated{" "}
                                {formatDate(
                                  leaveType.updatedAt,
                                )}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span className="inline-flex max-w-full break-all rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold tracking-wide text-slate-600">
                            {leaveType.code}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-slate-800">
                          {leaveType.daysPerYear}{" "}
                          {leaveType.daysPerYear ===
                          1
                            ? "day"
                            : "days"}
                        </td>

                        <td className="px-5 py-4">
                          <DocumentStatus
                            required={
                              leaveType.requiresDocument
                            }
                          />
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge
                            active={
                              leaveType.isActive
                            }
                          />
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                openEdit(
                                  leaveType,
                                )
                              }
                              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20]"
                            >
                              <Edit3 size={14} />
                              Edit
                            </button>

                            {leaveType.isActive ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openStatusAction(
                                    leaveType,
                                    "deactivate",
                                  )
                                }
                                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-amber-50 hover:text-[#9e7600] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20]"
                              >
                                <ToggleLeft
                                  size={14}
                                />
                                Deactivate
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  openStatusAction(
                                    leaveType,
                                    "activate",
                                  )
                                }
                                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                              >
                                <ToggleRight
                                  size={14}
                                />
                                Activate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading &&
          filteredLeaveTypes.length >
            0 && (
            <div className="border-t border-slate-200 bg-slate-50/50 px-4 py-3 sm:px-5">
              <div className="flex min-w-0 flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <span className="break-words">
                  Showing{" "}
                  <strong className="text-slate-700">
                    {filteredLeaveTypes.length}
                  </strong>{" "}
                  of{" "}
                  <strong className="text-slate-700">
                    {leaveTypes.length}
                  </strong>{" "}
                  Leave Types
                </span>

                {(search ||
                  statusFilter !==
                    "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter(
                        "all",
                      );
                    }}
                    className="self-start font-semibold text-[#b88900] hover:text-[#9e7600] sm:self-auto"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          )}
      </section>

      {/* Tenant / organization scope notice */}
      <section className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200">
          <ShieldCheck size={18} />
        </div>

        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-slate-800">
            Organization-scoped configuration
          </p>

          <p className="mt-1 break-words text-xs leading-5 text-slate-500">
            Leave Types shown here are determined by the organization
            associated with your authenticated account. Organization
            selection is not exposed as a client-side setting.
          </p>
        </div>
      </section>

      {formMode && (
        <LeaveTypeFormModal
          mode={formMode}
          form={form}
          errors={formErrors}
          selectedLeaveType={
            selectedLeaveType
          }
          submitting={submitting}
          onClose={closeForm}
          onChange={
            handleFormChange
          }
          onSubmit={handleSubmit}
        />
      )}

      {selectedLeaveType &&
        statusAction && (
          <StatusConfirmation
            leaveType={
              selectedLeaveType
            }
            action={statusAction}
            submitting={
              statusSubmitting
            }
            onClose={
              closeStatusAction
            }
            onConfirm={
              handleStatusAction
            }
          />
        )}
    </div>
  );
}