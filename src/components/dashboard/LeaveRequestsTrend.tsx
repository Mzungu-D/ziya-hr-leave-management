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

const defaultData: LeaveRequestsTrendData[] = [
  { month: "Jan", submitted: 42, approved: 35, rejected: 4 },
  { month: "Feb", submitted: 48, approved: 39, rejected: 5 },
  { month: "Mar", submitted: 56, approved: 46, rejected: 6 },
  { month: "Apr", submitted: 51, approved: 43, rejected: 4 },
  { month: "May", submitted: 67, approved: 55, rejected: 7 },
  { month: "Jun", submitted: 74, approved: 61, rejected: 8 },
  { month: "Jul", submitted: 82, approved: 69, rejected: 6 },
  { month: "Aug", submitted: 71, approved: 59, rejected: 7 },
  { month: "Sep", submitted: 64, approved: 54, rejected: 5 },
  { month: "Oct", submitted: 59, approved: 50, rejected: 4 },
  { month: "Nov", submitted: 53, approved: 45, rejected: 4 },
  { month: "Dec", submitted: 47, approved: 41, rejected: 3 },
];

function ChartSkeleton() {
  return (
    <div
      className="flex h-full min-h-[260px] animate-pulse items-end gap-2 px-4 pb-8 pt-6 sm:min-h-[300px]"
      role="status"
      aria-label="Loading leave request trend"
    >
      {[38, 55, 48, 67, 58, 76, 69, 61, 73, 52, 64, 46].map(
        (height, index) => (
          <div
            key={index}
            className="flex h-full flex-1 items-end"
          >
            <div
              className="w-full rounded-t-lg bg-slate-200"
              style={{ height: `${height}%` }}
            />
          </div>
        ),
      )}
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
    <div className="min-w-[170px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
      <p className="mb-2 text-xs font-bold text-slate-900">
        {label}
      </p>

      <div className="space-y-2">
        {payload.map((item) => {
          const key = String(item.name ?? "");

          return (
            <div
              key={key}
              className="flex items-center justify-between gap-5 text-xs"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: item.color ?? "#94a3b8",
                  }}
                  aria-hidden="true"
                />

                <span className="truncate text-slate-500">
                  {labels[key] ?? key}
                </span>
              </div>

              <span className="font-semibold text-slate-800">
                {item.value ?? 0}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LeaveRequestsTrend({
  data = defaultData,
  loading = false,
  title = "Leave Requests",
  subtitle = "Leave request activity throughout the year",
}: LeaveRequestsTrendProps) {
  return (
    <section
      className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="leave-requests-trend-title"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2
            id="leave-requests-trend-title"
            className="text-base font-bold text-slate-900 sm:text-lg"
          >
            {title}
          </h2>

          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
            {subtitle}
          </p>
        </div>

        <select
          aria-label="Leave request trend period"
          defaultValue="this-year"
          className="h-9 w-full shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 outline-none transition focus:border-[#c89b20] focus:ring-2 focus:ring-[#c89b20]/10 sm:w-auto"
        >
          <option value="this-year">This year</option>
          <option value="last-year">Last year</option>
        </select>
      </div>

      <div className="h-[300px] w-full min-w-0">
        {loading ? (
          <ChartSkeleton />
        ) : data.length === 0 ? (
          <div className="flex h-full min-h-[260px] items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">
                No leave request data
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Request activity will appear here once data is available.
              </p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
          >
            <AreaChart
              data={data}
              margin={{
                top: 10,
                right: 8,
                left: -18,
                bottom: 8,
              }}
            >
              <defs>
                <linearGradient
                  id="submittedGradient"
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
                  id="approvedGradient"
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
                fill="url(#submittedGradient)"
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
                fill="url(#approvedGradient)"
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

      {!loading && data.length > 0 && (
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