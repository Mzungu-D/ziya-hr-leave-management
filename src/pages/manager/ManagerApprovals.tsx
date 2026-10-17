import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileText,
  LoaderCircle,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  listManagerPendingRequests,
  managerApproveLeaveRequest,
  managerRejectLeaveRequest,
  type LeaveRequest,
} from "../../services/leave.service";

type Decision = "approve" | "reject";

function getEmployeeName(
  employee: LeaveRequest["employee"],
): string {
  if (!employee) return "Employee";

  const fullName =
    employee.fullName?.trim() ||
    employee.name?.trim() ||
    [employee.firstName, employee.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

  return fullName || employee.email || "Employee";
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getRequestDays(request: LeaveRequest): number | null {
  const value = request.days ?? request.totalDays;

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "The request could not be completed. Please try again.";
}

function StatusBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
      <Clock3 size={13} />
      Awaiting your decision
    </span>
  );
}

export function ManagerApprovals() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedRequest, setSelectedRequest] =
    useState<LeaveRequest | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [comments, setComments] = useState("");
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadRequests = useCallback(async (signal?: AbortSignal) => {
    setError(null);

    try {
      const result = await listManagerPendingRequests({ signal });
      setRequests(result);
    } catch (cause) {
      if (signal?.aborted) return;
      setError(getErrorMessage(cause));
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadRequests(controller.signal);

    return () => controller.abort();
  }, [loadRequests]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return requests;

    return requests.filter((request) => {
      const employee = getEmployeeName(request.employee);
      const leaveType = request.leaveType?.name ?? "";
      const email = request.employee?.email ?? "";
      const reason = request.reason ?? "";

      return [
        employee,
        leaveType,
        email,
        reason,
        request.id,
        request.employee?.employeeNumber ?? "",
        request.employee?.departmentName ?? "",
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [requests, search]);

  const openDecision = (
    request: LeaveRequest,
    nextDecision: Decision,
  ) => {
    setSelectedRequest(request);
    setDecision(nextDecision);
    setComments("");
    setDecisionError(null);
  };

  const closeDecision = () => {
    if (submitting) return;

    setSelectedRequest(null);
    setDecision(null);
    setComments("");
    setDecisionError(null);
  };

  const submitDecision = async () => {
    if (!selectedRequest || !decision || submitting) return;

    setSubmitting(true);
    setDecisionError(null);

    try {
      const payload = {
        comments: comments.trim() || null,
      };

      if (decision === "approve") {
        await managerApproveLeaveRequest(
          selectedRequest.id,
          payload,
        );
      } else {
        await managerRejectLeaveRequest(
          selectedRequest.id,
          payload,
        );
      }

      setRequests((current) =>
        current.filter((request) => request.id !== selectedRequest.id),
      );

      setSelectedRequest(null);
      setDecision(null);
      setComments("");
    } catch (cause) {
      setDecisionError(getErrorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  const refresh = () => {
    setRefreshing(true);
    void loadRequests();
  };

  const pendingCount = requests.length;
  const displayedCount = filteredRequests.length;

  return (
    <main className="min-w-0 space-y-6 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
            <ShieldCheck size={16} />
            Manager workspace
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Leave approvals
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Review your team's leave requests. Approved requests are forwarded
            to HR for the final decision.
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={loading || refreshing}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            size={16}
            className={refreshing ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Pending manager review
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {loading ? "—" : pendingCount}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Requests awaiting your decision
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 text-amber-700">
              <Clock3 size={22} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Approval process
              </p>
              <p className="mt-2 text-lg font-bold text-slate-900">
                Manager → HR
              </p>
              <p className="mt-1 text-xs text-slate-500">
                HR makes the final approval or rejection
              </p>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
              <ShieldCheck size={22} />
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="font-semibold text-slate-900">
              Requests requiring review
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {displayedCount}{" "}
              {displayedCount === 1 ? "request" : "requests"}
              {search.trim() ? " matching your search" : ""}
            </p>
          </div>

          <label className="relative block w-full sm:max-w-xs">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employee or leave type"
              className="min-h-10 w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>

        {error && (
          <div className="m-4 flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-start">
            <AlertCircle
              size={19}
              className="shrink-0 text-red-600"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-800">
                Could not load manager approvals
              </p>
              <p className="mt-1 break-words text-sm text-red-700">
                {error}
              </p>
            </div>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 p-8 text-slate-500">
            <LoaderCircle size={26} className="animate-spin" />
            <p className="text-sm">Loading leave requests…</p>
          </div>
        ) : !error && filteredRequests.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-5 py-12 text-center">
            <div className="rounded-2xl bg-slate-100 p-4 text-slate-500">
              <CheckCircle2 size={28} />
            </div>
            <h3 className="mt-4 font-semibold text-slate-900">
              {search.trim()
                ? "No matching requests"
                : "You're all caught up"}
            </h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
              {search.trim()
                ? "Try a different employee name, email address, or leave type."
                : "There are no leave requests waiting for manager review."}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {filteredRequests.map((request) => {
                const employeeName = getEmployeeName(request.employee);
                const days = getRequestDays(request);

                return (
                  <article
                    key={request.id}
                    className="p-4 transition hover:bg-slate-50/70 sm:p-5"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex min-w-0 gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                          <UserRound size={20} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="break-words font-semibold text-slate-900">
                              {employeeName}
                            </h3>
                            <StatusBadge />
                          </div>

                          <p className="mt-1 break-words text-sm text-slate-600">
                            {request.leaveType?.name ?? "Leave request"}
                            {request.employee?.departmentName
                              ? ` · ${request.employee.departmentName}`
                              : ""}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1.5">
                              <FileText size={14} />
                              {formatDate(request.startDate)} –{" "}
                              {formatDate(request.endDate)}
                            </span>

                            {days !== null && (
                              <span>
                                {days} {days === 1 ? "day" : "days"}
                              </span>
                            )}

                            {request.employee?.employeeNumber && (
                              <span>
                                Staff no. {request.employee.employeeNumber}
                              </span>
                            )}
                          </div>

                          {request.reason && (
                            <p className="mt-3 line-clamp-2 break-words text-sm leading-6 text-slate-600">
                              {request.reason}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row xl:shrink-0">
                        <button
                          type="button"
                          onClick={() => openDecision(request, "approve")}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        >
                          <CheckCircle2 size={16} />
                          Approve for HR
                        </button>

                        <button
                          type="button"
                          onClick={() => openDecision(request, "reject")}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200"
                        >
                          <XCircle size={16} />
                          Decline
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      {selectedRequest && decision && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDecision();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="manager-decision-title"
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="manager-decision-title"
                  className="text-lg font-bold text-slate-900"
                >
                  {decision === "approve"
                    ? "Approve for HR review?"
                    : "Decline leave request?"}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {decision === "approve"
                    ? "This sends the request to HR. It does not grant final approval."
                    : "This rejects the request at the manager stage. It will not proceed to HR."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeDecision}
                disabled={submitting}
                aria-label="Close decision dialog"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X size={19} />
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">
                {getEmployeeName(selectedRequest.employee)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {selectedRequest.leaveType?.name ?? "Leave request"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {formatDate(selectedRequest.startDate)} –{" "}
                {formatDate(selectedRequest.endDate)}
              </p>
              {selectedRequest.reason && (
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                  {selectedRequest.reason}
                </p>
              )}
            </div>

            <label className="mt-5 block">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <MessageSquare size={16} />
                Comments
                <span className="font-normal text-slate-400">
                  (optional)
                </span>
              </span>
              <textarea
                value={comments}
                onChange={(event) => setComments(event.target.value)}
                rows={4}
                maxLength={2000}
                disabled={submitting}
                placeholder={
                  decision === "approve"
                    ? "Add a note for HR, if needed…"
                    : "Explain the reason for declining, if needed…"
                }
                className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm leading-6 text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
              />
              <span className="mt-1 block text-right text-xs text-slate-400">
                {comments.length}/2000
              </span>
            </label>

            {decisionError && (
              <div className="mt-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle size={17} className="mt-0.5 shrink-0" />
                <p className="break-words">{decisionError}</p>
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDecision}
                disabled={submitting}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={submitDecision}
                disabled={submitting}
                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                  decision === "approve"
                    ? "bg-blue-700 hover:bg-blue-800"
                    : "bg-red-700 hover:bg-red-800"
                }`}
              >
                {submitting ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : decision === "approve" ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <XCircle size={16} />
                )}
                {submitting
                  ? "Submitting…"
                  : decision === "approve"
                    ? "Confirm and send to HR"
                    : "Confirm decline"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default ManagerApprovals;
