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
  const name =
    item.payload?.name ??
    item.name ??
    "Leave";

  const value = Number(
    item.payload?.value ??
      item.value ??
      0,
  );

  return (
    <div className="max-w-[calc(100vw-32px)] rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-xl">
      <p className="truncate text-xs font-semibold text-slate-500">
        {name}
      </p>

      <p className="mt-0.5 text-sm font-bold text-slate-900">
        {value.toFixed(1)}%
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
      <div className="relative h-36 w-36 rounded-full border-[24px] border-slate-200 sm:h-44 sm:w-44 sm:border-[30px]">
        <div className="absolute inset-3 rounded-full bg-white sm:inset-4" />
      </div>

      <span className="sr-only">
        Loading leave type distribution
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[240px] items-center justify-center px-4">
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
          No leave data
        </p>

        <p className="mt-1 max-w-[240px] text-xs leading-5 text-slate-400">
          Leave type distribution will appear here once
          requests are available.
        </p>
      </div>
    </div>
  );
}

export function LeaveTypeDistribution({
  data = [],
  loading = false,
  title = "Leave Type Distribution",
  subtitle = "Current leave request breakdown",
}: LeaveTypeDistributionProps) {
  const safeData = Array.isArray(data)
    ? data.filter(
        (item) =>
          item &&
          typeof item.name === "string" &&
          Number.isFinite(Number(item.value)) &&
          Number(item.value) > 0,
      )
    : [];

  const total = safeData.reduce(
    (sum, item) =>
      sum + Number(item.value),
    0,
  );

  const normalizedData =
    total > 0
      ? safeData.map((item) => ({
          name: item.name.trim(),
          value: Number(
            (
              (Number(item.value) / total) *
              100
            ).toFixed(1),
          ),
        }))
      : [];

  return (
    <section
      className="min-w-0 w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="leave-type-distribution-title"
    >
      <div className="min-w-0">
        <h2
          id="leave-type-distribution-title"
          className="text-base font-bold text-slate-900 sm:text-lg"
        >
          {title}
        </h2>

        <p className="mt-0.5 text-xs leading-5 text-slate-500 sm:text-sm">
          {subtitle}
        </p>
      </div>

      {loading ? (
        <ChartSkeleton />
      ) : normalizedData.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="relative mt-3 h-[220px] w-full min-w-0 sm:h-[230px]">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              minHeight={0}
            >
              <PieChart>
                <Pie
                  data={normalizedData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="76%"
                  paddingAngle={2}
                  stroke="#ffffff"
                  strokeWidth={3}
                  isAnimationActive={false}
                >
                  {normalizedData.map(
                    (entry, index) => (
                      <Cell
                        key={`${entry.name}-${index}`}
                        fill={
                          chartColors[
                            index %
                              chartColors.length
                          ]
                        }
                      />
                    ),
                  )}
                </Pie>

                <Tooltip
                  content={<CustomTooltip />}
                  wrapperStyle={{
                    outline: "none",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                  {total.toLocaleString()}
                </p>

                <p className="text-[11px] font-medium text-slate-400">
                  Requests
                </p>
              </div>
            </div>
          </div>

          <div className="mt-2 max-h-[180px] space-y-2.5 overflow-y-auto border-t border-slate-100 pt-4 pr-1">
            {normalizedData.map(
              (item, index) => (
                <div
                  key={`${item.name}-${index}`}
                  className="flex min-w-0 items-center gap-2.5"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        chartColors[
                          index %
                            chartColors.length
                        ],
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
                    {item.value.toFixed(1)}%
                  </span>
                </div>
              ),
            )}
          </div>
        </>
      )}
    </section>
  );
}