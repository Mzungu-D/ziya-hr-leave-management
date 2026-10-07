import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileCheck2,
  RefreshCw,
  Users,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "../../contexts/AuthContext";

import {
  AdminDashboardServiceError,
  getAdminDashboard,
  type AdminDashboardData,
  type UpcomingEvent as ApiUpcomingEvent,
  type DashboardAnnouncement,
} from "../../services/adminDashboard.service";

import { EmployeeDistribution } from "../../components/dashboard/EmployeeDistribution";
import { LeaveRequestsTrend } from "../../components/dashboard/LeaveRequestsTrend";
import { LeaveTypeDistribution } from "../../components/dashboard/LeaveTypeDistribution";
import { LeaveUtilizationChart } from "../../components/dashboard/LeaveUtilizationChart";
import { RecentLeaveRequests } from "../../components/dashboard/RecentLeaveRequests";
import type {
  RecentLeaveRequest,
  LeaveRequestStatus,
} from "../../components/dashboard/RecentLeaveRequests";
import { UpcomingEvents } from "../../components/dashboard/UpcomingEvents";
import type {
  UpcomingEvent,
  UpcomingEventType,
} from "../../components/dashboard/UpcomingEvents";
import { Announcements } from "../../components/dashboard/Announcements";
import type { Announcement } from "../../components/dashboard/Announcements";
import { SystemOverview } from "../../components/dashboard/SystemOverview";
import type { SystemOverviewData } from "../../components/dashboard/SystemOverview";
import { QuickActions } from "../../components/dashboard/QuickActions";

interface KpiCardProps {
  title: string;
  value: number;
  description: string;
  icon: typeof Users;
  onClick?: () => void;
}

function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  onClick,
}: KpiCardProps) {
  const content = (
    <div
      className={[
        "w-full min-w-0 rounded-2xl border border-slate-200",
        "bg-white p-4 shadow-sm transition sm:p-5",
        onClick
          ? "cursor-pointer hover:border-slate-300 hover:shadow-md"
          : "",
      ].join(" ")}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
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
          <Icon size={20} strokeWidth={2} />
        </div>
      </div>
    </div>
  );

  if (!onClick) {
    return content;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full min-w-0 text-left"
    >
      {content}
    </button>
  );
}

function LoadingCard() {
  return (
    <div className="h-[132px] w-full animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="h-3 w-28 rounded bg-slate-200" />
      <div className="mt-4 h-8 w-20 rounded bg-slate-200" />
      <div className="mt-3 h-3 w-40 rounded bg-slate-200" />
    </div>
  );
}

function DashboardError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section
      role="alert"
      className="w-full rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-5"
    >
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <AlertCircle
            className="mt-0.5 shrink-0 text-red-600"
            size={20}
          />

          <div className="min-w-0">
            <h2 className="font-semibold text-red-900">
              Unable to load dashboard
            </h2>

            <p className="mt-1 break-words text-sm leading-6 text-red-700">
              {message}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100 sm:w-auto"
        >
          <RefreshCw size={16} />
          Retry
        </button>
      </div>
    </section>
  );
}

