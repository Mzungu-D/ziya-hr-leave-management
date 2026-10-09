import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  X,
  XCircle,
} from "lucide-react";

import {
  hrApproveLeaveRequest,
  hrRejectLeaveRequest,
  listHrPendingRequests,
  type LeaveRequest,
  type LeaveServiceError,
} from "../../services/leave.service";

/**
 * ============================================================================
 * HELPERS
 * ============================================================================
 */

function getEmployeeName(
  request: LeaveRequest,
): string {
  const employee =
    request.employee;

  if (!employee) {
    return "Employee";
  }

  const fullName =
    employee.fullName?.trim();

  if (fullName) {
    return fullName;
  }

  const name =
    employee.name?.trim();

  if (name) {
    return name;
  }

  const composedName =
    [
      employee.firstName,
      employee.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

  return composedName || "Employee";
}

function getEmployeeInitials(
  request: LeaveRequest,
): string {
  const name =
    getEmployeeName(request);

  const parts =
    name
      .split(/\s+/)
      .filter(Boolean);

  if (parts.length === 0) {
    return "E";
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    `${parts[0][0]}${parts[parts.length - 1][0]}`
  ).toUpperCase();
}

function getDepartmentName(
  request: LeaveRequest,
): string {
  return (
    request.employee
      ?.departmentName ||
    "Department not assigned"
  );
}

function getLeaveTypeName(
  request: LeaveRequest,
): string {
  return (
    request.leaveType?.name ||
    "Leave"
  );
}

function getLeaveTypeCode(
  request: LeaveRequest,
): string {
  return (
    request.leaveType?.code ||
    ""
  );
}

function normalizeStatus(
  status: string | undefined,
): string {
  return (
    status ||
    ""
  )
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function formatStatus(
  status: string | undefined,
): string {
  const normalized =
    normalizeStatus(status);

  switch (normalized) {
    case "PENDING_HR":
      return "Pending HR";

    case "PENDING_MANAGER":
      return "Pending Manager";

    case "APPROVED":
      return "Approved";

    case "REJECTED":
      return "Rejected";

    case "CANCELLED":
      return "Cancelled";

    default:
      return (
        status ||
        "Unknown"
      );
  }
}

function formatDate(
  value: string | undefined,
): string {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-KE",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(date);
}

function formatDateRange(
  request: LeaveRequest,
): string {
  const start =
    formatDate(
      request.startDate,
    );

  const end =
    formatDate(
      request.endDate,
    );

  if (
    start === end
  ) {
    return start;
  }

  return `${start} – ${end}`;
}

function getRequestDays(
  request: LeaveRequest,
): number | null {
  const value =
    request.totalDays ??
    request.days;

  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  return value;
}

function formatDays(
  request: LeaveRequest,
): string {
  const days =
    getRequestDays(request);

  if (days === null) {
    return "Days not available";
  }

  return `${days} ${
    days === 1
      ? "day"
      : "days"
  }`;
}

function getErrorMessage(
  error: unknown,
): string {
  if (
    typeof error === "object" &&
    error !== null
  ) {
    const serviceError =
      error as LeaveServiceError;

    if (
      typeof serviceError.message ===
        "string" &&
      serviceError.message.trim()
    ) {
      return serviceError.message;
    }
  }

  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

/**
 * ============================================================================
 * STATUS BADGE
 * ============================================================================
 */

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized =
    normalizeStatus(status);

  if (
    normalized ===
    "PENDING_HR"
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        <Clock3
          size={13}
          strokeWidth={2}
        />
        Pending HR
      </span>
    );
  }

  if (
    normalized ===
    "APPROVED"
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        <CheckCircle2
          size={13}
          strokeWidth={2}
        />
        Approved
      </span>
    );
  }

  if (
    normalized ===
    "REJECTED"
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
        <XCircle
          size={13}
          strokeWidth={2}
        />
        Rejected
      </span>
    );
  }

  if (
    normalized ===
    "CANCELLED"
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
        <XCircle
          size={13}
          strokeWidth={2}
        />
        Cancelled
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
      {formatStatus(status)}
    </span>
  );
}

/**
 * ============================================================================
 * SUMMARY CARD
 * ============================================================================
 */

