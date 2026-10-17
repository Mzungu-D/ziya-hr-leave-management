import { useCallback, useEffect, useState } from "react";
import { CalendarDays, RefreshCw, Search } from "lucide-react";
import {
  listManagerTeamLeave,
  type LeaveRequest,
  type LeaveServiceError,
} from "../../services/leave.service";

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function employeeName(request: LeaveRequest) {
  const employee = request.employee;
  if (!employee) return request.employeeId || "Team member";

  const value = employee as unknown as Record<string, unknown>;
  const name = [value.firstName, value.lastName]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ");

  return name || (typeof value.name === "string" ? value.name : "Team member");
}

export function ManagerCalendar() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const data = await listManagerTeamLeave(
        { startDate: startDate || undefined, endDate: endDate || undefined },
        { signal },
      );
      setItems(data);
    } catch (err) {
      if (signal?.aborted) return;
      const serviceError = err as LeaveServiceError;
      setError(serviceError.message || "Unable to load the team calendar.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <main className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
            <CalendarDays size={17} /> Manager workspace
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Team Calendar
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review approved team leave and plan departmental coverage.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
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
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <Search size={16} /> Apply filters
          </button>
        </div>
      </section>

      {error && (
        <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>
          <button type="button" onClick={() => void load()} className="mt-2 font-semibold underline">
            Try again
          </button>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
          <h2 className="font-semibold text-slate-900">Approved team leave</h2>
          <p className="mt-1 text-sm text-slate-500">
            {loading ? "Loading team calendar…" : `${items.length} record${items.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Loading calendar…</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <CalendarDays className="mx-auto mb-3 text-slate-400" size={32} />
            <p className="font-medium text-slate-800">No approved leave found</p>
            <p className="mt-1 text-sm text-slate-500">Try another date range or refresh the calendar.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold sm:px-6">Employee</th>
                  <th className="px-4 py-3 font-semibold">Leave type</th>
                  <th className="px-4 py-3 font-semibold">Start</th>
                  <th className="px-4 py-3 font-semibold">End</th>
                  <th className="px-4 py-3 font-semibold">Days</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 font-medium text-slate-900 sm:px-6">{employeeName(item)}</td>
                    <td className="px-4 py-4 text-slate-600">{item.leaveType?.name || "Leave"}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">{formatDate(item.startDate)}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">{formatDate(item.endDate)}</td>
                    <td className="px-4 py-4 text-slate-600">{item.requestedDays ?? item.totalDays ?? item.days ?? "—"}</td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        {item.status.replaceAll("_", " ")}
                      </span>
                    </td>
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