function formatGeneratedAt(value: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/* ============================================================================
   API → UI ADAPTERS

   The API service intentionally keeps the backend contract.
   The dashboard components keep their existing UI contracts.
   These functions bridge the two without changing either side.
============================================================================ */

function normalizeRequestStatus(
  status: string,
): LeaveRequestStatus {
  switch (status.toUpperCase()) {
    case "APPROVED":
    case "HR_APPROVED":
      return "Approved";

    case "REJECTED":
      return "Rejected";

    case "CANCELLED":
      return "Cancelled";

    case "MANAGER_APPROVED":
    case "PENDING":
    default:
      return "Pending";
  }
}

function mapRecentLeaveRequests(
  requests:
    | AdminDashboardData["recentLeaveRequests"]
    | undefined,
): RecentLeaveRequest[] | undefined {
  if (!requests) {
    return undefined;
  }

  return requests.map((request) => ({
    id: request.id,
    employeeName: request.employeeName,
    employeeRole: request.employeeRole,
    employeeAvatarUrl: request.employeeAvatarUrl,
    leaveType: request.leaveType,
    startDate: request.startDate,
    endDate: request.endDate,
    days: Number(request.requestedDays) || 0,
    submittedAt: request.submittedAt,
    status: normalizeRequestStatus(request.status),
  }));
}

function normalizeUpcomingEventType(
  type: ApiUpcomingEvent["type"],
): UpcomingEventType {
  switch (String(type).toLowerCase()) {
    case "holiday":
      return "holiday";

    case "meeting":
      return "meeting";

    case "event":
      return "event";

    case "leave":
    case "leave_request":
    default:
      return "leave";
  }
}

function mapUpcomingEvents(
  events:
    | AdminDashboardData["upcomingEvents"]
    | undefined,
): UpcomingEvent[] | undefined {
  if (!events) {
    return undefined;
  }

  return events.map((event) => ({
    id: event.id,
    title: event.title,
    date: event.date,
    description: event.description,
    type: normalizeUpcomingEventType(event.type),
  }));
}

function mapAnnouncements(
  announcements: DashboardAnnouncement[] | undefined,
): Announcement[] | undefined {
  if (!announcements) {
    return undefined;
  }

  return announcements.map((announcement) => ({
    id: announcement.id,
    title: announcement.title,
    message: announcement.description,
    publishedAt: announcement.publishedAt,
    author: announcement.author,
    category: announcement.category,
    priority: "normal",
    pinned: false,
  }));
}

/**
 * The existing LeaveUtilizationChart is a monthly chart.
 *
 * The API currently exposes utilization by leave type rather than
 * monthly buckets. We therefore create one display row from the
 * available API values instead of pretending that leave types are months.
 *
 * This keeps TypeScript correct while we later align the backend
 * analytics endpoint with the monthly chart contract.
 */
function mapLeaveUtilization(
  data:
    | AdminDashboardData["leaveUtilization"]
    | undefined,
) {
  if (!data || data.length === 0) {
    return undefined;
  }

  const findType = (...names: string[]) => {
    const item = data.find((entry) =>
      names.some(
        (name) =>
          entry.name.trim().toLowerCase() ===
          name.trim().toLowerCase(),
      ),
    );

    return item?.usedDays ?? 0;
  };

  return [
    {
      month: "Current",
      annual: findType("Annual", "Annual Leave"),
      sick: findType("Sick", "Sick Leave"),
      maternity: findType(
        "Maternity",
        "Maternity Leave",
      ),
      paternity: findType(
        "Paternity",
        "Paternity Leave",
      ),
      other: data
        .filter((entry) => {
          const name = entry.name.trim().toLowerCase();

          return ![
            "annual",
            "annual leave",
            "sick",
            "sick leave",
            "maternity",
            "maternity leave",
            "paternity",
            "paternity leave",
          ].includes(name);
        })
        .reduce(
          (total, entry) =>
            total + (Number(entry.usedDays) || 0),
          0,
        ),
    },
  ];
}

/**
 * Maps the production API SystemOverview contract to the
 * SystemOverview component contract.
 *
 * IMPORTANT:
 * This must remain aligned with AdminDashboardData["systemOverview"].
 * The API uses:
 *   activeAdmins
 *   managers
 *   employees
 *   leaveTypes
 *   departments
 *   systemStatus
 *
 * No demo/default values are introduced here.
 */
function mapSystemOverview(
  dashboard: AdminDashboardData | null,
): SystemOverviewData | undefined {
  if (!dashboard) {
    return undefined;
  }

  const status =
    dashboard.systemOverview.systemStatus;

  let systemStatus: SystemOverviewData["systemStatus"];

  switch (status) {
    case "DEGRADED":
      systemStatus = "DEGRADED";
      break;

    case "OFFLINE":
      systemStatus = "OFFLINE";
      break;

    case "OPERATIONAL":
    default:
      systemStatus = "OPERATIONAL";
      break;
  }

  return {
    activeAdmins:
      Number(dashboard.systemOverview.activeAdmins) || 0,

    managers:
      Number(dashboard.systemOverview.managers) || 0,

    employees:
      Number(dashboard.systemOverview.employees) || 0,

    leaveTypes:
      Number(dashboard.systemOverview.leaveTypes) || 0,

    departments:
      Number(dashboard.systemOverview.departments) || 0,

    systemStatus,
  };
}

export function AdminDashboard() {
  const { user } = useAuth();

  const [dashboard, setDashboard] =
    useState<AdminDashboardData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [refreshing, setRefreshing] =
    useState(false);

  const userName = useMemo(() => {
    if (!user) {
      return "HR Administrator";
    }

    const firstName =
      typeof user.firstName === "string"
        ? user.firstName.trim()
        : "";

    const lastName =
      typeof user.lastName === "string"
        ? user.lastName.trim()
        : "";

    const fullName =
      `${firstName} ${lastName}`.trim();

    return fullName || "HR Administrator";
  }, [user]);

  const loadDashboard = useCallback(
    async (
      signal?: AbortSignal,
      isRefresh = false,
    ) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const result =
          await getAdminDashboard(signal);

        setDashboard(result);
      } catch (err) {
        if (
          err instanceof
            AdminDashboardServiceError &&
          err.code === "REQUEST_CANCELLED"
        ) {
          return;
        }

        if (
          err instanceof DOMException &&
          err.name === "AbortError"
        ) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load the HR administration dashboard.",
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const controller =
      new AbortController();

    void loadDashboard(
      controller.signal,
    );

    return () => {
      controller.abort();
    };
  }, [loadDashboard]);

  const handleRefresh = useCallback(() => {
    void loadDashboard(
      undefined,
      true,
    );
  }, [loadDashboard]);

  const summary =
    dashboard?.summary;

  const systemOverview =
    mapSystemOverview(dashboard);

  const recentRequests =
    useMemo(
      () =>
        mapRecentLeaveRequests(
          dashboard?.recentLeaveRequests,
        ),
      [dashboard?.recentLeaveRequests],
    );

  const upcomingEvents =
    useMemo(
      () =>
        mapUpcomingEvents(
          dashboard?.upcomingEvents,
        ),
      [dashboard?.upcomingEvents],
    );

  const announcements =
    useMemo(
      () =>
        mapAnnouncements(
          dashboard?.announcements,
        ),
      [dashboard?.announcements],
    );

  const leaveUtilization =
    useMemo(
      () =>
        mapLeaveUtilization(
          dashboard?.leaveUtilization,
        ),
      [dashboard?.leaveUtilization],
    );

  return (
    <main className="w-full min-w-0 overflow-x-hidden">
      <div className="mx-auto w-full min-w-0 max-w-[1920px] space-y-5 sm:space-y-6">
        <header className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="min-w-0 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">
                  HR Dashboard
                </h1>

                {systemOverview?.systemStatus ===
                  "OPERATIONAL" && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 size={13} />
                    Operational
                  </span>
                )}
              </div>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Welcome back,{" "}
                <span className="font-semibold text-slate-700">
                  {userName}
                </span>
                . Here is your organization's
                latest workforce and leave overview.
              </p>

              {dashboard?.generatedAt && (
                <p className="mt-1 text-xs text-slate-400">
                  Last updated{" "}
                  {formatGeneratedAt(
                    dashboard.generatedAt,
                  )}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={
                loading || refreshing
              }
              className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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
          </div>
        </header>

        {error && (
          <DashboardError
            message={error}
            onRetry={handleRefresh}
          />
        )}

        {loading && !dashboard ? (
          <section className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <LoadingCard />
            <LoadingCard />
            <LoadingCard />
            <LoadingCard />
          </section>
        ) : (
          <section className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Total Employees"
              value={
                summary?.totalEmployees ?? 0
              }
              description="Employees in your organization"
              icon={Users}
              onClick={() => {
                window.location.href =
                  "/admin/employees";
              }}
            />

            <KpiCard
              title="Active Employees"
              value={
                summary?.activeEmployees ?? 0
              }
              description="Currently active employees"
              icon={CheckCircle2}
            />

            <KpiCard
              title="Pending Approvals"
              value={
                summary?.pendingApprovals ?? 0
              }
              description="Requests awaiting HR action"
              icon={Clock3}
              onClick={() => {
                window.location.href =
                  "/admin/leave";
              }}
            />

            <KpiCard
              title="Approved This Month"
              value={
                summary?.approvedThisMonth ?? 0
              }
              description="Leave requests approved this month"
              icon={FileCheck2}
            />
          </section>
        )}

        <section className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="w-full min-w-0">
            <LeaveRequestsTrend
              data={dashboard?.leaveRequestsTrend?.map(
                (item) => ({
                  month: item.month,
                  submitted:
                    Number(item.total) || 0,
                  approved:
                    Number(item.approved) || 0,
                  rejected:
                    Number(item.rejected) || 0,
                }),
              )}
              loading={loading && !dashboard}
            />
          </div>

          <div className="w-full min-w-0">
            <LeaveTypeDistribution
              data={
                dashboard?.leaveTypeDistribution
              }
              loading={loading && !dashboard}
            />
          </div>
        </section>

        <section className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="w-full min-w-0">
            <LeaveUtilizationChart
              data={leaveUtilization}
              loading={loading && !dashboard}
            />
          </div>

          <div className="w-full min-w-0">
            <EmployeeDistribution
              data={
                dashboard?.employeeDistribution
              }
              loading={loading && !dashboard}
            />
          </div>
        </section>

        <section className="w-full min-w-0">
          <RecentLeaveRequests
            requests={recentRequests}
            loading={loading && !dashboard}
          />
        </section>

        <section className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="w-full min-w-0">
            <UpcomingEvents
              events={upcomingEvents}
              loading={loading && !dashboard}
            />
          </div>

          <div className="w-full min-w-0">
            <Announcements
              announcements={announcements}
              loading={loading && !dashboard}
            />
          </div>
        </section>

        <section className="w-full min-w-0">
          <SystemOverview
            data={systemOverview}
            loading={loading && !dashboard}
          />
        </section>

        <section className="w-full min-w-0 pb-4">
          <QuickActions />
        </section>
      </div>
    </main>
  );
}

export default AdminDashboard;