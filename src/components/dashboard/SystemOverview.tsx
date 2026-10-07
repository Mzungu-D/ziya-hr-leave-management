import {
  Activity,
  Building2,
  FileText,
  ShieldCheck,
  Users,
} from "lucide-react";

import type {
  AdminDashboardData,
  AdminDashboardStatus,
} from "../../services/adminDashboard.service";

export type SystemOverviewData =
  AdminDashboardData["systemOverview"];

interface SystemOverviewProps {
  data?: SystemOverviewData;
  loading?: boolean;
  onAdminsClick?: () => void;
  onManagersClick?: () => void;
  onEmployeesClick?: () => void;
  onLeaveTypesClick?: () => void;
  onDepartmentsClick?: () => void;
}

interface OverviewCardProps {
  icon: typeof Users;
  label: string;
  value: number;
  description?: string;
  onClick?: () => void;
  iconClassName: string;
  iconBackgroundClassName: string;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return "0";
  }

  return value.toLocaleString("en-KE");
}

function getStatusConfig(status: AdminDashboardStatus) {
  switch (status) {
    case "OPERATIONAL":
      return {
        label: "Operational",
        description:
          "All HR services are operating normally.",
        badgeClassName:
          "border-emerald-200 bg-emerald-50 text-emerald-700",
        dotClassName: "bg-emerald-500",
      };

    case "DEGRADED":
      return {
        label: "Degraded",
        description:
          "Some HR services may be experiencing issues.",
        badgeClassName:
          "border-amber-200 bg-amber-50 text-amber-700",
        dotClassName: "bg-amber-500",
      };

    case "OFFLINE":
      return {
        label: "Offline",
        description:
          "HR services are currently unavailable.",
        badgeClassName:
          "border-red-200 bg-red-50 text-red-700",
        dotClassName: "bg-red-500",
      };

    default:
      return {
        label: "Unavailable",
        description:
          "System status is currently unavailable.",
        badgeClassName:
          "border-slate-200 bg-slate-50 text-slate-600",
        dotClassName: "bg-slate-400",
      };
  }
}

function OverviewCard({
  icon: Icon,
  label,
  value,
  description,
  onClick,
  iconClassName,
  iconBackgroundClassName,
}: OverviewCardProps) {
  const content = (
    <div
      className={[
        "min-w-0 w-full rounded-xl border border-slate-100",
        "bg-slate-50 p-3 transition",
        onClick
          ? "hover:border-slate-200 hover:bg-slate-100/70 hover:shadow-sm"
          : "",
      ].join(" ")}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div
          className={[
            "flex h-9 w-9 shrink-0 items-center",
            "justify-center rounded-lg",
            iconBackgroundClassName,
          ].join(" ")}
        >
          <Icon
            size={18}
            className={iconClassName}
            strokeWidth={2}
            aria-hidden="true"
          />
        </div>

        {onClick && (
          <span
            className="shrink-0 text-xs font-medium text-slate-400"
            aria-hidden="true"
          >
            View
          </span>
        )}
      </div>

      <p className="mt-3 truncate text-2xl font-bold tracking-tight text-slate-900">
        {formatNumber(value)}
      </p>

      <p className="mt-1 truncate text-xs font-semibold text-slate-600">
        {label}
      </p>

      {description && (
        <p className="mt-1 truncate text-[11px] leading-4 text-slate-400">
          {description}
        </p>
      )}
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
      aria-label={`View ${label}`}
    >
      {content}
    </button>
  );
}

function LoadingCard() {
  return (
    <div className="min-w-0 w-full rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-200" />

      <div className="mt-3 h-7 w-14 animate-pulse rounded bg-slate-200" />

      <div className="mt-2 h-3 w-24 animate-pulse rounded bg-slate-200" />

      <div className="mt-2 h-3 w-20 animate-pulse rounded bg-slate-200" />
    </div>
  );
}

