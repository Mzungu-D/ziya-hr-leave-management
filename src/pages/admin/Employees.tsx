import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  Edit3,
  Eye,
  Filter,
  Loader2,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  createEmployee,
  listEmployees,
  updateEmployee,
  type CreateEmployeeInput,
  type EmployeeAuthenticationMethod,
  type EmployeePublicRecord,
  type EmployeeRole,
  type EmployeeStatus,
  type UpdateEmployeeInput,
} from "../../services/employee.service";

import {
  listDepartments,
  type Department,
} from "../../services/department.service";

/* ============================================================================
   TYPES
============================================================================ */

type EmployeeModal =
  | "create"
  | "edit"
  | "details"
  | null;

type StatusFilter =
  | "ALL"
  | EmployeeStatus;

type RoleFilter =
  | "ALL"
  | EmployeeRole;

interface EmployeeFormState {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentId: string;
  reportsToId: string;
  role: EmployeeRole;
  authenticationMethod: EmployeeAuthenticationMethod;
}

interface ServiceErrorLike {
  message?: string;
  code?: string;
  status?: number;
}

/* ============================================================================
   CONSTANTS
============================================================================ */

const ROLE_LABELS: Record<EmployeeRole, string> = {
  EMPLOYEE: "Employee",
  MANAGER: "Manager",
  HR_ADMIN: "HR Administrator",
  SUPER_ADMIN: "Super Administrator",
};

const STATUS_LABELS: Record<EmployeeStatus, string> = {
  PENDING: "Pending",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  SUSPENDED: "Suspended",
};

const AUTH_LABELS: Record<
  EmployeeAuthenticationMethod,
  string
> = {
  PASSWORD: "Password",
  OTP: "OTP",
  PASSWORD_AND_OTP: "Password + OTP",
};

const DEFAULT_FORM: EmployeeFormState = {
  employeeId: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  departmentId: "",
  reportsToId: "",
  role: "EMPLOYEE",
  authenticationMethod: "PASSWORD_AND_OTP",
};

/* ============================================================================
   HELPERS
============================================================================ */

function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (
    error &&
    typeof error === "object"
  ) {
    const candidate =
      error as ServiceErrorLike;

    if (
      typeof candidate.message === "string" &&
      candidate.message.trim()
    ) {
      return candidate.message;
    }
  }

  return fallback;
}

function getInitials(
  employee: EmployeePublicRecord,
): string {
  const first =
    employee.firstName
      ?.trim()
      .charAt(0) ?? "";

  const last =
    employee.lastName
      ?.trim()
      .charAt(0) ?? "";

  return (
    `${first}${last}`.toUpperCase() ||
    "U"
  );
}

function getFullName(
  employee: EmployeePublicRecord,
): string {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

function formatDate(
  value: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(date);
}

function formatRelativeDate(
  value: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const diff =
    Date.now() -
    date.getTime();

  const minutes = Math.floor(
    diff / 60000,
  );

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(
    minutes / 60,
  );

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(
    hours / 24,
  );

  if (days < 7) {
    return `${days}d ago`;
  }

  return formatDate(value);
}

function normalizeSearch(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase();
}

/* ============================================================================
   STATUS BADGE
============================================================================ */

function StatusBadge({
  status,
}: {
  status: EmployeeStatus;
}) {
  const styles: Record<
    EmployeeStatus,
    string
  > = {
    ACTIVE:
      "bg-emerald-50 text-emerald-700 ring-emerald-200",
    PENDING:
      "bg-amber-50 text-amber-700 ring-amber-200",
    INACTIVE:
      "bg-slate-100 text-slate-600 ring-slate-200",
    SUSPENDED:
      "bg-rose-50 text-rose-700 ring-rose-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles[status]}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-current"
        aria-hidden="true"
      />
      {STATUS_LABELS[status]}
    </span>
  );
}

/* ============================================================================
   ROLE BADGE
============================================================================ */

function RoleBadge({
  role,
}: {
  role: EmployeeRole;
}) {
  const styles: Record<
    EmployeeRole,
    string
  > = {
    EMPLOYEE:
      "bg-slate-100 text-slate-700",
    MANAGER:
      "bg-blue-50 text-blue-700",
    HR_ADMIN:
      "bg-violet-50 text-violet-700",
    SUPER_ADMIN:
      "bg-amber-50 text-amber-700",
  };

  return (
    <span
      className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold ${styles[role]}`}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

/* ============================================================================
   AVATAR
============================================================================ */

function EmployeeAvatar({
  employee,
  size = "md",
}: {
  employee: EmployeePublicRecord;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg"
      ? "h-14 w-14 text-base"
      : size === "sm"
        ? "h-9 w-9 text-[11px]"
        : "h-10 w-10 text-xs";

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-[#071a35] font-bold text-white ${sizeClass}`}
      aria-hidden="true"
    >
      {getInitials(employee)}
    </div>
  );
}

