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

const defaultData: EmployeeDistributionData[] = [
  { name: "Finance", value: 18 },
  { name: "Operations", value: 24 },
  { name: "Technology", value: 16 },
  { name: "Customer Experience", value: 20 },
  { name: "Human Resources", value: 8 },
  { name: "Other", value: 14 },
];

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

  const name = item.payload?.name ?? item.name ?? "Department";
  const value = item.payload?.value ?? item.value ?? 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-xl">
      <p className="text-xs font-semibold text-slate-500">
        {name}
      </p>

      <p className="mt-0.5 text-sm font-bold text-slate-900">
        {value} employees
      </p>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div
      className="flex min-h-[240px] animate-pulse items-center justify-center"
      role="status"
      aria-label="Loading employee distribution"
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
      <div className="max-w-xs text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <span className="text-lg font-bold text-slate-400">
            —
          </span>
        </div>

        <p className="mt-3 text-sm font-semibold text-slate-700">
          No employee data
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-400">
          Employee distribution will appear here once departments
          have employees.
        </p>
      </div>
    </div>
  );
}

export function EmployeeDistribution({
  data = defaultData,
  loading = false,
  title = "Employee Distribution",
  subtitle = "Employees by department",
}: EmployeeDistributionProps) {
  const totalEmployees = data.reduce(
    (sum, item) => sum + item.value,
    0,
  );

  return (
    <section
      className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="employee-distribution-title"
    >
      <div className="min-w-0">
        <h2
          id="employee-distribution-title"
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
      ) : data.length === 0 || totalEmployees === 0 ? (
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
                  data={data}
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
                  {data.map((entry, index) => (
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
                  {totalEmployees}
                </p>

                <p className="text-[11px] font-medium text-slate-400">
                  Employees
                </p>
              </div>
            </div>
          </div>

          <div className="mt-2 space-y-2.5 border-t border-slate-100 pt-4">
            {data.map((item, index) => {
              const percentage =
                totalEmployees > 0
                  ? Math.round(
                      (item.value / totalEmployees) * 100,
                    )
                  : 0;

              return (
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

                  <span className="shrink-0 text-xs font-semibold text-slate-700">
                    {item.value}
                  </span>

                  <span className="w-9 shrink-0 text-right text-[11px] text-slate-400">
                    {percentage}%
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}