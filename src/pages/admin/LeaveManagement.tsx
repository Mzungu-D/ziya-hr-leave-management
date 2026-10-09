import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  User,
  Users,
  X,
  XCircle,
} from "lucide-react";

import {
  getLeaveRequest,
  listHrPendingRequests,
  type LeaveRequest,
  type LeaveServiceError,
} from "../../services/leave.service";

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function getEmployeeName(
  request: LeaveRequest,
): string {
  const employee = request.employee;

  if (!employee) {
    return "Employee";
  }

  const fullName = employee.fullName?.trim();

  if (fullName) {
    return fullName;
  }

  const name = employee.name?.trim();

  if (name) {
    return name;
  }

  const composedName = [
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
  const name = getEmployeeName(request);

  const parts = name
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

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getDepartmentName(
  request: LeaveRequest,
): string {
  return (
    request.employee?.departmentName ||
    "Department not assigned"
  );
}

function getLeaveTypeName(
  request: LeaveRequest,
): string {
  return request.leaveType?.name || "Leave";
}

function getLeaveTypeCode(
  request: LeaveRequest,
): string {
  return request.leaveType?.code || "";
}

function normalizeStatus(
  status: string | undefined,
): string {
  return (
    status || ""
  )
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function formatStatus(
  status: string | undefined,
): string {
  const normalized = normalizeStatus(status);

  switch (normalized) {
    case "PENDING":
      return "Pending Manager";

    case "MANAGER_APPROVED":
      return "Pending HR";

    case "HR_APPROVED":
    case "APPROVED":
      return "Approved";

    case "REJECTED":
      return "Rejected";

    case "CANCELLED":
      return "Cancelled";

    default:
      return status || "Unknown";
  }
}

function formatDate(
  value: string | undefined,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
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
  const start = formatDate(request.startDate);
  const end = formatDate(request.endDate);

  if (start === end) {
    return start;
  }

  return `${start} – ${end}`;
}

function getDays(
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
  const days = getDays(request);

  if (days === null) {
    return "—";
  }

  return `${days} ${days === 1 ? "day" : "days"}`;
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
      typeof serviceError.message === "string" &&
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

  return "Unable to load leave records. Please try again.";
}

/* ============================================================================
 * STATUS BADGE
 * ========================================================================== */

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized = normalizeStatus(status);

  if (normalized === "MANAGER_APPROVED") {
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
    normalized === "HR_APPROVED" ||
    normalized === "APPROVED"
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

  if (normalized === "REJECTED") {
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

  if (normalized === "CANCELLED") {
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

/* ============================================================================
 * SUMMARY CARD
 * ========================================================================== */

function SummaryCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: number;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
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

/* ============================================================================
 * LEAVE MANAGEMENT
 * ========================================================================== */

export function LeaveManagement() {
  const [requests, setRequests] =
    useState<LeaveRequest[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [departmentFilter, setDepartmentFilter] =
    useState("ALL");

  const [leaveTypeFilter, setLeaveTypeFilter] =
    useState("ALL");

  const [selectedRequest, setSelectedRequest] =
    useState<LeaveRequest | null>(null);

  const [detailLoading, setDetailLoading] =
    useState(false);

  const [detailError, setDetailError] =
    useState("");

  /* ==========================================================================
   * LOAD DATA
   * ======================================================================== */

  const loadRequests = useCallback(
    async (
      options: {
        showRefresh?: boolean;
        signal?: AbortSignal;
      } = {},
    ) => {
      const showRefresh =
        options.showRefresh === true;

      try {
        setError("");

        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const data =
          await listHrPendingRequests({
            signal: options.signal,
          });

        if (!Array.isArray(data)) {
          setRequests([]);
          return;
        }

        setRequests(data);
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return;
        }

        const serviceError =
          loadError as LeaveServiceError;

        if (
          serviceError.code ===
          "REQUEST_CANCELLED"
        ) {
          return;
        }

        setError(
          getErrorMessage(loadError),
        );
      } finally {
        if (showRefresh) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const controller =
      new AbortController();

    void loadRequests({
      signal: controller.signal,
    });

    return () => {
      controller.abort();
    };
  }, [loadRequests]);

  /* ==========================================================================
   * DERIVED FILTER OPTIONS
   * ======================================================================== */

  const departments = useMemo(() => {
    const values = new Set<string>();

    for (const request of requests) {
      const department =
        getDepartmentName(request);

      if (department !== "Department not assigned") {
        values.add(department);
      }
    }

    return Array.from(values).sort(
      (a, b) => a.localeCompare(b),
    );
  }, [requests]);

  const leaveTypes = useMemo(() => {
    const values = new Map<
      string,
      string
    >();

    for (const request of requests) {
      const name =
        getLeaveTypeName(request);

      const code =
        getLeaveTypeCode(request);

      const key =
        code || name;

      if (!values.has(key)) {
        values.set(key, name);
      }
    }

    return Array.from(
      values.entries(),
    )
      .map(([value, label]) => ({
        value,
        label,
      }))
      .sort(
        (a, b) =>
          a.label.localeCompare(
            b.label,
          ),
      );
  }, [requests]);

  /* ==========================================================================
   * FILTERING
   * ======================================================================== */

  const filteredRequests = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return requests.filter(
      (request) => {
        const employeeName =
          getEmployeeName(request)
            .toLowerCase();

        const employeeEmail =
          request.employee?.email
            ?.toLowerCase() || "";

        const employeeNumber =
          request.employee?.employeeNumber
            ?.toLowerCase() || "";

        const department =
          getDepartmentName(request)
            .toLowerCase();

        const leaveType =
          getLeaveTypeName(request)
            .toLowerCase();

        const leaveCode =
          getLeaveTypeCode(request)
            .toLowerCase();

        const matchesSearch =
          !normalizedSearch ||
          employeeName.includes(
            normalizedSearch,
          ) ||
          employeeEmail.includes(
            normalizedSearch,
          ) ||
          employeeNumber.includes(
            normalizedSearch,
          ) ||
          department.includes(
            normalizedSearch,
          ) ||
          leaveType.includes(
            normalizedSearch,
          ) ||
          leaveCode.includes(
            normalizedSearch,
          );

        const matchesDepartment =
          departmentFilter === "ALL" ||
          getDepartmentName(request) ===
            departmentFilter;

        const matchesLeaveType =
          leaveTypeFilter === "ALL" ||
          (
            getLeaveTypeCode(request) ||
            getLeaveTypeName(request)
          ) === leaveTypeFilter;

        return (
          matchesSearch &&
          matchesDepartment &&
          matchesLeaveType
        );
      },
    );
  }, [
    requests,
    search,
    departmentFilter,
    leaveTypeFilter,
  ]);

  /* ==========================================================================
   * SUMMARY
   * ======================================================================== */

  const summary = useMemo(() => {
    const employees =
      new Set<string>();

    const departmentSet =
      new Set<string>();

    let totalDays = 0;

    let daysAvailable = true;

    for (const request of requests) {
      employees.add(
        request.employeeId,
      );

      departmentSet.add(
        getDepartmentName(request),
      );

      const days =
        getDays(request);

      if (days === null) {
        daysAvailable = false;
      } else {
        totalDays += days;
      }
    }

    return {
      pending: requests.length,
      employees: employees.size,
      departments:
        departmentSet.size,
      totalDays:
        daysAvailable
          ? totalDays
          : null,
    };
  }, [requests]);

  /* ==========================================================================
   * OPEN REQUEST DETAILS
   * ======================================================================== */

  const openRequest = useCallback(
    async (
      request: LeaveRequest,
    ) => {
      setSelectedRequest(request);
      setDetailError("");

      /*
       * The HR queue already returns the request
       * with employee, department and leave type
       * projections. We still attempt to retrieve
       * the authoritative single record so the
       * details drawer can use the latest server state.
       */
      try {
        setDetailLoading(true);

        const latest =
          await getLeaveRequest(
            request.id,
          );

        if (latest) {
          setSelectedRequest(
            latest,
          );
        }
      } catch (detailLoadError) {
        const serviceError =
          detailLoadError as LeaveServiceError;

        if (
          serviceError.code !==
            "REQUEST_CANCELLED" &&
          !(
            detailLoadError instanceof
              DOMException &&
            detailLoadError.name ===
              "AbortError"
          )
        ) {
          setDetailError(
            getErrorMessage(
              detailLoadError,
            ),
          );
        }
      } finally {
        setDetailLoading(false);
      }
    },
    [],
  );

  const closeDetails =
    useCallback(() => {
      setSelectedRequest(null);
      setDetailError("");
    }, []);

  /* ==========================================================================
   * KEYBOARD HANDLING
   * ======================================================================== */

  useEffect(() => {
    if (!selectedRequest) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        closeDetails();
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
    selectedRequest,
    closeDetails,
  ]);

  /* ==========================================================================
   * RENDER
   * ======================================================================== */

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">

        {/* ================================================================
         * HEADER
         * ================================================================ */}

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>HR</span>
              <ChevronRight
                size={15}
              />
              <span>Leave Management</span>
            </div>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              Leave Management
            </h1>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Review leave requests that have completed manager approval and are awaiting HR action.
            </p>
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
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? "animate-spin"
                  : undefined
              }
            />
            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>

        {/* ================================================================
         * ERROR
         * ================================================================ */}

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <div className="min-w-0 flex-1">
              <p className="font-medium">
                Unable to load leave requests
              </p>

              <p className="mt-1 leading-5">
                {error}
              </p>

              <button
                type="button"
                onClick={() =>
                  void loadRequests()
                }
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* ================================================================
         * SUMMARY
         * ================================================================ */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Pending HR"
            value={summary.pending}
            description="Requests awaiting final HR action"
            icon={
              <Clock3
                size={19}
              />
            }
          />

          <SummaryCard
            label="Employees"
            value={summary.employees}
            description="Employees represented in this queue"
            icon={
              <Users
                size={19}
              />
            }
          />

          <SummaryCard
            label="Departments"
            value={summary.departments}
            description="Departments represented in this queue"
            icon={
              <User
                size={19}
              />
            }
          />

          <SummaryCard
            label="Requested Days"
            value={
              summary.totalDays ??
              0
            }
            description={
              summary.totalDays === null
                ? "Day totals unavailable"
                : "Total days currently awaiting HR"
            }
            icon={
              <CalendarDays
                size={19}
              />
            }
          />
        </div>

        {/* ================================================================
         * FILTER BAR
         * ================================================================ */}

        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search
                size={17}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search employee, email, employee number, department or leave type..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#D4AF37] focus:bg-white focus:ring-2 focus:ring-[#D4AF37]/15"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Filter
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <select
                  value={departmentFilter}
                  onChange={(event) =>
                    setDepartmentFilter(
                      event.target.value,
                    )
                  }
                  className="h-11 w-full min-w-[190px] appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-700 outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/15"
                  aria-label="Filter by department"
                >
                  <option value="ALL">
                    All departments
                  </option>

                  {departments.map(
                    (department) => (
                      <option
                        key={department}
                        value={department}
                      >
                        {department}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="relative">
                <FileText
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <select
                  value={leaveTypeFilter}
                  onChange={(event) =>
                    setLeaveTypeFilter(
                      event.target.value,
                    )
                  }
                  className="h-11 w-full min-w-[190px] appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-700 outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/15"
                  aria-label="Filter by leave type"
                >
                  <option value="ALL">
                    All leave types
                  </option>

                  {leaveTypes.map(
                    (leaveType) => (
                      <option
                        key={leaveType.value}
                        value={
                          leaveType.value
                        }
                      >
                        {leaveType.label}
                      </option>
                    ),
                  )}
                </select>
              </div>

              {(search ||
                departmentFilter !==
                  "ALL" ||
                leaveTypeFilter !==
                  "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setDepartmentFilter(
                      "ALL",
                    );
                    setLeaveTypeFilter(
                      "ALL",
                    );
                  }}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  <X size={15} />
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              Showing{" "}
              <span className="font-semibold text-slate-700">
                {filteredRequests.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-700">
                {requests.length}
              </span>{" "}
              requests
            </span>

            <span>
              HR queue is limited to manager-approved requests.
            </span>
          </div>
        </div>

        {/* ================================================================
         * LOADING
         * ================================================================ */}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 shadow-sm">
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2
                size={28}
                className="animate-spin text-slate-500"
              />

              <p className="mt-4 text-sm font-medium text-slate-700">
                Loading leave requests...
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Retrieving the current HR queue.
              </p>
            </div>
          </div>
        ) : filteredRequests.length === 0 ? (
          /* ================================================================
           * EMPTY
           * ================================================================ */

          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 shadow-sm">
            <div className="mx-auto flex max-w-md flex-col items-center justify-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <CheckCircle2
                  size={26}
                />
              </div>

              <h2 className="mt-5 text-base font-semibold text-slate-900">
                {requests.length === 0
                  ? "No leave requests awaiting HR"
                  : "No matching leave requests"}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                {requests.length === 0
                  ? "There are currently no manager-approved leave requests waiting for final HR action."
                  : "Try adjusting your search or filters to find the request you need."}
              </p>

              {requests.length > 0 &&
                (
                  search ||
                  departmentFilter !==
                    "ALL" ||
                  leaveTypeFilter !==
                    "ALL"
                ) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setDepartmentFilter(
                        "ALL",
                      );
                      setLeaveTypeFilter(
                        "ALL",
                      );
                    }}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#071a35] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0a2347]"
                  >
                    Clear filters
                  </button>
                )}
            </div>
          </div>
        ) : (
          /* ================================================================
           * DATA
           * ================================================================ */

          <>
            {/* DESKTOP TABLE */}

            <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Employee
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Department
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Leave Type
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Dates
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Duration
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Status
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredRequests.map(
                      (request) => (
                        <tr
                          key={request.id}
                          className="transition hover:bg-slate-50/70"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#071a35] text-xs font-semibold text-white">
                                {getEmployeeInitials(
                                  request,
                                )}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {getEmployeeName(
                                    request,
                                  )}
                                </p>

                                <p className="mt-0.5 truncate text-xs text-slate-500">
                                  {request
                                    .employee
                                    ?.employeeNumber ||
                                    request
                                      .employee
                                      ?.email ||
                                    "Employee"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {getDepartmentName(
                              request,
                            )}
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
                              <p className="mt-0.5 text-xs text-slate-400">
                                {getLeaveTypeCode(
                                  request,
                                )}
                              </p>
                            )}
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {formatDateRange(
                              request,
                            )}
                          </td>

                          <td className="px-5 py-4 text-sm font-medium text-slate-700">
                            {formatDays(
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

                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                void openRequest(
                                  request,
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                              View
                              <ChevronRight
                                size={14}
                              />
                            </button>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MOBILE / TABLET CARDS */}

            <div className="grid gap-3 lg:hidden">
              {filteredRequests.map(
                (request) => (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() =>
                      void openRequest(
                        request,
                      )
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#071a35] text-xs font-semibold text-white">
                        {getEmployeeInitials(
                          request,
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {getEmployeeName(
                                request,
                              )}
                            </p>

                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {getDepartmentName(
                                request,
                              )}
                            </p>
                          </div>

                          <StatusBadge
                            status={
                              request.status
                            }
                          />
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                              Leave
                            </p>

                            <p className="mt-1 text-sm font-medium text-slate-700">
                              {getLeaveTypeName(
                                request,
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                              Duration
                            </p>

                            <p className="mt-1 text-sm font-medium text-slate-700">
                              {formatDays(
                                request,
                              )}
                            </p>
                          </div>

                          <div className="col-span-2">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                              Dates
                            </p>

                            <p className="mt-1 text-sm font-medium text-slate-700">
                              {formatDateRange(
                                request,
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-end gap-1 text-xs font-semibold text-slate-500">
                          View details
                          <ChevronRight
                            size={14}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                ),
              )}
            </div>
          </>
        )}
      </div>

      {/* ======================================================================
       * DETAILS DRAWER
       * ==================================================================== */}

      {selectedRequest && (
        <div
          className="fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
          aria-label="Leave request details"
        >
          <button
            type="button"
            aria-label="Close leave request details"
            onClick={closeDetails}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]"
          />

          <aside className="relative ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
            {/* Drawer header */}

            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <FileText
                    size={14}
                  />
                  Leave Request
                </div>

                <h2 className="mt-1 truncate text-lg font-semibold text-slate-950">
                  {getEmployeeName(
                    selectedRequest,
                  )}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {getDepartmentName(
                    selectedRequest,
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={closeDetails}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

            {/* Drawer body */}

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              {detailError && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertCircle
                    size={17}
                    className="mt-0.5 shrink-0"
                  />

                  <div>
                    <p className="font-medium">
                      Latest details could not be loaded
                    </p>

                    <p className="mt-1 text-xs leading-5">
                      {detailError}
                    </p>
                  </div>
                </div>
              )}

              {detailLoading && (
                <div className="mb-5 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-600">
                  <Loader2
                    size={15}
                    className="animate-spin"
                  />
                  Refreshing request details...
                </div>
              )}

              {/* Status */}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Current status
                    </p>

                    <div className="mt-2">
                      <StatusBadge
                        status={
                          selectedRequest.status
                        }
                      />
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-slate-400">
                      Submitted
                    </p>

                    <p className="mt-1 text-sm font-medium text-slate-700">
                      {formatDate(
                        selectedRequest.createdAt,
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Employee */}

              <section className="mt-5">
                <h3 className="text-sm font-semibold text-slate-900">
                  Employee
                </h3>

                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#071a35] text-sm font-semibold text-white">
                      {getEmployeeInitials(
                        selectedRequest,
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {getEmployeeName(
                          selectedRequest,
                        )}
                      </p>

                      {selectedRequest
                        .employee
                        ?.employeeNumber && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {
                            selectedRequest
                              .employee
                              .employeeNumber
                          }
                        </p>
                      )}

                      {selectedRequest
                        .employee
                        ?.email && (
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {
                            selectedRequest
                              .employee
                              .email
                          }
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        Department
                      </p>

                      <p className="mt-1 text-sm text-slate-700">
                        {getDepartmentName(
                          selectedRequest,
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        Role
                      </p>

                      <p className="mt-1 text-sm text-slate-700">
                        {selectedRequest
                          .employee
                          ?.role || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Leave details */}

              <section className="mt-5">
                <h3 className="text-sm font-semibold text-slate-900">
                  Leave details
                </h3>

                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        Leave type
                      </p>

                      <p className="mt-1 text-sm font-medium text-slate-800">
                        {getLeaveTypeName(
                          selectedRequest,
                        )}
                      </p>

                      {getLeaveTypeCode(
                        selectedRequest,
                      ) && (
                        <p className="mt-0.5 text-xs text-slate-400">
                          {getLeaveTypeCode(
                            selectedRequest,
                          )}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        Duration
                      </p>

                      <p className="mt-1 text-sm font-medium text-slate-800">
                        {formatDays(
                          selectedRequest,
                        )}
                      </p>
                    </div>

                    <div className="sm:col-span-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        Leave period
                      </p>

                      <p className="mt-1 text-sm font-medium text-slate-800">
                        {formatDateRange(
                          selectedRequest,
                        )}
                      </p>
                    </div>
                  </div>

                  {selectedRequest.reason && (
                    <div className="mt-5 border-t border-slate-100 pt-4">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        Employee reason
                      </p>

                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {
                          selectedRequest.reason
                        }
                      </p>
                    </div>
                  )}

                  {selectedRequest.attachmentUrl && (
                    <div className="mt-5 border-t border-slate-100 pt-4">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        Attachment
                      </p>

                      <a
                        href={
                          selectedRequest.attachmentUrl
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-[#071a35] underline decoration-slate-300 underline-offset-4 hover:decoration-[#D4AF37]"
                      >
                        <FileText
                          size={15}
                        />
                        View attachment
                      </a>
                    </div>
                  )}
                </div>
              </section>

              {/* Approval history */}

              <section className="mt-5">
                <h3 className="text-sm font-semibold text-slate-900">
                  Approval history
                </h3>

                <div className="mt-3 space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                        <CheckCircle2
                          size={16}
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">
                          Manager approval
                        </p>

                        {selectedRequest
                          .managerApprovedAt ? (
                          <p className="mt-1 text-xs text-slate-500">
                            Approved on{" "}
                            {formatDate(
                              selectedRequest.managerApprovedAt,
                            )}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-slate-500">
                            Manager approval recorded
                          </p>
                        )}

                        {selectedRequest
                          .managerComments && (
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-slate-600">
                            {
                              selectedRequest.managerComments
                            }
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                        <Clock3
                          size={16}
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">
                          HR review
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Awaiting final HR decision
                        </p>

                        {selectedRequest
                          .hrComments && (
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-slate-600">
                            {
                              selectedRequest.hrComments
                            }
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Request metadata */}

              <section className="mt-5">
                <h3 className="text-sm font-semibold text-slate-900">
                  Request information
                </h3>

                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-slate-500">
                        Request ID
                      </span>

                      <span className="max-w-[65%] break-all text-right font-mono text-xs text-slate-600">
                        {selectedRequest.id}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-500">
                        Submitted
                      </span>

                      <span className="text-right text-slate-700">
                        {formatDate(
                          selectedRequest.createdAt,
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-500">
                        Last updated
                      </span>

                      <span className="text-right text-slate-700">
                        {formatDate(
                          selectedRequest.updatedAt,
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Drawer footer */}

            <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-slate-500">
                  Final approval or rejection is handled from the Approvals workspace.
                </p>

                <button
                  type="button"
                  onClick={closeDetails}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default LeaveManagement;