import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Info,
  Paperclip,
  PlaneTakeoff,
  Plus,
  RefreshCw,
  Search,
  X,
  XCircle,
} from "lucide-react";

import type {
  LucideIcon,
} from "lucide-react";

import type {
  ChangeEvent,
  FormEvent,
  ReactNode,
} from "react";

import {
  useMemo,
  useRef,
  useState,
} from "react";

import { Link } from "react-router-dom";

import { useAuth } from "../../contexts/AuthContext";

/* ============================================================
   Types
============================================================ */

export type LeaveRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export interface LeaveTypeOption {
  id: string;
  name: string;
  description?: string;
  entitledDays: number;
  usedDays: number;
  remainingDays: number;
  requiresAttachment?: boolean;
  attachmentLabel?: string;
  active?: boolean;
}

export interface LeaveRequestRecord {
  id: string;
  referenceNumber: string;
  leaveTypeId: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: LeaveRequestStatus;
  reason: string;
  submittedAt: string;
  rejectionReason?: string;
  managerComment?: string;
  hrComment?: string;
  attachmentName?: string;
}

export interface LeaveCapacityWarning {
  exceedsCapacity: boolean;
  currentApprovedCount: number;
  configuredCapacity: number;
  departmentName?: string;
  message?: string;
}

export interface LeaveManagementData {
  leaveTypes: LeaveTypeOption[];
  requests: LeaveRequestRecord[];
  capacityWarning?: LeaveCapacityWarning | null;
}

export interface LeaveManagementProps {
  data?: LeaveManagementData;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSubmitLeave?: (
    request: SubmitLeaveRequest,
  ) => Promise<void>;
  onCancelLeave?: (
    requestId: string,
  ) => Promise<void>;
}

export interface SubmitLeaveRequest {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  attachment?: File;
}

type DateValidationError =
  | "NONE"
  | "START_REQUIRED"
  | "END_REQUIRED"
  | "START_IN_PAST"
  | "END_BEFORE_START";

interface StatusConfig {
  label: string;
  classes: string;
  icon: LucideIcon;
}

/* ============================================================
   Constants
============================================================ */

const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;

const ACCEPTED_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const ACCEPTED_ATTACHMENT_EXTENSIONS =
  ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx";

const defaultData: LeaveManagementData = {
  leaveTypes: [],
  requests: [],
  capacityWarning: null,
};

/* ============================================================
   Helpers
============================================================ */

function getTodayDate(): string {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(
    now.getMonth() + 1,
  ).padStart(2, "0");
  const day = String(
    now.getDate(),
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
    !day
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

  date.setHours(0, 0, 0, 0);

  return date;
}

function formatDate(
  value: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = parseDateOnly(value);

  if (!date) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat(
    "en-KE",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      ...options,
    },
  ).format(date);
}

function calculateCalendarDays(
  startDate: string,
  endDate: string,
): number {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (!start || !end || end < start) {
    return 0;
  }

  const millisecondsPerDay =
    24 * 60 * 60 * 1000;

  return (
    Math.floor(
      (end.getTime() -
        start.getTime()) /
        millisecondsPerDay,
    ) + 1
  );
}

function calculateWorkingDays(
  startDate: string,
  endDate: string,
): number {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (!start || !end || end < start) {
    return 0;
  }

  const current = new Date(start);
  let workingDays = 0;

  while (current <= end) {
    const day = current.getDay();

    if (
      day !== 0 &&
      day !== 6
    ) {
      workingDays += 1;
    }

    current.setDate(
      current.getDate() + 1,
    );
  }

  return workingDays;
}

function getStatusConfig(
  status: LeaveRequestStatus,
): StatusConfig {
  switch (status) {
    case "APPROVED":
      return {
        label: "Approved",
        classes:
          "border-emerald-200 bg-emerald-50 text-emerald-700",
        icon: CheckCircle2,
      };

    case "REJECTED":
      return {
        label: "Rejected",
        classes:
          "border-red-200 bg-red-50 text-red-700",
        icon: XCircle,
      };

    case "CANCELLED":
      return {
        label: "Cancelled",
        classes:
          "border-slate-200 bg-slate-100 text-slate-600",
        icon: X,
      };

    case "PENDING":
    default:
      return {
        label: "Pending",
        classes:
          "border-amber-200 bg-amber-50 text-amber-700",
        icon: Clock3,
      };
  }
}

