import {
  Loader2,
  Mail,
  RefreshCw,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";

import {
  listEmployees,
  type EmployeePublicRecord,
} from "../../services/employee.service";
import {
  sendEmployeeInvitation,
} from "../../services/invitation.service";

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    const message = (
      error as { message?: unknown }
    ).message;

    if (
      typeof message === "string" &&
      message.trim()
    ) {
      return message;
    }
  }

  return "The request could not be completed. Please try again.";
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getEmployeeName(
  employee: EmployeePublicRecord,
): string {
  return `${employee.firstName} ${employee.lastName}`.trim() ||
    "Unnamed employee";
}

export function Onboarding() {
  const [employees, setEmployees] = useState<EmployeePublicRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingEmployeeId, setSendingEmployeeId] = useState<string | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    setError(null);

    try {
      const result = await listEmployees();
      setEmployees(result.employees);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  const pendingEmployees = useMemo(
    () => employees.filter((employee) => employee.status === "PENDING"),
    [employees],
  );

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return pendingEmployees;
    }

    return pendingEmployees.filter((employee) => {
      const searchableValues = [
        employee.firstName,
        employee.lastName,
        employee.employeeId,
        employee.email,
        employee.phone,
      ];

      return searchableValues.some((value) =>
        value.toLowerCase().includes(query),
      );
    });
  }, [pendingEmployees, search]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadEmployees();
  };

  const handleSendInvitation = async (
    employee: EmployeePublicRecord,
  ) => {
    setSendingEmployeeId(employee.id);
    setError(null);
    setNotice(null);

    try {
      const result = await sendEmployeeInvitation(employee.id);

      setNotice(
        `Invitation sent to ${result.sentTo}. The link expires ${formatDateTime(
          result.expiresAt,
        )}.`,
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSendingEmployeeId(null);
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b88900]">
            HR workspace
          </p>

          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            Employee onboarding
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Send pending employees a secure email invitation to activate their
            account and create a password. They can then sign in using their
            registered email address or phone number.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={loading || refreshing}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={
                loading || refreshing ? "animate-spin" : undefined
              }
              aria-hidden="true"
            />
            Refresh
          </button>

          <Link
            to="/admin/employees"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#071a35] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0b2448] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8a415] focus-visible:ring-offset-2"
          >
            <UserPlus size={16} aria-hidden="true" />
            Add employee
          </Link>
        </div>
      </header>

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {notice}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">
              Pending employee accounts
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {pendingEmployees.length} employee
              {pendingEmployees.length === 1 ? "" : "s"} awaiting activation
            </p>
          </div>

          <label className="relative block w-full sm:max-w-xs">
            <span className="sr-only">Search pending employees</span>
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employees"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#d8a415] focus:ring-4 focus:ring-[#d8a415]/10"
            />
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-slate-500">
            <Loader2
              size={18}
              className="animate-spin"
              aria-hidden="true"
            />
            Loading employees…
          </div>
        ) : pendingEmployees.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Users
              size={30}
              aria-hidden="true"
              className="mx-auto text-slate-300"
            />

            <h3 className="mt-3 font-semibold text-slate-800">
              No pending employees
            </h3>

            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
              Add an employee record first. Once the employee is pending,
              return here to email their account activation link.
            </p>

            <Link
              to="/admin/employees"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#071a35] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0b2448]"
            >
              <UserPlus size={16} aria-hidden="true" />
              Add employee
            </Link>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Search
              size={28}
              aria-hidden="true"
              className="mx-auto text-slate-300"
            />
            <p className="mt-3 font-semibold text-slate-800">
              No matching employees
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Try another name, employee ID, email address, or phone number.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredEmployees.map((employee) => {
              const isSending = sendingEmployeeId === employee.id;
              const hasEmail = employee.email.trim().length > 0;

              return (
                <article
                  key={employee.id}
                  className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-slate-900">
                      {getEmployeeName(employee)}
                    </h3>

                    <p className="mt-1 break-all text-sm text-slate-600">
                      {hasEmail ? employee.email : "No email address"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Employee ID: {employee.employeeId}
                      {employee.phone
                        ? ` · Phone: ${employee.phone}`
                        : ""}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleSendInvitation(employee)}
                    disabled={
                      sendingEmployeeId !== null ||
                      !hasEmail
                    }
                    title={
                      hasEmail
                        ? "Send or resend the activation invitation"
                        : "This employee needs an email address before an invitation can be sent"
                    }
                    className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#071a35] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0b2448] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8a415] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSending ? (
                      <Loader2
                        size={16}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Mail size={16} aria-hidden="true" />
                    )}

                    {isSending
                      ? "Sending…"
                      : "Send / resend invitation"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}