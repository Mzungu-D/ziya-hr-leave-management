import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  listManagerPendingRequests,
} from "../../services/leave.service";
import type {
  LeaveRequest,
  LeaveServiceError,
} from "../../services/leave.service";

type LoadState = "loading" | "success" | "error";

function getEmployeeName(request: LeaveRequest): string {
  const employee = request.employee;

  if (!employee) {
    return "Employee details unavailable";
  }

  const fullName = employee.fullName?.trim();

  if (fullName) {
    return fullName;
  }

  const name = employee.name?.trim();

  if (name) {
    return name;
  }

  const combinedName = [
    employee.firstName,
    employee.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return combinedName || "Employee";
}

function getLeaveTypeName(request: LeaveRequest): string {
  return request.leaveType?.name?.trim() || "Leave request";
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateRange(request: LeaveRequest): string {
  return `${formatDate(request.startDate)} – ${formatDate(
    request.endDate,
  )}`;
}

function getRequestDays(request: LeaveRequest): number | null {
  const days = request.days ?? request.totalDays;

  return typeof days === "number" && Number.isFinite(days)
    ? days
    : null;
}

function getErrorMessage(error: unknown): string {
  const serviceError = error as Partial<LeaveServiceError> | null;

  if (
    serviceError &&
    typeof serviceError.message === "string" &&
    serviceError.message.trim()
  ) {
    return serviceError.message;
  }

  return "We could not load the manager dashboard. Please try again.";
}

function isPendingManagerRequest(request: LeaveRequest): boolean {
  return request.status === "PENDING_MANAGER";
}

function isPendingHrRequest(request: LeaveRequest): boolean {
  return request.status === "PENDING_HR";
}

function isApprovedRequest(request: LeaveRequest): boolean {
  return request.status === "APPROVED";
}

function isRejectedRequest(request: LeaveRequest): boolean {
  return request.status === "REJECTED";
}

function isUpcomingRequest(request: LeaveRequest): boolean {
  const start = new Date(request.startDate);
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  return (
    !Number.isNaN(start.getTime()) &&
    start >= today &&
    request.status === "APPROVED"
  );
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  iconClassName,
  to,
}: {
  title: string;
  value: number;
  description: string;
  icon: typeof Clock3;
  iconClassName: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
        </div>

        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
        >
          <Icon size={21} aria-hidden="true" />
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-xs leading-5 text-slate-500">
          {description}
        </span>

        <ArrowRight
          size={16}
          className="shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-700"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}

function RequestStatus({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING_MANAGER: "bg-amber-50 text-amber-800 ring-amber-200",
    PENDING_HR: "bg-blue-50 text-blue-800 ring-blue-200",
    APPROVED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    REJECTED: "bg-rose-50 text-rose-800 ring-rose-200",
    CANCELLED: "bg-slate-100 text-slate-600 ring-slate-200",
  };

  const labels: Record<string, string> = {
    PENDING_MANAGER: "Awaiting manager",
    PENDING_HR: "Awaiting HR",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
  };

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
        styles[status] ?? "bg-slate-100 text-slate-600 ring-slate-200"
      }`}
    >
      {labels[status] ?? status.replaceAll("_", " ")}
    </span>
  );
}

export function ManagerDashboard() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const loadDashboard = useCallback(async (signal: AbortSignal) => {
    setLoadState("loading");
    setErrorMessage("");

    try {
      const result = await listManagerPendingRequests({ signal });

      if (signal.aborted) {
        return;
      }

      setRequests(result);
      setLoadState("success");
    } catch (error) {
      if (signal.aborted) {
        return;
      }

      setErrorMessage(getErrorMessage(error));
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void loadDashboard(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadDashboard]);

  const pendingManagerRequests = requests.filter(
    isPendingManagerRequest,
  );

  const pendingHrRequests = requests.filter(isPendingHrRequest);

  const approvedRequests = requests.filter(isApprovedRequest);

  const rejectedRequests = requests.filter(isRejectedRequest);

  const upcomingApprovedRequests = requests
    .filter(isUpcomingRequest)
    .sort(
      (a, b) =>
        new Date(a.startDate).getTime() -
        new Date(b.startDate).getTime(),
    )
    .slice(0, 5);

  const recentRequests = [...requests]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime(),
    )
    .slice(0, 6);

  const firstName = (request: LeaveRequest) =>
    getEmployeeName(request);

  return (
    <main className="min-w-0 space-y-6 pb-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-blue-700">
            Manager workspace
          </p>

          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Manager Dashboard
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Review leave requests and keep track of your approval
            responsibilities.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            const controller = new AbortController();
            void loadDashboard(controller.signal);
          }}
          disabled={loadState === "loading"}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
        >
          <RefreshCw
            size={16}
            className={loadState === "loading" ? "animate-spin" : ""}
            aria-hidden="true"
          />
          Refresh
        </button>
      </section>

      {loadState === "error" && (
        <section
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-medium text-rose-900">
              Dashboard data could not be loaded
            </p>
            <p className="mt-1 text-sm leading-6 text-rose-800">
              {errorMessage}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              const controller = new AbortController();
              void loadDashboard(controller.signal);
            }}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-800 hover:bg-rose-100"
          >
            <RefreshCw size={15} aria-hidden="true" />
            Try again
          </button>
        </section>
      )}

      <section
        aria-label="Leave request overview"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          title="Awaiting your review"
          value={pendingManagerRequests.length}
          description="Requests in the manager queue"
          icon={Clock3}
          iconClassName="bg-amber-50 text-amber-700"
          to="/manager/approvals"
        />

        <MetricCard
          title="Awaiting HR"
          value={pendingHrRequests.length}
          description="Requests at the HR stage"
          icon={ShieldCheck}
          iconClassName="bg-blue-50 text-blue-700"
          to="/manager/approvals"
        />

        <MetricCard
          title="Approved requests"
          value={approvedRequests.length}
          description="Approved records returned by the queue"
          icon={CheckCircle2}
          iconClassName="bg-emerald-50 text-emerald-700"
          to="/manager/reports"
        />

        <MetricCard
          title="Rejected requests"
          value={rejectedRequests.length}
          description="Rejected records returned by the queue"
          icon={FileText}
          iconClassName="bg-rose-50 text-rose-700"
          to="/manager/reports"
        />
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Pending approvals
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Leave requests requiring manager action.
              </p>
            </div>

            <Link
              to="/manager/approvals"
              className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg px-3 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
            >
              View approvals
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          {loadState === "loading" ? (
            <div className="space-y-4 p-5" aria-label="Loading approvals">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="animate-pulse space-y-2 border-b border-slate-100 pb-4 last:border-0"
                >
                  <div className="h-4 w-2/5 rounded bg-slate-100" />
                  <div className="h-3 w-3/5 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : loadState === "error" ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-500">
                Approval records are unavailable until the service
                responds successfully.
              </p>
            </div>
          ) : pendingManagerRequests.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <CheckCircle2 size={23} aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-sm font-semibold text-slate-900">
                You’re all caught up
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                There are no leave requests awaiting your approval
                in the current manager queue.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingManagerRequests.slice(0, 6).map((request) => {
                const days = getRequestDays(request);

                return (
                  <div
                    key={request.id}
                    className="flex min-w-0 flex-col gap-3 p-5 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-slate-900">
                        {firstName(request)}
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        {getLeaveTypeName(request)}
                      </p>

                      <p className="mt-2 break-words text-xs leading-5 text-slate-500">
                        {formatDateRange(request)}
                        {days !== null
                          ? ` · ${days} ${days === 1 ? "day" : "days"}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                      <RequestStatus status={request.status} />

                      <Link
                        to="/manager/approvals"
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                        aria-label={`Review leave request from ${firstName(request)}`}
                      >
                        Review
                        <ArrowRight size={15} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {loadState === "success" &&
            pendingManagerRequests.length > 6 && (
              <div className="border-t border-slate-100 p-4 text-center">
                <Link
                  to="/manager/approvals"
                  className="text-sm font-medium text-blue-700 hover:underline"
                >
                  View all {pendingManagerRequests.length} pending requests
                </Link>
              </div>
            )}
        </div>

        <aside className="min-w-0 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                <CalendarDays size={20} aria-hidden="true" />
              </span>

              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900">
                  Upcoming approved leave
                </h2>
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  Approved requests present in the manager queue response.
                </p>
              </div>
            </div>

            {loadState === "loading" ? (
              <div className="mt-5 h-16 animate-pulse rounded-lg bg-slate-100" />
            ) : loadState === "error" ? (
              <p className="mt-5 text-sm text-slate-500">
                Upcoming leave could not be loaded.
              </p>
            ) : upcomingApprovedRequests.length === 0 ? (
              <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                No upcoming approved requests were returned by the
                current manager queue.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {upcomingApprovedRequests.map((request) => (
                  <div
                    key={request.id}
                    className="min-w-0 border-b border-slate-100 pb-4 last:border-0 last:pb-0"
                  >
                    <p className="break-words text-sm font-medium text-slate-900">
                      {getEmployeeName(request)}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {getLeaveTypeName(request)}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {formatDateRange(request)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <Link
              to="/manager/calendar"
              className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Open team calendar
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                <Users size={20} aria-hidden="true" />
              </span>

              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Team workspace
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Manager tools and team oversight.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <Link
                to="/manager/team"
                className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                My team
                <ArrowRight size={16} aria-hidden="true" />
              </Link>

              <Link
                to="/manager/reports"
                className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Team reports
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </aside>
      </section>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Recent leave requests
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              The latest records returned by the manager approval queue.
            </p>
          </div>

          <span className="text-xs text-slate-500">
            {loadState === "success"
              ? `${requests.length} records`
              : " "}
          </span>
        </div>

        {loadState === "loading" ? (
          <div className="space-y-3 p-5" aria-label="Loading requests">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-12 animate-pulse rounded-lg bg-slate-100"
              />
            ))}
          </div>
        ) : loadState === "error" ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Recent requests are unavailable.
          </div>
        ) : recentRequests.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <FileText
              size={26}
              className="mx-auto text-slate-400"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-medium text-slate-900">
              No requests to display
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Recent records will appear here when returned by the
              manager queue.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Employee</th>
                  <th className="px-5 py-3 font-medium">Leave type</th>
                  <th className="px-5 py-3 font-medium">Dates</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {recentRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-medium text-slate-900">
                      {getEmployeeName(request)}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {getLeaveTypeName(request)}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {formatDateRange(request)}
                    </td>
                    <td className="px-5 py-4">
                      <RequestStatus status={request.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
          <p className="text-xs leading-5 text-slate-500">
            Dashboard figures reflect records returned by the manager queue.
          </p>

          <Link
            to="/manager/approvals"
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
          >
            Approvals
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}

export default ManagerDashboard;
