import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface LeaveRequestsTrendData {
  month: string;
  submitted: number;
  approved: number;
  rejected: number;
}

interface LeaveRequestsTrendProps {
  data?: LeaveRequestsTrendData[];
  loading?: boolean;
  title?: string;
  subtitle?: string;
}

function ChartSkeleton() {
  return (
    <div
      className="flex h-full min-h-[240px] animate-pulse items-end gap-2 px-2 pb-8 pt-6 sm:min-h-[280px] sm:px-4"
      role="status"
      aria-label="Loading leave request trend"
    >
      {Array.from({ length: 12 }).map((_, index) => (
        <div
          key={index}
          className="flex h-full min-w-0 flex-1 items-end"
        >
          <div
            className="w-full rounded-t-lg bg-slate-200"
            style={{
              height: `${35 + ((index * 17) % 45)}%`,
            }}
          />
        </div>
      ))}

      <span className="sr-only">
        Loading leave request activity
      </span>
    </div>
  );
}

interface TooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const labels: Record<string, string> = {
    submitted: "Submitted",
    approved: "Approved",
    rejected: "Rejected",
  };

  return (
    <div className="min-w-[160px] max-w-[calc(100vw-32px)] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
      <p className="mb-2 text-xs font-bold text-slate-900">
        {label || "Period"}
      </p>

      <div className="space-y-2">
        {payload.map((item, index) => {
          const key = String(item.name ?? index);

          return (
            <div
              key={`${key}-${index}`}
              className="flex items-center justify-between gap-4 text-xs"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      item.color ?? "#94a3b8",
                  }}
                  aria-hidden="true"
                />

                <span className="truncate text-slate-500">
                  {labels[key] ?? key}
                </span>
              </div>

              <span className="shrink-0 font-semibold text-slate-800">
                {Number(item.value) || 0}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LeaveRequestsTrend({
  data = [],
  loading = false,
  title = "Leave Requests",
  subtitle = "Leave request activity throughout the year",
}: LeaveRequestsTrendProps) {
  const chartData = Array.isArray(data)
    ? data
    : [];

  return (
    <section
      className="min-w-0 w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="leave-requests-trend-title"
    >
      <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2
            id="leave-requests-trend-title"
            className="text-base font-bold text-slate-900 sm:text-lg"
          >
            {title}
          </h2>

          <p className="mt-0.5 text-xs leading-5 text-slate-500 sm:text-sm">
            {subtitle}
          </p>
        </div>

        <select
          aria-label="Leave request trend period"
          defaultValue="this-year"
          className="h-9 w-full shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 outline-none transition focus:border-[#c89b20] focus:ring-2 focus:ring-[#c89b20]/10 sm:w-auto"
        >
          <option value="this-year">
            This year
          </option>
        </select>
      </div>

      <div className="h-[260px] w-full min-w-0 sm:h-[300px]">
        {loading ? (
          <ChartSkeleton />
        ) : chartData.length === 0 ? (
          <div className="flex h-full min-h-[240px] items-center justify-center px-4">
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">
                No leave request data
              </p>

              <p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">
                Leave request activity will appear here once
                your organization has recorded requests.
              </p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={0}
          >
            <AreaChart
              data={chartData}
              margin={{
                top: 10,
                right: 8,
                left: -18,
                bottom: 8,
              }}
            >
              <defs>
                <linearGradient
                  id="leaveSubmittedGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="#2f80ed"
                    stopOpacity={0.2}
                  />

                  <stop
                    offset="100%"
                    stopColor="#2f80ed"
                    stopOpacity={0}
                  />
                </linearGradient>

                <linearGradient
                  id="leaveApprovedGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="#43b581"
                    stopOpacity={0.16}
                  />

                  <stop
                    offset="100%"
                    stopColor="#43b581"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid
                stroke="#e2e8f0"
                strokeDasharray="3 3"
                vertical={false}
              />

              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={12}
                tick={{
                  fontSize: 11,
                  fill: "#64748b",
                }}
                dy={8}
              />

              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{
                  fontSize: 11,
                  fill: "#64748b",
                }}
                width={35}
                allowDecimals={false}
              />

              <Tooltip
                cursor={{
                  stroke: "#cbd5e1",
                  strokeWidth: 1,
                }}
                content={<CustomTooltip />}
              />

              <Area
                type="monotone"
                dataKey="submitted"
                name="submitted"
                stroke="#2f80ed"
                strokeWidth={2.5}
                fill="url(#leaveSubmittedGradient)"
                dot={false}
                activeDot={{
                  r: 5,
                  strokeWidth: 2,
                  stroke: "#ffffff",
                }}
              />

              <Area
                type="monotone"
                dataKey="approved"
                name="approved"
                stroke="#43b581"
                strokeWidth={2.5}
                fill="url(#leaveApprovedGradient)"
                dot={false}
                activeDot={{
                  r: 5,
                  strokeWidth: 2,
                  stroke: "#ffffff",
                }}
              />

              <Area
                type="monotone"
                dataKey="rejected"
                name="rejected"
                stroke="#ef6b73"
                strokeWidth={2}
                fill="transparent"
                dot={false}
                activeDot={{
                  r: 4,
                  strokeWidth: 2,
                  stroke: "#ffffff",
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {!loading && chartData.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span
              className="h-2 w-2 rounded-full bg-[#2f80ed]"
              aria-hidden="true"
            />
            Submitted
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span
              className="h-2 w-2 rounded-full bg-[#43b581]"
              aria-hidden="true"
            />
            Approved
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span
              className="h-2 w-2 rounded-full bg-[#ef6b73]"
              aria-hidden="true"
            />
            Rejected
          </div>
        </div>
      )}
    </section>
  );
}