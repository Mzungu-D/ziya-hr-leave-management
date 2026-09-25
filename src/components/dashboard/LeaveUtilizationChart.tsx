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

const defaultData: LeaveUtilizationData[] = [
  {
    month: "Jan",
    annual: 28,
    sick: 12,
    maternity: 7,
    paternity: 3,
    other: 4,
  },
  {
    month: "Feb",
    annual: 32,
    sick: 15,
    maternity: 8,
    paternity: 4,
    other: 5,
  },
  {
    month: "Mar",
    annual: 40,
    sick: 20,
    maternity: 11,
    paternity: 5,
    other: 6,
  },
  {
    month: "Apr",
    annual: 42,
    sick: 23,
    maternity: 13,
    paternity: 5,
    other: 7,
  },
  {
    month: "May",
    annual: 51,
    sick: 27,
    maternity: 15,
    paternity: 6,
    other: 8,
  },
  {
    month: "Jun",
    annual: 63,
    sick: 34,
    maternity: 18,
    paternity: 7,
    other: 10,
  },
  {
    month: "Jul",
    annual: 71,
    sick: 32,
    maternity: 20,
    paternity: 8,
    other: 11,
  },
  {
    month: "Aug",
    annual: 55,
    sick: 29,
    maternity: 17,
    paternity: 7,
    other: 9,
  },
  {
    month: "Sep",
    annual: 47,
    sick: 25,
    maternity: 14,
    paternity: 6,
    other: 8,
  },
  {
    month: "Oct",
    annual: 43,
    sick: 23,
    maternity: 12,
    paternity: 5,
    other: 7,
  },
  {
    month: "Nov",
    annual: 44,
    sick: 22,
    maternity: 13,
    paternity: 5,
    other: 7,
  },
  {
    month: "Dec",
    annual: 34,
    sick: 16,
    maternity: 10,
    paternity: 4,
    other: 5,
  },
];

function ChartSkeleton() {
  return (
    <div
      className="flex h-full min-h-[260px] animate-pulse items-end gap-3 px-4 pb-8 pt-6 sm:min-h-[300px]"
      role="status"
      aria-label="Loading leave utilization chart"
    >
      {[45, 60, 35, 70, 55, 82, 65, 48, 72, 58, 76, 50].map(
        (height, index) => (
          <div
            key={index}
            className="flex flex-1 items-end gap-1"
          >
            <div
              className="w-full rounded-t bg-slate-200"
              style={{ height: `${height}%` }}
            />
            <div
              className="w-full rounded-t bg-slate-100"
              style={{ height: `${Math.max(height - 20, 15)}%` }}
            />
          </div>
        ),
      )}
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
    name: string;
    value: number;
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
      <p className="mb-2 text-xs font-bold text-slate-900">
        {label}
      </p>

      <div className="space-y-1.5">
        {payload.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between gap-6 text-xs"
          >
            <span className="text-slate-500">{item.name}</span>

            <span className="font-semibold text-slate-800">
              {item.value} days
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LeaveUtilizationChart({
  data = defaultData,
  loading = false,
  title = "Leave Utilization",
  subtitle = "Monthly leave usage",
}: LeaveUtilizationChartProps) {
  return (
    <section
      className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="leave-utilization-title"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2
            id="leave-utilization-title"
            className="text-base font-bold text-slate-900 sm:text-lg"
          >
            {title}
          </h2>

          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
            {subtitle}
          </p>
        </div>

        <select
          aria-label="Leave utilization period"
          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 outline-none transition focus:border-[#c89b20] focus:ring-2 focus:ring-[#c89b20]/10 sm:w-auto"
          defaultValue="this-year"
        >
          <option value="this-year">This year</option>
          <option value="last-year">Last year</option>
        </select>
      </div>

      <div className="h-[300px] w-full min-w-0">
        {loading ? (
          <ChartSkeleton />
        ) : (
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
          >
            <BarChart
              data={data}
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
              />

              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{
                  fontSize: 11,
                  fill: "#64748b",
                }}
                width={35}
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
                }}
              />

              <Bar
                dataKey="annual"
                name="Annual"
                fill="#2f80ed"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
              />

              <Bar
                dataKey="sick"
                name="Sick"
                fill="#43b581"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
              />

              <Bar
                dataKey="maternity"
                name="Maternity"
                fill="#f2778a"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
              />

              <Bar
                dataKey="paternity"
                name="Paternity"
                fill="#8b6fe8"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
              />

              <Bar
                dataKey="other"
                name="Other"
                fill="#f4bd42"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}