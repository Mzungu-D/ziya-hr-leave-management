
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { FormEvent } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleUserRound,
  Clock3,
  FileSearch,
  Filter,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

import { auditLogService } from "../../services/audit-log.service";

import type {
  AuditLog,
  AuditLogFilters,
} from "../../services/audit-log.service";

const PAGE_SIZE = 25;

const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "CREATE", label: "Create" },
  { value: "UPDATE", label: "Update" },
  { value: "DELETE", label: "Delete" },
  { value: "LOGIN", label: "Login" },
  { value: "LOGOUT", label: "Logout" },
  { value: "APPROVE", label: "Approve" },
  { value: "REJECT", label: "Reject" },
  { value: "EXPORT", label: "Export" },
] as const;

const ENTITY_OPTIONS = [
  { value: "", label: "All entity types" },
  { value: "Employee", label: "Employee" },
  { value: "LeaveRequest", label: "Leave request" },
  { value: "LeaveType", label: "Leave type" },
  { value: "Department", label: "Department" },
  { value: "Organization", label: "Organization" },
  { value: "User", label: "User" },
  { value: "SystemSetting", label: "System setting" },
] as const;

const INPUT_CLASS =
  "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-50";

const PRIMARY_BUTTON_CLASS =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50";

const SECONDARY_BUTTON_CLASS =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50";

interface FilterDraft {
  action: string;
  entityType: string;
  actorId: string;
}

interface AuditLogFiltersState {
  search: string;
  action: string;
  entityType: string;
  actorId: string;
}

interface AuditLogRequestState {
  page: number;
  filters: AuditLogFilters;
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "We could not load the audit logs. Please try again.";
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Nairobi",
  }).format(date);
}

function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "Unknown time";
  }

  const difference = timestamp - Date.now();
  const absoluteDifference = Math.abs(difference);
  const minutes = Math.round(absoluteDifference / 60_000);
  const hours = Math.round(absoluteDifference / 3_600_000);
  const days = Math.round(absoluteDifference / 86_400_000);

  const formatter = new Intl.RelativeTimeFormat("en", {
    numeric: "auto",
  });

  if (minutes < 1) {
    return formatter.format(0, "minute");
  }

  if (minutes < 60) {
    return formatter.format(
      Math.sign(difference) * minutes,
      "minute",
    );
  }

  if (hours < 24) {
    return formatter.format(
      Math.sign(difference) * hours,
      "hour",
    );
  }

  return formatter.format(
    Math.sign(difference) * days,
    "day",
  );
}

