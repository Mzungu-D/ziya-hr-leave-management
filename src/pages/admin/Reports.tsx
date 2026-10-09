import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileBarChart,
  RefreshCw,
  Users,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  getAnnualReports,
  getReportsForDateRange,
  type DepartmentReportItem,
  type EmployeeReportItem,
  type LeaveTypeReportItem,
  type ReportsAnalytics,
} from "../../services/reports.service";

type ReportMode = "year" | "range";

const CURRENT_YEAR = new Date().getFullYear();

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  MANAGER_APPROVED: "Manager Approved",
  HR_APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-KE", {
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-KE", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number): string {
  return `${Math.max(
    0,
    Math.min(100, Number.isFinite(value) ? value : 0),
  ).toFixed(1)}%`;
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function downloadCsv(
  filename: string,
  rows: Array<Record<string, string | number>>,
): void {
  if (rows.length === 0) {
    return;
  }

  const headers = Object.keys(rows[0]);

  const escapeCsv = (value: unknown): string => {
    const stringValue = String(value ?? "");

    if (
      stringValue.includes(",") ||
      stringValue.includes('"') ||
      stringValue.includes("\n")
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  };

  const csv = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) =>
      headers
        .map((header) => escapeCsv(row[header]))
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
}

function getStatusLabel(status: string): string {
  return (
    STATUS_LABELS[status] ||
    status
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (character) =>
        character.toUpperCase(),
      )
  );
}

function getStatusClass(status: string): string {
  switch (status) {
    case "HR_APPROVED":
      return "bg-emerald-50 text-emerald-700";

    case "MANAGER_APPROVED":
      return "bg-blue-50 text-blue-700";

    case "PENDING":
      return "bg-amber-50 text-amber-700";

    case "REJECTED":
      return "bg-red-50 text-red-700";

    case "CANCELLED":
      return "bg-slate-100 text-slate-600";

    default:
      return "bg-slate-100 text-slate-700";
  }
}

