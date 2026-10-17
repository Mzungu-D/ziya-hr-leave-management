import { useCallback, useEffect, useState } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import {
  getManagerLeaveReport,
  type ManagerLeaveReport,
  type LeaveServiceError,
} from "../../services/leave.service";

const emptyReport: ManagerLeaveReport = {
  totalRequests: 0,
  totalRequestedDays: 0,
  totalApprovedDays: 0,
  byStatus: {},
  byLeaveType: {},
};

function formatLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export function ManagerReports() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [report, setReport] = useState<ManagerLeaveReport>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const result = await getManagerLeaveReport(
        { startDate: startDate || undefined, endDate: endDate || undefined },
        { signal },
      );
      setReport(result);
    } catch (err) {
      if (signal?.aborted) return;
      setError((err as LeaveServiceError).message || "Unable to load leave reports.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const metrics = [
    { label: "Total requests", value: report.totalRequests },
    { label: "Days requested", value: report.totalRequestedDays },
    { label: "Approved days", value: report.totalApprovedDays },
  ];

  return (
    <main className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
            <BarChart3 size={17} /> Manager workspace
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Team Leave Reports</h1>
          <p className="mt-1 text-sm text-slate-500">Understand leave demand, approvals, and leave-type usage.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </header>

      <section className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">
          From
          <input
            type="date"
            value={startDate}
            max={endDate || undefined}
            onChange={(event) => setStartDate(event.target.value)}
            className="mt-1 block min-h-10 w-full rounded-lg border border-slate-200 px-3 font-normal"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          To
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(event) => setEndDate(event.target.value)}
            className="mt-1 block min-h-10 w-full rounded-lg border border-slate-200 px-3 font-normal"
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="min-h-10 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            Apply filters
          </button>
        </div>
      </section>

      {error && (
        <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>
          <button type="button" onClick={() => void load()} className="mt-2 font-semibold underline">Try again</button>
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-500">{metric.label}</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {loading ? "—" : metric.value.toLocaleString()}
            </p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
          <h2 className="font-semibold text-slate-900">Leave by status</h2>
        </div>
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading report…</p>
        ) : Object.keys(report.byStatus).length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No status data is available for this period.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(report.byStatus).map(([status, count]) => (
              <div key={status} className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm text-slate-500">{formatLabel(status)}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{count}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
          <h2 className="font-semibold text-slate-900">Leave type breakdown</h2>
          <p className="mt-1 text-sm text-slate-500">Requested days compared with approved days.</p>
        </div>
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading breakdown…</p>
        ) : Object.keys(report.byLeaveType).length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No leave-type data is available for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold sm:px-6">Leave type</th>
                  <th className="px-4 py-3 font-semibold">Requests</th>
                  <th className="px-4 py-3 font-semibold">Requested days</th>
                  <th className="px-4 py-3 font-semibold">Approved days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(report.byLeaveType).map(([name, values]) => (
                  <tr key={name} className="hover:bg-slate-50">
                    <td className="px-4 py-4 font-medium text-slate-900 sm:px-6">{name}</td>
                    <td className="px-4 py-4 text-slate-600">{values.requests}</td>
                    <td className="px-4 py-4 text-slate-600">{values.requestedDays}</td>
                    <td className="px-4 py-4 text-slate-600">{values.approvedDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