function SummaryCard({
  label,
  value,
  icon,
  description,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {description}
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * APPROVALS PAGE
 * ============================================================================
 */

export function Approvals() {
  const [
    requests,
    setRequests,
  ] = useState<LeaveRequest[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    selectedRequest,
    setSelectedRequest,
  ] =
    useState<LeaveRequest | null>(
      null,
    );

  const [
    decisionRequest,
    setDecisionRequest,
  ] =
    useState<LeaveRequest | null>(
      null,
    );

  const [
    decision,
    setDecision,
  ] = useState<
    "approve" | "reject" | null
  >(null);

  const [
    comments,
    setComments,
  ] = useState("");

  const [
    actionLoading,
    setActionLoading,
  ] = useState<string | null>(
    null,
  );

  const [
    actionError,
    setActionError,
  ] = useState("");

  /**
   * ==========================================================================
   * LOAD HR QUEUE
   * ==========================================================================
   */

  const loadRequests =
    useCallback(
      async (
        options: {
          showRefresh?: boolean;
          signal?: AbortSignal;
        } = {},
      ) => {
        const showRefresh =
          options.showRefresh === true;

        try {
          if (showRefresh) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          setError("");

          const records =
            await listHrPendingRequests({
              signal:
                options.signal,
            });

          setRequests(
            Array.isArray(records)
              ? records
              : [],
          );
        } catch (err) {
          if (
            err instanceof DOMException &&
            err.name ===
              "AbortError"
          ) {
            return;
          }

          setError(
            getErrorMessage(err),
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [],
    );

  useEffect(() => {
    const controller =
      new AbortController();

    void loadRequests({
      signal:
        controller.signal,
    });

    return () => {
      controller.abort();
    };
  }, [loadRequests]);

  /**
   * ==========================================================================
   * FILTERING
   * ==========================================================================
   */

  const filteredRequests =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return requests;
      }

      return requests.filter(
        (request) => {
          const employee =
            getEmployeeName(
              request,
            ).toLowerCase();

          const department =
            getDepartmentName(
              request,
            ).toLowerCase();

          const leaveType =
            getLeaveTypeName(
              request,
            ).toLowerCase();

          const code =
            getLeaveTypeCode(
              request,
            ).toLowerCase();

          const reason =
            (
              request.reason ||
              ""
            ).toLowerCase();

          const id =
            request.id.toLowerCase();

          return (
            employee.includes(
              query,
            ) ||
            department.includes(
              query,
            ) ||
            leaveType.includes(
              query,
            ) ||
            code.includes(
              query,
            ) ||
            reason.includes(
              query,
            ) ||
            id.includes(
              query,
            )
          );
        },
      );
    }, [requests, search]);

  /**
   * ==========================================================================
   * SUMMARY
   * ==========================================================================
   */

  const summary =
    useMemo(() => {
      const pending =
        requests.filter(
          (request) =>
            normalizeStatus(
              request.status,
            ) === "PENDING_HR",
        ).length;

      const departments =
        new Set(
          requests
            .map(
              getDepartmentName,
            )
            .filter(Boolean),
        ).size;

      const employees =
        new Set(
          requests
            .map(
              (request) =>
                request.employeeId,
            )
            .filter(Boolean),
        ).size;

      return {
        pending,
        departments,
        employees,
      };
    }, [requests]);

  /**
   * ==========================================================================
   * OPEN DECISION DIALOG
   * ==========================================================================
   */

  const openDecision =
    useCallback(
      (
        request: LeaveRequest,
        action:
          | "approve"
          | "reject",
      ) => {
        setDecisionRequest(
          request,
        );

        setDecision(action);

        setComments("");

        setActionError("");
      },
      [],
    );

  /**
   * ==========================================================================
   * CLOSE DECISION DIALOG
   * ==========================================================================
   */

  const closeDecision =
    useCallback(() => {
      if (actionLoading) {
        return;
      }

      setDecisionRequest(
        null,
      );

      setDecision(null);

      setComments("");

      setActionError("");
    }, [actionLoading]);

  /**
   * ==========================================================================
   * PROCESS DECISION
   * ==========================================================================
   */

  const processDecision =
    useCallback(
      async () => {
        if (
          !decisionRequest ||
          !decision
        ) {
          return;
        }

        const requestId =
          decisionRequest.id;

        const actionKey =
          `${decision}-${requestId}`;

        try {
          setActionLoading(
            actionKey,
          );

          setActionError("");

          const payload = {
            comments:
              comments.trim()
                ? comments.trim()
                : null,
          };

          let updatedRequest:
            | LeaveRequest;

          if (
            decision ===
            "approve"
          ) {
            updatedRequest =
              await hrApproveLeaveRequest(
                requestId,
                payload,
              );
          } else {
            updatedRequest =
              await hrRejectLeaveRequest(
                requestId,
                payload,
              );
          }

          /**
           * The HR queue normally removes a request once its final decision
           * has been completed. We also update the local state immediately
           * so the UI never waits for a second request merely to reflect the
           * action.
           */
          setRequests(
            (current) =>
              current.filter(
                (request) =>
                  request.id !==
                  requestId,
              ),
          );

          setSelectedRequest(
            (current) =>
              current?.id ===
              requestId
                ? updatedRequest
                : current,
          );

          closeDecision();

          /**
           * Refresh the authoritative queue after the action.
           */
          await loadRequests({
            showRefresh: true,
          });
        } catch (err) {
          setActionError(
            getErrorMessage(err),
          );
        } finally {
          setActionLoading(
            null,
          );
        }
      },
      [
        closeDecision,
        comments,
        decision,
        decisionRequest,
        loadRequests,
      ],
    );

  /**
   * ==========================================================================
   * KEYBOARD HANDLING
   * ==========================================================================
   */

  useEffect(() => {
    if (!selectedRequest) {
      return;
    }

    const handleKeyDown =
      (event: KeyboardEvent) => {
        if (
          event.key === "Escape"
        ) {
          setSelectedRequest(
            null,
          );
        }
      };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [selectedRequest]);

  useEffect(() => {
    if (!decisionRequest) {
      return;
    }

    const handleKeyDown =
      (event: KeyboardEvent) => {
        if (
          event.key === "Escape" &&
          !actionLoading
        ) {
          closeDecision();
        }
      };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    actionLoading,
    closeDecision,
    decisionRequest,
  ]);

  /**
   * ==========================================================================
   * RENDER
   * ==========================================================================
   */

  return (
    <>
      <div className="min-h-full bg-slate-50">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
          {/* ================================================================
              HEADER
          ================================================================ */}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#071a35] text-[#D4AF37]">
                  <ShieldCheck
                    size={19}
                    strokeWidth={2}
                  />
                </div>

                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                    Approvals
                  </h1>

                  <p className="mt-0.5 text-sm text-slate-500">
                    Review and make final HR decisions on employee leave requests.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadRequests({
                  showRefresh: true,
                })
              }
              disabled={
                loading ||
                refreshing
              }
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />

              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>

          {/* ================================================================
              ERROR
          ================================================================ */}

          {error && (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0"
              />

              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  Unable to load approvals
                </p>

                <p className="mt-1">
                  {error}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  void loadRequests()
                }
                className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
              >
                Retry
              </button>
            </div>
          )}

          {/* ================================================================
              SUMMARY
          ================================================================ */}

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard
              label="Pending approval"
              value={
                summary.pending
              }
              description="Requests awaiting final HR action"
              icon={
                <Clock3
                  size={20}
                />
              }
            />

            <SummaryCard
              label="Employees"
              value={
                summary.employees
              }
              description="Employees represented in the queue"
              icon={
                <User
                  size={20}
                />
              }
            />

            <SummaryCard
              label="Departments"
              value={
                summary.departments
              }
              description="Departments represented in the queue"
              icon={
                <FileText
                  size={20}
                />
              }
            />
          </div>

          {/* ================================================================
              MAIN PANEL
          ================================================================ */}

          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Toolbar */}

            <div className="border-b border-slate-200 p-4 sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    HR Approval Queue
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Leave requests that have completed the manager approval stage.
                  </p>
                </div>

                <div className="relative w-full lg:max-w-sm">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="search"
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Search employee, department or leave..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#071a35] focus:bg-white focus:ring-2 focus:ring-[#071a35]/10"
                  />
                </div>
              </div>
            </div>

            {/* Loading */}

            {loading ? (
              <div className="flex min-h-[320px] items-center justify-center px-6">
                <div className="flex flex-col items-center text-center">
                  <Loader2
                    size={28}
                    className="animate-spin text-[#071a35]"
                  />

                  <p className="mt-3 text-sm font-medium text-slate-700">
                    Loading approval queue...
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Retrieving requests from the production HR API.
                  </p>
                </div>
              </div>
            ) : filteredRequests.length ===
              0 ? (
              <div className="flex min-h-[320px] items-center justify-center px-6">
                <div className="max-w-md text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <CheckCircle2
                      size={24}
                    />
                  </div>

                  <h3 className="mt-4 text-base font-semibold text-slate-900">
                    {search
                      ? "No matching requests"
                      : "No pending approvals"}
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {search
                      ? "Try a different search term."
                      : "There are currently no leave requests waiting for final HR approval."}
                  </p>

                  {search && (
                    <button
                      type="button"
                      onClick={() =>
                        setSearch(
                          "",
                        )
                      }
                      className="mt-4 text-sm font-medium text-[#071a35] hover:underline"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* ==========================================================
                    DESKTOP TABLE
                ========================================================== */}

                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[1000px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80">
                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Employee
                        </th>

                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Leave type
                        </th>

                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Dates
                        </th>

                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Duration
                        </th>

                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Department
                        </th>

                        <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Status
                        </th>

                        <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {filteredRequests.map(
                        (request) => {
                          const requestAction =
                            actionLoading?.endsWith(
                              request.id,
                            );

                          return (
                            <tr
                              key={
                                request.id
                              }
                              className="transition hover:bg-slate-50/70"
                            >
                              <td className="px-5 py-4">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedRequest(
                                      request,
                                    )
                                  }
                                  className="flex items-center gap-3 text-left"
                                >
                                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#071a35] text-xs font-semibold text-white">
                                    {getEmployeeInitials(
                                      request,
                                    )}
                                  </span>

                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold text-slate-900">
                                      {getEmployeeName(
                                        request,
                                      )}
                                    </span>

                                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                                      {request
                                        .employee
                                        ?.employeeNumber ||
                                        request
                                          .employee
                                          ?.email ||
                                        "Employee"}
                                    </span>
                                  </span>
                                </button>
                              </td>

                              <td className="px-5 py-4">
                                <p className="text-sm font-medium text-slate-800">
                                  {getLeaveTypeName(
                                    request,
                                  )}
                                </p>

                                {getLeaveTypeCode(
                                  request,
                                ) && (
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    {
                                      getLeaveTypeCode(
                                        request,
                                      )
                                    }
                                  </p>
                                )}
                              </td>

                              <td className="px-5 py-4 text-sm text-slate-700">
                                {formatDateRange(
                                  request,
                                )}
                              </td>

                              <td className="px-5 py-4 text-sm font-medium text-slate-800">
                                {formatDays(
                                  request,
                                )}
                              </td>

                              <td className="px-5 py-4 text-sm text-slate-600">
                                {getDepartmentName(
                                  request,
                                )}
                              </td>

                              <td className="px-5 py-4">
                                <StatusBadge
                                  status={
                                    request.status
                                  }
                                />
                              </td>

                              <td className="px-5 py-4">
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openDecision(
                                        request,
                                        "reject",
                                      )
                                    }
                                    disabled={
                                      Boolean(
                                        actionLoading,
                                      ) ||
                                      normalizeStatus(
                                        request.status,
                                      ) !==
                                        "PENDING_HR"
                                    }
                                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <X
                                      size={14}
                                    />
                                    Reject
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      openDecision(
                                        request,
                                        "approve",
                                      )
                                    }
                                    disabled={
                                      Boolean(
                                        actionLoading,
                                      ) ||
                                      normalizeStatus(
                                        request.status,
                                      ) !==
                                        "PENDING_HR"
                                    }
                                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#071a35] px-3 text-xs font-medium text-white transition hover:bg-[#0b2850] disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {requestAction ? (
                                      <Loader2
                                        size={14}
                                        className="animate-spin"
                                      />
                                    ) : (
                                      <Check
                                        size={14}
                                      />
                                    )}

                                    Approve
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>

                {/* ==========================================================
                    MOBILE / TABLET CARDS
                ========================================================== */}

                <div className="divide-y divide-slate-100 lg:hidden">
                  {filteredRequests.map(
                    (request) => (
                      <article
                        key={
                          request.id
                        }
                        className="p-4 sm:p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedRequest(
                                request,
                              )
                            }
                            className="flex min-w-0 items-center gap-3 text-left"
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#071a35] text-xs font-semibold text-white">
                              {getEmployeeInitials(
                                request,
                              )}
                            </span>

                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-slate-900">
                                {getEmployeeName(
                                  request,
                                )}
                              </span>

                              <span className="mt-0.5 block truncate text-xs text-slate-500">
                                {getDepartmentName(
                                  request,
                                )}
                              </span>
                            </span>
                          </button>

                          <StatusBadge
                            status={
                              request.status
                            }
                          />
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                              Leave type
                            </p>

                            <p className="mt-1 text-sm font-medium text-slate-800">
                              {getLeaveTypeName(
                                request,
                              )}
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                              Duration
                            </p>

                            <p className="mt-1 text-sm font-medium text-slate-800">
                              {formatDays(
                                request,
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 rounded-xl border border-slate-100 bg-white p-3">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            Dates
                          </p>

                          <p className="mt-1 text-sm text-slate-700">
                            {formatDateRange(
                              request,
                            )}
                          </p>
                        </div>

                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openDecision(
                                request,
                                "reject",
                              )
                            }
                            disabled={
                              Boolean(
                                actionLoading,
                              ) ||
                              normalizeStatus(
                                request.status,
                              ) !==
                                "PENDING_HR"
                            }
                            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <X
                              size={16}
                            />
                            Reject
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openDecision(
                                request,
                                "approve",
                              )
                            }
                            disabled={
                              Boolean(
                                actionLoading,
                              ) ||
                              normalizeStatus(
                                request.status,
                              ) !==
                                "PENDING_HR"
                            }
                            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#071a35] px-3 text-sm font-medium text-white hover:bg-[#0b2850] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Check
                              size={16}
                            />
                            Approve
                          </button>
                        </div>
                      </article>
                    ),
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {/* ======================================================================
          REQUEST DETAILS DRAWER
      ======================================================================= */}

      {selectedRequest && (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            aria-label="Close request details"
            onClick={() =>
              setSelectedRequest(
                null,
              )
            }
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Leave request
                </p>

                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  Request details
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedRequest(
                    null,
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                <X
                  size={19}
                />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#071a35] text-sm font-semibold text-white">
                  {getEmployeeInitials(
                    selectedRequest,
                  )}
                </div>

                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-slate-900">
                    {getEmployeeName(
                      selectedRequest,
                    )}
                  </h3>

                  <p className="truncate text-sm text-slate-500">
                    {selectedRequest
                      .employee
                      ?.email ||
                      "Employee"}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <StatusBadge
                  status={
                    selectedRequest.status
                  }
                />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Leave type
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {getLeaveTypeName(
                      selectedRequest,
                    )}
                  </p>

                  {getLeaveTypeCode(
                    selectedRequest,
                  ) && (
                    <p className="mt-1 text-xs text-slate-500">
                      {getLeaveTypeCode(
                        selectedRequest,
                      )}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Duration
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatDays(
                      selectedRequest,
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Start date
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatDate(
                      selectedRequest.startDate,
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    End date
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatDate(
                      selectedRequest.endDate,
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Department
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {getDepartmentName(
                      selectedRequest,
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Reason
                </p>

                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {selectedRequest.reason?.trim() ||
                    "No reason provided."}
                </p>
              </div>

              {selectedRequest
                .managerComments && (
                <div className="mt-4 rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Manager comments
                  </p>

                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {
                      selectedRequest.managerComments
                    }
                  </p>
                </div>
              )}

              {selectedRequest
                .attachmentUrl && (
                <div className="mt-4 rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Attachment
                  </p>

                  <a
                    href={
                      selectedRequest.attachmentUrl
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-[#071a35] hover:underline"
                  >
                    <FileText
                      size={16}
                    />
                    View attachment
                  </a>
                </div>
              )}

              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Request submitted
                </p>

                <p className="mt-1 text-sm text-slate-700">
                  {formatDate(
                    selectedRequest.createdAt,
                  )}
                </p>
              </div>
            </div>

            {normalizeStatus(
              selectedRequest.status,
            ) === "PENDING_HR" && (
              <div className="border-t border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      openDecision(
                        selectedRequest,
                        "reject",
                      )
                    }
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    <X
                      size={16}
                    />
                    Reject
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openDecision(
                        selectedRequest,
                        "approve",
                      )
                    }
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#071a35] px-3 text-sm font-medium text-white hover:bg-[#0b2850]"
                  >
                    <Check
                      size={16}
                    />
                    Approve
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* ======================================================================
          DECISION MODAL
      ======================================================================= */}

      {decisionRequest &&
        decision && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close decision dialog"
              onClick={closeDecision}
              disabled={
                Boolean(
                  actionLoading,
                )
              }
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm disabled:cursor-not-allowed"
            />

            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="decision-dialog-title"
              className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
                <div>
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      decision ===
                      "approve"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    {decision ===
                    "approve" ? (
                      <CheckCircle2
                        size={21}
                      />
                    ) : (
                      <XCircle
                        size={21}
                      />
                    )}
                  </div>

                  <h2
                    id="decision-dialog-title"
                    className="mt-3 text-lg font-semibold text-slate-900"
                  >
                    {decision ===
                    "approve"
                      ? "Approve leave request"
                      : "Reject leave request"}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {decision ===
                    "approve"
                      ? "This will give the request final HR approval."
                      : "This will reject the request at the final HR approval stage."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    closeDecision
                  }
                  disabled={
                    Boolean(
                      actionLoading,
                    )
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Close"
                >
                  <X
                    size={18}
                  />
                </button>
              </div>

              <div className="px-5 py-5 sm:px-6">
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#071a35] text-xs font-semibold text-white">
                      {getEmployeeInitials(
                        decisionRequest,
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {getEmployeeName(
                          decisionRequest,
                        )}
                      </p>

                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {getLeaveTypeName(
                          decisionRequest,
                        )}{" "}
                        ·{" "}
                        {formatDateRange(
                          decisionRequest,
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <label
                  htmlFor="approval-comments"
                  className="mt-5 block text-sm font-medium text-slate-700"
                >
                  Comments
                  <span className="ml-1 font-normal text-slate-400">
                    optional
                  </span>
                </label>

                <textarea
                  id="approval-comments"
                  value={comments}
                  onChange={(event) =>
                    setComments(
                      event.target
                        .value,
                    )
                  }
                  maxLength={2000}
                  rows={5}
                  disabled={
                    Boolean(
                      actionLoading,
                    )
                  }
                  placeholder={
                    decision ===
                    "approve"
                      ? "Add an approval note if needed..."
                      : "Add a reason for rejecting this request..."
                  }
                  className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#071a35] focus:ring-2 focus:ring-[#071a35]/10 disabled:bg-slate-50"
                />

                <div className="mt-1 text-right text-xs text-slate-400">
                  {comments.length}/2000
                </div>

                {actionError && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle
                      size={17}
                      className="mt-0.5 shrink-0"
                    />

                    <span>
                      {actionError}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                <button
                  type="button"
                  onClick={
                    closeDecision
                  }
                  disabled={
                    Boolean(
                      actionLoading,
                    )
                  }
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void processDecision()
                  }
                  disabled={
                    Boolean(
                      actionLoading,
                    )
                  }
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                    decision ===
                    "approve"
                      ? "bg-[#071a35] hover:bg-[#0b2850]"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {actionLoading ? (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  ) : decision ===
                    "approve" ? (
                    <Check
                      size={16}
                    />
                  ) : (
                    <X
                      size={16}
                    />
                  )}

                  {actionLoading
                    ? "Processing..."
                    : decision ===
                        "approve"
                      ? "Approve request"
                      : "Reject request"}
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}

export default Approvals;