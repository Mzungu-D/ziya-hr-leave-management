import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  ShieldCheck,
  Users,
} from "lucide-react";

export interface SystemOverviewData {
  totalEmployees: number;
  activeEmployees: number;
  pendingApprovals: number;
  approvedRequests: number;
  systemAlerts: number;
  departments: number;
  leaveTypes: number;
  systemStatus: "Operational" | "Degraded" | "Maintenance";
  lastUpdated?: string;
}

interface SystemOverviewProps {
  data?: SystemOverviewData;
  loading?: boolean;
  title?: string;
  subtitle?: string;
  onEmployeesClick?: () => void;
  onApprovalsClick?: () => void;
  onAlertsClick?: () => void;
}

const defaultData: SystemOverviewData = {
  totalEmployees: 126,
  activeEmployees: 118,
  pendingApprovals: 8,
  approvedRequests: 342,
  systemAlerts: 0,
  departments: 9,
  leaveTypes: 6,
  systemStatus: "Operational",
  lastUpdated: "Updated just now",
};

function OverviewSkeleton() {
  return (
    <div
      className="animate-pulse"
      role="status"
      aria-label="Loading system overview"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-slate-100 p-3"
          >
            <div className="h-8 w-8 rounded-lg bg-slate-200" />
            <div className="mt-3 h-3 w-20 rounded bg-slate-200" />
            <div className="mt-2 h-6 w-14 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      <div className="mt-4 h-16 rounded-xl bg-slate-100" />
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  iconClassName,
  onClick,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  iconClassName: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}
        aria-hidden="true"
      >
        <Icon size={17} strokeWidth={2} />
      </div>

      <div className="mt-3 min-w-0">
        <p
          title={label}
          className="truncate text-[11px] font-medium text-slate-500"
        >
          {label}
        </p>

        <p
          title={String(value)}
          className="mt-0.5 truncate text-xl font-bold tracking-tight text-slate-900"
        >
          {value.toLocaleString()}
        </p>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="min-w-0 rounded-xl border border-slate-100 p-3 text-left transition hover:border-slate-200 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2"
        aria-label={`${label}: ${value}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="min-w-0 rounded-xl border border-slate-100 p-3">
      {content}
    </div>
  );
}

function getStatusStyles(
  status: SystemOverviewData["systemStatus"],
) {
  switch (status) {
    case "Operational":
      return {
        iconClassName: "bg-emerald-50 text-emerald-600",
        badgeClassName:
          "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
        label: "All systems operational",
      };

    case "Degraded":
      return {
        iconClassName: "bg-amber-50 text-amber-600",
        badgeClassName:
          "bg-amber-50 text-amber-700 ring-amber-600/10",
        label: "Some services need attention",
      };

    case "Maintenance":
      return {
        iconClassName: "bg-blue-50 text-blue-600",
        badgeClassName:
          "bg-blue-50 text-blue-700 ring-blue-600/10",
        label: "Scheduled maintenance",
      };

    default:
      return {
        iconClassName: "bg-slate-50 text-slate-600",
        badgeClassName:
          "bg-slate-50 text-slate-700 ring-slate-600/10",
        label: "System status unavailable",
      };
  }
}

export function SystemOverview({
  data = defaultData,
  loading = false,
  title = "System Overview",
  subtitle = "HR platform status and activity",
  onEmployeesClick,
  onApprovalsClick,
  onAlertsClick,
}: SystemOverviewProps) {
  const statusStyles = getStatusStyles(data.systemStatus);

  return (
    <section
      className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="system-overview-title"
    >
      <div className="mb-4">
        <h2
          id="system-overview-title"
          className="text-base font-bold text-slate-900 sm:text-lg"
        >
          {title}
        </h2>

        <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
          {subtitle}
        </p>
      </div>

      {loading ? (
        <OverviewSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              icon={Users}
              label="Total Employees"
              value={data.totalEmployees}
              iconClassName="bg-blue-50 text-blue-600"
              onClick={onEmployeesClick}
            />

            <MetricCard
              icon={Clock3}
              label="Pending Approvals"
              value={data.pendingApprovals}
              iconClassName="bg-amber-50 text-amber-600"
              onClick={onApprovalsClick}
            />

            <MetricCard
              icon={CheckCircle2}
              label="Approved Requests"
              value={data.approvedRequests}
              iconClassName="bg-emerald-50 text-emerald-600"
            />

            <MetricCard
              icon={AlertTriangle}
              label="System Alerts"
              value={data.systemAlerts}
              iconClassName={
                data.systemAlerts > 0
                  ? "bg-red-50 text-red-600"
                  : "bg-slate-100 text-slate-500"
              }
              onClick={onAlertsClick}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex min-w-0 items-center gap-3 rounded-xl bg-slate-50 p-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${statusStyles.iconClassName}`}
              >
                <ShieldCheck size={17} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-slate-400">
                  Platform status
                </p>

                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold ring-1 ring-inset ${statusStyles.badgeClassName}`}
                  >
                    <span
                      className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                        data.systemStatus === "Operational"
                          ? "bg-emerald-500"
                          : data.systemStatus === "Degraded"
                            ? "bg-amber-500"
                            : "bg-blue-500"
                      }`}
                      aria-hidden="true"
                    />

                    {data.systemStatus}
                  </span>

                  <span className="truncate text-[11px] text-slate-500">
                    {statusStyles.label}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-3 rounded-xl bg-slate-50 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <Database size={17} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-slate-400">
                  Organization setup
                </p>

                <p className="mt-1 truncate text-xs font-semibold text-slate-700">
                  {data.departments} departments · {data.leaveTypes} leave
                  types
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Activity size={14} className="text-slate-400" />

              <span>
                {data.activeEmployees.toLocaleString()} active employees
              </span>
            </div>

            {data.lastUpdated && (
              <span className="text-[11px] text-slate-400">
                {data.lastUpdated}
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}