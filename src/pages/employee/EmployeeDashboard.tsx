import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Info,
  PlaneTakeoff,
  Plus,
  RefreshCw,
  WalletCards,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { useAuth } from "../../contexts/AuthContext";

/* ============================================================
   Types
============================================================ */

export type EmployeeLeaveRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export interface EmployeeLeaveBalance {
  leaveTypeId: string;
  leaveTypeName: string;
  remainingDays: number;
  entitledDays: number;
  usedDays: number;
  color?: string;
}

export interface EmployeeLeaveRequest {
  id: string;
  referenceNumber: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: EmployeeLeaveRequestStatus;
  submittedAt: string;
  rejectionReason?: string;
}

export interface EmployeeUpcomingLeave {
  id: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
}

export interface EmployeeDashboardEvent {
  id: string;
  title: string;
  date: string;
  description?: string;
  type: "HOLIDAY" | "LEAVE" | "ANNOUNCEMENT" | "OTHER";
}

export interface EmployeeDashboardNotification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  type:
    | "LEAVE"
    | "APPROVAL"
    | "ANNOUNCEMENT"
    | "SYSTEM"
    | "OTHER";
}

export interface EmployeeDashboardData {
  leaveBalances: EmployeeLeaveBalance[];
  recentLeaveRequests: EmployeeLeaveRequest[];
  upcomingLeave: EmployeeUpcomingLeave[];
  upcomingEvents: EmployeeDashboardEvent[];
  notifications: EmployeeDashboardNotification[];
}

