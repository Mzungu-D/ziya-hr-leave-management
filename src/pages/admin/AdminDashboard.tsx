import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Users,
} from "lucide-react";

import { StatCard } from "../../components/dashboard/StatCard";
import { LeaveUtilizationChart } from "../../components/dashboard/LeaveUtilizationChart";
import { LeaveRequestsTrend } from "../../components/dashboard/LeaveRequestsTrend";
import { LeaveTypeDistribution } from "../../components/dashboard/LeaveTypeDistribution";
import { RecentLeaveRequests } from "../../components/dashboard/RecentLeaveRequests";
import { EmployeeDistribution } from "../../components/dashboard/EmployeeDistribution";
import { UpcomingEvents } from "../../components/dashboard/UpcomingEvents";
import { Announcements } from "../../components/dashboard/Announcements";
import { SystemOverview } from "../../components/dashboard/SystemOverview";
import { QuickActions } from "../../components/dashboard/QuickActions";

export function AdminDashboard() {
  const handleViewAllRequests = () => {
    // Connect to the Leave Management route when routing is implemented.
  };

  const handleViewRequest = () => {
    // Connect to the individual leave request detail view.
  };

  const handleViewEvents = () => {
    // Connect to the Holidays & Calendar route.
  };

  const handleViewAnnouncements = () => {
    // Connect to the announcements management view.
  };

  const handleQuickAction = () => {
    // Connect each action to its corresponding HR module.
  };

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {/* Page header */}
      <section className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#b88900]">
            <Activity size={14} />
            <span>HR Administration</span>
          </div>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Dashboard
          </h1>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Welcome back. Here is an overview of your organization&apos;s
            people, leave activity, approvals, and HR operations.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:flex">
            <CalendarDays size={16} className="text-slate-400" />

            <span className="text-xs font-medium text-slate-600">
              25 September 2026
            </span>
          </div>
        </div>
      </section>

      {/* Primary statistics */}
      <section
        aria-label="HR dashboard statistics"
        className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Total Employees"
          value="126"
          comparison="vs last month"
          trend="+6.8%"
          trendDirection="up"
          icon={Users}
          iconClassName="bg-blue-50 text-blue-600"
        />

        <StatCard
          label="Pending Approvals"
          value="8"
          comparison="Requests awaiting action"
          trend="3 urgent"
          trendDirection="neutral"
          icon={Clock3}
          iconClassName="bg-amber-50 text-amber-600"
          onClick={handleViewAllRequests}
          ariaLabel="View 8 pending leave approvals"
        />

        <StatCard
          label="Approved This Month"
          value="74"
          comparison="Leave requests approved"
          trend="+12.4%"
          trendDirection="up"
          icon={CheckCircle2}
          iconClassName="bg-emerald-50 text-emerald-600"
        />

        <StatCard
          label="Leave Requests"
          value="96"
          comparison="Submitted this month"
          trend="+8.1%"
          trendDirection="up"
          icon={FileCheck2}
          iconClassName="bg-violet-50 text-violet-600"
        />
      </section>

      {/* Main analytics */}
      <section className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <LeaveRequestsTrend />
        </div>

        <div className="min-w-0 xl:col-span-4">
          <LeaveTypeDistribution />
        </div>
      </section>

      {/* Secondary analytics */}
      <section className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <LeaveUtilizationChart />
        </div>

        <div className="min-w-0 xl:col-span-4">
          <EmployeeDistribution />
        </div>
      </section>

      {/* Requests and events */}
      <section className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <RecentLeaveRequests
            onViewAll={handleViewAllRequests}
            onViewRequest={handleViewRequest}
          />
        </div>

        <div className="min-w-0 xl:col-span-4">
          <UpcomingEvents onViewAll={handleViewEvents} />
        </div>
      </section>

      {/* Operational information */}
      <section className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-7">
          <Announcements onViewAll={handleViewAnnouncements} />
        </div>

        <div className="min-w-0 xl:col-span-5">
          <SystemOverview
            onEmployeesClick={() => {
              // Connect to employee management.
            }}
            onApprovalsClick={handleViewAllRequests}
            onAlertsClick={() => {
              // Connect to system alerts.
            }}
          />
        </div>
      </section>

      {/* Quick actions */}
      <section>
        <QuickActions onAction={handleQuickAction} />
      </section>

      {/* Dashboard footer status */}
      <section className="flex min-w-0 flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
            aria-hidden="true"
          />

          <p className="truncate text-xs font-medium text-slate-600">
            Ziya HR platform is operational
          </p>
        </div>

        <p className="text-[11px] text-slate-400">
          Dashboard data will be connected to the HR backend during
          integration.
        </p>
      </section>
    </div>
  );
}