function formatAction(action: string): string {
  return action
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatEntityType(entityType: string): string {
  return entityType
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getActorName(entry: AuditLog): string {
  const name = [
    entry.actorFirstName,
    entry.actorLastName,
  ]
    .filter(
      (part): part is string =>
        typeof part === "string" && part.trim().length > 0,
    )
    .join(" ")
    .trim();

  return name || entry.actorEmail || "System / unknown actor";
}

function getInitials(entry: AuditLog): string {
  const name = getActorName(entry);

  if (name === "System / unknown actor") {
    return "SY";
  }

  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function getActionStyle(action: string): string {
  const normalized = action.toUpperCase();

  if (
    normalized.includes("DELETE") ||
    normalized.includes("REJECT") ||
    normalized.includes("FAIL")
  ) {
    return "border-red-100 bg-red-50 text-red-700";
  }

  if (
    normalized.includes("APPROVE") ||
    normalized.includes("CREATE") ||
    normalized.includes("SUCCESS")
  ) {
    return "border-emerald-100 bg-emerald-50 text-emerald-700";
  }

  if (
    normalized.includes("LOGIN") ||
    normalized.includes("LOGOUT") ||
    normalized.includes("AUTH")
  ) {
    return "border-violet-100 bg-violet-50 text-violet-700";
  }

  if (
    normalized.includes("UPDATE") ||
    normalized.includes("EDIT")
  ) {
    return "border-amber-100 bg-amber-50 text-amber-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function hasActiveFilters(
  filters: AuditLogFiltersState,
): boolean {
  return Boolean(
    filters.search.trim() ||
      filters.action ||
      filters.entityType ||
      filters.actorId.trim(),
  );
}

function matchesSearch(
  entry: AuditLog,
  search: string,
): boolean {
  if (!search.trim()) {
    return true;
  }

  const normalizedSearch = search.trim().toLowerCase();

  const searchableValues = [
    entry.action,
    entry.entityType,
    entry.entityId,
    entry.summary,
    entry.actorFirstName,
    entry.actorLastName,
    entry.actorEmail,
    entry.ipAddress,
  ];

  return searchableValues.some(
    (value) =>
      typeof value === "string" &&
      value.toLowerCase().includes(normalizedSearch),
  );
}

function safeMetadataString(
  metadata: Record<string, unknown>,
): string {
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return "Metadata could not be displayed.";
  }
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="rounded-2xl border border-red-200 bg-red-50 p-5 sm:p-6"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-red-100 p-2 text-red-700">
          <AlertCircle size={20} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-red-900">
            Unable to load audit logs
          </h2>

          <p className="mt-1 break-words text-sm leading-6 text-red-800">
            {message}
          </p>

          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 bg-white px-3.5 text-sm font-semibold text-red-800 transition hover:bg-red-100 focus:outline-none focus:ring-4 focus:ring-red-500/15"
          >
            <RefreshCw size={15} aria-hidden="true" />
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  filtered,
  onClear,
}: {
  filtered: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-16 text-center sm:py-20">
      <div className="rounded-2xl bg-slate-100 p-4 text-slate-500">
        {filtered ? (
          <FileSearch size={30} aria-hidden="true" />
        ) : (
          <Activity size={30} aria-hidden="true" />
        )}
      </div>

      <h3 className="mt-5 text-base font-semibold text-slate-900">
        {filtered
          ? "No matching audit events"
          : "No audit events yet"}
      </h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        {filtered
          ? "Try changing your search or filters to find the activity you need."
          : "When recorded system activity is available, it will appear here."}
      </p>

      {filtered && (
        <button
          type="button"
          onClick={onClear}
          className={`${SECONDARY_BUTTON_CLASS} mt-5`}
        >
          <X size={15} aria-hidden="true" />
          Clear filters
        </button>
      )}
    </div>
  );
}

function AuditLogDetails({
  entry,
}: {
  entry: AuditLog;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        className="inline-flex min-h-9 items-center gap-2 rounded-lg text-xs font-semibold text-blue-700 transition hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        {expanded ? (
          <ArrowUp size={14} aria-hidden="true" />
        ) : (
          <ArrowDown size={14} aria-hidden="true" />
        )}
        {expanded ? "Hide event details" : "View event details"}
      </button>

      {expanded && (
        <div className="mt-3 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs font-medium text-slate-500">
                Event ID
              </dt>
              <dd className="mt-1 break-all font-mono text-xs text-slate-800">
                {entry.id}
              </dd>
            </div>

            <div className="min-w-0">
              <dt className="text-xs font-medium text-slate-500">
                Actor ID
              </dt>
              <dd className="mt-1 break-all font-mono text-xs text-slate-800">
                {entry.actorId || "Not recorded"}
              </dd>
            </div>

            <div className="min-w-0">
              <dt className="text-xs font-medium text-slate-500">
                Entity ID
              </dt>
              <dd className="mt-1 break-all font-mono text-xs text-slate-800">
                {entry.entityId || "Not recorded"}
              </dd>
            </div>

            <div className="min-w-0">
              <dt className="text-xs font-medium text-slate-500">
                IP address
              </dt>
              <dd className="mt-1 break-all text-xs text-slate-800">
                {entry.ipAddress || "Not recorded"}
              </dd>
            </div>

            <div className="min-w-0 sm:col-span-2">
              <dt className="text-xs font-medium text-slate-500">
                User agent
              </dt>
              <dd className="mt-1 break-all text-xs leading-5 text-slate-800">
                {entry.userAgent || "Not recorded"}
              </dd>
            </div>
          </dl>

          <div>
            <h4 className="text-xs font-semibold text-slate-700">
              Event metadata
            </h4>

            {entry.metadata ? (
              <pre className="mt-2 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs leading-5 text-slate-700">
                {safeMetadataString(entry.metadata)}
              </pre>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                No additional metadata was recorded for this event.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AuditLogRow({
  entry,
}: {
  entry: AuditLog;
}) {
  const actorName = getActorName(entry);

  return (
    <tr className="align-top transition hover:bg-slate-50/80">
      <td className="min-w-64 px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-600">
            {getInitials(entry)}
          </div>

          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-semibold text-slate-900">
              {actorName}
            </p>

            {entry.actorEmail && (
              <p className="mt-1 break-all text-xs text-slate-500">
                {entry.actorEmail}
              </p>
            )}

            <AuditLogDetails entry={entry} />
          </div>
        </div>
      </td>

      <td className="min-w-36 px-4 py-4 sm:px-5">
        <span
          className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getActionStyle(entry.action)}`}
        >
          {formatAction(entry.action)}
        </span>

        <p className="mt-2 break-words text-xs text-slate-500">
          {formatEntityType(entry.entityType)}
          {entry.entityId ? ` · ${entry.entityId}` : ""}
        </p>
      </td>

      <td className="min-w-64 max-w-md px-4 py-4 sm:px-5">
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
          {entry.summary}
        </p>
      </td>

      <td className="min-w-48 px-4 py-4 sm:px-5">
        <time
          dateTime={entry.createdAt}
          title={formatDateTime(entry.createdAt)}
          className="block whitespace-nowrap text-sm font-medium text-slate-800"
        >
          {formatDateTime(entry.createdAt)}
        </time>

        <span className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <Clock3 size={12} aria-hidden="true" />
          {formatRelativeTime(entry.createdAt)}
        </span>
      </td>
    </tr>
  );
}

export default function AuditLogs() {
  const [entries, setEntries] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 0,
    hasMore: false,
  });

  const [draft, setDraft] = useState<FilterDraft>({
    action: "",
    entityType: "",
    actorId: "",
  });

  const [filters, setFilters] = useState<AuditLogFiltersState>({
    search: "",
    action: "",
    entityType: "",
    actorId: "",
  });

  const [request, setRequest] = useState<AuditLogRequestState>({
    page: 1,
    filters: {},
  });

  const [refreshKey, setRefreshKey] = useState(0);

  const loadAuditLogs = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      try {
        setError(null);

        const result = await auditLogService.listAuditLogs({
          page: request.page,
          pageSize: PAGE_SIZE,
          ...request.filters,
          signal,
        });

        if (signal.aborted) {
          return;
        }

        setEntries(result.data);
        setPagination(result.pagination);
      } catch (caughtError: unknown) {
        if (signal.aborted) {
          return;
        }

        setError(getErrorMessage(caughtError));
        setEntries([]);
      } finally {
        if (!signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [request],
  );

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    void loadAuditLogs(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadAuditLogs, refreshKey]);

  const visibleEntries = useMemo(
    () =>
      entries.filter((entry) =>
        matchesSearch(entry, filters.search),
      ),
    [entries, filters.search],
  );

  const filterActive = hasActiveFilters(filters);

  const firstResult =
    pagination.total === 0
      ? 0
      : (pagination.page - 1) * pagination.pageSize + 1;

  const lastResult = Math.min(
    pagination.page * pagination.pageSize,
    pagination.total,
  );

  const handleApplyFilters = (
    event: FormEvent<HTMLFormElement>,
  ): void => {
    event.preventDefault();

    const nextFilters: AuditLogFiltersState = {
      search: filters.search,
      action: draft.action,
      entityType: draft.entityType,
      actorId: draft.actorId.trim(),
    };

    const apiFilters: AuditLogFilters = {
      ...(nextFilters.action
        ? { action: nextFilters.action }
        : {}),
      ...(nextFilters.entityType
        ? { entityType: nextFilters.entityType }
        : {}),
      ...(nextFilters.actorId
        ? { actorId: nextFilters.actorId }
        : {}),
    };

    setFilters(nextFilters);
    setRequest({
      page: 1,
      filters: apiFilters,
    });
  };

  const handleClearFilters = (): void => {
    setDraft({
      action: "",
      entityType: "",
      actorId: "",
    });

    setFilters({
      search: "",
      action: "",
      entityType: "",
      actorId: "",
    });

    setRequest({
      page: 1,
      filters: {},
    });
  };

  const handleRefresh = (): void => {
    setRefreshing(true);
    setRefreshKey((current) => current + 1);
  };

  const handlePageChange = (nextPage: number): void => {
    const lastPage = Math.max(1, pagination.totalPages);

    if (
      !Number.isSafeInteger(nextPage) ||
      nextPage < 1 ||
      nextPage > lastPage ||
      nextPage === request.page
    ) {
      return;
    }

    setRequest((current) => ({
      ...current,
      page: nextPage,
    }));
  };

  const handleSearchChange = (value: string): void => {
    setFilters((current) => ({
      ...current,
      search: value,
    }));
  };

  const handleActorIdChange = (value: string): void => {
    setDraft((current) => ({
      ...current,
      actorId: value,
    }));
  };

  return (
    <main className="min-w-0 space-y-6 pb-8">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-16 size-56 rounded-full bg-blue-50/80 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100 sm:size-14">
              <ShieldCheck
                size={27}
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                  Audit Logs
                </h1>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Activity history
                </span>
              </div>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Review recorded system activity, identify who
                performed an action, and inspect the available
                event details.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className={SECONDARY_BUTTON_CLASS}
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
              aria-hidden="true"
            />
            Refresh logs
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Recorded events
              </p>

              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                {loading && pagination.total === 0
                  ? "—"
                  : pagination.total.toLocaleString("en-KE")}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Events available to your account
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
              <Activity size={22} aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Current page
              </p>

              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                {loading && pagination.total === 0
                  ? "—"
                  : `${pagination.page} / ${Math.max(1, pagination.totalPages)}`}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {pagination.pageSize} records per request
              </p>
            </div>

            <div className="rounded-xl bg-violet-50 p-3 text-violet-700">
              <CalendarDays size={22} aria-hidden="true" />
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-950">
                System activity
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Filter and inspect recorded audit events.
              </p>
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search
                size={17}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />

              <input
                type="search"
                value={filters.search}
                onChange={(event) =>
                  handleSearchChange(event.target.value)
                }
                placeholder="Search this page..."
                aria-label="Search audit events on this page"
                className={`${INPUT_CLASS} pl-10 pr-10`}
              />

              {filters.search && (
                <button
                  type="button"
                  onClick={() => handleSearchChange("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <form
            onSubmit={handleApplyFilters}
            className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4"
          >
            <div className="mb-3 flex items-center gap-2">
              <Filter
                size={16}
                className="text-slate-500"
                aria-hidden="true"
              />

              <h3 className="text-sm font-semibold text-slate-800">
                Filters
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <label
                  htmlFor="audit-action"
                  className="mb-1.5 block text-xs font-semibold text-slate-600"
                >
                  Action
                </label>

                <select
                  id="audit-action"
                  value={draft.action}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      action: event.target.value,
                    }))
                  }
                  className={INPUT_CLASS}
                >
                  {ACTION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="audit-entity"
                  className="mb-1.5 block text-xs font-semibold text-slate-600"
                >
                  Entity type
                </label>

                <select
                  id="audit-entity"
                  value={draft.entityType}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      entityType: event.target.value,
                    }))
                  }
                  className={INPUT_CLASS}
                >
                  {ENTITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="audit-actor"
                  className="mb-1.5 block text-xs font-semibold text-slate-600"
                >
                  Actor ID
                </label>

                <input
                  id="audit-actor"
                  type="text"
                  value={draft.actorId}
                  onChange={(event) =>
                    handleActorIdChange(event.target.value)
                  }
                  maxLength={100}
                  autoComplete="off"
                  placeholder="Filter by actor ID"
                  className={INPUT_CLASS}
                />
              </div>

              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className={`${PRIMARY_BUTTON_CLASS} flex-1`}
                >
                  <Filter size={15} aria-hidden="true" />
                  Apply filters
                </button>

                <button
                  type="button"
                  onClick={handleClearFilters}
                  disabled={loading && !filterActive}
                  aria-label="Clear all filters"
                  title="Clear all filters"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X size={17} aria-hidden="true" />
                </button>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Action, entity type, and actor ID filters are
              applied by the server. Search filters the records
              currently loaded on this page.
            </p>
          </form>
        </div>

        {error && !loading ? (
          <div className="p-5 sm:p-6">
            <ErrorState
              message={error}
              onRetry={handleRefresh}
            />
          </div>
        ) : loading && entries.length === 0 ? (
          <div
            className="flex min-h-72 flex-col items-center justify-center px-5 py-12 text-center"
            role="status"
            aria-live="polite"
          >
            <LoaderCircle
              size={30}
              className="animate-spin text-blue-700"
              aria-hidden="true"
            />

            <p className="mt-4 text-sm font-semibold text-slate-800">
              Loading audit logs
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Retrieving the activity available to your account.
            </p>
          </div>
        ) : visibleEntries.length === 0 ? (
          <EmptyState
            filtered={filterActive}
            onClear={handleClearFilters}
          />
        ) : (
          <>
            <div className="border-b border-slate-100 px-5 py-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  Showing{" "}
                  <span className="font-semibold text-slate-800">
                    {visibleEntries.length}
                  </span>{" "}
                  matching events on this page
                </p>

                {loading && (
                  <span className="inline-flex items-center gap-2 text-xs text-blue-700">
                    <LoaderCircle
                      size={13}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                    Updating results…
                  </span>
                )}
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse text-left">
                <caption className="sr-only">
                  Audit events with actor, action, summary, and
                  timestamp information.
                </caption>

                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th
                      scope="col"
                      className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 sm:px-5"
                    >
                      Actor
                    </th>

                    <th
                      scope="col"
                      className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 sm:px-5"
                    >
                      Action / entity
                    </th>

                    <th
                      scope="col"
                      className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 sm:px-5"
                    >
                      Event summary
                    </th>

                    <th
                      scope="col"
                      className="px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 sm:px-5"
                    >
                      Date and time
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {visibleEntries.map((entry) => (
                    <AuditLogRow
                      key={entry.id}
                      entry={entry}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-4 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-sm text-slate-500">
                {pagination.total > 0 ? (
                  <>
                    Showing{" "}
                    <span className="font-semibold text-slate-800">
                      {firstResult}–{lastResult}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-slate-800">
                      {pagination.total.toLocaleString("en-KE")}
                    </span>{" "}
                    events
                  </>
                ) : (
                  "No events to display"
                )}
              </p>

              <nav
                aria-label="Audit log pagination"
                className="flex flex-wrap items-center gap-1.5"
              >
                <button
                  type="button"
                  onClick={() => handlePageChange(1)}
                  disabled={loading || request.page <= 1}
                  aria-label="First page"
                  title="First page"
                  className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronsLeft size={16} aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handlePageChange(request.page - 1)
                  }
                  disabled={loading || request.page <= 1}
                  aria-label="Previous page"
                  title="Previous page"
                  className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>

                <span
                  className="min-w-24 px-2 text-center text-sm font-semibold tabular-nums text-slate-700"
                  aria-live="polite"
                >
                  Page {pagination.page} of{" "}
                  {Math.max(1, pagination.totalPages)}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    handlePageChange(request.page + 1)
                  }
                  disabled={
                    loading ||
                    !pagination.hasMore ||
                    request.page >= pagination.totalPages
                  }
                  aria-label="Next page"
                  title="Next page"
                  className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={16} aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handlePageChange(pagination.totalPages)
                  }
                  disabled={
                    loading ||
                    !pagination.hasMore ||
                    request.page >= pagination.totalPages
                  }
                  aria-label="Last page"
                  title="Last page"
                  className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronsRight size={16} aria-hidden="true" />
                </button>
              </nav>
            </div>
          </>
        )}
      </section>

      <section className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <div className="rounded-xl bg-white p-2 text-slate-600 shadow-sm">
          <CircleUserRound size={19} aria-hidden="true" />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-800">
            Audit data and access
          </h2>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            This page displays activity returned by the
            authenticated API. Access permissions, organization
            boundaries, and the records a user may view must be
            enforced by the backend. Audit events should be
            treated as sensitive operational records.
          </p>
        </div>
      </section>
    </main>
  );
}
