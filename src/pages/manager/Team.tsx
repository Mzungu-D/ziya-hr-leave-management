import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Users,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";
import {
  listEmployees,
  type EmployeePublicRecord,
  type EmployeeStatus,
} from "../../services/employee.service";

/* ============================================================================
   TYPES
============================================================================ */

type StatusFilter = "ALL" | EmployeeStatus;

type LoadState = "loading" | "ready" | "error";

const STATUS_OPTIONS: {
  value: StatusFilter;
  label: string;
}[] = [
  { value: "ALL", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "PENDING", label: "Pending" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "SUSPENDED", label: "Suspended" },
];

/* ============================================================================
   HELPERS
============================================================================ */

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function fullName(employee: {
  firstName: string;
  lastName: string;
}): string {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
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

  return "Unable to load your team. Please try again.";
}

function statusClasses(status: EmployeeStatus): string {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
    case "PENDING":
      return "bg-amber-50 text-amber-700 ring-amber-600/20";
    case "INACTIVE":
      return "bg-slate-100 text-slate-600 ring-slate-500/20";
    case "SUSPENDED":
      return "bg-rose-50 text-rose-700 ring-rose-600/20";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-500/20";
  }
}

/*
 * Resolve the authenticated manager to their employee record.
 *
 * `AuthenticatedUser.id` and `AuthenticatedUser.employeeId` are separate
 * fields. Do not assume either one is the employee record's database ID.
 *
 * Email is used as an additional identity match because the authenticated
 * user and employee DTO both expose email. Organization scope is checked
 * independently before this helper is called.
 */
function resolveManagerRecord(
  employees: EmployeePublicRecord[],
  identity: {
    id: string;
    employeeId?: string;
    email: string;
  },
): EmployeePublicRecord | null {
  const userId = normalize(identity.id);
  const employeeId = normalize(identity.employeeId);
  const email = normalize(identity.email);

  return (
    employees.find(
      (employee) =>
        normalize(employee.id) === userId,
    ) ??
    employees.find(
      (employee) =>
        Boolean(employeeId) &&
        normalize(employee.employeeId) === employeeId,
    ) ??
    employees.find(
      (employee) =>
        Boolean(email) &&
        normalize(employee.email) === email,
    ) ??
    null
  );
}

/*
 * `reportsTo.id` is the employee record identifier used by the existing
 * employee service's reporting-manager assignment contract.
 */
function isDirectReport(
  employee: EmployeePublicRecord,
  manager: EmployeePublicRecord,
): boolean {
  if (!employee.reportsTo) {
    return false;
  }

  return (
    normalize(employee.reportsTo.id) ===
      normalize(manager.id) ||
    (
      Boolean(manager.employeeId) &&
      normalize(employee.reportsTo.employeeId) ===
        normalize(manager.employeeId)
    )
  );
}

/* ============================================================================
   PAGE
============================================================================ */

