import { useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Eye,
  MoreHorizontal,
  XCircle,
} from "lucide-react";

export type LeaveRequestStatus =
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Cancelled";

export interface RecentLeaveRequest {
  id: string;
  employeeName: string;
  employeeRole?: string;
  employeeAvatarUrl?: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  submittedAt: string;
  status: LeaveRequestStatus;
}

interface RecentLeaveRequestsProps {
  requests?: RecentLeaveRequest[];
  loading?: boolean;
  title?: string;
  subtitle?: string;
  onViewAll?: () => void;
  onViewRequest?: (request: RecentLeaveRequest) => void;
}

const statusConfig: Record<
  LeaveRequestStatus,
  {
    label: string;
    className: string;
    icon: typeof Clock3;
  }
> = {
  Pending: {
    label: "Pending",
    className:
      "bg-amber-50 text-amber-700 ring-amber-600/10",
    icon: Clock3,
  },
  Approved: {
    label: "Approved",
    className:
      "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    icon: CheckCircle2,
  },
  Rejected: {
    label: "Rejected",
    className:
      "bg-red-50 text-red-700 ring-red-600/10",
    icon: XCircle,
  },
  Cancelled: {
    label: "Cancelled",
    className:
      "bg-slate-100 text-slate-600 ring-slate-500/10",
    icon: XCircle,
  },
};

function getInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "—";
}

function formatDays(days: number): string {
  const safeDays = Number.isFinite(days)
    ? Math.max(0, days)
    : 0;

  return `${safeDays} ${
    safeDays === 1 ? "day" : "days"
  }`;
}

function EmployeeAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string;
}) {
  const [imageFailed, setImageFailed] =
    useState(false);

  if (avatarUrl && !imageFailed) {
    return (
      <img
        src={avatarUrl}
        alt=""
        loading="lazy"
        onError={() => setImageFailed(true)}
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d8a415]/10 text-xs font-bold text-[#a77d00]"
      aria-hidden="true"
    >
      {getInitials(name)}
    </div>
  );
}

function RequestSkeleton() {
  return (
    <div
      className="animate-pulse space-y-4"
      role="status"
      aria-label="Loading recent leave requests"
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 p-3"
        >
          <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200" />

          <div className="min-w-0 flex-1">
            <div className="h-3.5 w-32 max-w-full rounded bg-slate-200" />
            <div className="mt-2 h-3 w-24 max-w-full rounded bg-slate-100" />
          </div>

          <div className="hidden h-6 w-20 shrink-0 rounded-full bg-slate-200 sm:block" />

          <div className="hidden h-3 w-20 shrink-0 rounded bg-slate-100 md:block" />
        </div>
      ))}

      <span className="sr-only">
        Loading recent leave requests
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[280px] items-center justify-center px-4 py-8">
      <div className="max-w-xs text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <Clock3
            size={22}
            className="text-slate-400"
            aria-hidden="true"
          />
        </div>

        <p className="mt-3 text-sm font-semibold text-slate-700">
          No recent leave requests
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-400">
          New employee leave requests will appear here
          automatically.
        </p>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: LeaveRequestStatus;
}) {
  const config =
    statusConfig[status] ?? statusConfig.Pending;

  const Icon = config.icon;

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${config.className}`}
    >
      <Icon
        size={12}
        strokeWidth={2.2}
        aria-hidden="true"
      />

      <span className="truncate">
        {config.label}
      </span>
    </span>
  );
}

export function RecentLeaveRequests({
  requests = [],
  loading = false,
  title = "Recent Leave Requests",
  subtitle = "Latest employee leave activity",
  onViewAll,
  onViewRequest,
}: RecentLeaveRequestsProps) {
  const safeRequests = Array.isArray(requests)
    ? requests.filter(
        (request) =>
          request &&
          typeof request.id === "string" &&
          request.id.trim().length > 0 &&
          typeof request.employeeName === "string" &&
          request.employeeName.trim().length > 0,
      )
    : [];

  return (
    <section
      className="min-w-0 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      aria-labelledby="recent-leave-requests-title"
    >
      <div className="flex min-w-0 flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <h2
            id="recent-leave-requests-title"
            className="truncate text-base font-bold text-slate-900 sm:text-lg"
          >
            {title}
          </h2>

          <p className="mt-0.5 truncate text-xs text-slate-500 sm:text-sm">
            {subtitle}
          </p>
        </div>

        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex w-fit shrink-0 items-center rounded-lg px-2.5 py-2 text-xs font-semibold text-[#a77d00] transition hover:bg-[#d8a415]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2"
          >
            View all
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-4 sm:p-5">
          <RequestSkeleton />
        </div>
      ) : safeRequests.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="hidden w-full overflow-x-auto md:block">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Employee
                  </th>

                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Leave Type
                  </th>

                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Duration
                  </th>

                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Submitted
                  </th>

                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Status
                  </th>

                  <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {safeRequests.map((request) => (
                  <tr
                    key={request.id}
                    className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
                  >
                    <td className="px-5 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <EmployeeAvatar
                          name={request.employeeName}
                          avatarUrl={
                            request.employeeAvatarUrl
                          }
                        />

                        <div className="min-w-0">
                          <p
                            title={request.employeeName}
                            className="max-w-[220px] truncate text-sm font-semibold text-slate-800"
                          >
                            {request.employeeName}
                          </p>

                          {request.employeeRole && (
                            <p
                              title={request.employeeRole}
                              className="mt-0.5 max-w-[220px] truncate text-xs text-slate-400"
                            >
                              {request.employeeRole}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <p
                        title={request.leaveType}
                        className="max-w-[160px] truncate text-sm font-medium text-slate-700"
                      >
                        {request.leaveType}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-400">
                        {request.id}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <p className="whitespace-nowrap text-sm font-medium text-slate-700">
                        {request.startDate}
                      </p>

                      <p className="mt-0.5 whitespace-nowrap text-xs text-slate-400">
                        to {request.endDate} ·{" "}
                        {formatDays(request.days)}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-500">
                      <span className="whitespace-nowrap">
                        {request.submittedAt}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge
                        status={request.status}
                      />
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          onViewRequest?.(request)
                        }
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2"
                        aria-label={`View ${request.employeeName}'s leave request`}
                        title="View request"
                      >
                        <Eye
                          size={17}
                          aria-hidden="true"
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 md:hidden">
            {safeRequests.map((request) => (
              <article
                key={request.id}
                className="min-w-0 p-4 transition hover:bg-slate-50/60"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <EmployeeAvatar
                    name={request.employeeName}
                    avatarUrl={
                      request.employeeAvatarUrl
                    }
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p
                          title={request.employeeName}
                          className="truncate text-sm font-semibold text-slate-800"
                        >
                          {request.employeeName}
                        </p>

                        {request.employeeRole && (
                          <p
                            title={request.employeeRole}
                            className="mt-0.5 truncate text-xs text-slate-400"
                          >
                            {request.employeeRole}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          onViewRequest?.(request)
                        }
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-1"
                        aria-label={`More actions for ${request.employeeName}`}
                      >
                        <MoreHorizontal
                          size={18}
                          aria-hidden="true"
                        />
                      </button>
                    </div>

                    <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
                      <StatusBadge
                        status={request.status}
                      />

                      <span className="truncate text-[11px] font-medium text-slate-400">
                        {request.id}
                      </span>
                    </div>

                    <div className="mt-3 rounded-xl bg-slate-50 p-3">
                      <div className="space-y-2">
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <span className="shrink-0 text-xs text-slate-400">
                            Leave type
                          </span>

                          <span
                            title={request.leaveType}
                            className="min-w-0 truncate text-right text-xs font-semibold text-slate-700"
                          >
                            {request.leaveType}
                          </span>
                        </div>

                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <span className="shrink-0 text-xs text-slate-400">
                            Dates
                          </span>

                          <span className="min-w-0 text-right text-xs font-semibold text-slate-700">
                            {request.startDate} –{" "}
                            {request.endDate}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="shrink-0 text-xs text-slate-400">
                            Duration
                          </span>

                          <span className="shrink-0 text-xs font-semibold text-slate-700">
                            {formatDays(request.days)}
                          </span>
                        </div>

                        <div className="flex min-w-0 items-center justify-between gap-3">
                          <span className="shrink-0 text-xs text-slate-400">
                            Submitted
                          </span>

                          <span className="min-w-0 truncate text-right text-xs font-medium text-slate-600">
                            {request.submittedAt}
                          </span>
                        </div>
                      </div>
                    </div>

                    {onViewRequest && (
                      <button
                        type="button"
                        onClick={() =>
                          onViewRequest(request)
                        }
                        className="mt-3 inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold text-[#a77d00] transition hover:text-[#8f6a00] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2"
                      >
                        <Eye
                          size={14}
                          aria-hidden="true"
                        />
                        View request
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}