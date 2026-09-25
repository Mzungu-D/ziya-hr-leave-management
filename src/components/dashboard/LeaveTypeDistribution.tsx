import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export interface LeaveTypeDistributionData {
  name: string;
  value: number;
}

interface LeaveTypeDistributionProps {
  data?: LeaveTypeDistributionData[];
  loading?: boolean;
  title?: string;
  subtitle?: string;
}

const defaultData: LeaveTypeDistributionData[] = [
  { name: "Annual Leave", value: 42 },
  { name: "Sick Leave", value: 24 },
  { name: "Maternity Leave", value: 13 },
  { name: "Paternity Leave", value: 8 },
  { name: "Other Leave", value: 13 },
];

const chartColors = [
  "#2f80ed",
  "#43b581",
  "#f2778a",
  "#8b6fe8",
  "#f4bd42",
];

interface TooltipPayloadItem {
  name?: string;
  value?: number;
  payload?: {
    name?: string;
    value?: number;
  };
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0];
  const name = item.payload?.name ?? item.name ?? "Leave";
  const value = item.payload?.value ?? item.value ?? 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-xl">
      <p className="text-xs font-semibold text-slate-500">
        {name}
      </p>

      <p className="mt-0.5 text-sm font-bold text-slate-900">
        {value}%
      </p>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div
      className="flex min-h-[240px] animate-pulse items-center justify-center"
      role="status"
      aria-label="Loading leave type distribution"
    >
      <div className="relative h-44 w-44 rounded-full border-[30px] border-slate-200">
        <div className="absolute inset-4 rounded-full bg-white" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[240px] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <span className="text-lg font-bold text-slate-400">—</span>
        </div>

        <p className="mt-3 text-sm font-semibold text-slate-700">
          No leave data
        </p>

        <p className="mt-1 max-w-[220px] text-xs leading-5 text-slate-400">
          Leave type distribution will appear here once requests are
          available.
        </p>
      </div>
    </div>
  );
}

export function LeaveTypeDistribution({
  data = defaultData,
  loading = false,
  title = "Leave Type Distribution",
  subtitle = "Current leave request breakdown",
}: LeaveTypeDistributionProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const normalizedData =
    total > 0
      ? data.map((item) => ({
          ...item,
          value: Number(((item.value / total) * 100).toFixed(1)),
        }))
      : [];

  return (
    <section
      className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="leave-type-distribution-title"
    >
      <div className="min-w-0">
        <h2
          id="leave-type-distribution-title"
          className="text-base font-bold text-slate-900 sm:text-lg"
        >
          {title}
        </h2>

        <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
          {subtitle}
        </p>
      </div>

      {loading ? (
        <ChartSkeleton />
      ) : normalizedData.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="relative mt-3 h-[230px] w-full min-w-0">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
            >
              <PieChart>
                <Pie
                  data={normalizedData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="57%"
                  outerRadius="78%"
                  paddingAngle={2}
                  stroke="#ffffff"
                  strokeWidth={3}
                >
                  {normalizedData.map((entry, index) => (
                    <Cell
                      key={`${entry.name}-${index}`}
                      fill={
                        chartColors[index % chartColors.length]
                      }
                    />
                  ))}
                </Pie>

                <Tooltip
                  content={<CustomTooltip />}
                  wrapperStyle={{ outline: "none" }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-2xl font-bold tracking-tight text-slate-900">
                  {total}
                </p>

                <p className="text-[11px] font-medium text-slate-400">
                  Requests
                </p>
              </div>
            </div>
          </div>

          <div className="mt-2 space-y-2.5 border-t border-slate-100 pt-4">
            {normalizedData.map((item, index) => (
              <div
                key={item.name}
                className="flex items-center gap-2.5"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      chartColors[index % chartColors.length],
                  }}
                  aria-hidden="true"
                />

                <span
                  title={item.name}
                  className="min-w-0 flex-1 truncate text-xs font-medium text-slate-600"
                >
                  {item.name}
                </span>

                <span className="shrink-0 text-xs font-bold text-slate-900">
                  {item.value}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}