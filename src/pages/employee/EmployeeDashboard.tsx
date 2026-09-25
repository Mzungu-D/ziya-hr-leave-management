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
  UserRound,
  WalletCards,
} from "lucide-react";
import type {
  LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

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
  type:
    | "HOLIDAY"
    | "LEAVE"
    | "ANNOUNCEMENT"
    | "OTHER";
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

const defaultDashboardData: EmployeeDashboardData = {
  leaveBalances: [],
  recentLeaveRequests: [],
  upcomingLeave: [],
  upcomingEvents: [],
  notifications: [],
};

/* ============================================================
   Helpers
============================================================ */

function formatDate(
  value: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  }).format(date);
}

function formatRelativeTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  const now = Date.now();
  const difference = now - date.getTime();

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (difference < minute) {
    return "Just now";
  }

  if (difference < hour) {
    const minutes = Math.floor(difference / minute);

    return `${minutes}m ago`;
  }

  if (difference < day) {
    const hours = Math.floor(difference / hour);

    return `${hours}h ago`;
  }

  if (difference < 7 * day) {
    const days = Math.floor(difference / day);

    return `${days}d ago`;
  }

  return formatDate(value, {
    day: "numeric",
    month: "short",
  });
}

function getInitials(
  firstName?: string,
  lastName?: string,
): string {
  const initials =
    `${firstName?.trim().charAt(0) ?? ""}${
      lastName?.trim().charAt(0) ?? ""
    }`.toUpperCase();

  return initials || "U";
}

function getStatusLabel(
  status: EmployeeLeaveRequestStatus,
): string {
  switch (status) {
    case "APPROVED":
      return "Approved";

    case "REJECTED":
      return "Rejected";

    case "CANCELLED":
      return "Cancelled";

    case "PENDING":
    default:
      return "Pending";
  }
}

