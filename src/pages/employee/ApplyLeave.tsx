import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Info,
  Paperclip,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ChangeEvent,
  FormEvent,
  ReactNode,
} from "react";
import { Link, useNavigate } from "react-router-dom";

/* ============================================================
   Types
============================================================ */

export interface LeaveTypeOption {
  id: string;
  name: string;
  description?: string;
  remainingDays: number;
  requiresAttachment?: boolean;
  attachmentDescription?: string;
  isActive?: boolean;
}

export interface LeaveHoliday {
  date: string;
  name: string;
}

export interface LeaveApplicationSubmission {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalWorkingDays: number;
  reason: string;
  attachment?: File;
}

export interface LeaveCapacityStatus {
  mode: "WARNING" | "STRICT";
  currentApprovedCount: number;
  maximumAllowed: number;
  wouldExceedCapacity: boolean;
  message?: string;
}

interface ApplyLeaveProps {
  leaveTypes?: LeaveTypeOption[];
  holidays?: LeaveHoliday[];
  capacityStatus?: LeaveCapacityStatus | null;
  isLoading?: boolean;
  isSubmitting?: boolean;
  error?: string | null;
  successMessage?: string | null;
  onSubmit?: (
    application: LeaveApplicationSubmission,
  ) => Promise<void> | void;
  onCancel?: () => void;
}

/* ============================================================
   Constants
============================================================ */

const MAX_ATTACHMENT_SIZE =
  10 * 1024 * 1024;

const ACCEPTED_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const ACCEPTED_ATTACHMENT_EXTENSIONS =
  ".pdf,.jpg,.jpeg,.png,.webp";

const defaultLeaveTypes: LeaveTypeOption[] = [];

const defaultHolidays: LeaveHoliday[] = [];

/* ============================================================
   Helpers
============================================================ */