function formatSubmittedAt(
  value: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat(
    "en-KE",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(date);
}

function getDateValidationError(
  startDate: string,
  endDate: string,
): DateValidationError {
  if (!startDate) {
    return "START_REQUIRED";
  }

  if (!endDate) {
    return "END_REQUIRED";
  }

  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  const today = parseDateOnly(
    getTodayDate(),
  );

  if (!start || !end || !today) {
    return "START_REQUIRED";
  }

  if (start < today) {
    return "START_IN_PAST";
  }

  if (end < start) {
    return "END_BEFORE_START";
  }

  return "NONE";
}

function getDateValidationMessage(
  error: DateValidationError,
): string {
  switch (error) {
    case "START_REQUIRED":
      return "Select a start date.";

    case "END_REQUIRED":
      return "Select an end date.";

    case "START_IN_PAST":
      return "Leave cannot start in the past.";

    case "END_BEFORE_START":
      return "The end date cannot be before the start date.";

    case "NONE":
    default:
      return "";
  }
}

function isValidAttachment(
  file: File,
): boolean {
  return ACCEPTED_ATTACHMENT_TYPES.includes(
    file.type,
  );
}

function formatFileSize(
  bytes: number,
): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

/* ============================================================
   Reusable UI
============================================================ */

function LoadingBlock({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-slate-100 ${className}`}
      aria-hidden="true"
    />
  );
}

function SectionHeader({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
          {title}
        </h2>

        {description && (
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {description}
          </p>
        )}
      </div>

      {actionLabel &&
        actionHref && (
          <Link
            to={actionHref}
            className="shrink-0 text-sm font-semibold text-[#a47700] transition hover:text-[#7f5b00] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2"
          >
            {actionLabel}
          </Link>
        )}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: LeaveRequestStatus;
}) {
  const config =
    getStatusConfig(status);

  const Icon = config.icon;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${config.classes}`}
    >
      <Icon
        size={12}
        strokeWidth={2}
        aria-hidden="true"
      />
      {config.label}
    </span>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center px-5 py-8 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon
          size={20}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </div>

      <h3 className="mt-3 text-sm font-semibold text-slate-800">
        {title}
      </h3>

      <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
        {description}
      </p>

      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Main Component
============================================================ */

export function LeaveManagement({
  data = defaultData,
  isLoading = false,
  error = null,
  onRetry,
  onSubmitLeave,
  onCancelLeave,
}: LeaveManagementProps) {
  const { user } = useAuth();

  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const [isFormOpen, setIsFormOpen] =
    useState(false);

  const [selectedLeaveTypeId, setSelectedLeaveTypeId] =
    useState("");

  const [startDate, setStartDate] =
    useState("");

  const [endDate, setEndDate] =
    useState("");

  const [reason, setReason] =
    useState("");

  const [attachment, setAttachment] =
    useState<File | undefined>(
      undefined,
    );

  const [attachmentError, setAttachmentError] =
    useState("");

  const [formError, setFormError] =
    useState("");

  const [formSuccess, setFormSuccess] =
    useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [cancellingRequestId, setCancellingRequestId] =
    useState<string | null>(
      null,
    );

  const [searchQuery, setSearchQuery] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<
      LeaveRequestStatus | "ALL"
    >("ALL");

  const [leaveTypeFilter, setLeaveTypeFilter] =
    useState("ALL");

  const [expandedRequestId, setExpandedRequestId] =
    useState<string | null>(
      null,
    );

  const dashboardData =
    data ?? defaultData;

  const activeLeaveTypes =
    dashboardData.leaveTypes.filter(
      (leaveType) =>
        leaveType.active !== false,
    );

  const selectedLeaveType =
    activeLeaveTypes.find(
      (leaveType) =>
        leaveType.id ===
        selectedLeaveTypeId,
    );

  const dateValidationError =
    getDateValidationError(
      startDate,
      endDate,
    );

  const workingDays = useMemo(
    () =>
      dateValidationError === "NONE"
        ? calculateWorkingDays(
            startDate,
            endDate,
          )
        : 0,
    [
      dateValidationError,
      startDate,
      endDate,
    ],
  );

  const calendarDays = useMemo(
    () =>
      dateValidationError === "NONE"
        ? calculateCalendarDays(
            startDate,
            endDate,
          )
        : 0,
    [
      dateValidationError,
      startDate,
      endDate,
    ],
  );

  const filteredRequests =
    useMemo(() => {
      const query =
        searchQuery
          .trim()
          .toLowerCase();

      return dashboardData.requests.filter(
        (request) => {
          const matchesStatus =
            statusFilter === "ALL" ||
            request.status ===
              statusFilter;

          const matchesType =
            leaveTypeFilter ===
              "ALL" ||
            request.leaveTypeId ===
              leaveTypeFilter;

          const matchesSearch =
            !query ||
            request.referenceNumber
              .toLowerCase()
              .includes(query) ||
            request.leaveTypeName
              .toLowerCase()
              .includes(query) ||
            request.reason
              .toLowerCase()
              .includes(query);

          return (
            matchesStatus &&
            matchesType &&
            matchesSearch
          );
        },
      );
    }, [
      dashboardData.requests,
      leaveTypeFilter,
      searchQuery,
      statusFilter,
    ]);

  const pendingCount =
    dashboardData.requests.filter(
      (request) =>
        request.status === "PENDING",
    ).length;

  const approvedCount =
    dashboardData.requests.filter(
      (request) =>
        request.status === "APPROVED",
    ).length;

  const rejectedCount =
    dashboardData.requests.filter(
      (request) =>
        request.status === "REJECTED",
    ).length;

  const totalRemainingDays =
    activeLeaveTypes.reduce(
      (total, leaveType) =>
        total +
        Math.max(
          leaveType.remainingDays,
          0,
        ),
      0,
    );

  /* ==========================================================
     Form actions
  ========================================================== */

  const resetForm = () => {
    setSelectedLeaveTypeId("");
    setStartDate("");
    setEndDate("");
    setReason("");
    setAttachment(undefined);
    setAttachmentError("");
    setFormError("");
    setFormSuccess("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSubmitting) {
      return;
    }

    setIsFormOpen(false);
    resetForm();
  };

  const handleAttachmentChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    setAttachmentError("");

    const file =
      event.target.files?.[0];

    if (!file) {
      setAttachment(undefined);
      return;
    }

    if (
      !isValidAttachment(file)
    ) {
      setAttachment(undefined);
      setAttachmentError(
        "Unsupported file type. Upload PDF, JPG, PNG, WEBP, DOC or DOCX.",
      );

      event.target.value = "";
      return;
    }

    if (
      file.size >
      MAX_ATTACHMENT_SIZE_BYTES
    ) {
      setAttachment(undefined);
      setAttachmentError(
        "The attachment must not exceed 5 MB.",
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

  const validateForm =
    (): string | null => {
      if (!selectedLeaveTypeId) {
        return "Select a leave type.";
      }

      if (
        dateValidationError !== "NONE"
      ) {
        return getDateValidationMessage(
          dateValidationError,
        );
      }

      if (workingDays <= 0) {
        return "The selected period does not contain any working days.";
      }

      if (
        selectedLeaveType &&
        workingDays >
          selectedLeaveType.remainingDays
      ) {
        return `You only have ${selectedLeaveType.remainingDays} ${selectedLeaveType.remainingDays === 1 ? "day" : "days"} remaining for ${selectedLeaveType.name}.`;
      }

      if (
        selectedLeaveType
          ?.requiresAttachment &&
        !attachment
      ) {
        return (
          selectedLeaveType.attachmentLabel ||
          "An attachment is required for this leave type."
        );
      }

      if (!reason.trim()) {
        return "Please provide a reason for your leave request.";
      }

      if (
        reason.trim().length < 5
      ) {
        return "Please provide a little more detail in the reason for your request.";
      }

      if (
        reason.trim().length > 2000
      ) {
        return "The leave reason cannot exceed 2,000 characters.";
      }

      if (attachmentError) {
        return attachmentError;
      }

      return null;
    };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setFormError("");
    setFormSuccess("");

    const validationError =
      validateForm();

    if (validationError) {
      setFormError(
        validationError,
      );
      return;
    }

    const request: SubmitLeaveRequest =
      {
        leaveTypeId:
          selectedLeaveTypeId,
        startDate,
        endDate,
        totalDays: workingDays,
        reason: reason.trim(),
        attachment,
      };

    setIsSubmitting(true);

    try {
      if (onSubmitLeave) {
        await onSubmitLeave(
          request,
        );
      } else {
        /*
         * The API integration point intentionally remains
         * optional until the backend endpoint is connected.
         * No fake request is persisted locally.
         */
      }

      setFormSuccess(
        "Your leave request has been submitted successfully.",
      );

      resetForm();

      setTimeout(() => {
        setIsFormOpen(false);
        setFormSuccess("");
      }, 900);
    } catch (submissionError) {
      setFormError(
        submissionError instanceof Error
          ? submissionError.message
          : "We could not submit your leave request. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRequest =
    async (
      requestId: string,
    ) => {
      if (!onCancelLeave) {
        return;
      }

      setCancellingRequestId(
        requestId,
      );

      try {
        await onCancelLeave(
          requestId,
        );
      } catch {
        /*
         * The parent/API layer owns the error
         * presentation for cancellation.
         */
      } finally {
        setCancellingRequestId(
          null,
        );
      }
    };

  /* ==========================================================
     Loading state
  ========================================================== */

  if (isLoading) {
    return (
      <div className="space-y-6 pb-8">
        <div className="rounded-2xl bg-[#071a35] p-5 sm:p-7">
          <LoadingBlock className="h-4 w-32 bg-white/10" />
          <LoadingBlock className="mt-3 h-8 w-72 max-w-full bg-white/10" />
          <LoadingBlock className="mt-2 h-4 w-96 max-w-full bg-white/10" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({
            length: 4,
          }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <LoadingBlock className="h-3 w-24" />
              <LoadingBlock className="mt-4 h-8 w-20" />
              <LoadingBlock className="mt-2 h-3 w-32" />
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <LoadingBlock className="h-5 w-44" />
          <LoadingBlock className="mt-6 h-12 w-full" />
          <LoadingBlock className="mt-3 h-12 w-full" />
          <LoadingBlock className="mt-3 h-12 w-full" />
        </div>
      </div>
    );
  }

  /* ==========================================================
     Error state
  ========================================================== */

  if (error) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center py-10">
        <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertCircle
              size={23}
              strokeWidth={1.9}
              aria-hidden="true"
            />
          </div>

          <h1 className="mt-4 text-lg font-bold text-slate-900">
            We couldn't load your
            leave information
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {error}
          </p>

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#d8a415] px-5 text-sm font-semibold text-white transition hover:bg-[#bf920f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2"
            >
              <RefreshCw
                size={15}
                aria-hidden="true"
              />
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ==========================================================
     Dashboard
  ========================================================== */

  return (
    <div className="space-y-6 pb-8">
      {/* ========================================================
          Header
      ========================================================= */}

      <section className="relative overflow-hidden rounded-2xl bg-[#071a35] text-white shadow-sm">
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#d8a415]/10 blur-3xl"
          aria-hidden="true"
        />

        <div
          className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-white/5 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
              Leave Management
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Manage your leave
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Submit new leave requests,
              monitor approvals and keep
              track of your available
              leave balance.
            </p>

            {user && (
              <p className="mt-2 text-xs font-medium text-slate-400">
                {user.firstName}{" "}
                {user.lastName}
                {user.departmentName
                  ? ` • ${user.departmentName}`
                  : ""}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={openForm}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#d8a415] px-5 text-sm font-bold text-white shadow-lg transition hover:bg-[#bf920f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8a415] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071a35]"
          >
            <Plus
              size={18}
              strokeWidth={2.2}
              aria-hidden="true"
            />
            Apply for Leave
          </button>
        </div>
      </section>

      {/* ========================================================
          Summary
      ========================================================= */}

      <section aria-label="Leave summary">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Leave Remaining"
            value={`${totalRemainingDays} days`}
            description="Across active leave types"
            icon={CalendarDays}
            iconClassName="bg-emerald-50 text-emerald-600"
          />

          <SummaryCard
            label="Pending"
            value={String(pendingCount)}
            description="Awaiting approval"
            icon={Clock3}
            iconClassName="bg-amber-50 text-amber-600"
          />

          <SummaryCard
            label="Approved"
            value={String(approvedCount)}
            description="Approved requests"
            icon={CheckCircle2}
            iconClassName="bg-blue-50 text-blue-600"
          />

          <SummaryCard
            label="Rejected"
            value={String(rejectedCount)}
            description="Rejected requests"
            icon={XCircle}
            iconClassName="bg-red-50 text-red-600"
          />
        </div>
      </section>

      {/* ========================================================
          Leave Balances
      ========================================================= */}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <SectionHeader
            title="Your Leave Balance"
            description="Current entitlement, usage and remaining days."
          />
        </div>

        {activeLeaveTypes.length ===
        0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No leave balances available"
            description="Your leave balances will appear here once your HR records have been synchronized."
          />
        ) : (
          <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
            {activeLeaveTypes.map(
              (leaveType) => {
                const entitlement =
                  Math.max(
                    leaveType.entitledDays,
                    0,
                  );

                const used =
                  Math.max(
                    leaveType.usedDays,
                    0,
                  );

                const remaining =
                  Math.max(
                    leaveType.remainingDays,
                    0,
                  );

                const usagePercentage =
                  entitlement > 0
                    ? Math.min(
                        Math.round(
                          (used /
                            entitlement) *
                            100,
                        ),
                        100,
                      )
                    : 0;

                return (
                  <div
                    key={leaveType.id}
                    className="p-5 sm:p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">
                          {leaveType.name}
                        </p>

                        {leaveType.description && (
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                            {
                              leaveType.description
                            }
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-xl font-bold text-slate-900">
                          {remaining}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          remaining
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        {used} used
                      </span>

                      <span className="font-semibold text-slate-700">
                        {entitlement} total
                      </span>
                    </div>

                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#d8a415] transition-all"
                        style={{
                          width: `${usagePercentage}%`,
                        }}
                        aria-label={`${usagePercentage}% of ${leaveType.name} entitlement used`}
                      />
                    </div>
                  </div>
                );
              },
            )}
          </div>
        )}
      </section>

      {/* ========================================================
          Capacity Warning
      ========================================================= */}

      {dashboardData.capacityWarning
        ?.exceedsCapacity && (
        <section
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Info
                size={18}
                strokeWidth={1.9}
                aria-hidden="true"
              />
            </div>

            <div className="min-w-0">
              <h2 className="text-sm font-bold text-amber-900">
                Leave capacity warning
              </h2>

              <p className="mt-1 text-sm leading-6 text-amber-800">
                {dashboardData
                  .capacityWarning
                  .message ||
                  `There are currently ${dashboardData.capacityWarning.currentApprovedCount} approved employees from ${dashboardData.capacityWarning.departmentName || "your department"} during the affected period. The configured capacity is ${dashboardData.capacityWarning.configuredCapacity}. Your request may require additional approval.`}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================
          Requests
      ========================================================= */}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <SectionHeader
            title="Leave Requests"
            description="Review the status and details of your submitted requests."
          />

          {/* Filters */}
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px_190px]">
            <label className="relative block">
              <span className="sr-only">
                Search leave requests
              </span>

              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />

              <input
                type="search"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value,
                  )
                }
                placeholder="Search reference, type or reason..."
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#c89b20] focus:ring-2 focus:ring-[#d8a415]/15"
              />
            </label>

            <label className="relative block">
              <span className="sr-only">
                Filter by status
              </span>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target
                      .value as
                      | LeaveRequestStatus
                      | "ALL",
                  )
                }
                className="min-h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-700 outline-none transition focus:border-[#c89b20] focus:ring-2 focus:ring-[#d8a415]/15"
              >
                <option value="ALL">
                  All statuses
                </option>
                <option value="PENDING">
                  Pending
                </option>
                <option value="APPROVED">
                  Approved
                </option>
                <option value="REJECTED">
                  Rejected
                </option>
                <option value="CANCELLED">
                  Cancelled
                </option>
              </select>

              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
            </label>

            <label className="relative block">
              <span className="sr-only">
                Filter by leave type
              </span>

              <select
                value={leaveTypeFilter}
                onChange={(event) =>
                  setLeaveTypeFilter(
                    event.target.value,
                  )
                }
                className="min-h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-700 outline-none transition focus:border-[#c89b20] focus:ring-2 focus:ring-[#d8a415]/15"
              >
                <option value="ALL">
                  All leave types
                </option>

                {activeLeaveTypes.map(
                  (leaveType) => (
                    <option
                      key={leaveType.id}
                      value={leaveType.id}
                    >
                      {leaveType.name}
                    </option>
                  ),
                )}
              </select>

              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
            </label>
          </div>
        </div>

        {filteredRequests.length ===
        0 ? (
          <EmptyState
            icon={FileText}
            title={
              dashboardData.requests
                .length === 0
                ? "No leave requests yet"
                : "No matching requests"
            }
            description={
              dashboardData.requests
                .length === 0
                ? "Your submitted leave requests will appear here."
                : "Try changing your search or filters."
            }
            action={
              dashboardData.requests
                .length === 0 ? (
                <button
                  type="button"
                  onClick={openForm}
                  className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-[#d8a415] px-3.5 text-xs font-semibold text-white transition hover:bg-[#bf920f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2"
                >
                  <Plus
                    size={14}
                    aria-hidden="true"
                  />
                  Apply for leave
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-left">
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Request
                    </th>

                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Dates
                    </th>

                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Days
                    </th>

                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Submitted
                    </th>

                    <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredRequests.map(
                    (request) => (
                      <tr
                        key={request.id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">
                              {
                                request.leaveTypeName
                              }
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {
                                request.referenceNumber
                              }
                            </p>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {formatDate(
                            request.startDate,
                          )}{" "}
                          –{" "}
                          {formatDate(
                            request.endDate,
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold text-slate-800">
                          {request.totalDays}{" "}
                          {request.totalDays ===
                          1
                            ? "day"
                            : "days"}
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge
                            status={
                              request.status
                            }
                          />
                        </td>

                        <td className="px-5 py-4 text-xs text-slate-500">
                          {formatSubmittedAt(
                            request.submittedAt,
                          )}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRequestId(
                                (
                                  current,
                                ) =>
                                  current ===
                                  request.id
                                    ? null
                                    : request.id,
                              )
                            }
                            className="text-xs font-semibold text-[#a47700] hover:text-[#7f5b00] focus:outline-none focus-visible:underline"
                          >
                            {expandedRequestId ===
                            request.id
                              ? "Hide details"
                              : "View details"}
                          </button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile/tablet cards */}
            <div className="divide-y divide-slate-100 lg:hidden">
              {filteredRequests.map(
                (request) => {
                  const expanded =
                    expandedRequestId ===
                    request.id;

                  return (
                    <div
                      key={request.id}
                      className="p-5 sm:p-6"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedRequestId(
                            expanded
                              ? null
                              : request.id,
                          )
                        }
                        className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2"
                        aria-expanded={
                          expanded
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">
                              {
                                request.leaveTypeName
                              }
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {
                                request.referenceNumber
                              }
                            </p>
                          </div>

                          <StatusBadge
                            status={
                              request.status
                            }
                          />
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              Dates
                            </p>

                            <p className="mt-1 text-xs font-medium text-slate-700">
                              {formatDate(
                                request.startDate,
                              )}
                              <br />
                              {formatDate(
                                request.endDate,
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              Duration
                            </p>

                            <p className="mt-1 text-xs font-semibold text-slate-700">
                              {
                                request.totalDays
                              }{" "}
                              {request.totalDays ===
                              1
                                ? "day"
                                : "days"}
                            </p>
                          </div>
                        </div>
                      </button>

                      {expanded && (
                        <div className="mt-4 rounded-xl bg-slate-50 p-4">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              Reason
                            </p>

                            <p className="mt-1 text-sm leading-6 text-slate-700">
                              {
                                request.reason
                              }
                            </p>
                          </div>

                          <div className="mt-4">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              Submitted
                            </p>

                            <p className="mt-1 text-xs text-slate-600">
                              {formatSubmittedAt(
                                request.submittedAt,
                              )}
                            </p>
                          </div>

                          {request.attachmentName && (
                            <div className="mt-4 flex items-center gap-2 text-xs text-slate-600">
                              <Paperclip
                                size={14}
                                aria-hidden="true"
                              />
                              {
                                request.attachmentName
                              }
                            </div>
                          )}

                          {request.rejectionReason && (
                            <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                              <span className="font-semibold">
                                Rejection reason:
                              </span>{" "}
                              {
                                request.rejectionReason
                              }
                            </div>
                          )}

                          {request.managerComment && (
                            <div className="mt-4">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Manager comment
                              </p>

                              <p className="mt-1 text-xs leading-5 text-slate-600">
                                {
                                  request.managerComment
                                }
                              </p>
                            </div>
                          )}

                          {request.hrComment && (
                            <div className="mt-4">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                HR comment
                              </p>

                              <p className="mt-1 text-xs leading-5 text-slate-600">
                                {
                                  request.hrComment
                                }
                              </p>
                            </div>
                          )}

                          {request.status ===
                            "PENDING" &&
                            onCancelLeave && (
                              <button
                                type="button"
                                disabled={
                                  cancellingRequestId ===
                                  request.id
                                }
                                onClick={() =>
                                  void handleCancelRequest(
                                    request.id,
                                  )
                                }
                                className="mt-4 inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {cancellingRequestId ===
                                request.id ? (
                                  <>
                                    <RefreshCw
                                      size={14}
                                      className="animate-spin"
                                      aria-hidden="true"
                                    />
                                    Cancelling...
                                  </>
                                ) : (
                                  <>
                                    <X
                                      size={14}
                                      aria-hidden="true"
                                    />
                                    Cancel request
                                  </>
                                )}
                              </button>
                            )}
                        </div>
                      )}
                    </div>
                  );
                },
              )}
            </div>
          </>
        )}
      </section>

      {/* ========================================================
          Apply Leave Modal
      ========================================================= */}

      {isFormOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="apply-leave-title"
        >
          <div className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-[92vh] sm:rounded-2xl">
            {/* Modal header */}
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#a47700]">
                  New request
                </p>

                <h2
                  id="apply-leave-title"
                  className="mt-1 text-lg font-bold tracking-tight text-slate-900 sm:text-xl"
                >
                  Apply for Leave
                </h2>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Complete the details below.
                  Your request will follow
                  the configured approval
                  workflow.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={isSubmitting}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close leave application"
              >
                <X
                  size={20}
                  aria-hidden="true"
                />
              </button>
            </div>

            {/* Modal body */}
            <form
              onSubmit={handleSubmit}
              className="min-h-0 flex-1 overflow-y-auto"
            >
              <div className="space-y-5 p-5 sm:p-6">
                {formError && (
                  <div
                    className="rounded-xl border border-red-200 bg-red-50 p-3.5"
                    role="alert"
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertCircle
                        size={17}
                        className="mt-0.5 shrink-0 text-red-600"
                        aria-hidden="true"
                      />

                      <p className="text-sm leading-5 text-red-700">
                        {formError}
                      </p>
                    </div>
                  </div>
                )}

                {formSuccess && (
                  <div
                    className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5"
                    role="status"
                  >
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2
                        size={17}
                        className="mt-0.5 shrink-0 text-emerald-600"
                        aria-hidden="true"
                      />

                      <p className="text-sm leading-5 text-emerald-700">
                        {formSuccess}
                      </p>
                    </div>
                  </div>
                )}

                {/* Leave type */}
                <div>
                  <label
                    htmlFor="leave-type"
                    className="block text-sm font-semibold text-slate-800"
                  >
                    Leave Type{" "}
                    <span className="text-red-500">
                      *
                    </span>
                  </label>

                  <div className="relative mt-2">
                    <select
                      id="leave-type"
                      value={
                        selectedLeaveTypeId
                      }
                      onChange={(event) => {
                        setSelectedLeaveTypeId(
                          event.target
                            .value,
                        );
                        setFormError("");
                      }}
                      disabled={
                        isSubmitting
                      }
                      className="min-h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm text-slate-800 outline-none transition focus:border-[#c89b20] focus:ring-2 focus:ring-[#d8a415]/15 disabled:bg-slate-50"
                    >
                      <option value="">
                        Select leave type
                      </option>

                      {activeLeaveTypes.map(
                        (leaveType) => (
                          <option
                            key={
                              leaveType.id
                            }
                            value={
                              leaveType.id
                            }
                          >
                            {
                              leaveType.name
                            }{" "}
                            —{" "}
                            {
                              leaveType.remainingDays
                            }{" "}
                            days remaining
                          </option>
                        ),
                      )}
                    </select>

                    <ChevronDown
                      size={17}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                  </div>

                  {selectedLeaveType && (
                    <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">
                        {
                          selectedLeaveType.remainingDays
                        }{" "}
                        {selectedLeaveType.remainingDays ===
                        1
                          ? "day"
                          : "days"}{" "}
                        remaining
                      </span>
                      {" • "}
                      {
                        selectedLeaveType.usedDays
                      }{" "}
                      used of{" "}
                      {
                        selectedLeaveType.entitledDays
                      }{" "}
                      entitled
                    </div>
                  )}
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="leave-start-date"
                      className="block text-sm font-semibold text-slate-800"
                    >
                      Start Date{" "}
                      <span className="text-red-500">
                        *
                      </span>
                    </label>

                    <input
                      id="leave-start-date"
                      type="date"
                      min={getTodayDate()}
                      value={startDate}
                      onChange={(event) => {
                        setStartDate(
                          event.target
                            .value,
                        );
                        setFormError("");
                      }}
                      disabled={
                        isSubmitting
                      }
                      className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#c89b20] focus:ring-2 focus:ring-[#d8a415]/15 disabled:bg-slate-50"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="leave-end-date"
                      className="block text-sm font-semibold text-slate-800"
                    >
                      End Date{" "}
                      <span className="text-red-500">
                        *
                      </span>
                    </label>

                    <input
                      id="leave-end-date"
                      type="date"
                      min={
                        startDate ||
                        getTodayDate()
                      }
                      value={endDate}
                      onChange={(event) => {
                        setEndDate(
                          event.target
                            .value,
                        );
                        setFormError("");
                      }}
                      disabled={
                        isSubmitting
                      }
                      className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#c89b20] focus:ring-2 focus:ring-[#d8a415]/15 disabled:bg-slate-50"
                    />
                  </div>
                </div>

                {/* Duration */}
                {dateValidationError ===
                  "NONE" && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <DurationCard
                      label="Working days"
                      value={String(
                        workingDays,
                      )}
                    />

                    <DurationCard
                      label="Calendar days"
                      value={String(
                        calendarDays,
                      )}
                    />

                    <DurationCard
                      label="Remaining after request"
                      value={
                        selectedLeaveType
                          ? String(
                              Math.max(
                                selectedLeaveType.remainingDays -
                                  workingDays,
                                0,
                              ),
                            )
                          : "—"
                      }
                    />
                  </div>
                )}

                {/* Reason */}
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor="leave-reason"
                      className="block text-sm font-semibold text-slate-800"
                    >
                      Reason{" "}
                      <span className="text-red-500">
                        *
                      </span>
                    </label>

                    <span className="text-[11px] text-slate-400">
                      {reason.length}/2000
                    </span>
                  </div>

                  <textarea
                    id="leave-reason"
                    value={reason}
                    onChange={(event) => {
                      setReason(
                        event.target.value,
                      );
                      setFormError("");
                    }}
                    maxLength={2000}
                    rows={5}
                    disabled={
                      isSubmitting
                    }
                    placeholder="Provide a clear reason for your leave request..."
                    className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#c89b20] focus:ring-2 focus:ring-[#d8a415]/15 disabled:bg-slate-50"
                  />
                </div>

                {/* Attachment */}
                <div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <label
                      htmlFor="leave-attachment"
                      className="block text-sm font-semibold text-slate-800"
                    >
                      Supporting Attachment
                      {selectedLeaveType
                        ?.requiresAttachment && (
                        <span className="text-red-500">
                          {" "}
                          *
                        </span>
                      )}
                    </label>

                    <span className="text-[11px] text-slate-400">
                      PDF, JPG, PNG, WEBP, DOC or DOCX • Max 5 MB
                    </span>
                  </div>

                  <div className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                    {!attachment ? (
                      <label
                        htmlFor="leave-attachment"
                        className="flex cursor-pointer flex-col items-center justify-center rounded-lg px-4 py-6 text-center transition hover:bg-white"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
                          <Paperclip
                            size={18}
                            aria-hidden="true"
                          />
                        </div>

                        <p className="mt-3 text-sm font-semibold text-slate-700">
                          Attach supporting document
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Click to browse files from your device.
                        </p>
                      </label>
                    ) : (
                      <div className="flex items-center justify-between gap-3 rounded-lg bg-white p-3 shadow-sm">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                            <Paperclip
                              size={17}
                              aria-hidden="true"
                            />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">
                              {
                                attachment.name
                              }
                            </p>

                            <p className="mt-0.5 text-xs text-slate-400">
                              {formatFileSize(
                                attachment.size,
                              )}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={
                            removeAttachment
                          }
                          disabled={
                            isSubmitting
                          }
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Remove attachment"
                        >
                          <X
                            size={16}
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    id="leave-attachment"
                    type="file"
                    accept={
                      ACCEPTED_ATTACHMENT_EXTENSIONS
                    }
                    onChange={
                      handleAttachmentChange
                    }
                    disabled={
                      isSubmitting
                    }
                    className="sr-only"
                  />

                  {attachmentError && (
                    <p
                      className="mt-2 text-xs font-medium text-red-600"
                      role="alert"
                    >
                      {attachmentError}
                    </p>
                  )}
                </div>

                {/* Capacity notice */}
                {dashboardData.capacityWarning
                  ?.exceedsCapacity && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                    <div className="flex items-start gap-2.5">
                      <Info
                        size={16}
                        className="mt-0.5 shrink-0 text-amber-700"
                        aria-hidden="true"
                      />

                      <p className="text-xs leading-5 text-amber-800">
                        {dashboardData
                          .capacityWarning
                          .message ||
                          "Your selected dates may exceed the configured departmental leave capacity. Your request can still be submitted, but additional approval may be required."}
                      </p>
                    </div>
                  </div>
                )}

                {/* Form actions */}
                <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeForm}
                    disabled={
                      isSubmitting
                    }
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      activeLeaveTypes.length ===
                        0
                    }
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#d8a415] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#bf920f] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw
                          size={16}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <PlaneTakeoff
                          size={17}
                          aria-hidden="true"
                        />
                        Submit Leave Request
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Supporting Components
============================================================ */

interface SummaryCardProps {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
}

function SummaryCard({
  label,
  value,
  description,
  icon: Icon,
  iconClassName,
}: SummaryCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>

          <p className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            {description}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
        >
          <Icon
            size={19}
            strokeWidth={1.9}
            aria-hidden="true"
          />
        </div>
      </div>
    </article>
  );
}

interface DurationCardProps {
  label: string;
  value: string;
}

function DurationCard({
  label,
  value,
}: DurationCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-lg font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}