export function SystemOverview({
  data,
  loading = false,
  onAdminsClick,
  onManagersClick,
  onEmployeesClick,
  onLeaveTypesClick,
  onDepartmentsClick,
}: SystemOverviewProps) {
  const statusConfig = data
    ? getStatusConfig(data.systemStatus)
    : null;

  return (
    <section
      aria-labelledby="system-overview-title"
      className="min-w-0 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      {/* ================================================================
          HEADER
      ================================================================= */}
      <div className="mb-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <Activity
              size={19}
              strokeWidth={2}
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0">
            <h2
              id="system-overview-title"
              className="truncate text-base font-bold text-slate-900 sm:text-lg"
            >
              System Overview
            </h2>

            <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
              Current HR system and workforce configuration
            </p>
          </div>
        </div>

        {loading ? (
          <div
            className="h-8 w-28 animate-pulse rounded-full bg-slate-100"
            aria-hidden="true"
          />
        ) : statusConfig ? (
          <div
            className={[
              "inline-flex w-fit shrink-0 items-center gap-2",
              "rounded-full border px-3 py-1.5",
              "text-xs font-semibold",
              statusConfig.badgeClassName,
            ].join(" ")}
          >
            <span
              className={[
                "h-2 w-2 shrink-0 rounded-full",
                statusConfig.dotClassName,
              ].join(" ")}
              aria-hidden="true"
            />

            <span>{statusConfig.label}</span>
          </div>
        ) : null}
      </div>

      {/* ================================================================
          LOADING
      ================================================================= */}
      {loading ? (
        <div
          className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
          aria-label="Loading system overview"
          aria-busy="true"
        >
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
        </div>
      ) : !data ? (
        /* ================================================================
           EMPTY / UNAVAILABLE
        ================================================================= */
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
          <Activity
            size={24}
            className="mx-auto text-slate-400"
            aria-hidden="true"
          />

          <p className="mt-3 text-sm font-semibold text-slate-700">
            System overview unavailable
          </p>

          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">
            The HR dashboard did not return system overview
            data from the production service.
          </p>
        </div>
      ) : (
        <>
          {/* ================================================================
              OVERVIEW CARDS
          ================================================================= */}
          <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <OverviewCard
              icon={ShieldCheck}
              label="Active Admins"
              value={data.activeAdmins}
              description="Administrator accounts"
              onClick={onAdminsClick}
              iconClassName="text-emerald-600"
              iconBackgroundClassName="bg-emerald-50"
            />

            <OverviewCard
              icon={Users}
              label="Managers"
              value={data.managers}
              description="Manager accounts"
              onClick={onManagersClick}
              iconClassName="text-blue-600"
              iconBackgroundClassName="bg-blue-50"
            />

            <OverviewCard
              icon={Users}
              label="Employees"
              value={data.employees}
              description="Employee accounts"
              onClick={onEmployeesClick}
              iconClassName="text-violet-600"
              iconBackgroundClassName="bg-violet-50"
            />

            <OverviewCard
              icon={FileText}
              label="Leave Types"
              value={data.leaveTypes}
              description="Configured leave types"
              onClick={onLeaveTypesClick}
              iconClassName="text-orange-600"
              iconBackgroundClassName="bg-orange-50"
            />

            <OverviewCard
              icon={Building2}
              label="Departments"
              value={data.departments}
              description="Configured departments"
              onClick={onDepartmentsClick}
              iconClassName="text-pink-600"
              iconBackgroundClassName="bg-pink-50"
            />
          </div>

          {/* ================================================================
              SYSTEM STATUS
          ================================================================= */}
          {statusConfig && (
            <div className="mt-5 flex min-w-0 flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  System Status
                </p>

                <div className="mt-1 flex min-w-0 items-center gap-2">
                  <span
                    className={[
                      "h-2 w-2 shrink-0 rounded-full",
                      statusConfig.dotClassName,
                    ].join(" ")}
                    aria-hidden="true"
                  />

                  <p className="truncate text-sm font-semibold text-slate-700">
                    {statusConfig.label}
                  </p>
                </div>
              </div>

              <p className="min-w-0 text-xs leading-5 text-slate-500 sm:max-w-md sm:text-right">
                {statusConfig.description}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default SystemOverview;