function getTodayDate(): string {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(
    today.getMonth() + 1,
  ).padStart(2, "0");
  const day = String(
    today.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateOnly(
  value: string,
): Date | null {
  if (!value) {
    return null;
  }

  const [year, month, day] =
    value.split("-").map(Number);

  if (
    !year ||
    !month ||
    !day ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const date = new Date(
    year,
    month - 1,
    day,
  );

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatDate(
  value: string,
): string {
  const date = parseDateOnly(value);

  if (!date) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function calculateWorkingDays(
  startDate: string,
  endDate: string,
  holidays: LeaveHoliday[],
): number {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (!start || !end || start > end) {
    return 0;
  }

  const holidayDates = new Set(
    holidays.map((holiday) => holiday.date),
  );

  let workingDays = 0;

  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();

    const isWeekend =
      dayOfWeek === 0 ||
      dayOfWeek === 6;

    const year = current.getFullYear();
    const month = String(
      current.getMonth() + 1,
    ).padStart(2, "0");
    const day = String(
      current.getDate(),
    ).padStart(2, "0");

    const dateKey = `${year}-${month}-${day}`;

    const isHoliday =
      holidayDates.has(dateKey);

    if (!isWeekend && !isHoliday) {
      workingDays += 1;
    }

    current.setDate(
      current.getDate() + 1,
    );
  }

  return workingDays;
}

function formatFileSize(
  bytes: number,
): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

/* ============================================================
   Reusable UI
============================================================ */

function FieldLabel({
  children,
  required = false,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-2 block text-sm font-semibold text-slate-800">
      {children}

      {required && (
        <span
          className="ml-1 text-red-500"
          aria-hidden="true"
        >
          *
        </span>
      )}
    </label>
  );
}

function FormError({
  message,
}: {
  message?: string;
}) {
  if (!message) {
    return null;
  }

  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-5 text-red-600">
      <AlertCircle
        size={14}
        className="mt-0.5 shrink-0"
        aria-hidden="true"
      />

      <span>{message}</span>
    </p>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6 pb-8">
      <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6">
        <div className="h-5 w-40 rounded bg-slate-100" />
        <div className="mt-3 h-4 w-72 max-w-full rounded bg-slate-100" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.7fr)]">
        <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6">
          <div className="h-5 w-36 rounded bg-slate-100" />

          <div className="mt-8 space-y-6">
            <div>
              <div className="h-3 w-24 rounded bg-slate-100" />
              <div className="mt-2 h-11 w-full rounded-xl bg-slate-100" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="h-3 w-24 rounded bg-slate-100" />
                <div className="mt-2 h-11 w-full rounded-xl bg-slate-100" />
              </div>

              <div>
                <div className="h-3 w-24 rounded bg-slate-100" />
                <div className="mt-2 h-11 w-full rounded-xl bg-slate-100" />
              </div>
            </div>

            <div>
              <div className="h-3 w-24 rounded bg-slate-100" />
              <div className="mt-2 h-32 w-full rounded-xl bg-slate-100" />
            </div>
          </div>
        </div>

        <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6">
          <div className="h-5 w-32 rounded bg-slate-100" />
          <div className="mt-6 h-40 rounded-xl bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Main Component
============================================================ */

export function ApplyLeave({
  leaveTypes = defaultLeaveTypes,
  holidays = defaultHolidays,
  capacityStatus = null,
  isLoading = false,
  isSubmitting = false,
  error = null,
  successMessage = null,
  onSubmit,
  onCancel,
}: ApplyLeaveProps) {
  const navigate = useNavigate();

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [leaveTypeId, setLeaveTypeId] =
    useState("");

  const [startDate, setStartDate] =
    useState("");

  const [endDate, setEndDate] =
    useState("");

  const [reason, setReason] =
    useState("");

  const [attachment, setAttachment] =
    useState<File | undefined>();

  const [attachmentError, setAttachmentError] =
    useState("");

  const [submitError, setSubmitError] =
    useState("");

  const [submitted, setSubmitted] =
    useState(false);

  const [validationAttempted, setValidationAttempted] =
    useState(false);

  const today = useMemo(
    () => getTodayDate(),
    [],
  );

  const selectedLeaveType =
    leaveTypes.find(
      (leaveType) =>
        leaveType.id === leaveTypeId,
    );

  const workingDays = useMemo(
    () =>
      calculateWorkingDays(
        startDate,
        endDate,
        holidays,
      ),
    [startDate, endDate, holidays],
  );

  const dateRangeIsReversed = useMemo(() => {
    const start = parseDateOnly(startDate);
    const end = parseDateOnly(endDate);

    return Boolean(
      start &&
        end &&
        start > end,
    );
  }, [startDate, endDate]);

  const startDateIsInPast =
    Boolean(startDate) &&
    startDate < today;

  const insufficientBalance =
    Boolean(
      selectedLeaveType &&
        workingDays >
          selectedLeaveType.remainingDays,
    );

  const requiresAttachment =
    Boolean(
      selectedLeaveType?.requiresAttachment,
    );

  const isCapacityBlocked =
    Boolean(
      capacityStatus?.wouldExceedCapacity &&
        capacityStatus.mode === "STRICT",
    );

  const reasonTooShort =
    reason.trim().length > 0 &&
    reason.trim().length < 10;

  const reasonTooLong =
    reason.trim().length > 1000;

  const formErrors = useMemo(() => {
    const errors: Record<
      string,
      string
    > = {};

    if (!leaveTypeId) {
      errors.leaveType =
        "Select a leave type.";
    }

    if (!startDate) {
      errors.startDate =
        "Select the first day of your leave.";
    } else if (startDateIsInPast) {
      errors.startDate =
        "The start date cannot be in the past.";
    }

    if (!endDate) {
      errors.endDate =
        "Select the last day of your leave.";
    } else if (dateRangeIsReversed) {
      errors.endDate =
        "The end date must be on or after the start date.";
    }

    if (
      startDate &&
      endDate &&
      !dateRangeIsReversed &&
      workingDays === 0
    ) {
      errors.dates =
        "The selected period contains no working days. Weekends and public holidays are excluded.";
    }

    if (insufficientBalance) {
      errors.balance =
        `You have only ${
          selectedLeaveType?.remainingDays ?? 0
        } ${
          selectedLeaveType?.remainingDays === 1
            ? "day"
            : "days"
        } remaining for ${
          selectedLeaveType?.name ??
          "this leave type"
        }.`;
    }

    if (!reason.trim()) {
      errors.reason =
        "Provide a reason for your leave request.";
    } else if (reasonTooShort) {
      errors.reason =
        "Please provide at least 10 characters.";
    } else if (reasonTooLong) {
      errors.reason =
        "The reason cannot exceed 1,000 characters.";
    }

    if (
      requiresAttachment &&
      !attachment
    ) {
      errors.attachment =
        selectedLeaveType?.attachmentDescription ??
        "An attachment is required for this leave type.";
    }

    if (isCapacityBlocked) {
      errors.capacity =
        capacityStatus?.message ??
        "This request cannot be submitted because the department leave capacity would be exceeded.";
    }

    return errors;
  }, [
    attachment,
    dateRangeIsReversed,
    endDate,
    insufficientBalance,
    isCapacityBlocked,
    leaveTypeId,
    reason,
    reasonTooLong,
    reasonTooShort,
    selectedLeaveType,
    startDate,
    startDateIsInPast,
    workingDays,
    requiresAttachment,
    capacityStatus,
  ]);

  const hasValidationErrors =
    Object.keys(formErrors).length > 0;

  const canSubmit =
    !isSubmitting &&
    !hasValidationErrors &&
    Boolean(leaveTypeId) &&
    Boolean(startDate) &&
    Boolean(endDate) &&
    workingDays > 0 &&
    Boolean(reason.trim());

  /* ==========================================================
     Handlers
  ========================================================== */

  const handleAttachmentChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file =
      event.target.files?.[0];

    setAttachmentError("");

    if (!file) {
      setAttachment(undefined);
      return;
    }

    if (
      !ACCEPTED_ATTACHMENT_TYPES.includes(
        file.type,
      )
    ) {
      setAttachment(undefined);

      setAttachmentError(
        "Unsupported file type. Upload PDF, JPG, PNG or WebP.",
      );

      event.target.value = "";

      return;
    }

    if (file.size > MAX_ATTACHMENT_SIZE) {
      setAttachment(undefined);

      setAttachmentError(
        "The attachment must not exceed 10 MB.",
      );

      event.target.value = "";

      return;
    }

    setAttachment(file);
  };

  const removeAttachment = () => {
    setAttachment(undefined);
    setAttachmentError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setValidationAttempted(true);
    setSubmitError("");
    setSubmitted(false);

    if (!canSubmit) {
      return;
    }

    try {
      if (onSubmit) {
        await onSubmit({
          leaveTypeId,
          startDate,
          endDate,
          totalWorkingDays: workingDays,
          reason: reason.trim(),
          attachment,
        });
      }

      setSubmitted(true);
    } catch (submissionError) {
      const message =
        submissionError instanceof Error
          ? submissionError.message
          : "We could not submit your leave request. Please try again.";

      setSubmitError(message);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }

    navigate("/employee");
  };

  const handleStartDateChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value;

    setStartDate(value);

    if (
      endDate &&
      value &&
      endDate < value
    ) {
      setEndDate("");
    }
  };

  /* ==========================================================
     Loading
  ========================================================== */

  if (isLoading) {
    return <LoadingState />;
  }

  /* ==========================================================
     Success
  ========================================================== */

  if (submitted || successMessage) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center py-10">
        <div className="w-full max-w-xl rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2
              size={28}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </div>

          <h1 className="mt-5 text-xl font-bold tracking-tight text-slate-900">
            Leave request submitted
          </h1>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            {successMessage ??
              "Your leave request has been submitted successfully and is now awaiting the required approval workflow."}
          </p>

          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/employee/leave"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#d8a415] px-5 text-sm font-semibold text-white transition hover:bg-[#bf920f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2"
            >
              View My Leave

              <ArrowLeft
                size={16}
                className="rotate-180"
                aria-hidden="true"
              />
            </Link>

            <Link
              to="/employee"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ==========================================================
     Main Form
  ========================================================== */

  return (
    <div className="space-y-6 pb-8">
      {/* Page heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            to="/employee"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2"
          >
            <ArrowLeft
              size={16}
              aria-hidden="true"
            />

            Back to dashboard
          </Link>

          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Apply for Leave
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Submit your leave request for manager and HR
            approval.
          </p>
        </div>
      </div>

      {/* General server error */}
      {(error || submitError) && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <AlertCircle
            size={19}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />

          <div className="min-w-0">
            <p className="font-semibold">
              Unable to submit your request
            </p>

            <p className="mt-1 leading-5">
              {submitError || error}
            </p>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
          {/* Main form */}
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
            <div className="border-b border-slate-100 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#d8a415]/10 text-[#a47700]">
                  <CalendarDays
                    size={20}
                    strokeWidth={1.9}
                    aria-hidden="true"
                  />
                </div>

                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-900">
                    Leave Details
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Select your leave type and the dates you
                    need away from work.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              {/* Leave type */}
              <div>
                <FieldLabel required>
                  Leave Type
                </FieldLabel>

                <div className="relative">
                  <select
                    value={leaveTypeId}
                    onChange={(event) =>
                      setLeaveTypeId(
                        event.target.value,
                      )
                    }
                    className={`h-12 w-full appearance-none rounded-xl border bg-white px-4 pr-11 text-sm text-slate-800 outline-none transition focus:border-[#c89b20] focus:ring-2 focus:ring-[#c89b20]/10 ${
                      validationAttempted &&
                      formErrors.leaveType
                        ? "border-red-300"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                    aria-invalid={
                      validationAttempted &&
                      Boolean(formErrors.leaveType)
                    }
                  >
                    <option value="">
                      Select leave type
                    </option>

                    {leaveTypes
                      .filter(
                        (leaveType) =>
                          leaveType.isActive !==
                          false,
                      )
                      .map((leaveType) => (
                        <option
                          key={leaveType.id}
                          value={leaveType.id}
                        >
                          {leaveType.name} —{" "}
                          {leaveType.remainingDays}{" "}
                          {leaveType.remainingDays ===
                          1
                            ? "day"
                            : "days"}{" "}
                          remaining
                        </option>
                      ))}
                  </select>

                  <ChevronDown
                    size={18}
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                </div>

                {selectedLeaveType?.description && (
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {selectedLeaveType.description}
                  </p>
                )}

                {selectedLeaveType && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <WalletIcon />

                    <span className="text-xs text-slate-600">
                      Available balance:
                    </span>

                    <strong className="text-xs text-slate-900">
                      {selectedLeaveType.remainingDays}{" "}
                      {selectedLeaveType.remainingDays ===
                      1
                        ? "day"
                        : "days"}
                    </strong>
                  </div>
                )}

                {validationAttempted && (
                  <FormError
                    message={formErrors.leaveType}
                  />
                )}
              </div>

              {/* Dates */}
              <div>
                <FieldLabel required>
                  Leave Dates
                </FieldLabel>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="leave-start-date"
                      className="mb-2 block text-xs font-medium text-slate-500"
                    >
                      Start date
                    </label>

                    <div className="relative">
                      <CalendarDays
                        size={17}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />

                      <input
                        id="leave-start-date"
                        type="date"
                        min={today}
                        value={startDate}
                        onChange={
                          handleStartDateChange
                        }
                        className={`h-12 w-full rounded-xl border bg-white pl-11 pr-3 text-sm text-slate-800 outline-none transition focus:border-[#c89b20] focus:ring-2 focus:ring-[#c89b20]/10 ${
                          validationAttempted &&
                          formErrors.startDate
                            ? "border-red-300"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                        aria-invalid={
                          validationAttempted &&
                          Boolean(formErrors.startDate)
                        }
                      />
                    </div>

                    {validationAttempted && (
                      <FormError
                        message={
                          formErrors.startDate
                        }
                      />
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="leave-end-date"
                      className="mb-2 block text-xs font-medium text-slate-500"
                    >
                      End date
                    </label>

                    <div className="relative">
                      <CalendarDays
                        size={17}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />

                      <input
                        id="leave-end-date"
                        type="date"
                        min={
                          startDate || today
                        }
                        value={endDate}
                        onChange={(event) =>
                          setEndDate(
                            event.target.value,
                          )
                        }
                        className={`h-12 w-full rounded-xl border bg-white pl-11 pr-3 text-sm text-slate-800 outline-none transition focus:border-[#c89b20] focus:ring-2 focus:ring-[#c89b20]/10 ${
                          validationAttempted &&
                          formErrors.endDate
                            ? "border-red-300"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                        aria-invalid={
                          validationAttempted &&
                          Boolean(formErrors.endDate)
                        }
                      />
                    </div>

                    {validationAttempted && (
                      <FormError
                        message={
                          formErrors.endDate
                        }
                      />
                    )}
                  </div>
                </div>

                {validationAttempted &&
                  formErrors.dates && (
                    <FormError
                      message={formErrors.dates}
                    />
                  )}

                {startDate &&
                  endDate &&
                  !dateRangeIsReversed &&
                  workingDays > 0 && (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Clock3
                          size={16}
                          className="text-emerald-600"
                          aria-hidden="true"
                        />

                        <span className="text-xs font-medium text-emerald-800">
                          Working days
                        </span>
                      </div>

                      <strong className="text-sm text-emerald-800">
                        {workingDays}{" "}
                        {workingDays === 1
                          ? "day"
                          : "days"}
                      </strong>
                    </div>
                  )}
              </div>

              {/* Balance warning */}
              {validationAttempted &&
                insufficientBalance && (
                  <div
                    role="alert"
                    className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
                  >
                    <AlertCircle
                      size={19}
                      className="mt-0.5 shrink-0 text-red-600"
                      aria-hidden="true"
                    />

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-red-800">
                        Insufficient leave balance
                      </p>

                      <p className="mt-1 text-xs leading-5 text-red-700">
                        {formErrors.balance}
                      </p>
                    </div>
                  </div>
                )}

              {/* Capacity warning */}
              {capacityStatus?.wouldExceedCapacity && (
                <div
                  role={
                    isCapacityBlocked
                      ? "alert"
                      : "status"
                  }
                  className={`flex items-start gap-3 rounded-xl border p-4 ${
                    isCapacityBlocked
                      ? "border-red-200 bg-red-50"
                      : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <AlertTriangle
                    size={19}
                    className={`mt-0.5 shrink-0 ${
                      isCapacityBlocked
                        ? "text-red-600"
                        : "text-amber-600"
                    }`}
                    aria-hidden="true"
                  />

                  <div className="min-w-0">
                    <p
                      className={`text-sm font-semibold ${
                        isCapacityBlocked
                          ? "text-red-800"
                          : "text-amber-800"
                      }`}
                    >
                      {isCapacityBlocked
                        ? "Department capacity limit reached"
                        : "Department capacity warning"}
                    </p>

                    <p
                      className={`mt-1 text-xs leading-5 ${
                        isCapacityBlocked
                          ? "text-red-700"
                          : "text-amber-700"
                      }`}
                    >
                      {capacityStatus.message ??
                        `There are currently ${capacityStatus.currentApprovedCount} approved overlapping leave requests out of the configured maximum of ${capacityStatus.maximumAllowed}.`}
                    </p>

                    {!isCapacityBlocked && (
                      <p className="mt-2 text-xs font-medium text-amber-800">
                        You may still submit the request.
                        The manager will see this warning
                        during approval.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Reason */}
              <div>
                <div className="flex items-center justify-between gap-3">
                  <FieldLabel required>
                    Reason
                  </FieldLabel>

                  <span
                    className={`text-[11px] ${
                      reason.length > 1000
                        ? "font-semibold text-red-600"
                        : "text-slate-400"
                    }`}
                  >
                    {reason.length}/1000
                  </span>
                </div>

                <textarea
                  value={reason}
                  onChange={(event) =>
                    setReason(event.target.value)
                  }
                  rows={6}
                  maxLength={1000}
                  placeholder="Explain briefly why you are requesting this leave..."
                  className={`w-full resize-y rounded-xl border bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#c89b20] focus:ring-2 focus:ring-[#c89b20]/10 ${
                    validationAttempted &&
                    formErrors.reason
                      ? "border-red-300"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                  aria-invalid={
                    validationAttempted &&
                    Boolean(formErrors.reason)
                  }
                />

                {validationAttempted && (
                  <FormError
                    message={formErrors.reason}
                  />
                )}
              </div>

              {/* Attachment */}
              <div>
                <FieldLabel
                  required={requiresAttachment}
                >
                  Supporting Document
                </FieldLabel>

                <p className="mb-3 text-xs leading-5 text-slate-500">
                  Upload a supporting document when
                  required by your organization's leave
                  policy. Maximum size: 10 MB.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={
                    ACCEPTED_ATTACHMENT_EXTENSIONS
                  }
                  onChange={
                    handleAttachmentChange
                  }
                  className="sr-only"
                  id="leave-attachment"
                />

                {!attachment ? (
                  <label
                    htmlFor="leave-attachment"
                    className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center transition hover:border-[#c89b20] hover:bg-amber-50/30 focus-within:border-[#c89b20] focus-within:ring-2 focus-within:ring-[#c89b20]/10"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
                      <Paperclip
                        size={19}
                        aria-hidden="true"
                      />
                    </div>

                    <span className="mt-3 text-sm font-semibold text-slate-700">
                      Choose a supporting document
                    </span>

                    <span className="mt-1 text-xs text-slate-500">
                      PDF, JPG, PNG or WebP
                    </span>
                  </label>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm">
                      <FileText
                        size={19}
                        aria-hidden="true"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {attachment.name}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatFileSize(
                          attachment.size,
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={
                        removeAttachment
                      }
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20]"
                      aria-label="Remove attachment"
                      title="Remove attachment"
                    >
                      <X
                        size={17}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                )}

                {(attachmentError ||
                  (validationAttempted &&
                    formErrors.attachment)) && (
                  <FormError
                    message={
                      attachmentError ||
                      formErrors.attachment
                    }
                  />
                )}
              </div>
            </div>
          </section>

          {/* Summary / policy panel */}
          <aside className="space-y-6">
            {/* Request summary */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
              <div className="border-b border-slate-100 p-5">
                <h2 className="text-base font-bold text-slate-900">
                  Request Summary
                </h2>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Review the details before submitting.
                </p>
              </div>

              <div className="space-y-4 p-5">
                <SummaryRow
                  label="Leave type"
                  value={
                    selectedLeaveType?.name ??
                    "Not selected"
                  }
                />

                <SummaryRow
                  label="Start date"
                  value={
                    startDate
                      ? formatDate(startDate)
                      : "Not selected"
                  }
                />

                <SummaryRow
                  label="End date"
                  value={
                    endDate
                      ? formatDate(endDate)
                      : "Not selected"
                  }
                />

                <SummaryRow
                  label="Working days"
                  value={
                    workingDays > 0
                      ? `${workingDays} ${
                          workingDays === 1
                            ? "day"
                            : "days"
                        }`
                      : "—"
                  }
                  emphasize={
                    workingDays > 0
                  }
                />

                {selectedLeaveType && (
                  <SummaryRow
                    label="Balance after request"
                    value={
                      workingDays <=
                      selectedLeaveType.remainingDays
                        ? `${
                            selectedLeaveType.remainingDays -
                            workingDays
                          } ${
                            selectedLeaveType.remainingDays -
                              workingDays ===
                            1
                              ? "day"
                              : "days"
                          }`
                        : "Insufficient balance"
                    }
                    valueClassName={
                      insufficientBalance
                        ? "text-red-600"
                        : "text-slate-900"
                    }
                  />
                )}

                <div className="border-t border-slate-100 pt-4">
                  <div className="flex items-start gap-2">
                    <ShieldCheck
                      size={17}
                      className="mt-0.5 shrink-0 text-emerald-600"
                      aria-hidden="true"
                    />

                    <p className="text-xs leading-5 text-slate-500">
                      Your request will follow your
                      organization's approval workflow.
                      Approval does not automatically
                      mean the leave is finalized until all
                      required approval stages are complete.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Leave policy information */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
              <div className="border-b border-slate-100 p-5">
                <div className="flex items-center gap-2">
                  <Info
                    size={18}
                    className="text-[#a47700]"
                    aria-hidden="true"
                  />

                  <h2 className="text-base font-bold text-slate-900">
                    Before you submit
                  </h2>
                </div>
              </div>

              <div className="space-y-3 p-5">
                <PolicyItem>
                  Weekends are excluded from working-day
                  calculations.
                </PolicyItem>

                <PolicyItem>
                  Public holidays configured by HR are
                  excluded automatically.
                </PolicyItem>

                <PolicyItem>
                  Your available leave balance is checked
                  before submission.
                </PolicyItem>

                <PolicyItem>
                  Overlapping leave requests are checked by
                  the system.
                </PolicyItem>

                <PolicyItem>
                  Department leave capacity may generate a
                  warning or block approval depending on HR
                  policy.
                </PolicyItem>

                <PolicyItem>
                  Your manager or department head reviews
                  the request before HR final approval.
                </PolicyItem>
              </div>
            </section>

            {/* Submit actions */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
              {validationAttempted &&
                hasValidationErrors && (
                  <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <AlertTriangle
                      size={17}
                      className="mt-0.5 shrink-0 text-amber-600"
                      aria-hidden="true"
                    />

                    <p className="text-xs leading-5 text-amber-800">
                      Please correct the highlighted
                      fields before submitting your request.
                    </p>
                  </div>
                )}

              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  (validationAttempted &&
                    hasValidationErrors)
                }
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#d8a415] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#bf920f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                      aria-hidden="true"
                    />

                    Submitting...
                  </>
                ) : (
                  <>
                    <Send
                      size={17}
                      strokeWidth={2}
                      aria-hidden="true"
                    />

                    Submit Leave Request
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
   Supporting Components
============================================================ */

function SummaryRow({
  label,
  value,
  emphasize = false,
  valueClassName = "",
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-slate-500">
        {label}
      </span>

      <span
        className={`max-w-[60%] text-right text-xs ${
          emphasize
            ? "font-bold text-[#a47700]"
            : "font-semibold text-slate-700"
        } ${valueClassName}`}
      >
        {value}
      </span>
    </div>
  );
}

function PolicyItem({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <CheckCircle2
        size={15}
        className="mt-0.5 shrink-0 text-emerald-500"
        aria-hidden="true"
      />

      <p className="text-xs leading-5 text-slate-600">
        {children}
      </p>
    </div>
  );
}

function WalletIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-slate-500"
    >
      <path d="M20 7V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v8a2 2 0 0 1-2 2H5a3 3 0 0 1-2-3V7" />
      <path d="M16 14h.01" />
    </svg>
  );
}