interface EmployeeDashboardProps {
  data?: EmployeeDashboardData;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

/* ============================================================
   Constants
============================================================ */

const EMPTY_DASHBOARD_DATA: EmployeeDashboardData = {
  leaveBalances: [],
  recentLeaveRequests: [],
  upcomingLeave: [],
  upcomingEvents: [],
  notifications: [],
};

const CHART_COLORS = [
  "#C49A45",
  "#0F766E",
  "#64748B",
  "#7C3AED",
  "#0284C7",
  "#D97706",
  "#DB2777",
  "#475569",
];

const STATUS_STYLES: Record<
  EmployeeLeaveRequestStatus,
  string
> = {
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  REJECTED: "bg-red-50 text-red-700 ring-red-200",
  CANCELLED: "bg-slate-100 text-slate-600 ring-slate-200",
};

/* ============================================================
   Helpers
============================================================ */

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-KE", {
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string): string {
  if (!value || Number.isNaN(Date.parse(value))) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatShortDate(value: string): string {
  if (!value || Number.isNaN(Date.parse(value))) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function formatDateRange(startDate: string, endDate: string): string {
  if (startDate === endDate) {
    return formatDate(startDate);
  }

  return `${formatShortDate(startDate)} – ${formatDate(endDate)}`;
}

function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";

  return "Good evening";
}

function getDisplayStatus(status: EmployeeLeaveRequestStatus): string {
  switch (status) {
    case "PENDING":
      return "Pending approval";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "CANCELLED":
      return "Cancelled";
  }
}

function getStatusIcon(
  status: EmployeeLeaveRequestStatus,
): LucideIcon {
  switch (status) {
    case "APPROVED":
      return CheckCircle2;
    case "REJECTED":
      return XCircle;
    case "CANCELLED":
      return XCircle;
    case "PENDING":
      return Clock3;
  }
}

/* ============================================================
   Reusable UI
============================================================ */

function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
          {title}
        </h2>

        {description && (
          <p className="mt-1 text-sm leading-5 text-slate-500">
            {description}
          </p>
        )}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 lg:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

function DashboardStatCard({
  label,
  value,
  description,
  icon: Icon,
  iconClassName = "bg-slate-100 text-slate-700",
}: {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  iconClassName?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-3 break-words text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {value}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
        >
          <Icon size={20} aria-hidden="true" />
        </div>
      </div>

      <p className="mt-2 break-words text-xs leading-5 text-slate-500 sm:text-sm">
        {description}
      </p>
    </div>
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
    <div className="flex min-w-0 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-9 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Icon size={21} aria-hidden="true" />
      </div>

      <h3 className="mt-3 text-sm font-semibold text-slate-800">
        {title}
      </h3>

      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
        {description}
      </p>

      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

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

/* ============================================================
   Leave Balance Doughnut Chart
============================================================ */

function LeaveBalanceChart({
  balances,
}: {
  balances: EmployeeLeaveBalance[];
}) {
  const chartData = balances
    .map((balance, index) => ({
      id: balance.leaveTypeId,
      name: balance.leaveTypeName,
      value: Math.max(0, balance.remainingDays),
      color:
        balance.color || CHART_COLORS[index % CHART_COLORS.length],
    }))
    .filter((item) => item.value > 0);

  const totalRemaining = balances.reduce(
    (total, balance) => total + Math.max(0, balance.remainingDays),
    0,
  );

  if (balances.length === 0) {
    return (
      <EmptyState
        icon={WalletCards}
        title="No leave balances available"
        description="Your leave balance chart will appear when your leave records are available."
      />
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex min-h-[250px] flex-col items-center justify-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <WalletCards size={22} aria-hidden="true" />
        </div>

        <h3 className="mt-3 text-sm font-semibold text-slate-800">
          No remaining leave days
        </h3>

        <p className="mt-1 max-w-xs text-sm leading-6 text-slate-500">
          Your current leave balances do not contain any remaining days.
        </p>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-1 items-center gap-5 sm:grid-cols-[minmax(180px,0.9fr)_minmax(0,1fr)] sm:gap-6">
      <div className="relative mx-auto h-[220px] w-full max-w-[280px] min-w-0 sm:h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="65%"
              outerRadius="88%"
              paddingAngle={chartData.length > 1 ? 3 : 0}
              stroke="none"
              isAnimationActive={false}
            >
              {chartData.map((item) => (
                <Cell key={item.id} fill={item.color} />
              ))}
            </Pie>

            <Tooltip
              formatter={(value, name) => [
                `${formatNumber(Number(value))} days`,
                String(name),
              ]}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-medium text-slate-500">
            Remaining
          </span>

          <span className="mt-1 max-w-[130px] break-words text-center text-3xl font-semibold tracking-tight text-slate-900">
            {formatNumber(totalRemaining)}
          </span>

          <span className="mt-1 text-xs text-slate-500">
            leave days
          </span>
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        {chartData.map((item) => {
          const percentage =
            totalRemaining > 0
              ? (item.value / totalRemaining) * 100
              : 0;

          return (
            <div key={item.id} className="min-w-0">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span
                    className="mt-1 h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: item.color }}
                    aria-hidden="true"
                  />

                  <span className="break-words text-sm font-medium text-slate-700">
                    {item.name}
                  </span>
                </div>

                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                  {formatNumber(item.value)}
                </span>
              </div>

              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          );
        })}

        <p className="border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
          The chart shows remaining days by leave type. Balances are based on
          the data supplied by the leave service.
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   Main Employee Dashboard
============================================================ */

export function EmployeeDashboard({
  data = EMPTY_DASHBOARD_DATA,
  isLoading = false,
  error = null,
  onRetry,
}: EmployeeDashboardProps) {
  const { user } = useAuth();

  const firstName = user?.firstName?.trim() || "there";
  const lastName = user?.lastName?.trim() || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const jobTitle = user?.jobTitle?.trim() || "Employee";

  const dashboardData = data;

  const totalRemainingDays = dashboardData.leaveBalances.reduce(
    (total, balance) => total + Math.max(0, balance.remainingDays),
    0,
  );

  const totalEntitledDays = dashboardData.leaveBalances.reduce(
    (total, balance) => total + Math.max(0, balance.entitledDays),
    0,
  );

  const pendingRequests = dashboardData.recentLeaveRequests.filter(
    (request) => request.status === "PENDING",
  ).length;

  const approvedRequests = dashboardData.recentLeaveRequests.filter(
    (request) => request.status === "APPROVED",
  ).length;

  const unreadNotifications = dashboardData.notifications.filter(
    (notification) => !notification.read,
  ).length;

  const nextLeave = [...dashboardData.upcomingLeave]
    .filter((leave) => !Number.isNaN(Date.parse(leave.startDate)))
    .sort(
      (first, second) =>
        Date.parse(first.startDate) - Date.parse(second.startDate),
    )[0];

  const usagePercentage =
    totalEntitledDays > 0
      ? Math.min(
          100,
          Math.max(
            0,
            ((totalEntitledDays - totalRemainingDays) /
              totalEntitledDays) *
              100,
          ),
        )
      : 0;

  /* Loading state */

  if (isLoading) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-6 overflow-x-clip pb-8">
        <div className="rounded-2xl bg-[#071a35] p-5 sm:p-7">
          <div className="flex items-center gap-4">
            <LoadingBlock className="h-14 w-14 shrink-0 rounded-full bg-white/15" />

            <div className="min-w-0 flex-1 space-y-3">
              <LoadingBlock className="h-5 w-40 bg-white/15" />
              <LoadingBlock className="h-4 w-64 max-w-full bg-white/15" />
            </div>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <LoadingBlock className="h-4 w-28" />
              <LoadingBlock className="mt-4 h-8 w-20" />
              <LoadingBlock className="mt-3 h-3 w-36 max-w-full" />
            </div>
          ))}
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
          {Array.from({ length: 2 }, (_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <LoadingBlock className="h-5 w-40" />
              <LoadingBlock className="mt-6 h-56 w-full" />
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-slate-500" role="status">
          Loading your employee dashboard…
        </p>
      </div>
    );
  }

  /* Error state */

  if (error) {
    return (
      <div className="flex min-h-[50vh] w-full min-w-0 items-center justify-center px-2 py-10">
        <div
          className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-5 text-center shadow-sm sm:p-8"
          role="alert"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <Info size={23} aria-hidden="true" />
          </div>

          <h1 className="mt-4 text-lg font-semibold text-slate-900">
            We couldn't load your dashboard
          </h1>

          <p className="mt-2 break-words text-sm leading-6 text-slate-600">
            {error}
          </p>

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#071a35] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#10294c] focus:outline-none focus:ring-2 focus:ring-[#c49a45] focus:ring-offset-2"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  /* Dashboard */

  return (
    <main className="mx-auto w-full min-w-0 max-w-[1600px] space-y-5 overflow-x-clip pb-8 sm:space-y-6">
      {/* Welcome banner */}

      <section className="relative overflow-hidden rounded-2xl bg-[#071a35] text-white shadow-sm">
        <div
          className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-white/10"
          aria-hidden="true"
        />

        <div
          className="pointer-events-none absolute -right-4 -top-12 h-48 w-48 rounded-full border border-white/10"
          aria-hidden="true"
        />

        <div className="relative flex min-w-0 flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            {user?.profilePictureUrl ? (
              <img
                src={user.profilePictureUrl}
                alt={`${fullName} profile`}
                className="h-14 w-14 shrink-0 rounded-full border border-white/20 object-cover sm:h-16 sm:w-16"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg font-semibold text-white sm:h-16 sm:w-16">
                {fullName
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((part) => part.charAt(0))
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() || "E"}
              </div>
            )}

            <div className="min-w-0">
              <p className="text-sm font-medium text-white/70">
                {getGreeting()}
              </p>

              <h1 className="mt-1 break-words text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl">
                Welcome back, {firstName}
              </h1>

              <p className="mt-1 break-words text-sm text-white/70">
                {jobTitle} · Here is your leave overview.
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
            <Link
              to="/employee/leave"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              <FileText size={17} aria-hidden="true" />
              My leave requests
            </Link>

            <Link
              to="/employee/apply-leave"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#c49a45] px-4 py-2.5 text-sm font-semibold text-[#071a35] transition hover:bg-[#d4ad60] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#071a35]"
            >
              <Plus size={17} aria-hidden="true" />
              Apply for leave
            </Link>
          </div>
        </div>
      </section>

      {/* Summary cards */}

      <section
        aria-label="Leave summary"
        className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4"
      >
        <DashboardStatCard
          label="Leave remaining"
          value={
            dashboardData.leaveBalances.length > 0
              ? `${formatNumber(totalRemainingDays)} days`
              : "—"
          }
          description="Across available leave types"
          icon={WalletCards}
          iconClassName="bg-amber-50 text-amber-700"
        />

        <DashboardStatCard
          label="Pending requests"
          value={
            dashboardData.recentLeaveRequests.length > 0
              ? String(pendingRequests)
              : "0"
          }
          description="Awaiting a decision"
          icon={Clock3}
          iconClassName="bg-blue-50 text-blue-700"
        />

        <DashboardStatCard
          label="Approved requests"
          value={
            dashboardData.recentLeaveRequests.length > 0
              ? String(approvedRequests)
              : "0"
          }
          description="Approved leave applications"
          icon={CheckCircle2}
          iconClassName="bg-emerald-50 text-emerald-700"
        />

        <DashboardStatCard
          label="Notifications"
          value={String(unreadNotifications)}
          description="Unread dashboard notifications"
          icon={Bell}
          iconClassName="bg-violet-50 text-violet-700"
        />
      </section>

      {/* Leave balance and next leave */}

      <section className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]">
        <Panel>
          <SectionHeading
            title="My leave balance"
            description="Remaining leave days by leave type"
          />

          <LeaveBalanceChart balances={dashboardData.leaveBalances} />

          {dashboardData.leaveBalances.length > 0 && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-500">
                  Overall entitlement usage
                </span>

                <span className="text-sm font-semibold tabular-nums text-slate-800">
                  {formatNumber(usagePercentage)}%
                </span>
              </div>

              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-label="Overall leave entitlement usage"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(usagePercentage)}
              >
                <div
                  className="h-full rounded-full bg-[#c49a45] transition-[width]"
                  style={{ width: `${usagePercentage}%` }}
                />
              </div>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                {formatNumber(totalEntitledDays)} entitled days in total.
                Check individual balances below for the breakdown.
              </p>
            </div>
          )}
        </Panel>

        <Panel>
          <SectionHeading
            title="Upcoming leave"
            description="Your next approved leave period"
            action={
              <Link
                to="/employee/leave"
                className="inline-flex items-center gap-1 text-sm font-medium text-[#8a6725] hover:text-[#071a35]"
              >
                View requests
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            }
          />

          {nextLeave ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                  <PlaneTakeoff size={21} aria-hidden="true" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="break-words text-base font-semibold text-slate-900">
                    {nextLeave.leaveTypeName}
                  </p>

                  <p className="mt-1 break-words text-sm leading-6 text-slate-600">
                    {formatDateRange(
                      nextLeave.startDate,
                      nextLeave.endDate,
                    )}
                  </p>

                  <p className="mt-2 text-sm font-medium text-emerald-800">
                    {formatNumber(nextLeave.totalDays)} days approved
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="No upcoming leave"
              description="Your future approved leave will appear here."
              action={
                <Link
                  to="/employee/apply-leave"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#071a35] px-4 py-2 text-sm font-medium text-white hover:bg-[#10294c]"
                >
                  <Plus size={16} aria-hidden="true" />
                  Apply for leave
                </Link>
              }
            />
          )}

          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <CalendarDays
                className="mt-0.5 shrink-0 text-slate-500"
                size={18}
                aria-hidden="true"
              />

              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">
                  Planning ahead?
                </p>

                <p className="mt-1 text-sm leading-5 text-slate-500">
                  Submit a leave request early and follow its approval status
                  from your leave history.
                </p>
              </div>
            </div>
          </div>
        </Panel>
      </section>

      {/* Individual leave balances */}

      <Panel>
        <SectionHeading
          title="Balance breakdown"
          description="Entitled, used and remaining days for each leave type"
        />

        {dashboardData.leaveBalances.length === 0 ? (
          <EmptyState
            icon={WalletCards}
            title="No leave balances available yet"
            description="Your leave balances will appear here when the records are available from HR."
          />
        ) : (
          <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {dashboardData.leaveBalances.map((balance, index) => {
              const entitlement = Math.max(0, balance.entitledDays);
              const used = Math.max(0, balance.usedDays);
              const remaining = Math.max(0, balance.remainingDays);

              const progress =
                entitlement > 0
                  ? Math.min(100, (used / entitlement) * 100)
                  : 0;

              const color =
                balance.color ||
                CHART_COLORS[index % CHART_COLORS.length];

              return (
                <article
                  key={balance.leaveTypeId}
                  className="min-w-0 rounded-xl border border-slate-200 p-4 sm:p-5"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className="mt-1 h-3 w-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />

                    <div className="min-w-0 flex-1">
                      <h3 className="break-words text-sm font-semibold text-slate-900">
                        {balance.leaveTypeName}
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        {formatNumber(entitlement)} entitled days
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-lg font-semibold tabular-nums text-slate-900">
                        {formatNumber(remaining)}
                      </p>

                      <p className="text-xs text-slate-500">remaining</p>
                    </div>
                  </div>

                  <div
                    className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"
                    role="progressbar"
                    aria-label={`${balance.leaveTypeName} days used`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress)}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      {formatNumber(used)} days used
                    </span>

                    <span>
                      {formatNumber(remaining)} days available
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Recent requests */}

      <Panel>
        <SectionHeading
          title="Recent leave requests"
          description="Track the status of your latest applications"
          action={
            <Link
              to="/employee/leave"
              className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-[#8a6725] hover:text-[#071a35]"
            >
              View all
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          }
        />

        {dashboardData.recentLeaveRequests.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No leave requests yet"
            description="Your submitted applications will appear here with their approval status."
            action={
              <Link
                to="/employee/apply-leave"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#071a35] px-4 py-2 text-sm font-medium text-white hover:bg-[#10294c]"
              >
                <Plus size={16} aria-hidden="true" />
                Apply for leave
              </Link>
            }
          />
        ) : (
          <>
            {/* Mobile request cards */}

            <div className="space-y-3 md:hidden">
              {dashboardData.recentLeaveRequests.slice(0, 5).map((request) => {
                const StatusIcon = getStatusIcon(request.status);

                return (
                  <Link
                    key={request.id}
                    to={`/employee/leave/${request.id}`}
                    className="block min-w-0 rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#c49a45]"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-slate-900">
                          {request.leaveTypeName}
                        </p>

                        <p className="mt-1 break-words text-xs text-slate-500">
                          Ref: {request.referenceNumber}
                        </p>
                      </div>

                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[request.status]}`}
                      >
                        <StatusIcon size={13} aria-hidden="true" />
                        {getDisplayStatus(request.status)}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">Period</p>
                        <p className="mt-1 break-words text-slate-700">
                          {formatDateRange(
                            request.startDate,
                            request.endDate,
                          )}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">Duration</p>
                        <p className="mt-1 font-medium text-slate-800">
                          {formatNumber(request.totalDays)} days
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="text-xs text-slate-500">
                        Submitted {formatDate(request.submittedAt)}
                      </span>

                      <ArrowRight
                        size={16}
                        className="shrink-0 text-slate-400"
                        aria-hidden="true"
                      />
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Tablet and desktop request table */}

            <div className="hidden min-w-0 overflow-x-auto md:block">
              <table className="w-full min-w-[680px] table-auto text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3">Leave type</th>
                    <th className="px-3 py-3">Period</th>
                    <th className="px-3 py-3">Days</th>
                    <th className="px-3 py-3">Submitted</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">
                      <span className="sr-only">View request</span>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {dashboardData.recentLeaveRequests
                    .slice(0, 5)
                    .map((request) => (
                      <tr
                        key={request.id}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="max-w-[220px] px-3 py-4">
                          <Link
                            to={`/employee/leave/${request.id}`}
                            className="break-words text-sm font-medium text-slate-900 hover:text-[#8a6725]"
                          >
                            {request.leaveTypeName}
                          </Link>

                          <p className="mt-1 break-words text-xs text-slate-500">
                            {request.referenceNumber}
                          </p>
                        </td>

                        <td className="px-3 py-4 text-sm text-slate-600">
                          {formatDateRange(
                            request.startDate,
                            request.endDate,
                          )}
                        </td>

                        <td className="px-3 py-4 text-sm tabular-nums text-slate-700">
                          {formatNumber(request.totalDays)}
                        </td>

                        <td className="px-3 py-4 text-sm text-slate-600">
                          {formatDate(request.submittedAt)}
                        </td>

                        <td className="px-3 py-4">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[request.status]}`}
                          >
                            {getDisplayStatus(request.status)}
                          </span>
                        </td>

                        <td className="px-3 py-4 text-right">
                          <Link
                            to={`/employee/leave/${request.id}`}
                            aria-label={`View ${request.leaveTypeName} request`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#c49a45]"
                          >
                            <ArrowRight size={17} aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      {/* Notifications and events */}

      <section className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel>
          <SectionHeading
            title="Notifications"
            description="Recent updates for your account"
            action={
              <Link
                to="/employee/notifications"
                className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-[#8a6725] hover:text-[#071a35]"
              >
                View all
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            }
          />

          {dashboardData.notifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="You're all caught up"
              description="There are no notifications to display right now."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {dashboardData.notifications.slice(0, 5).map((notification) => (
                <div
                  key={notification.id}
                  className="flex min-w-0 items-start gap-3 py-4 first:pt-0 last:pb-0"
                >
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <Bell size={17} aria-hidden="true" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start gap-2">
                      <h3 className="min-w-0 flex-1 break-words text-sm font-medium text-slate-900">
                        {notification.title}
                      </h3>

                      {!notification.read && (
                        <span
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#c49a45]"
                          aria-label="Unread"
                        />
                      )}
                    </div>

                    <p className="mt-1 break-words text-sm leading-5 text-slate-500">
                      {notification.message}
                    </p>

                    <p className="mt-2 text-xs text-slate-400">
                      {formatDate(notification.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <SectionHeading
            title="Upcoming events"
            description="Important dates and announcements"
          />

          {dashboardData.upcomingEvents.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No upcoming events"
              description="Important dates and announcements will appear here when available."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {dashboardData.upcomingEvents
                .slice()
                .sort(
                  (first, second) =>
                    Date.parse(first.date) - Date.parse(second.date),
                )
                .slice(0, 5)
                .map((event) => (
                  <div
                    key={event.id}
                    className="flex min-w-0 items-start gap-3 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex h-11 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-amber-50 text-[#8a6725]">
                      <CalendarDays size={18} aria-hidden="true" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="break-words text-sm font-semibold text-slate-900">
                        {event.title}
                      </h3>

                      <p className="mt-1 break-words text-xs text-slate-500">
                        {formatDate(event.date)}
                      </p>

                      {event.description && (
                        <p className="mt-2 break-words text-sm leading-5 text-slate-600">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Panel>
      </section>

      {/* Footer note */}

      <div className="flex min-w-0 items-start gap-2 px-1 text-xs leading-5 text-slate-500">
        <Info
          size={15}
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        />

        <p className="min-w-0 break-words">
          Leave balances and request statuses reflect the records supplied by
          the leave service. Contact HR if a balance or approval status appears
          incorrect.
        </p>
      </div>
    </main>
  );
}

export default EmployeeDashboard;