/* ============================================================================
   KPI CARD
============================================================================ */

function KpiCard({
  label,
  value,
  icon: Icon,
  description,
  iconClassName,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  description: string;
  iconClassName: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-400">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {value.toLocaleString()}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {description}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
        >
          <Icon
            size={19}
            strokeWidth={2}
          />
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   LOADING SKELETON
============================================================================ */

function EmployeeTableSkeleton() {
  return (
    <div
      className="animate-pulse space-y-3 p-4 sm:p-5"
      role="status"
      aria-label="Loading employees"
    >
      {Array.from({
        length: 7,
      }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 rounded-xl border border-slate-100 p-4"
        >
          <div className="h-10 w-10 rounded-full bg-slate-200" />

          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-40 rounded bg-slate-200" />
            <div className="h-3 w-28 rounded bg-slate-100" />
          </div>

          <div className="hidden h-6 w-20 rounded bg-slate-100 sm:block" />
          <div className="hidden h-6 w-20 rounded bg-slate-100 md:block" />
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
   EMPTY STATE
============================================================================ */

function EmptyState({
  filtered,
  onClear,
}: {
  filtered: boolean;
  onClear: () => void;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
        <Users
          size={24}
          className="text-slate-400"
        />
      </div>

      <h3 className="mt-4 text-sm font-bold text-slate-900">
        {filtered
          ? "No employees match your filters"
          : "No employees found"}
      </h3>

      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
        {filtered
          ? "Try changing your search or filters."
          : "Employees created in your organization will appear here."}
      </p>

      {filtered && (
        <button
          type="button"
          onClick={onClear}
          className="mt-5 inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

/* ============================================================================
   EMPLOYEE DETAILS
============================================================================ */

function EmployeeDetails({
  employee,
}: {
  employee: EmployeePublicRecord;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
        <EmployeeAvatar
          employee={employee}
          size="lg"
        />

        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold text-slate-900">
            {getFullName(employee)}
          </h3>

          <p className="mt-0.5 text-sm text-slate-500">
            {employee.employeeId}
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge
              status={employee.status}
            />

            <RoleBadge
              role={employee.role}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <DetailItem
          icon={Mail}
          label="Email"
          value={employee.email}
          verified={
            employee.emailVerified
          }
        />

        <DetailItem
          icon={Phone}
          label="Phone"
          value={employee.phone}
          verified={
            employee.phoneVerified
          }
        />

        <DetailItem
          icon={Building2}
          label="Department"
          value={
            employee.department
              ? `${employee.department.name} (${employee.department.code})`
              : "Not assigned"
          }
        />

        <DetailItem
          icon={CircleUserRound}
          label="Reporting Manager"
          value={
            employee.reportsTo
              ? `${employee.reportsTo.firstName} ${employee.reportsTo.lastName}`
              : "Not assigned"
          }
        />

        <DetailItem
          icon={ShieldCheck}
          label="Authentication"
          value={
            AUTH_LABELS[
              employee.authenticationMethod
            ]
          }
        />

        <DetailItem
          icon={UserCheck}
          label="Created"
          value={formatDate(
            employee.createdAt,
          )}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Account activity
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-800">
              Last record update
            </p>
          </div>

          <span className="text-xs text-slate-500">
            {formatRelativeDate(
              employee.updatedAt,
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

function DetailItem({
  icon: Icon,
  label,
  value,
  verified,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  verified?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon size={15} />

        <span className="text-[11px] font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>

      <p className="mt-2 truncate text-sm font-medium text-slate-800">
        {value}
      </p>

      {verified !== undefined && (
        <div
          className={`mt-1 inline-flex items-center gap-1 text-[11px] font-medium ${
            verified
              ? "text-emerald-600"
              : "text-amber-600"
          }`}
        >
          <CheckCircle2 size={12} />

          {verified
            ? "Verified"
            : "Not verified"}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   EMPLOYEE FORM
============================================================================ */

function EmployeeForm({
  mode,
  form,
  setForm,
  departments,
  employees,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  form: EmployeeFormState;
  setForm: React.Dispatch<
    React.SetStateAction<EmployeeFormState>
  >;
  departments: Department[];
  employees: EmployeePublicRecord[];
  submitting: boolean;
  error: string | null;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void;
  onCancel: () => void;
}) {
  const currentEmployee =
    employees.find(
      (employee) =>
        employee.employeeId ===
        form.employeeId,
    );

  const eligibleManagers =
    employees.filter(
      (employee) =>
        employee.id !==
          currentEmployee?.id &&
        (
          employee.role === "MANAGER" ||
          employee.role === "HR_ADMIN" ||
          employee.role === "SUPER_ADMIN"
        ) &&
        employee.status === "ACTIVE",
    );

  const update = <
    K extends keyof EmployeeFormState,
  >(
    field: K,
    value: EmployeeFormState[K],
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5"
    >
      {error && (
        <div className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle
            size={18}
            className="mt-0.5 shrink-0"
          />

          <span>{error}</span>
        </div>
      )}

      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">
          Personal information
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="First name"
            required
            value={form.firstName}
            onChange={(value) =>
              update(
                "firstName",
                value,
              )
            }
            placeholder="First name"
          />

          <FormField
            label="Last name"
            required
            value={form.lastName}
            onChange={(value) =>
              update(
                "lastName",
                value,
              )
            }
            placeholder="Last name"
          />

          <FormField
            label="Employee ID"
            required
            value={form.employeeId}
            onChange={(value) =>
              update(
                "employeeId",
                value,
              )
            }
            placeholder="e.g. EMP-001"
          />

          <FormField
            label="Email address"
            required
            type="email"
            value={form.email}
            onChange={(value) =>
              update(
                "email",
                value,
              )
            }
            placeholder="employee@company.com"
          />

          <FormField
            label="Phone number"
            required
            type="tel"
            value={form.phone}
            onChange={(value) =>
              update(
                "phone",
                value,
              )
            }
            placeholder="+254..."
          />
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">
          Organization
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Department"
            value={form.departmentId}
            onChange={(value) =>
              update(
                "departmentId",
                value,
              )
            }
            options={[
              {
                value: "",
                label: "Not assigned",
              },
              ...departments.map(
                (department) => ({
                  value: department.id,
                  label: `${department.name} (${department.code})`,
                }),
              ),
            ]}
          />

          <SelectField
            label="Reporting manager"
            value={form.reportsToId}
            onChange={(value) =>
              update(
                "reportsToId",
                value,
              )
            }
            options={[
              {
                value: "",
                label: "Not assigned",
              },
              ...eligibleManagers.map(
                (manager) => ({
                  value: manager.id,
                  label: `${getFullName(manager)} — ${ROLE_LABELS[manager.role]}`,
                }),
              ),
            ]}
          />

          <SelectField
            label="Role"
            value={form.role}
            onChange={(value) =>
              update(
                "role",
                value as EmployeeRole,
              )
            }
            options={[
              {
                value: "EMPLOYEE",
                label: "Employee",
              },
              {
                value: "MANAGER",
                label: "Manager",
              },
              {
                value: "HR_ADMIN",
                label: "HR Administrator",
              },
              {
                value: "SUPER_ADMIN",
                label: "Super Administrator",
              },
            ]}
          />

          <SelectField
            label="Authentication"
            value={
              form.authenticationMethod
            }
            onChange={(value) =>
              update(
                "authenticationMethod",
                value as EmployeeAuthenticationMethod,
              )
            }
            options={[
              {
                value:
                  "PASSWORD_AND_OTP",
                label:
                  "Password + OTP",
              },
              {
                value: "PASSWORD",
                label: "Password",
              },
              {
                value: "OTP",
                label: "OTP",
              },
            ]}
          />
        </div>
      </div>

      {mode === "create" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
          New employees are created as{" "}
          <strong>PENDING</strong>.
          Account activation and credentials
          are handled by the employee
          activation workflow.
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#071a35] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0b2448] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && (
            <Loader2
              size={16}
              className="animate-spin"
            />
          )}

          {mode === "create"
            ? "Create employee"
            : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}
        {required && (
          <span className="ml-1 text-rose-500">
            *
          </span>
        )}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        placeholder={placeholder}
        required={required}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#b88900] focus:ring-2 focus:ring-[#b88900]/10"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  options: {
    value: string;
    label: string;
  }[];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}
      </span>

      <div className="relative">
        <select
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
          className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-800 outline-none transition focus:border-[#b88900] focus:ring-2 focus:ring-[#b88900]/10"
        >
          {options.map(
            (option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ),
          )}
        </select>

        <ChevronDown
          size={15}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </div>
    </label>
  );
}

/* ============================================================================
   MODAL
============================================================================ */

function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`flex max-h-[95vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${
          wide
            ? "max-w-3xl"
            : "max-w-xl"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">
              {title}
            </h2>

            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                {subtitle}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   PAGE
============================================================================ */

export function Employees() {
  const [
    employees,
    setEmployees,
  ] = useState<
    EmployeePublicRecord[]
  >([]);

  const [
    departments,
    setDepartments,
  ] = useState<Department[]>([]);

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
  ] = useState<string | null>(
    null,
  );

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<StatusFilter>(
    "ALL",
  );

  const [
    roleFilter,
    setRoleFilter,
  ] = useState<RoleFilter>(
    "ALL",
  );

  const [
    departmentFilter,
    setDepartmentFilter,
  ] = useState("ALL");

  const [
    modal,
    setModal,
  ] = useState<EmployeeModal>(
    null,
  );

  const [
    selectedEmployee,
    setSelectedEmployee,
  ] = useState<EmployeePublicRecord | null>(
    null,
  );

  const [
    form,
    setForm,
  ] = useState<EmployeeFormState>(
    DEFAULT_FORM,
  );

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    formError,
    setFormError,
  ] = useState<string | null>(
    null,
  );

  /* --------------------------------------------------------------------------
     LOAD
  -------------------------------------------------------------------------- */

  const loadEmployees =
    useCallback(
      async (
        showRefreshState = false,
      ) => {
        try {
          if (showRefreshState) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          setError(null);

          const [
            employeeResult,
            departmentResult,
          ] = await Promise.all([
            listEmployees(),
            listDepartments(),
          ]);

          setEmployees(
            employeeResult.employees ??
              [],
          );

          setDepartments(
            departmentResult ?? [],
          );
        } catch (requestError) {
          setError(
            getErrorMessage(
              requestError,
              "Unable to load employees.",
            ),
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [],
    );

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  /* --------------------------------------------------------------------------
     FILTERING
  -------------------------------------------------------------------------- */

  const filteredEmployees =
    useMemo(() => {
      const query =
        normalizeSearch(search);

      return employees.filter(
        (employee) => {
          const matchesSearch =
            !query ||
            [
              employee.firstName,
              employee.lastName,
              employee.employeeId,
              employee.email,
              employee.phone,
              employee.department?.name,
              employee.department?.code,
              employee.reportsTo
                ?.firstName,
              employee.reportsTo
                ?.lastName,
            ]
              .filter(Boolean)
              .some((value) =>
                normalizeSearch(
                  String(value),
                ).includes(query),
              );

          const matchesStatus =
            statusFilter === "ALL" ||
            employee.status ===
              statusFilter;

          const matchesRole =
            roleFilter === "ALL" ||
            employee.role ===
              roleFilter;

          const matchesDepartment =
            departmentFilter === "ALL" ||
            employee.department?.id ===
              departmentFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesRole &&
            matchesDepartment
          );
        },
      );
    }, [
      employees,
      search,
      statusFilter,
      roleFilter,
      departmentFilter,
    ]);

  /* --------------------------------------------------------------------------
     KPI DATA
  -------------------------------------------------------------------------- */

  const statistics =
    useMemo(() => {
      const active =
        employees.filter(
          (employee) =>
            employee.status ===
            "ACTIVE",
        ).length;

      const pending =
        employees.filter(
          (employee) =>
            employee.status ===
            "PENDING",
        ).length;

      const managers =
        employees.filter(
          (employee) =>
            employee.role ===
              "MANAGER" ||
            employee.role ===
              "HR_ADMIN" ||
            employee.role ===
              "SUPER_ADMIN",
        ).length;

      return {
        total: employees.length,
        active,
        pending,
        managers,
      };
    }, [employees]);

  /* --------------------------------------------------------------------------
     MODAL HELPERS
  -------------------------------------------------------------------------- */

  const openCreate =
    () => {
      setSelectedEmployee(null);

      setForm({
        ...DEFAULT_FORM,
      });

      setFormError(null);
      setModal("create");
    };

  const openEdit =
    (
      employee: EmployeePublicRecord,
    ) => {
      setSelectedEmployee(
        employee,
      );

      setForm({
        employeeId:
          employee.employeeId,
        firstName:
          employee.firstName,
        lastName:
          employee.lastName,
        email:
          employee.email,
        phone:
          employee.phone,
        departmentId:
          employee.department?.id ??
          "",
        reportsToId:
          employee.reportsTo?.id ??
          "",
        role: employee.role,
        authenticationMethod:
          employee.authenticationMethod,
      });

      setFormError(null);
      setModal("edit");
    };

  const openDetails =
    (
      employee: EmployeePublicRecord,
    ) => {
      setSelectedEmployee(
        employee,
      );

      setModal("details");
    };

  const closeModal =
    () => {
      if (submitting) {
        return;
      }

      setModal(null);
      setSelectedEmployee(null);
      setFormError(null);
    };

  /* --------------------------------------------------------------------------
     CREATE / UPDATE
  -------------------------------------------------------------------------- */

  const handleSubmit =
    async (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      setFormError(null);

      const employeeId =
        form.employeeId.trim();

      const firstName =
        form.firstName.trim();

      const lastName =
        form.lastName.trim();

      const email =
        form.email.trim();

      const phone =
        form.phone.trim();

      if (
        !employeeId ||
        !firstName ||
        !lastName ||
        !email ||
        !phone
      ) {
        setFormError(
          "Employee ID, first name, last name, email address and phone number are required.",
        );
        return;
      }

      setSubmitting(true);

      try {
        if (modal === "create") {
          const payload: CreateEmployeeInput =
            {
              employeeId,
              firstName,
              lastName,
              email,
              phone,
              departmentId:
                form.departmentId.trim() ||
                undefined,
              reportsToId:
                form.reportsToId.trim() ||
                undefined,
              role: form.role,
              authenticationMethod:
                form.authenticationMethod,
            };

          const created =
            await createEmployee(
              payload,
            );

          setEmployees(
            (current) => [
              created,
              ...current.filter(
                (employee) =>
                  employee.id !==
                  created.id,
              ),
            ],
          );

          setSelectedEmployee(
            created,
          );

          setForm({
            ...DEFAULT_FORM,
          });

          setModal("details");

          return;
        }

        if (
          modal === "edit" &&
          selectedEmployee
        ) {
          const payload: UpdateEmployeeInput =
            {
              employeeId,
              firstName,
              lastName,
              email,
              phone,
              departmentId:
                form.departmentId.trim() ||
                null,
              reportsToId:
                form.reportsToId.trim() ||
                null,
              role: form.role,
              authenticationMethod:
                form.authenticationMethod,
            };

          const updated =
            await updateEmployee(
              selectedEmployee.id,
              payload,
            );

          setEmployees(
            (current) =>
              current.map(
                (employee) =>
                  employee.id ===
                  updated.id
                    ? updated
                    : employee,
              ),
          );

          setSelectedEmployee(
            updated,
          );

          setModal("details");

          return;
        }

        setFormError(
          "Unable to determine the employee operation. Please close the form and try again.",
        );
      } catch (requestError) {
        setFormError(
          getErrorMessage(
            requestError,
            modal === "create"
              ? "Unable to create the employee."
              : "Unable to update the employee.",
          ),
        );
      } finally {
        setSubmitting(false);
      }
    };

  /* --------------------------------------------------------------------------
     CLEAR FILTERS
  -------------------------------------------------------------------------- */

  const clearFilters =
    () => {
      setSearch("");
      setStatusFilter("ALL");
      setRoleFilter("ALL");
      setDepartmentFilter("ALL");
    };

  /* --------------------------------------------------------------------------
     RENDER
  -------------------------------------------------------------------------- */

  return (
    <div className="min-w-0 w-full space-y-5">
      {/* HEADER */}

      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#b88900]">
            <Users size={15} />
            Workforce
          </div>

          <h1 className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Employees
          </h1>

          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Manage employee records,
            organizational roles,
            reporting structures and
            account status.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() =>
              void loadEmployees(true)
            }
            disabled={
              loading || refreshing
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#071a35] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b2448] focus:outline-none focus:ring-2 focus:ring-[#b88900]/30"
          >
            <Plus size={17} />
            Add employee
          </button>
        </div>
      </div>

      {/* ERROR */}

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle
            size={18}
            className="mt-0.5 shrink-0"
          />

          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              Unable to load employees
            </p>

            <p className="mt-0.5">
              {error}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadEmployees()
            }
            className="shrink-0 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI CARDS */}

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total employees"
          value={statistics.total}
          description="People in your organization"
          icon={Users}
          iconClassName="bg-blue-50 text-blue-600"
        />

        <KpiCard
          label="Active"
          value={statistics.active}
          description="Currently active accounts"
          icon={UserCheck}
          iconClassName="bg-emerald-50 text-emerald-600"
        />

        <KpiCard
          label="Pending"
          value={statistics.pending}
          description="Awaiting activation"
          icon={UserPlus}
          iconClassName="bg-amber-50 text-amber-600"
        />

        <KpiCard
          label="Managers & admins"
          value={statistics.managers}
          description="Leadership and HR roles"
          icon={ShieldCheck}
          iconClassName="bg-violet-50 text-violet-600"
        />
      </div>

      {/* DIRECTORY */}

      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                  Employee directory
                </h2>

                <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                  {filteredEmployees.length.toLocaleString()}{" "}
                  of{" "}
                  {employees.length.toLocaleString()}{" "}
                  employees shown
                </p>
              </div>

              <div className="relative w-full lg:max-w-sm">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Search employees..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#b88900] focus:bg-white focus:ring-2 focus:ring-[#b88900]/10"
                  aria-label="Search employees"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch("")
                    }
                    className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <Filter size={14} />
                Filters
              </div>

              <FilterSelect
                value={statusFilter}
                onChange={(value) =>
                  setStatusFilter(
                    value as StatusFilter,
                  )
                }
                options={[
                  {
                    value: "ALL",
                    label:
                      "All statuses",
                  },
                  {
                    value: "ACTIVE",
                    label: "Active",
                  },
                  {
                    value: "PENDING",
                    label: "Pending",
                  },
                  {
                    value: "INACTIVE",
                    label: "Inactive",
                  },
                  {
                    value: "SUSPENDED",
                    label: "Suspended",
                  },
                ]}
              />

              <FilterSelect
                value={roleFilter}
                onChange={(value) =>
                  setRoleFilter(
                    value as RoleFilter,
                  )
                }
                options={[
                  {
                    value: "ALL",
                    label: "All roles",
                  },
                  {
                    value: "EMPLOYEE",
                    label:
                      "Employees",
                  },
                  {
                    value: "MANAGER",
                    label:
                      "Managers",
                  },
                  {
                    value: "HR_ADMIN",
                    label:
                      "HR administrators",
                  },
                  {
                    value: "SUPER_ADMIN",
                    label:
                      "Super administrators",
                  },
                ]}
              />

              <FilterSelect
                value={
                  departmentFilter
                }
                onChange={(value) =>
                  setDepartmentFilter(
                    value,
                  )
                }
                options={[
                  {
                    value: "ALL",
                    label:
                      "All departments",
                  },
                  ...departments.map(
                    (department) => ({
                      value:
                        department.id,
                      label:
                        department.name,
                    }),
                  ),
                ]}
              />

              {(search ||
                statusFilter !==
                  "ALL" ||
                roleFilter !==
                  "ALL" ||
                departmentFilter !==
                  "ALL") && (
                <button
                  type="button"
                  onClick={
                    clearFilters
                  }
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                >
                  <X size={13} />
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <EmployeeTableSkeleton />
        ) : filteredEmployees.length ===
          0 ? (
          <EmptyState
            filtered={
              employees.length > 0
            }
            onClear={
              clearFilters
            }
          />
        ) : (
          <>
            {/* DESKTOP / TABLET */}

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-left">
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Employee
                    </th>

                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Department
                    </th>

                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Role
                    </th>

                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Status
                    </th>

                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Manager
                    </th>

                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map(
                    (employee) => (
                      <tr
                        key={employee.id}
                        className="group transition hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex min-w-0 items-center gap-3">
                            <EmployeeAvatar
                              employee={
                                employee
                              }
                              size="sm"
                            />

                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-800">
                                {getFullName(
                                  employee,
                                )}
                              </p>

                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
                                <span>
                                  {
                                    employee.employeeId
                                  }
                                </span>

                                <span className="hidden lg:inline">
                                  •
                                </span>

                                <span className="hidden truncate lg:inline">
                                  {
                                    employee.email
                                  }
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-700">
                              {employee
                                .department
                                ?.name ??
                                "Unassigned"}
                            </p>

                            {employee
                              .department
                              ?.code && (
                              <p className="mt-0.5 text-[11px] text-slate-400">
                                {
                                  employee
                                    .department
                                    .code
                                }
                              </p>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <RoleBadge
                            role={
                              employee.role
                            }
                          />
                        </td>

                        <td className="px-4 py-3.5">
                          <StatusBadge
                            status={
                              employee.status
                            }
                          />
                        </td>

                        <td className="px-4 py-3.5">
                          {employee.reportsTo ? (
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-700">
                                {
                                  employee
                                    .reportsTo
                                    .firstName
                                }{" "}
                                {
                                  employee
                                    .reportsTo
                                    .lastName
                                }
                              </p>

                              <p className="mt-0.5 text-[11px] text-slate-400">
                                {
                                  ROLE_LABELS[
                                    employee
                                      .reportsTo
                                      .role
                                  ]
                                }
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Not assigned
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex justify-end gap-1">
                            <IconButton
                              label="View employee"
                              icon={Eye}
                              onClick={() =>
                                openDetails(
                                  employee,
                                )
                              }
                            />

                            <IconButton
                              label="Edit employee"
                              icon={Edit3}
                              onClick={() =>
                                openEdit(
                                  employee,
                                )
                              }
                            />

                            <IconButton
                              label="More actions"
                              icon={
                                MoreHorizontal
                              }
                              onClick={() =>
                                openDetails(
                                  employee,
                                )
                              }
                            />
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            {/* MOBILE */}

            <div className="divide-y divide-slate-100 md:hidden">
              {filteredEmployees.map(
                (employee) => (
                  <div
                    key={employee.id}
                    className="p-4"
                  >
                    <div className="flex items-start gap-3">
                      <EmployeeAvatar
                        employee={
                          employee
                        }
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">
                              {getFullName(
                                employee,
                              )}
                            </p>

                            <p className="mt-0.5 text-xs text-slate-400">
                              {
                                employee.employeeId
                              }
                            </p>
                          </div>

                          <StatusBadge
                            status={
                              employee.status
                            }
                          />
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-lg bg-slate-50 p-2">
                            <p className="text-slate-400">
                              Department
                            </p>

                            <p className="mt-0.5 truncate font-semibold text-slate-700">
                              {employee
                                .department
                                ?.name ??
                                "Unassigned"}
                            </p>
                          </div>

                          <div className="rounded-lg bg-slate-50 p-2">
                            <p className="text-slate-400">
                              Role
                            </p>

                            <p className="mt-0.5 truncate font-semibold text-slate-700">
                              {
                                ROLE_LABELS[
                                  employee
                                    .role
                                ]
                              }
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <p className="truncate text-xs text-slate-400">
                            {
                              employee.email
                            }
                          </p>

                          <div className="flex shrink-0 gap-1">
                            <IconButton
                              label="View"
                              icon={Eye}
                              onClick={() =>
                                openDetails(
                                  employee,
                                )
                              }
                            />

                            <IconButton
                              label="Edit"
                              icon={Edit3}
                              onClick={() =>
                                openEdit(
                                  employee,
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          </>
        )}
      </section>

      {/* DETAILS MODAL */}

      {modal === "details" &&
        selectedEmployee && (
          <Modal
            title="Employee profile"
            subtitle="Employee information and account details"
            onClose={closeModal}
          >
            <EmployeeDetails
              employee={
                selectedEmployee
              }
            />

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() =>
                  openEdit(
                    selectedEmployee,
                  )
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#071a35] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0b2448]"
              >
                <Edit3 size={16} />
                Edit employee
              </button>
            </div>
          </Modal>
        )}

      {/* CREATE / EDIT MODAL */}

      {(modal === "create" ||
        modal === "edit") && (
        <Modal
          title={
            modal === "create"
              ? "Add employee"
              : "Edit employee"
          }
          subtitle={
            modal === "create"
              ? "Create a new employee record in your organization"
              : "Update this employee's organizational information"
          }
          onClose={closeModal}
          wide
        >
          <EmployeeForm
            mode={modal}
            form={form}
            setForm={setForm}
            departments={
              departments
            }
            employees={employees}
            submitting={
              submitting
            }
            error={formError}
            onSubmit={
              handleSubmit
            }
            onCancel={
              closeModal
            }
          />
        </Modal>
      )}
    </div>
  );
}

/* ============================================================================
   FILTER SELECT
============================================================================ */

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (
    value: string,
  ) => void;
  options: {
    value: string;
    label: string;
  }[];
}) {
  return (
    <div className="relative min-w-0 sm:w-auto">
      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-xs font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-[#b88900] focus:ring-2 focus:ring-[#b88900]/10 sm:min-w-[145px]"
      >
        {options.map(
          (option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ),
        )}
      </select>

      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
      />
    </div>
  );
}

/* ============================================================================
   ICON BUTTON
============================================================================ */

function IconButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof Eye;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#b88900]/20"
    >
      <Icon size={15} />
    </button>
  );
}