export default function Team() {
  const { user, isLoading: authLoading } = useAuth();

  const [employees, setEmployees] = useState<EmployeePublicRecord[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("ALL");
  const [refreshing, setRefreshing] = useState(false);

  const requestController = useRef<AbortController | null>(null);
  const requestVersion = useRef(0);

  const loadTeam = useCallback(
    async (isRefresh = false) => {
      if (!user || authLoading) {
        return;
      }

      requestController.current?.abort();

      const controller = new AbortController();
      requestController.current = controller;
      const currentVersion = ++requestVersion.current;

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoadState("loading");
      }

      setErrorMessage("");

      try {
        const result = await listEmployees({
          signal: controller.signal,
        });

        if (
          controller.signal.aborted ||
          currentVersion !== requestVersion.current
        ) {
          return;
        }

        /*
         * Never use a client-provided organization identifier to request
         * data. The service derives organization scope from the session.
         * This additional check prevents cross-organization rows from
         * being displayed if an unexpected response contains them.
         */
        const organizationEmployees = result.employees.filter(
          (employee) =>
            employee.organizationId === user.organizationId,
        );

        setEmployees(organizationEmployees);
        setLoadState("ready");
      } catch (error) {
        if (
          controller.signal.aborted ||
          currentVersion !== requestVersion.current
        ) {
          return;
        }

        setErrorMessage(getErrorMessage(error));
        setLoadState("error");
      } finally {
        if (currentVersion === requestVersion.current) {
          setRefreshing(false);
        }
      }
    },
    [user, authLoading],
  );

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user || user.role !== "MANAGER") {
      setEmployees([]);
      setLoadState("ready");
      return;
    }

    void loadTeam();

    return () => {
      requestController.current?.abort();
      requestVersion.current += 1;
    };
  }, [authLoading, user, loadTeam]);

  const managerRecord = useMemo(() => {
    if (!user) {
      return null;
    }

    return resolveManagerRecord(employees, {
      id: user.id,
      employeeId: user.employeeId,
      email: user.email,
    });
  }, [employees, user]);

  const team = useMemo(() => {
    if (!managerRecord) {
      return [];
    }

    return employees
      .filter((employee) => employee.id !== managerRecord.id)
      .filter((employee) => isDirectReport(employee, managerRecord))
      .sort((a, b) =>
        fullName(a).localeCompare(fullName(b)),
      );
  }, [employees, managerRecord]);

  const departments = useMemo(
    () =>
      Array.from(
        new Set(
          team
            .map((employee) => employee.department?.name)
            .filter((name): name is string => Boolean(name)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [team],
  );

  const filteredTeam = useMemo(() => {
    const query = normalize(search);

    return team.filter((employee) => {
      const matchesSearch =
        !query ||
        normalize(fullName(employee)).includes(query) ||
        normalize(employee.employeeId).includes(query) ||
        normalize(employee.email).includes(query) ||
        normalize(employee.phone).includes(query) ||
        normalize(employee.department?.name).includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        employee.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [team, search, statusFilter]);

  const activeCount = team.filter(
    (employee) => employee.status === "ACTIVE",
  ).length;

  const pendingCount = team.filter(
    (employee) => employee.status === "PENDING",
  ).length;

  const inactiveCount = team.filter(
    (employee) =>
      employee.status === "INACTIVE" ||
      employee.status === "SUSPENDED",
  ).length;

  if (authLoading || loadState === "loading") {
    return (
      <div className="min-h-[60vh] bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-5 w-72 max-w-full animate-pulse rounded bg-slate-200" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>
      </div>
    );
  }

  if (!user || user.role !== "MANAGER") {
    return (
      <main className="min-h-[60vh] bg-slate-50 px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <AlertCircle className="mx-auto h-10 w-10 text-rose-600" />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">
            Manager access required
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            This page is available to authenticated managers only.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Users className="h-4 w-4" />
              Manager workspace
            </div>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              My Team
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              View your direct reports, check employee status, and find
              team contact information.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadTeam(true)}
            disabled={refreshing}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </header>

        {/* Errors */}
        {loadState === "error" && (
          <section
            role="alert"
            className="flex flex-col gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
              <div>
                <h2 className="font-semibold text-rose-900">
                  Unable to load your team
                </h2>
                <p className="mt-1 break-words text-sm text-rose-800">
                  {errorMessage}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadTeam()}
              className="min-h-10 rounded-lg border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-800 hover:bg-rose-100"
            >
              Try again
            </button>
          </section>
        )}

        {/* Summary cards */}
        <section
          aria-label="Team summary"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          <SummaryCard
            title="Direct reports"
            value={team.length}
            description="Employees reporting to you"
            icon={<Users className="h-5 w-5" />}
            iconClass="bg-blue-50 text-blue-700"
          />
          <SummaryCard
            title="Active employees"
            value={activeCount}
            description="Accounts currently active"
            icon={<CheckCircle2 className="h-5 w-5" />}
            iconClass="bg-emerald-50 text-emerald-700"
          />
          <SummaryCard
            title="Pending or inactive"
            value={pendingCount + inactiveCount}
            description={`${pendingCount} pending · ${inactiveCount} inactive or suspended`}
            icon={<Clock3 className="h-5 w-5" />}
            iconClass="bg-amber-50 text-amber-700"
          />
        </section>

        {/* Team table/card list */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Team members
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {filteredTeam.length} of {team.length} direct reports
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="relative block">
                  <span className="sr-only">Search team members</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search name, ID, email…"
                    className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-64"
                  />
                  {search && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </label>

                <label>
                  <span className="sr-only">Filter by employee status</span>
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value as StatusFilter)
                    }
                    className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {departments.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Departments
                </span>
                {departments.map((department) => (
                  <span
                    key={department}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
                  >
                    {department}
                  </span>
                ))}
              </div>
            )}
          </div>

          {loadState === "error" ? (
            <div className="px-5 py-12 text-center">
              <Users className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">
                Team information is unavailable until the request succeeds.
              </p>
            </div>
          ) : !managerRecord ? (
            <div className="px-5 py-12 text-center">
              <AlertCircle className="mx-auto h-9 w-9 text-amber-500" />
              <h3 className="mt-3 font-semibold text-slate-900">
                Employee record could not be matched
              </h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                Your authenticated account could not be matched to an employee
                record in this organization. No team members are shown to avoid
                displaying the wrong employees. Ask HR to verify your employee
                account and reporting-manager assignment.
              </p>
            </div>
          ) : filteredTeam.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                <Users className="h-6 w-6 text-slate-500" />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">
                {team.length === 0
                  ? "No direct reports found"
                  : "No matching team members"}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                {team.length === 0
                  ? "Employees appear here when their reporting manager is assigned to your employee record."
                  : "Try a different search term or change the status filter."}
              </p>
              {(search || statusFilter !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                  }}
                  className="mt-4 text-sm font-semibold text-blue-700 hover:text-blue-800"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop/tablet layout */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] divide-y divide-slate-100 text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Employee
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Department
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Contact
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Status
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Joined
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTeam.map((employee) => (
                      <tr
                        key={employee.id}
                        className="transition hover:bg-slate-50/80"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={fullName(employee)} />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">
                                {fullName(employee)}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                ID: {employee.employeeId}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm text-slate-700">
                            {employee.department?.name ?? "Unassigned"}
                          </p>
                          {employee.department?.code && (
                            <p className="mt-1 text-xs text-slate-400">
                              {employee.department.code}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <ContactDetails employee={employee} />
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={employee.status} />
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                          {formatDate(employee.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile layout */}
              <div className="divide-y divide-slate-100 md:hidden">
                {filteredTeam.map((employee) => (
                  <article key={employee.id} className="p-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <Avatar name={fullName(employee)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words font-semibold text-slate-900">
                            {fullName(employee)}
                          </h3>
                          <StatusBadge status={employee.status} />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Employee ID: {employee.employeeId}
                        </p>
                        <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                          <BriefcaseBusiness className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="break-words">
                            {employee.department?.name ?? "Unassigned"}
                          </span>
                        </p>
                        <div className="mt-3">
                          <ContactDetails employee={employee} />
                        </div>
                        <p className="mt-3 text-xs text-slate-400">
                          Joined {formatDate(employee.createdAt)}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          <footer className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <span>
              Showing {filteredTeam.length} of {team.length} direct reports
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Read-only team directory
            </span>
          </footer>
        </section>

        <p className="text-xs leading-5 text-slate-400">
          Employee details are provided by your organization&apos;s employee
          service. Contact HR if a reporting relationship or employee status
          appears incorrect.
        </p>
      </div>
    </main>
  );
}

/* ============================================================================
   PRESENTATIONAL COMPONENTS
============================================================================ */

function SummaryCard({
  title,
  value,
  description,
  icon,
  iconClass,
}: {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  iconClass: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {description}
          </p>
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
        >
          {icon}
        </div>
      </div>
    </article>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div
      aria-label={name}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700 ring-1 ring-slate-200"
    >
      {getInitials(name) || <UserRound className="h-5 w-5" />}
    </div>
  );
}

function StatusBadge({ status }: { status: EmployeeStatus }) {
  const Icon =
    status === "ACTIVE"
      ? CheckCircle2
      : status === "PENDING"
        ? Clock3
        : XCircle;

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClasses(status)}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function ContactDetails({
  employee,
}: {
  employee: EmployeePublicRecord;
}) {
  return (
    <div className="space-y-1.5">
      <a
        href={`mailto:${employee.email}`}
        className="flex min-w-0 items-center gap-2 text-sm text-slate-600 hover:text-blue-700"
      >
        <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="break-all">{employee.email}</span>
      </a>
      {employee.phone && (
        <a
          href={`tel:${employee.phone}`}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-700"
        >
          <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span>{employee.phone}</span>
        </a>
      )}
    </div>
  );
}
