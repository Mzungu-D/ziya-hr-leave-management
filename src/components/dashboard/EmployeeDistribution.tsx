import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export interface EmployeeDistributionData {
  name: string;
  value: number;
}

interface EmployeeDistributionProps {
  data?: EmployeeDistributionData[];
  loading?: boolean;
  title?: string;
  subtitle?: string;
}

const chartColors = [
  "#2f80ed",
  "#43b581",
  "#f4bd42",
  "#8b6fe8",
  "#f2778a",
  "#64748b",
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
    "Department";

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
        {value.toLocaleString()} employees
      </p>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div
      className="flex min-h-[240px] animate-pulse items-center justify-center px-4"
      role="status"
      aria-label="Loading employee distribution"
    >
      <div className="relative h-36 w-36 rounded-full border-[24px] border-slate-200 sm:h-44 sm:w-44 sm:border-[30px]">
        <div className="absolute inset-3 rounded-full bg-white sm:inset-4" />
      </div>

      <span className="sr-only">
        Loading employee distribution
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[240px] items-center justify-center px-4">
      <div className="max-w-xs text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <span
            className="text-lg font-bold text-slate-400"
            aria-hidden="true"
          >
            —
          </span>
        </div>

        <p className="mt-3 text-sm font-semibold text-slate-700">
          No employee data
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-400">
          Employee distribution will appear here once
          departments have employees.
        </p>
      </div>
    </div>
  );
}

export function EmployeeDistribution({
  data = [],
  loading = false,
  title = "Employee Distribution",
  subtitle = "Employees by department",
}: EmployeeDistributionProps) {
  const safeData = Array.isArray(data)
    ? data.filter(
        (item) =>
          item &&
          typeof item.name === "string" &&
          item.name.trim().length > 0 &&
          Number.isFinite(Number(item.value)) &&
          Number(item.value) > 0,
      )
    : [];

  const totalEmployees = safeData.reduce(
    (sum, item) =>
      sum + Number(item.value),
    0,
  );

  return (
    <section
      className="min-w-0 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="employee-distribution-title"
    >
      <div className="min-w-0">
        <h2
          id="employee-distribution-title"
          className="truncate text-base font-bold text-slate-900 sm:text-lg"
        >
          {title}
        </h2>

        <p className="mt-0.5 truncate text-xs text-slate-500 sm:text-sm">
          {subtitle}
        </p>
      </div>

      {loading ? (
        <ChartSkeleton />
      ) : safeData.length === 0 ||
        totalEmployees === 0 ? (
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
                  data={safeData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="57%"
                  outerRadius="78%"
                  paddingAngle={2}
                  stroke="#ffffff"
                  strokeWidth={3}
                  isAnimationActive={false}
                >
                  {safeData.map(
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
                  {totalEmployees.toLocaleString()}
                </p>

                <p className="text-[11px] font-medium text-slate-400">
                  Employees
                </p>
              </div>
            </div>
          </div>

          <div className="mt-2 max-h-[190px] space-y-2.5 overflow-y-auto border-t border-slate-100 pt-4 pr-1">
            {safeData.map(
              (item, index) => {
                const value = Number(
                  item.value,
                );

                const percentage =
                  totalEmployees > 0
                    ? Math.round(
                        (value /
                          totalEmployees) *
                          100,
                      )
                    : 0;

                return (
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

                    <span className="shrink-0 text-xs font-semibold text-slate-700">
                      {value.toLocaleString()}
                    </span>

                    <span className="w-9 shrink-0 text-right text-[11px] text-slate-400">
                      {percentage}%
                    </span>
                  </div>
                );
              },
            )}
          </div>
        </>
      )}
    </section>
  );
}