function getStatusClasses(
  status: EmployeeLeaveRequestStatus,
): string {
  switch (status) {
    case "APPROVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "REJECTED":
      return "border-red-200 bg-red-50 text-red-700";

    case "CANCELLED":
      return "border-slate-200 bg-slate-100 text-slate-600";

    case "PENDING":
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function getEventIcon(
  type: EmployeeDashboardEvent["type"],
): LucideIcon {
  switch (type) {
    case "HOLIDAY":
      return CalendarDays;

    case "LEAVE":
      return PlaneTakeoff;

    case "ANNOUNCEMENT":
      return Info;

    case "OTHER":
    default:
      return CalendarDays;
  }
}

/* ============================================================
   Reusable UI
============================================================ */

interface SectionHeaderProps {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}

function SectionHeader({
  title,
  description,
  actionLabel,
  actionHref,
}: SectionHeaderProps) {
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

      {actionLabel && actionHref && (
        <Link
          to={actionHref}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[#a47700] transition hover:text-[#7f5b00] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2"
        >
          {actionLabel}

          <ArrowRight
            size={15}
            strokeWidth={2}
            aria-hidden="true"
          />
        </Link>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
}

function DashboardStatCard({
  label,
  value,
  description,
  icon: Icon,
  iconClassName,
}: StatCardProps) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
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

      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
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
   Main Dashboard
============================================================ */

export function EmployeeDashboard({
  data = defaultDashboardData,
  isLoading = false,
  error = null,
  onRetry,
}: EmployeeDashboardProps) {
  const { user } = useAuth();

  const firstName =
    user?.firstName?.trim() || "there";

  const fullName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : "Ziya HR Employee";

  const initials = getInitials(
    user?.firstName,
    user?.lastName,
  );

  const departmentName =
    user?.departmentName ||
    "Department not assigned";

  const jobTitle =
    user?.jobTitle || "Employee";

  const dashboardData =
    data ?? defaultDashboardData;

  const unreadNotifications =
    dashboardData.notifications.filter(
      (notification) => !notification.read,
    ).length;

  const pendingRequests =
    dashboardData.recentLeaveRequests.filter(
      (request) =>
        request.status === "PENDING",
    ).length;

  const approvedRequests =
    dashboardData.recentLeaveRequests.filter(
      (request) =>
        request.status === "APPROVED",
    ).length;

  const totalRemainingDays =
    dashboardData.leaveBalances.reduce(
      (total, balance) =>
        total +
        Math.max(balance.remainingDays, 0),
      0,
    );

  const nextLeave =
    dashboardData.upcomingLeave[0];

  /* ==========================================================
     Loading state
  ========================================================== */

  if (isLoading) {
    return (
      <div className="space-y-6 pb-8">
        <section className="overflow-hidden rounded-2xl bg-[#071a35] p-5 text-white shadow-sm sm:p-7">
          <div className="flex items-center gap-4">
            <LoadingBlock className="h-14 w-14 shrink-0 rounded-full bg-white/10" />

            <div className="min-w-0 flex-1 space-y-2">
              <LoadingBlock className="h-5 w-48 bg-white/10" />
              <LoadingBlock className="h-4 w-64 max-w-full bg-white/10" />
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map(
            (_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <LoadingBlock className="h-3 w-24" />

                <LoadingBlock className="mt-4 h-8 w-20" />

                <LoadingBlock className="mt-2 h-3 w-32" />
              </div>
            ),
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <LoadingBlock className="h-5 w-36" />
            <LoadingBlock className="mt-6 h-48 w-full" />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <LoadingBlock className="h-5 w-36" />
            <LoadingBlock className="mt-6 h-48 w-full" />
          </div>
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
            <Info
              size={22}
              strokeWidth={1.9}
              aria-hidden="true"
            />
          </div>

          <h1 className="mt-4 text-lg font-bold text-slate-900">
            We couldn't load your dashboard
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {error}
          </p>

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-[#d8a415] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#bf920f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2"
            >
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
      {/* ======================================================
          Welcome / Employee Identity
      ======================================================= */}

      <section className="relative overflow-hidden rounded-2xl bg-[#071a35] text-white shadow-sm">
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#d8a415]/10 blur-3xl"
          aria-hidden="true"
        />

        <div
          className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-white/5 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            {/* Profile picture */}
            {user?.profilePictureUrl ? (
              <img
                src={user.profilePictureUrl}
                alt={`${fullName} profile`}
                className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-white/20 sm:h-16 sm:w-16"
              />
            ) : (
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/10 text-base font-bold text-white ring-2 ring-white/10 sm:h-16 sm:w-16"
                aria-hidden="true"
              >
                {initials || (
                  <UserRound
                    size={24}
                    strokeWidth={1.7}
                  />
                )}
              </div>
            )}

            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-slate-300">
                Employee Dashboard
              </p>

              <h1 className="mt-1 truncate text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
                Welcome back, {firstName}
              </h1>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-300">
                {jobTitle} • {departmentName}
              </p>
            </div>
          </div>

          {/* Apply for Leave */}
          <Link
            to="/employee/leave"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#d8a415] px-5 text-sm font-bold text-white shadow-lg shadow-black/10 transition hover:bg-[#bf920f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8a415] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071a35]"
          >
            <Plus
              size={18}
              strokeWidth={2.2}
              aria-hidden="true"
            />

            Apply for Leave
          </Link>
        </div>
      </section>

      {/* ======================================================
          Summary Cards
      ======================================================= */}

      <section aria-label="Leave summary">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardStatCard
            label="Leave Remaining"
            value={
              dashboardData.leaveBalances.length > 0
                ? `${totalRemainingDays} days`
                : "—"
            }
            description="Across available leave types"
            icon={WalletCards}
            iconClassName="bg-emerald-50 text-emerald-600"
          />

          <DashboardStatCard
            label="Pending Requests"
            value={
              dashboardData.recentLeaveRequests.length >
              0
                ? String(pendingRequests)
                : "—"
            }
            description="Requests awaiting action"
            icon={Clock3}
            iconClassName="bg-amber-50 text-amber-600"
          />

          <DashboardStatCard
            label="Approved Requests"
            value={
              dashboardData.recentLeaveRequests.length >
              0
                ? String(approvedRequests)
                : "—"
            }
            description="Approved leave requests"
            icon={CheckCircle2}
            iconClassName="bg-blue-50 text-blue-600"
          />

          <DashboardStatCard
            label="Notifications"
            value={
              dashboardData.notifications.length > 0
                ? String(unreadNotifications)
                : "—"
            }
            description="Unread notifications"
            icon={Bell}
            iconClassName="bg-violet-50 text-violet-600"
          />
        </div>
      </section>

      {/* ======================================================
          Leave Balances + Upcoming Leave
      ======================================================= */}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        {/* Leave balances */}
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <SectionHeader
              title="Leave Balance"
              description="Your available leave entitlement and usage."
              actionLabel="View all"
              actionHref="/employee/leave"
            />
          </div>

          {dashboardData.leaveBalances.length ===
          0 ? (
            <EmptyState
              icon={WalletCards}
              title="No leave balance available yet"
              description="Your leave balances will appear here once your HR records have been synchronized."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {dashboardData.leaveBalances.map(
                (balance) => {
                  const entitlement = Math.max(
                    balance.entitledDays,
                    0,
                  );

                  const used = Math.max(
                    balance.usedDays,
                    0,
                  );

                  const remaining = Math.max(
                    balance.remainingDays,
                    0,
                  );

                  const usagePercentage =
                    entitlement > 0
                      ? Math.min(
                          Math.round(
                            (used / entitlement) *
                              100,
                          ),
                          100,
                        )
                      : 0;

                  return (
                    <div
                      key={balance.leaveTypeId}
                      className="p-5 sm:p-6"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {balance.leaveTypeName}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {used} used of{" "}
                            {entitlement} days
                          </p>
                        </div>

                        <div className="shrink-0 text-left sm:text-right">
                          <p className="text-lg font-bold text-slate-900">
                            {remaining}
                          </p>

                          <p className="text-xs text-slate-500">
                            days remaining
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-[#d8a415] transition-all"
                          style={{
                            width: `${usagePercentage}%`,
                          }}
                          aria-label={`${usagePercentage}% of ${balance.leaveTypeName} entitlement used`}
                        />
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </section>

        {/* Upcoming leave */}
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <SectionHeader
              title="Upcoming Leave"
              description="Your next approved time away."
              actionLabel="Calendar"
              actionHref="/employee/calendar"
            />
          </div>

          {nextLeave ? (
            <div className="p-5 sm:p-6">
              <div className="rounded-2xl bg-slate-50 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#d8a415]/10 text-[#a47700]">
                    <PlaneTakeoff
                      size={20}
                      strokeWidth={1.9}
                      aria-hidden="true"
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">
                      {nextLeave.leaveTypeName}
                    </p>

                    <p className="mt-1 text-sm text-slate-600">
                      {formatDate(
                        nextLeave.startDate,
                      )}{" "}
                      –{" "}
                      {formatDate(
                        nextLeave.endDate,
                      )}
                    </p>

                    <p className="mt-2 text-xs font-medium text-slate-500">
                      {nextLeave.totalDays}{" "}
                      {nextLeave.totalDays === 1
                        ? "day"
                        : "days"}
                    </p>
                  </div>
                </div>
              </div>

              {dashboardData.upcomingLeave.length >
                1 && (
                <div className="mt-4 space-y-3">
                  {dashboardData.upcomingLeave
                    .slice(1, 3)
                    .map((leave) => (
                      <div
                        key={leave.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {leave.leaveTypeName}
                          </p>

                          <p className="mt-0.5 text-xs text-slate-500">
                            {formatDate(
                              leave.startDate,
                            )}
                          </p>
                        </div>

                        <span className="shrink-0 text-xs font-semibold text-slate-600">
                          {leave.totalDays}d
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={PlaneTakeoff}
              title="No upcoming leave"
              description="You don't have any upcoming approved leave at the moment."
              action={
                <Link
                  to="/employee/leave"
                  className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2"
                >
                  Apply for leave
                  <ArrowRight
                    size={14}
                    aria-hidden="true"
                  />
                </Link>
              }
            />
          )}
        </section>
      </div>

      {/* ======================================================
          Recent Requests + Notifications
      ======================================================= */}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        {/* Recent leave requests */}
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <SectionHeader
              title="Recent Leave Requests"
              description="Track the status of your submitted requests."
              actionLabel="View leave history"
              actionHref="/employee/leave"
            />
          </div>

          {dashboardData.recentLeaveRequests
            .length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No leave requests yet"
              description="Your submitted leave requests will appear here with their approval status."
              action={
                <Link
                  to="/employee/leave"
                  className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-[#d8a415] px-3.5 text-xs font-semibold text-white transition hover:bg-[#bf920f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2"
                >
                  <Plus
                    size={14}
                    aria-hidden="true"
                  />
                  Apply for leave
                </Link>
              }
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {dashboardData.recentLeaveRequests
                .slice(0, 5)
                .map((request) => (
                  <Link
                    key={request.id}
                    to={`/employee/leave/${request.id}`}
                    className="block p-5 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#c89b20] sm:p-6"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {request.leaveTypeName}
                          </p>

                          <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getStatusClasses(
                              request.status,
                            )}`}
                          >
                            {getStatusLabel(
                              request.status,
                            )}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-slate-500">
                          {formatDate(
                            request.startDate,
                          )}{" "}
                          –{" "}
                          {formatDate(
                            request.endDate,
                          )}
                        </p>

                        <p className="mt-1 text-[11px] text-slate-400">
                          {request.referenceNumber}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center justify-between gap-4 sm:block sm:text-right">
                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            {request.totalDays}{" "}
                            {request.totalDays === 1
                              ? "day"
                              : "days"}
                          </p>

                          <p className="mt-1 text-[11px] text-slate-400">
                            Submitted{" "}
                            {formatRelativeTime(
                              request.submittedAt,
                            )}
                          </p>
                        </div>

                        <ArrowRight
                          size={16}
                          className="text-slate-400 sm:hidden"
                          aria-hidden="true"
                        />
                      </div>
                    </div>

                    {request.status ===
                      "REJECTED" &&
                      request.rejectionReason && (
                        <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                          <span className="font-semibold">
                            Reason:
                          </span>{" "}
                          {request.rejectionReason}
                        </div>
                      )}
                  </Link>
                ))}
            </div>
          )}
        </section>

        {/* Notifications */}
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <SectionHeader
              title="Notifications"
              description="Recent updates that may need your attention."
              actionLabel="View all"
              actionHref="/employee/notifications"
            />
          </div>

          {dashboardData.notifications.length ===
          0 ? (
            <EmptyState
              icon={Bell}
              title="You're all caught up"
              description="New leave decisions, announcements and important HR updates will appear here."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {dashboardData.notifications
                .slice(0, 5)
                .map((notification) => (
                  <Link
                    key={notification.id}
                    to="/employee/notifications"
                    className={`block p-4 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#c89b20] ${
                      notification.read
                        ? ""
                        : "bg-amber-50/30"
                    }`}
                  >
                    <div className="flex gap-3">
                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                          notification.read
                            ? "bg-slate-200"
                            : "bg-[#d8a415]"
                        }`}
                        aria-hidden="true"
                      />

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {notification.title}
                        </p>

                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                          {notification.message}
                        </p>

                        <p className="mt-2 text-[11px] text-slate-400">
                          {formatRelativeTime(
                            notification.createdAt,
                          )}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
            </div>
          )}
        </section>
      </div>

      {/* ======================================================
          Upcoming Events
      ======================================================= */}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <SectionHeader
            title="Upcoming Events"
            description="Public holidays, approved leave and important HR dates."
            actionLabel="Open calendar"
            actionHref="/employee/calendar"
          />
        </div>

        {dashboardData.upcomingEvents.length ===
        0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No upcoming events"
            description="Your HR calendar will show holidays, approved leave and other relevant dates here."
          />
        ) : (
          <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3">
            {dashboardData.upcomingEvents
              .slice(0, 6)
              .map((event) => {
                const EventIcon = getEventIcon(
                  event.type,
                );

                return (
                  <div
                    key={event.id}
                    className="flex gap-3 p-5"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <EventIcon
                        size={18}
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {event.title}
                      </p>

                      <p className="mt-1 text-xs font-medium text-[#a47700]">
                        {formatDate(event.date)}
                      </p>

                      {event.description && (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </section>

      {/* ======================================================
          Quick Actions
      ======================================================= */}

      <section>
        <div className="mb-3">
          <SectionHeader
            title="Quick Actions"
            description="Common tasks available from your employee workspace."
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            href="/employee/leave"
            icon={Plus}
            title="Apply for Leave"
            description="Submit a new leave request."
          />

          <QuickAction
            href="/employee/calendar"
            icon={CalendarDays}
            title="View Calendar"
            description="Check leave and HR dates."
          />

          <QuickAction
            href="/employee/team"
            icon={UserRound}
            title="View My Team"
            description="See team availability."
          />

          <QuickAction
            href="/employee/notifications"
            icon={Bell}
            title="Notifications"
            description={
              unreadNotifications > 0
                ? `${unreadNotifications} unread`
                : "You're all caught up."
            }
          />
        </div>
      </section>
    </div>
  );
}

/* ============================================================
   Quick Action
============================================================ */

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={href}
      className="group flex min-h-[104px] items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/30 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#d8a415]/10 text-[#a47700] transition group-hover:bg-[#d8a415] group-hover:text-white">
        <Icon
          size={20}
          strokeWidth={1.9}
          aria-hidden="true"
        />
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-slate-900">
          {title}
        </p>

        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>

      <ArrowRight
        size={16}
        className="ml-auto shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500"
        aria-hidden="true"
      />
    </Link>
  );
}