function StatCard({
  label,
  value,
  description,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string;
  description: string;
  icon: typeof Users;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-[#071a35]">
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {description}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
        >
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#071a35]">
            {title}
          </h2>

          {description ? (
            <p className="mt-1 text-xs text-slate-500">
              {description}
            </p>
          ) : null}
        </div>

        {action}
      </div>

      <div className="p-5">{children}</div>
    </section>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <FileBarChart size={22} />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-slate-700">
        {title}
      </h3>

      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-2xl bg-slate-100"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="h-[380px] animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-[380px] animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}

export function Reports() {
  const [report, setReport] =
    useState<ReportsAnalytics | null>(null);

  const [mode, setMode] =
    useState<ReportMode>("year");

  const [year, setYear] =
    useState<number>(CURRENT_YEAR);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [loading, setLoading] =
    useState<boolean>(true);

  const [refreshing, setRefreshing] =
    useState<boolean>(false);

  const [error, setError] =
    useState<string | null>(null);

  const [selectedDepartment, setSelectedDepartment] =
    useState<string>("all");

  const loadReport = useCallback(
    async (signal?: AbortSignal) => {
      setError(null);

      try {
        if (mode === "range") {
          if (!from || !to) {
            throw new Error(
              "Please select both a start and end date.",
            );
          }

          const data =
            await getReportsForDateRange(
              from,
              to,
              signal,
            );

          setReport(data);
          return;
        }

        const data = await getAnnualReports(
          year,
          signal,
        );

        setReport(data);
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load reports.",
        );
      }
    },
    [from, mode, to, year],
  );

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);

    void loadReport(controller.signal).finally(() => {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    });

    return () => controller.abort();
  }, [loadReport]);

  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      await loadReport();
    } finally {
      setRefreshing(false);
    }
  };

  const departmentNames = useMemo(() => {
    if (!report) {
      return [];
    }

    return report.departmentReport
      .map((department) => department.departmentName)
      .filter(
        (name, index, values) =>
          values.indexOf(name) === index,
      )
      .sort((a, b) => a.localeCompare(b));
  }, [report]);

  const filteredDepartments = useMemo(() => {
    if (!report) {
      return [];
    }

    if (selectedDepartment === "all") {
      return report.departmentReport;
    }

    return report.departmentReport.filter(
      (department) =>
        department.departmentName ===
        selectedDepartment,
    );
  }, [report, selectedDepartment]);

  const filteredEmployees = useMemo(() => {
    if (!report) {
      return [];
    }

    if (selectedDepartment === "all") {
      return report.employeeReport;
    }

    return report.employeeReport.filter(
      (employee) =>
        employee.departmentName ===
        selectedDepartment,
    );
  }, [report, selectedDepartment]);

  const handleExportDepartments = () => {
    if (!filteredDepartments.length) {
      return;
    }

    downloadCsv(
      `ziya-hr-department-report-${report?.period.year}.csv`,
      filteredDepartments.map(
        (department: DepartmentReportItem) => ({
          Department: department.departmentName,
          Employees: department.employeeCount,
          "Leave Requests": department.leaveRequests,
          "Approved Requests":
            department.approvedRequests,
          "Pending Requests":
            department.pendingRequests,
          "Rejected Requests":
            department.rejectedRequests,
          "Cancelled Requests":
            department.cancelledRequests,
          "Requested Days": department.requestedDays,
          "Approved Days": department.approvedDays,
          "Utilization Rate":
            `${department.utilizationRate.toFixed(1)}%`,
        }),
      ),
    );
  };

  const handleExportEmployees = () => {
    if (!filteredEmployees.length) {
      return;
    }

    downloadCsv(
      `ziya-hr-employee-report-${report?.period.year}.csv`,
      filteredEmployees.map(
        (employee: EmployeeReportItem) => ({
          "Employee ID": employee.employeeNumber,
          Employee: employee.employeeName,
          Department: employee.departmentName,
          Status: employee.status,
          "Leave Requests": employee.leaveRequests,
          "Approved Requests":
            employee.approvedRequests,
          "Pending Requests":
            employee.pendingRequests,
          "Rejected Requests":
            employee.rejectedRequests,
          "Cancelled Requests":
            employee.cancelledRequests,
          "Requested Days": employee.requestedDays,
          "Approved Days": employee.approvedDays,
          "Pending Days": employee.pendingDays,
        }),
      ),
    );
  };

  if (loading && !report) {
    return (
      <div className="mx-auto w-full max-w-[1800px] p-4 sm:p-6 lg:p-8">
        <div className="mb-6">
          <div className="h-8 w-64 animate-pulse rounded bg-slate-100" />
          <div className="mt-2 h-4 w-96 max-w-full animate-pulse rounded bg-slate-100" />
        </div>

        <LoadingState />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#071a35] text-[#d8a415]">
              <BarChart3 size={21} />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#071a35] sm:text-3xl">
                Reports & Analytics
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Workforce and leave analytics for your organization.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setMode("year")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                mode === "year"
                  ? "bg-[#071a35] text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Annual
            </button>

            <button
              type="button"
              onClick={() => setMode("range")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                mode === "range"
                  ? "bg-[#071a35] text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Custom range
            </button>
          </div>

          {mode === "year" ? (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">
                Reporting year
              </span>

              <select
                value={year}
                onChange={(event) =>
                  setYear(Number(event.target.value))
                }
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-[#d8a415] focus:ring-2 focus:ring-[#d8a415]/20"
              >
                {Array.from(
                  { length: 11 },
                  (_, index) =>
                    CURRENT_YEAR - 5 + index,
                ).map((optionYear) => (
                  <option
                    key={optionYear}
                    value={optionYear}
                  >
                    {optionYear}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500">
                  From
                </span>

                <input
                  type="date"
                  value={from}
                  onChange={(event) =>
                    setFrom(event.target.value)
                  }
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#d8a415] focus:ring-2 focus:ring-[#d8a415]/20"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500">
                  To
                </span>

                <input
                  type="date"
                  value={to}
                  onChange={(event) =>
                    setTo(event.target.value)
                  }
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#d8a415] focus:ring-2 focus:ring-[#d8a415]/20"
                />
              </label>
            </>
          )}

          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#071a35] px-4 text-sm font-semibold text-white transition hover:bg-[#0c274b] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={
                refreshing ? "animate-spin" : ""
              }
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
          <AlertCircle
            size={20}
            className="mt-0.5 shrink-0"
          />

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              Unable to load reports
            </p>

            <p className="mt-1 text-sm text-red-700">
              {error}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      ) : null}

      {report ? (
        <>
          {/* Report period */}
          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-[#b8860b]">
                <CalendarDays size={18} />
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Reporting period
                </p>

                <p className="mt-0.5 text-sm font-semibold text-[#071a35]">
                  {formatDate(report.period.from)} —{" "}
                  {formatDate(report.period.to)}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Generated{" "}
              {new Intl.DateTimeFormat("en-KE", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(
                new Date(report.generatedAt),
              )}
            </p>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Employees"
              value={formatInteger(
                report.overview.totalEmployees,
              )}
              description={`${formatInteger(
                report.overview.activeEmployees,
              )} active employees`}
              icon={Users}
              iconClass="bg-blue-50 text-blue-700"
            />

            <StatCard
              label="Leave Requests"
              value={formatInteger(
                report.overview.totalLeaveRequests,
              )}
              description={`${formatInteger(
                report.overview.pendingLeaveRequests,
              )} currently pending`}
              icon={Activity}
              iconClass="bg-violet-50 text-violet-700"
            />

            <StatCard
              label="Approved Leave"
              value={formatInteger(
                report.overview.approvedLeaveDays,
              )}
              description={`${formatInteger(
                report.overview.approvedLeaveRequests,
              )} approved requests`}
              icon={CheckCircle2}
              iconClass="bg-emerald-50 text-emerald-700"
            />

            <StatCard
              label="Leave Utilization"
              value={formatPercent(
                report.overview.utilizationRate,
              )}
              description={`${formatNumber(
                report.overview.pendingLeaveDays,
              )} days pending`}
              icon={BarChart3}
              iconClass="bg-amber-50 text-amber-700"
            />
          </div>

          {/* Secondary summary */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500">
                <Clock3 size={16} />
                <span className="text-xs font-medium">
                  Pending
                </span>
              </div>

              <p className="mt-2 text-xl font-bold text-[#071a35]">
                {formatInteger(
                  report.overview.pendingLeaveRequests,
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 size={16} />
                <span className="text-xs font-medium">
                  Approved
                </span>
              </div>

              <p className="mt-2 text-xl font-bold text-[#071a35]">
                {formatInteger(
                  report.overview.approvedLeaveRequests,
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-red-600">
                <XCircle size={16} />
                <span className="text-xs font-medium">
                  Rejected
                </span>
              </div>

              <p className="mt-2 text-xl font-bold text-[#071a35]">
                {formatInteger(
                  report.overview.rejectedLeaveRequests,
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500">
                <Users size={16} />
                <span className="text-xs font-medium">
                  Departments
                </span>
              </div>

              <p className="mt-2 text-xl font-bold text-[#071a35]">
                {formatInteger(
                  report.overview.totalDepartments,
                )}
              </p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <SectionCard
              title="Leave requests trend"
              description="Monthly leave request activity during the reporting period."
            >
              {report.monthlyLeaveRequests.length ===
              0 ? (
                <EmptyState
                  title="No leave activity"
                  description="There are no leave requests in the selected reporting period."
                />
              ) : (
                <div className="h-[330px] w-full">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <LineChart
                      data={
                        report.monthlyLeaveRequests
                      }
                      margin={{
                        top: 10,
                        right: 10,
                        left: -15,
                        bottom: 0,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="label"
                        tick={{
                          fontSize: 11,
                        }}
                        tickLine={false}
                        axisLine={false}
                      />

                      <YAxis
                        allowDecimals={false}
                        tick={{
                          fontSize: 11,
                        }}
                        tickLine={false}
                        axisLine={false}
                      />

                      <Tooltip />

                      <Legend />

                      <Line
                        type="monotone"
                        dataKey="totalRequests"
                        name="Total"
                        stroke="#071a35"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />

                      <Line
                        type="monotone"
                        dataKey="approvedRequests"
                        name="Approved"
                        stroke="#16a34a"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                      />

                      <Line
                        type="monotone"
                        dataKey="pendingRequests"
                        name="Pending"
                        stroke="#d8a415"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Leave status distribution"
              description="Breakdown of leave requests by workflow status."
            >
              {report.leaveStatusReport.length ===
              0 ? (
                <EmptyState
                  title="No status data"
                  description="There are no leave requests to display for this period."
                />
              ) : (
                <div className="h-[330px] w-full">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <PieChart>
                      <Pie
                        data={report.leaveStatusReport}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={3}
                      >
                        {report.leaveStatusReport.map(
                          (entry, index) => (
                            <Cell
                              key={`${entry.status}-${index}`}
                              fill={
                                [
                                  "#071a35",
                                  "#16a34a",
                                  "#d8a415",
                                  "#dc2626",
                                  "#64748b",
                                ][
                                  index % 5
                                ]
                              }
                            />
                          ),
                        )}
                      </Pie>

                      <Tooltip
                        formatter={(value) =>
                          formatInteger(
                            Number(value),
                          )
                        }
                      />

                      <Legend
                        formatter={(value) =>
                          getStatusLabel(value)
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>
          </div>

          {/* Department analytics */}
          <SectionCard
            title="Department analytics"
            description="Leave activity and utilization by department."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedDepartment}
                  onChange={(event) =>
                    setSelectedDepartment(
                      event.target.value,
                    )
                  }
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-[#d8a415]"
                >
                  <option value="all">
                    All departments
                  </option>

                  {departmentNames.map(
                    (department) => (
                      <option
                        key={department}
                        value={department}
                      >
                        {department}
                      </option>
                    ),
                  )}
                </select>

                <button
                  type="button"
                  onClick={handleExportDepartments}
                  disabled={
                    filteredDepartments.length ===
                    0
                  }
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download size={14} />
                  Export
                </button>
              </div>
            }
          >
            {filteredDepartments.length === 0 ? (
              <EmptyState
                title="No department data"
                description="No departments have reportable leave activity for this period."
              />
            ) : (
              <div className="space-y-6">
                <div className="h-[320px] w-full">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <BarChart
                      data={filteredDepartments}
                      margin={{
                        top: 10,
                        right: 10,
                        left: -15,
                        bottom: 45,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="departmentName"
                        angle={-25}
                        textAnchor="end"
                        interval={0}
                        tick={{
                          fontSize: 10,
                        }}
                        tickLine={false}
                        axisLine={false}
                      />

                      <YAxis
                        allowDecimals={false}
                        tick={{
                          fontSize: 11,
                        }}
                        tickLine={false}
                        axisLine={false}
                      />

                      <Tooltip />

                      <Legend />

                      <Bar
                        dataKey="leaveRequests"
                        name="Requests"
                        fill="#071a35"
                        radius={[
                          5,
                          5,
                          0,
                          0,
                        ]}
                      />

                      <Bar
                        dataKey="approvedRequests"
                        name="Approved"
                        fill="#16a34a"
                        radius={[
                          5,
                          5,
                          0,
                          0,
                        ]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="min-w-[900px] w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">
                          Department
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          Employees
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          Requests
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          Approved
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          Pending
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          Requested days
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          Approved days
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          Utilization
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {filteredDepartments.map(
                        (department) => (
                          <tr
                            key={
                              department.departmentId ??
                              department.departmentName
                            }
                            className="hover:bg-slate-50"
                          >
                            <td className="px-4 py-3 font-medium text-slate-700">
                              {
                                department.departmentName
                              }
                            </td>

                            <td className="px-4 py-3 text-slate-600">
                              {formatInteger(
                                department.employeeCount,
                              )}
                            </td>

                            <td className="px-4 py-3 text-slate-600">
                              {formatInteger(
                                department.leaveRequests,
                              )}
                            </td>

                            <td className="px-4 py-3 text-emerald-700">
                              {formatInteger(
                                department.approvedRequests,
                              )}
                            </td>

                            <td className="px-4 py-3 text-amber-700">
                              {formatInteger(
                                department.pendingRequests,
                              )}
                            </td>

                            <td className="px-4 py-3 text-slate-600">
                              {formatNumber(
                                department.requestedDays,
                              )}
                            </td>

                            <td className="px-4 py-3 text-slate-600">
                              {formatNumber(
                                department.approvedDays,
                              )}
                            </td>

                            <td className="px-4 py-3 font-semibold text-[#071a35]">
                              {formatPercent(
                                department.utilizationRate,
                              )}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </SectionCard>

          {/* Leave type analytics */}
          <SectionCard
            title="Leave type utilization"
            description="Allocated, used and pending leave days by leave type."
          >
            {report.leaveTypeReport.length === 0 ? (
              <EmptyState
                title="No leave type data"
                description="No leave types have reportable balances for this period."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="min-w-[850px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">
                        Leave type
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Allocated
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Used
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Pending
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Remaining
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Requests
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Utilization
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {report.leaveTypeReport.map(
                      (
                        leaveType: LeaveTypeReportItem,
                      ) => (
                        <tr
                          key={
                            leaveType.leaveTypeId
                          }
                          className="hover:bg-slate-50"
                        >
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-slate-700">
                                {
                                  leaveType.leaveTypeName
                                }
                              </p>

                              <p className="mt-0.5 text-xs text-slate-400">
                                {
                                  leaveType.leaveTypeCode
                                }
                              </p>
                            </div>
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {formatNumber(
                              leaveType.allocatedDays,
                            )}
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {formatNumber(
                              leaveType.usedDays,
                            )}
                          </td>

                          <td className="px-4 py-3 text-amber-700">
                            {formatNumber(
                              leaveType.pendingDays,
                            )}
                          </td>

                          <td className="px-4 py-3 font-medium text-slate-700">
                            {formatNumber(
                              leaveType.remainingDays,
                            )}
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {formatInteger(
                              leaveType.requestCount,
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex min-w-[130px] items-center gap-3">
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-[#d8a415]"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      Math.max(
                                        0,
                                        leaveType.utilizationRate,
                                      ),
                                    )}%`,
                                  }}
                                />
                              </div>

                              <span className="w-12 text-right text-xs font-semibold text-slate-700">
                                {formatPercent(
                                  leaveType.utilizationRate,
                                )}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Employee report */}
          <SectionCard
            title="Employee leave report"
            description="Detailed employee-level leave activity for the selected period."
            action={
              <button
                type="button"
                onClick={handleExportEmployees}
                disabled={
                  filteredEmployees.length === 0
                }
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download size={14} />
                Export CSV
              </button>
            }
          >
            {filteredEmployees.length === 0 ? (
              <EmptyState
                title="No employee data"
                description="No employees have reportable leave activity for the selected period."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="min-w-[1050px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">
                        Employee
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Department
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Status
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Requests
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Approved
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Pending
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Rejected
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Requested days
                      </th>
                      <th className="px-4 py-3 font-semibold">
                        Approved days
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredEmployees.map(
                      (
                        employee: EmployeeReportItem,
                      ) => (
                        <tr
                          key={
                            employee.employeeId
                          }
                          className="hover:bg-slate-50"
                        >
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-slate-700">
                                {
                                  employee.employeeName
                                }
                              </p>

                              <p className="mt-0.5 text-xs text-slate-400">
                                {
                                  employee.employeeNumber
                                }
                              </p>
                            </div>
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {
                              employee.departmentName
                            }
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                employee.status ===
                                "ACTIVE"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {employee.status}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {formatInteger(
                              employee.leaveRequests,
                            )}
                          </td>

                          <td className="px-4 py-3 text-emerald-700">
                            {formatInteger(
                              employee.approvedRequests,
                            )}
                          </td>

                          <td className="px-4 py-3 text-amber-700">
                            {formatInteger(
                              employee.pendingRequests,
                            )}
                          </td>

                          <td className="px-4 py-3 text-red-700">
                            {formatInteger(
                              employee.rejectedRequests,
                            )}
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {formatNumber(
                              employee.requestedDays,
                            )}
                          </td>

                          <td className="px-4 py-3 font-medium text-slate-700">
                            {formatNumber(
                              employee.approvedDays,
                            )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Status summary */}
          <SectionCard
            title="Leave status summary"
            description="Request counts and requested days by workflow status."
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {report.leaveStatusReport.map(
                (status) => (
                  <div
                    key={status.status}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(
                          status.status,
                        )}`}
                      >
                        {getStatusLabel(
                          status.status,
                        )}
                      </span>

                      <span className="text-xs font-semibold text-slate-400">
                        {formatPercent(
                          status.percentage,
                        )}
                      </span>
                    </div>

                    <p className="mt-3 text-xl font-bold text-[#071a35]">
                      {formatInteger(status.count)}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {formatNumber(
                        status.requestedDays,
                      )}{" "}
                      requested days
                    </p>
                  </div>
                ),
              )}
            </div>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}

export default Reports;