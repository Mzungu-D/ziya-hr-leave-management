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

const data = [
  { month: "Jan", annual: 28, sick: 12, maternity: 7, other: 4 },
  { month: "Feb", annual: 32, sick: 15, maternity: 8, other: 5 },
  { month: "Mar", annual: 40, sick: 20, maternity: 11, other: 6 },
  { month: "Apr", annual: 42, sick: 23, maternity: 13, other: 7 },
  { month: "May", annual: 51, sick: 27, maternity: 15, other: 8 },
  { month: "Jun", annual: 63, sick: 34, maternity: 18, other: 10 },
  { month: "Jul", annual: 71, sick: 32, maternity: 20, other: 11 },
  { month: "Aug", annual: 55, sick: 29, maternity: 17, other: 9 },
  { month: "Sep", annual: 47, sick: 25, maternity: 14, other: 8 },
  { month: "Oct", annual: 43, sick: 23, maternity: 12, other: 7 },
  { month: "Nov", annual: 44, sick: 22, maternity: 13, other: 7 },
  { month: "Dec", annual: 34, sick: 16, maternity: 10, other: 5 },
];

export function LeaveUtilizationChart() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 sm:text-lg">
            Leave Utilization
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Monthly leave usage
          </p>
        </div>

        <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 outline-none">
          <option>This year</option>
          <option>Last year</option>
        </select>
      </div>

      <div className="h-[260px] w-full sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e2e8f0"
            />

            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#64748b" }}
            />

            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#64748b" }}
            />

            <Tooltip />

            <Legend
              wrapperStyle={{
                fontSize: "11px",
                paddingTop: "10px",
              }}
            />

            <Bar
              dataKey="annual"
              name="Annual Leave"
              fill="#2f80ed"
              radius={[4, 4, 0, 0]}
            />

            <Bar
              dataKey="sick"
              name="Sick Leave"
              fill="#43b581"
              radius={[4, 4, 0, 0]}
            />

            <Bar
              dataKey="maternity"
              name="Maternity Leave"
              fill="#f2778a"
              radius={[4, 4, 0, 0]}
            />

            <Bar
              dataKey="other"
              name="Other"
              fill="#f4bd42"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}