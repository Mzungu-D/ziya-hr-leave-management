import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface LeaveUtilizationData {
  month: string;
  annual: number;
  sick: number;
  maternity: number;
  paternity: number;
  other: number;
}

interface LeaveUtilizationChartProps {
  data?: LeaveUtilizationData[];
  loading?: boolean;
  title?: string;
  subtitle?: string;
}

function ChartSkeleton() {
  return (
    <div
      className="flex h-full min-h-[260px] animate-pulse items-end gap-3 overflow-hidden px-4 pb-8 pt-6 sm:min-h-[300px]"
      role="status"
      aria-label="Loading leave utilization chart"
    >
      {[45, 60, 35, 70, 55, 82, 65, 48, 72, 58, 76, 50].map(
        (height, index) => (
          <div
            key={index}
            className="flex min-w-0 flex-1 items-end gap-1"
          >
            <div
              className="w-full rounded-t bg-slate-200"
              style={{ height: `${height}%` }}
            />
            <div
              className="w-full rounded-t bg-slate-100"
              style={{
                height: `${Math.max(height - 20, 15)}%`,
              }}
            />
          </div>
        ),
      )}

      <span className="sr-only">
        Loading leave utilization data
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[260px] items-center justify-center px-4 sm:min-h-[300px]">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <span
            className="text-lg font-bold text-slate-400"
            aria-hidden="true"
          >
            —
          </span>
        </div>

        <p className="mt-3 text-sm font-semibold text-slate-700">
          No utilization data
        </p>

        <p className="mt-1 max-w-[260px] text-xs leading-5 text-slate-400">
          Leave utilization will appear here once leave
          activity is available.
        </p>
      </div>
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="max-w-[calc(100vw-32px)] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
      <p className="mb-2 truncate text-xs font-bold text-slate-900">
        {label ?? "Period"}
      </p>

      <div className="space-y-1.5">
        {payload.map((item) => {
          const value = Number(item.value ?? 0);

          return (
            <div
              key={item.name ?? "leave"}
              className="flex items-center justify-between gap-4 text-xs"
            >
              <span className="truncate text-slate-500">
                {item.name ?? "Leave"}
              </span>

              <span className="shrink-0 font-semibold text-slate-800">
                {value.toLocaleString()} days
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LeaveUtilizationChart({
  data = [],
  loading = false,
  title = "Leave Utilization",
  subtitle = "Monthly leave usage",
}: LeaveUtilizationChartProps) {
  const safeData = Array.isArray(data)
    ? data.filter(
        (item) =>
          item &&
          typeof item.month === "string" &&
          [
            item.annual,
            item.sick,
            item.maternity,
            item.paternity,
            item.other,
          ].some((value) => Number(value) > 0),
      )
    : [];

  return (
    <section
      className="min-w-0 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="leave-utilization-title"
    >
      <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2
            id="leave-utilization-title"
            className="truncate text-base font-bold text-slate-900 sm:text-lg"
          >
            {title}
          </h2>

          <p className="mt-0.5 truncate text-xs text-slate-500 sm:text-sm">
            {subtitle}
          </p>
        </div>

        <select
          aria-label="Leave utilization period"
          className="h-9 w-full shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 outline-none transition focus:border-[#c89b20] focus:ring-2 focus:ring-[#c89b20]/10 sm:w-auto"
          defaultValue="this-year"
        >
          <option value="this-year">This year</option>
          <option value="last-year">Last year</option>
        </select>
      </div>

      <div className="h-[280px] w-full min-w-0 sm:h-[300px]">
        {loading ? (
          <ChartSkeleton />
        ) : safeData.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={0}
          >
            <BarChart
              data={safeData}
              margin={{
                top: 8,
                right: 8,
                left: -12,
                bottom: 8,
              }}
              barCategoryGap="18%"
            >
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
                interval="preserveStartEnd"
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
                  fill: "rgba(148, 163, 184, 0.08)",
                }}
                content={<CustomTooltip />}
              />

              <Legend
                verticalAlign="bottom"
                align="center"
                iconType="circle"
                iconSize={7}
                wrapperStyle={{
                  fontSize: "11px",
                  paddingTop: "18px",
                  maxWidth: "100%",
                }}
              />

              <Bar
                dataKey="annual"
                name="Annual"
                fill="#2f80ed"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
                isAnimationActive={false}
              />

              <Bar
                dataKey="sick"
                name="Sick"
                fill="#43b581"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
                isAnimationActive={false}
              />

              <Bar
                dataKey="maternity"
                name="Maternity"
                fill="#f2778a"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
                isAnimationActive={false}
              />

              <Bar
                dataKey="paternity"
                name="Paternity"
                fill="#8b6fe8"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
                isAnimationActive={false}
              />

              <Bar
                dataKey="other"
                name="Other"
                fill="#f4bd42"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}