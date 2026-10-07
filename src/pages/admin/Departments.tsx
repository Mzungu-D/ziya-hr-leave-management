import {
  AlertCircle,
  Building2,
  Check,
  ChevronDown,
  Crown,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from "react";

import {
  createDepartment,
  deleteDepartment,
  listDepartments,
  updateDepartment,
  type Department,
  type DepartmentLead,
  type DepartmentServiceError,
} from "../../services/department.service";

/* -------------------------------------------------------------------------- */
/* Employee contract                                                          */
/* -------------------------------------------------------------------------- */

/**
 * This is intentionally defined locally from the verified employee API
 * contract rather than importing a helper that does not exist in the
 * current frontend service.
 */
interface DepartmentEmployee {
  id: string;
  organizationId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role:
    | "EMPLOYEE"
    | "MANAGER"
    | "HR_ADMIN"
    | "SUPER_ADMIN";
  status:
    | "PENDING"
    | "ACTIVE"
    | "INACTIVE"
    | "SUSPENDED";
  authenticationMethod:
    | "PASSWORD"
    | "OTP"
    | "PASSWORD_AND_OTP";
  emailVerified: boolean;
  phoneVerified: boolean;
  department: {
    id: string;
    name: string;
    code: string;
  } | null;
  reportsTo: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    email: string;
    role:
      | "EMPLOYEE"
      | "MANAGER"
      | "HR_ADMIN"
      | "SUPER_ADMIN";
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface EmployeeListResponse {
  employees: DepartmentEmployee[];
  total: number;
}

/* -------------------------------------------------------------------------- */
/* Department lead contract                                                   */
/* -------------------------------------------------------------------------- */

type DepartmentWithLead = Department;

/* -------------------------------------------------------------------------- */
/* Employee API                                                               */
/* -------------------------------------------------------------------------- */

const DEFAULT_API_BASE_URL =
  "https://ziya-hr-api-production.up.railway.app";

const configuredApiBaseUrl =
  import.meta.env.VITE_API_BASE_URL;

const API_BASE_URL = (
  configuredApiBaseUrl ||
  DEFAULT_API_BASE_URL
)
  .trim()
  .replace(/\/+$/, "");

const EMPLOYEE_ENDPOINT =
  "/api/employees";

const REQUEST_TIMEOUT_MS = 30_000;

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function employeeApiError(
  message: string,
  code?: string,
): DepartmentServiceError {
  return {
    message,
    code,
  };
}

function validateEmployeeApiUrl(): void {
  if (!API_BASE_URL) {
    throw employeeApiError(
      "The Leave Management API is not configured.",
      "API_BASE_URL_NOT_CONFIGURED",
    );
  }

  try {
    const url = new URL(
      API_BASE_URL,
    );

    if (
      url.protocol !== "https:" &&
      import.meta.env.DEV !== true
    ) {
      throw new Error(
        "Production API URL must use HTTPS.",
      );
    }
  } catch {
    throw employeeApiError(
      "The Leave Management API configuration is invalid.",
      "INVALID_API_BASE_URL",
    );
  }
}

function isEmployee(
  value: unknown,
): value is DepartmentEmployee {
  if (!isRecord(value)) {
    return false;
  }

  const department =
    value.department;

  const validDepartment =
    department === null ||
    (
      isRecord(department) &&
      typeof department.id ===
        "string" &&
      typeof department.name ===
        "string" &&
      typeof department.code ===
        "string"
    );

  return (
    typeof value.id === "string" &&
    typeof value.organizationId ===
      "string" &&
    typeof value.employeeId ===
      "string" &&
    typeof value.firstName ===
      "string" &&
    typeof value.lastName ===
      "string" &&
    typeof value.email ===
      "string" &&
    typeof value.phone ===
      "string" &&
    (
      value.role === "EMPLOYEE" ||
      value.role === "MANAGER" ||
      value.role === "HR_ADMIN" ||
      value.role === "SUPER_ADMIN"
    ) &&
    (
      value.status === "PENDING" ||
      value.status === "ACTIVE" ||
      value.status === "INACTIVE" ||
      value.status === "SUSPENDED"
    ) &&
    (
      value.authenticationMethod ===
        "PASSWORD" ||
      value.authenticationMethod ===
        "OTP" ||
      value.authenticationMethod ===
        "PASSWORD_AND_OTP"
    ) &&
    typeof value.emailVerified ===
      "boolean" &&
    typeof value.phoneVerified ===
      "boolean" &&
    validDepartment &&
    (
      value.reportsTo === null ||
      (
        isRecord(value.reportsTo) &&
        typeof value.reportsTo.id ===
          "string" &&
        typeof value.reportsTo.employeeId ===
          "string" &&
        typeof value.reportsTo.firstName ===
          "string" &&
        typeof value.reportsTo.lastName ===
          "string" &&
        typeof value.reportsTo.email ===
          "string"
      )
    ) &&
    typeof value.createdAt ===
      "string" &&
    typeof value.updatedAt ===
      "string"
  );
}

function parseEmployeeResponse(
  value: unknown,
): EmployeeListResponse {
  if (!isRecord(value)) {
    throw employeeApiError(
      "The Employee service returned an invalid response.",
      "INVALID_EMPLOYEE_RESPONSE",
    );
  }

  const data =
    value.data;

  if (!isRecord(data)) {
    throw employeeApiError(
      "The Employee service returned an invalid data response.",
      "INVALID_EMPLOYEE_DATA",
    );
  }

  const rawEmployees =
    data.employees;

  if (!Array.isArray(rawEmployees)) {
    throw employeeApiError(
      "The Employee service returned an invalid employee list.",
      "INVALID_EMPLOYEE_LIST",
    );
  }

  const employees =
    rawEmployees.filter(
      isEmployee,
    );

  if (
    employees.length !==
    rawEmployees.length
  ) {
    throw employeeApiError(
      "The Employee service returned an invalid employee record.",
      "INVALID_EMPLOYEE_RECORD",
    );
  }

  const total =
    typeof data.total ===
    "number"
      ? data.total
      : employees.length;

  return {
    employees,
    total,
  };
}

async function listDepartmentEmployees(): Promise<EmployeeListResponse> {
  validateEmployeeApiUrl();

  const controller =
    new AbortController();

  const timeout =
    window.setTimeout(
      () => {
        controller.abort();
      },
      REQUEST_TIMEOUT_MS,
    );

  try {
    const response =
      await fetch(
        `${API_BASE_URL}${EMPLOYEE_ENDPOINT}`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            Accept:
              "application/json",
          },
          cache: "no-store",
          signal:
            controller.signal,
        },
      );

    let payload:
      | unknown
      | undefined;

    try {
      payload =
        await response.json();
    } catch {
      payload =
        undefined;
    }

    if (!response.ok) {
      let message =
        "Unable to load employees.";

      if (
        isRecord(payload)
      ) {
        if (
          typeof payload.message ===
          "string"
        ) {
          message =
            payload.message;
        } else if (
          isRecord(
            payload.error,
          ) &&
          typeof payload.error
            .message ===
            "string"
        ) {
          message =
            payload.error.message;
        }
      }

      throw employeeApiError(
        message,
        "EMPLOYEE_REQUEST_FAILED",
      );
    }

    return parseEmployeeResponse(
      payload,
    );
  } catch (error) {
    if (
      error instanceof
      DOMException &&
      error.name ===
        "AbortError"
    ) {
      throw employeeApiError(
        "The Employee request timed out. Please try again.",
        "REQUEST_TIMEOUT",
      );
    }

    if (
      isRecord(error) &&
      typeof error.message ===
        "string"
    ) {
      throw error;
    }

    throw employeeApiError(
      "Unable to connect to the Employee service. Please check your connection and try again.",
      "NETWORK_ERROR",
    );
  } finally {
    window.clearTimeout(
      timeout,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type ModalMode =
  | "create"
  | "edit";

interface DepartmentFormState {
  name: string;
  code: string;
  departmentLeadId: string;
}

interface NoticeState {
  type:
    | "success"
    | "error"
    | "warning";
  message: string;
}

interface ModalState {
  open: boolean;
  mode: ModalMode;
  department:
    | DepartmentWithLead
    | null;
}

interface DeleteState {
  open: boolean;
  department:
    | DepartmentWithLead
    | null;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const EMPTY_FORM: DepartmentFormState =
  {
    name: "",
    code: "",
    departmentLeadId: "",
  };

const EMPTY_MODAL: ModalState = {
  open: false,
  mode: "create",
  department: null,
};

const EMPTY_DELETE: DeleteState =
  {
    open: false,
    department: null,
  };

const DEPARTMENT_CODE_PATTERN =
  /^[A-Z0-9](?:[A-Z0-9_-]*[A-Z0-9])?$/;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function normalizeText(
  value: string,
): string {
  return value
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCode(
  value: string,
): string {
  return value
    .normalize("NFC")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

function errorMessage(
  error: unknown,
  fallback: string,
): string {
  if (
    isRecord(error) &&
    typeof error.message ===
      "string" &&
    error.message.trim()
  ) {
    return error.message.trim();
  }

  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message.trim();
  }

  return fallback;
}

function employeeName(
  employee: DepartmentEmployee,
): string {
  return `${employee.firstName} ${employee.lastName}`
    .replace(/\s+/g, " ")
    .trim();
}

function initials(
  firstName: string,
  lastName: string,
): string {
  return `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`
    .toUpperCase();
}

function roleLabel(
  role:
    | DepartmentEmployee["role"]
    | DepartmentLead["role"],
): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "Super Admin";

    case "HR_ADMIN":
      return "HR Admin";

    case "MANAGER":
      return "Manager";

    default:
      return "Employee";
  }
}

function roleClasses(
  role:
    | DepartmentEmployee["role"]
    | DepartmentLead["role"],
): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "bg-amber-50 text-amber-700 ring-amber-200";

    case "HR_ADMIN":
      return "bg-blue-50 text-blue-700 ring-blue-200";

    case "MANAGER":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";

    default:
      return "bg-slate-50 text-slate-600 ring-slate-200";
  }
}

/**
 * Department Lead eligibility is intentionally only a UI filter.
 *
 * Backend remains authoritative.
 */
function eligibleLeadsForDepartment(
  employees: DepartmentEmployee[],
  departmentId: string,
): DepartmentEmployee[] {
  return employees
    .filter(
      (employee) =>
        employee.status ===
          "ACTIVE" &&
        (
          employee.role ===
            "MANAGER" ||
          employee.role ===
            "HR_ADMIN" ||
          employee.role ===
            "SUPER_ADMIN"
        ) &&
        employee.department?.id ===
          departmentId,
    )
    .sort(
      (a, b) =>
        employeeName(a).localeCompare(
          employeeName(b),
        ),
    );
}

/* -------------------------------------------------------------------------- */
/* Status badge                                                               */
/* -------------------------------------------------------------------------- */

function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?:
    | "neutral"
    | "success"
    | "warning"
    | "danger";
}) {
  const classes = {
    neutral:
      "bg-slate-50 text-slate-600 ring-slate-200",
    success:
      "bg-emerald-50 text-emerald-700 ring-emerald-200",
    warning:
      "bg-amber-50 text-amber-700 ring-amber-200",
    danger:
      "bg-rose-50 text-rose-700 ring-rose-200",
  };

  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1",
        "text-[11px] font-semibold ring-1 ring-inset",
        classes[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Department lead display                                                    */
/* -------------------------------------------------------------------------- */

function DepartmentLeadDisplay({
  department,
}: {
  department: DepartmentWithLead;
}) {
  const lead =
    department.departmentLead;

  if (!lead) {
    return (
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <UserRound
            size={16}
          />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">
            No lead assigned
          </p>

          <p className="mt-0.5 text-xs text-slate-400">
            Assign a department lead
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#071a35] text-[10px] font-bold text-white">
        {initials(
          lead.firstName,
          lead.lastName,
        )}
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">
          {lead.firstName}{" "}
          {lead.lastName}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span
            className={[
              "inline-flex rounded-full px-2 py-0.5",
              "text-[10px] font-semibold ring-1 ring-inset",
              roleClasses(
                lead.role,
              ),
            ].join(" ")}
          >
            {roleLabel(
              lead.role,
            )}
          </span>

          {lead.status ===
            "ACTIVE" && (
            <span className="text-[10px] font-semibold text-emerald-600">
              Active
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Loading skeleton                                                           */
/* -------------------------------------------------------------------------- */

function LoadingSkeleton() {
  return (
    <div
      className="space-y-5"
      aria-busy="true"
      aria-label="Loading departments"
    >
      <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({
          length: 4,
        }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-2xl bg-slate-200"
          />
        ))}
      </div>

      <div className="h-96 animate-pulse rounded-2xl bg-slate-200" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                */
/* -------------------------------------------------------------------------- */

function EmptyState({
  searching,
  onCreate,
}: {
  searching: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="px-5 py-14 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <Building2
          size={25}
          strokeWidth={1.8}
        />
      </div>

      <h3 className="mt-5 text-base font-bold text-slate-900">
        {searching
          ? "No departments found"
          : "No departments yet"}
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {searching
          ? "Try a different department name or code."
          : "Create your first department to start organizing your workforce."}
      </p>

      {!searching && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-6 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#d8a415] px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-[#c9960f] focus:outline-none focus:ring-2 focus:ring-[#d8a415] focus:ring-offset-2"
        >
          <Plus
            size={17}
          />
          Create department
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Department modal                                                           */
/* -------------------------------------------------------------------------- */

function DepartmentModal({
  state,
  form,
  setForm,
  employees,
  employeesLoaded,
  submitting,
  onClose,
  onSubmit,
}: {
  state: ModalState;
  form: DepartmentFormState;
  setForm: Dispatch<
    SetStateAction<DepartmentFormState>
  >;
  employees: DepartmentEmployee[];
  employeesLoaded: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => Promise<void>;
}) {
  const [
    validationError,
    setValidationError,
  ] = useState("");

  if (!state.open) {
    return null;
  }

  const isCreate =
    state.mode === "create";

  const eligibleLeads =
    !isCreate &&
    state.department
      ? eligibleLeadsForDepartment(
          employees,
          state.department.id,
        )
      : [];

  const submit =
    async (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      setValidationError("");

      const name =
        normalizeText(
          form.name,
        );

      const code =
        normalizeCode(
          form.code,
        );

      if (!name) {
        setValidationError(
          "Department name is required.",
        );
        return;
      }

      if (!code) {
        setValidationError(
          "Department code is required.",
        );
        return;
      }

      if (
        !DEPARTMENT_CODE_PATTERN.test(
          code,
        )
      ) {
        setValidationError(
          "Department code may contain only letters, numbers, underscores and hyphens, and must start and end with a letter or number.",
        );
        return;
      }

      setForm(
        (current) => ({
          ...current,
          name,
          code,
        }),
      );

      await onSubmit(
        event,
      );
    };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="department-modal-title"
    >
      <div className="flex max-h-[94vh] min-w-0 w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-3xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-[#b7890c]">
              {isCreate ? (
                <Plus
                  size={18}
                />
              ) : (
                <Pencil
                  size={17}
                />
              )}
            </div>

            <div className="min-w-0">
              <h2
                id="department-modal-title"
                className="text-base font-bold text-slate-900"
              >
                {isCreate
                  ? "Create department"
                  : "Edit department"}
              </h2>

              <p className="mt-0.5 text-xs leading-5 text-slate-500">
                {isCreate
                  ? "Add a department to your organization."
                  : "Update department details and reporting ownership."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X
              size={19}
            />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={submit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            {validationError && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700"
              >
                <AlertCircle
                  size={17}
                  className="mt-0.5 shrink-0"
                />

                <span>
                  {
                    validationError
                  }
                </span>
              </div>
            )}

            <div className="space-y-5">
              {/* Name */}
              <div>
                <label
                  htmlFor="department-name"
                  className="mb-1.5 block text-sm font-semibold text-slate-800"
                >
                  Department name
                  <span className="ml-1 text-rose-500">
                    *
                  </span>
                </label>

                <input
                  id="department-name"
                  type="text"
                  value={
                    form.name
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        name:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  maxLength={
                    100
                  }
                  autoComplete="organization"
                  placeholder="e.g. Finance"
                  disabled={
                    submitting
                  }
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#d8a415] focus:ring-2 focus:ring-[#d8a415]/20 disabled:cursor-not-allowed disabled:bg-slate-50"
                />

                <p className="mt-1.5 text-xs text-slate-400">
                  Use the official department name.
                </p>
              </div>

              {/* Code */}
              <div>
                <label
                  htmlFor="department-code"
                  className="mb-1.5 block text-sm font-semibold text-slate-800"
                >
                  Department code
                  <span className="ml-1 text-rose-500">
                    *
                  </span>
                </label>

                <input
                  id="department-code"
                  type="text"
                  value={
                    form.code
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        code:
                          normalizeCode(
                            event
                              .target
                              .value,
                          ),
                      }),
                    )
                  }
                  maxLength={
                    50
                  }
                  autoComplete="off"
                  placeholder="e.g. FIN"
                  disabled={
                    submitting
                  }
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium uppercase tracking-wide text-slate-900 outline-none transition placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus:border-[#d8a415] focus:ring-2 focus:ring-[#d8a415]/20 disabled:cursor-not-allowed disabled:bg-slate-50"
                />

                <p className="mt-1.5 text-xs text-slate-400">
                  Letters, numbers, underscores and hyphens are supported.
                </p>
              </div>

              {/* Lead */}
              {!isCreate && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-3 flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-[#b7890c]">
                      <Crown
                        size={17}
                      />
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Department Lead
                      </h3>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Only active managers and administrators already assigned to this department are eligible.
                      </p>
                    </div>
                  </div>

                  {!employeesLoaded ? (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-800">
                      <AlertCircle
                        size={16}
                        className="mt-0.5 shrink-0"
                      />

                      <span>
                        Employee information could not be loaded. Lead selection is temporarily unavailable.
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <select
                          id="department-lead"
                          value={
                            form.departmentLeadId
                          }
                          onChange={(
                            event,
                          ) =>
                            setForm(
                              (
                                current,
                              ) => ({
                                ...current,
                                departmentLeadId:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                          disabled={
                            submitting ||
                            eligibleLeads.length ===
                              0
                          }
                          className="h-11 w-full appearance-none rounded-xl border border-slate-300 bg-white px-3.5 pr-10 text-sm text-slate-900 outline-none transition focus:border-[#d8a415] focus:ring-2 focus:ring-[#d8a415]/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          <option value="">
                            No department lead
                          </option>

                          {eligibleLeads.map(
                            (
                              employee,
                            ) => (
                              <option
                                key={
                                  employee.id
                                }
                                value={
                                  employee.id
                                }
                              >
                                {
                                  employeeName(
                                    employee,
                                  )
                                }{" "}
                                —{" "}
                                {roleLabel(
                                  employee.role,
                                )}
                              </option>
                            ),
                          )}
                        </select>

                        <ChevronDown
                          size={17}
                          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                      </div>

                      {eligibleLeads.length ===
                        0 && (
                        <p className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs leading-5 text-slate-500">
                          No eligible Department Lead candidates currently belong to this department.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {isCreate && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck
                      size={18}
                      className="mt-0.5 shrink-0 text-blue-600"
                    />

                    <div>
                      <p className="text-sm font-semibold text-blue-900">
                        Department Lead is assigned after creation
                      </p>

                      <p className="mt-1 text-xs leading-5 text-blue-700">
                        The department must exist before an employee can belong to it and become its Department Lead.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={onClose}
              disabled={
                submitting
              }
              className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                submitting
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#d8a415] px-5 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-[#c9960f] focus:outline-none focus:ring-2 focus:ring-[#d8a415] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                  {isCreate
                    ? "Creating..."
                    : "Saving..."}
                </>
              ) : (
                <>
                  <Check
                    size={17}
                  />
                  {isCreate
                    ? "Create department"
                    : "Save changes"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Delete modal                                                               */
/* -------------------------------------------------------------------------- */

function DeleteDepartmentModal({
  state,
  deleting,
  onClose,
  onConfirm,
}: {
  state: DeleteState;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  if (
    !state.open ||
    !state.department
  ) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-department-title"
    >
      <div className="w-full min-w-0 max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <Trash2
              size={20}
            />
          </div>

          <div className="min-w-0">
            <h2
              id="delete-department-title"
              className="text-base font-bold text-slate-900"
            >
              Delete department?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              You are about to delete{" "}
              <span className="font-semibold text-slate-900">
                {
                  state
                    .department
                    .name
                }
              </span>
              . The backend will reject the deletion if the department is still referenced by employees or leave history.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={
              deleting
            }
            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() =>
              void onConfirm()
            }
            disabled={
              deleting
            }
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-bold text-white transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? (
              <>
                <Loader2
                  size={17}
                  className="animate-spin"
                />
                Deleting...
              </>
            ) : (
              <>
                <Trash2
                  size={17}
                />
                Delete department
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main page                                                                  */
/* -------------------------------------------------------------------------- */

export function Departments() {
  const [
    departments,
    setDepartments,
  ] = useState<
    DepartmentWithLead[]
  >([]);

  const [
    employees,
    setEmployees,
  ] = useState<
    DepartmentEmployee[]
  >([]);

  const [
    employeesLoaded,
    setEmployeesLoaded,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    notice,
    setNotice,
  ] = useState<
    NoticeState | null
  >(null);

  const [
    pageError,
    setPageError,
  ] = useState("");

  const [
    employeeWarning,
    setEmployeeWarning,
  ] = useState("");

  const [
    modal,
    setModal,
  ] = useState<ModalState>(
    EMPTY_MODAL,
  );

  const [
    deleteState,
    setDeleteState,
  ] = useState<DeleteState>(
    EMPTY_DELETE,
  );

  const [
    form,
    setForm,
  ] = useState<DepartmentFormState>(
    EMPTY_FORM,
  );

  /* ------------------------------------------------------------------------ */
  /* Load departments + employees                                             */
  /* ------------------------------------------------------------------------ */

  const loadData =
    useCallback(
      async (
        initial = false,
      ) => {
        if (initial) {
          setLoading(
            true,
          );
        } else {
          setRefreshing(
            true,
          );
        }

        setPageError("");
        setEmployeeWarning("");

        const [
          departmentResult,
          employeeResult,
        ] =
          await Promise.allSettled([
            listDepartments(),
            listDepartmentEmployees(),
          ]);

        if (
          departmentResult.status ===
          "fulfilled"
        ) {
          setDepartments(
            departmentResult.value as DepartmentWithLead[],
          );
        } else {
          setPageError(
            errorMessage(
              departmentResult.reason,
              "We could not load departments. Please try again.",
            ),
          );
        }

        if (
          employeeResult.status ===
          "fulfilled"
        ) {
          setEmployees(
            employeeResult.value
              .employees,
          );

          setEmployeesLoaded(
            true,
          );
        } else {
          setEmployees(
            [],
          );

          setEmployeesLoaded(
            false,
          );

          setEmployeeWarning(
            errorMessage(
              employeeResult.reason,
              "Employee information could not be loaded. Department Lead selection is temporarily unavailable.",
            ),
          );
        }

        setLoading(false);
        setRefreshing(false);
      },
      [],
    );

  useEffect(() => {
    void loadData(
      true,
    );
  }, [loadData]);

  /* ------------------------------------------------------------------------ */
  /* Notice timeout                                                           */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer =
      window.setTimeout(
        () =>
          setNotice(null),
        5000,
      );

    return () =>
      window.clearTimeout(
        timer,
      );
  }, [notice]);

  /* ------------------------------------------------------------------------ */
  /* Derived data                                                             */
  /* ------------------------------------------------------------------------ */

  const employeeCounts =
    useMemo(() => {
      const result =
        new Map<
          string,
          number
        >();

      for (const employee of employees) {
        const departmentId =
          employee.department?.id;

        if (!departmentId) {
          continue;
        }

        result.set(
          departmentId,
          (result.get(
            departmentId,
          ) ?? 0) + 1,
        );
      }

      return result;
    }, [employees]);

  const filteredDepartments =
    useMemo(() => {
      const term =
        normalizeText(
          search,
        ).toLowerCase();

      if (!term) {
        return departments;
      }

      return departments.filter(
        (department) => {
          const lead =
            department.departmentLead;

          const searchable = [
            department.name,
            department.code,
            lead
              ? `${lead.firstName} ${lead.lastName}`
              : "",
            lead?.email ?? "",
          ]
            .join(" ")
            .toLowerCase();

          return searchable.includes(
            term,
          );
        },
      );
    }, [
      departments,
      search,
    ]);

  const totalEmployees =
    employees.length;

  const assignedEmployees =
    employees.filter(
      (employee) =>
        employee.department !==
        null,
    ).length;

  const departmentsWithLeads =
    departments.filter(
      (department) =>
        department.departmentLead !=
        null,
    ).length;

  const departmentsWithoutLeads =
    Math.max(
      0,
      departments.length -
        departmentsWithLeads,
    );

  /* ------------------------------------------------------------------------ */
  /* Create                                                                   */
  /* ------------------------------------------------------------------------ */

  const openCreate =
    useCallback(() => {
      setForm(
        EMPTY_FORM,
      );

      setModal({
        open: true,
        mode: "create",
        department: null,
      });
    }, []);

  /* ------------------------------------------------------------------------ */
  /* Edit                                                                     */
  /* ------------------------------------------------------------------------ */

  const openEdit =
    useCallback(
      (
        department: DepartmentWithLead,
      ) => {
        setForm({
          name:
            department.name,
          code:
            department.code,
          departmentLeadId:
            department
              .departmentLead
              ?.employeeId ??
            "",
        });

        setModal({
          open: true,
          mode: "edit",
          department,
        });
      },
      [],
    );

  /* ------------------------------------------------------------------------ */
  /* Close modal                                                              */
  /* ------------------------------------------------------------------------ */

  const closeModal =
    useCallback(() => {
      if (submitting) {
        return;
      }

      setModal(
        EMPTY_MODAL,
      );

      setForm(
        EMPTY_FORM,
      );
    }, [
      submitting,
    ]);

  /* ------------------------------------------------------------------------ */
  /* Submit                                                                   */
  /* ------------------------------------------------------------------------ */

  const submitDepartment =
    useCallback(
      async (
        event: FormEvent<HTMLFormElement>,
      ) => {
        event.preventDefault();

        if (submitting) {
          return;
        }

        const name =
          normalizeText(
            form.name,
          );

        const code =
          normalizeCode(
            form.code,
          );

        setSubmitting(
          true,
        );

        try {
          if (
            modal.mode ===
            "create"
          ) {
            await createDepartment({
              name,
              code,
            });

            setNotice({
              type: "success",
              message:
                `${name} was created successfully.`,
            });
          } else if (
            modal.department
          ) {
            await updateDepartment(
              modal.department.id,
              {
                name,
                code,
                departmentLeadId:
                  form.departmentLeadId || null,
              },
            );

            setNotice({
              type: "success",
              message:
                `${name} was updated successfully.`,
            });
          }

          setModal(
            EMPTY_MODAL,
          );

          setForm(
            EMPTY_FORM,
          );

          await loadData();
        } catch (error) {
          setNotice({
            type: "error",
            message:
              errorMessage(
                error,
                modal.mode ===
                  "create"
                  ? "We could not create the department."
                  : "We could not save the department changes.",
              ),
          });
        } finally {
          setSubmitting(
            false,
          );
        }
      },
      [
        form.code,
        form.departmentLeadId,
        form.name,
        loadData,
        modal.department,
        modal.mode,
        submitting,
      ],
    );

  /* ------------------------------------------------------------------------ */
  /* Delete                                                                   */
  /* ------------------------------------------------------------------------ */

  const openDelete =
    useCallback(
      (
        department: DepartmentWithLead,
      ) => {
        setDeleteState({
          open: true,
          department,
        });
      },
      [],
    );

  const closeDelete =
    useCallback(() => {
      if (deleting) {
        return;
      }

      setDeleteState(
        EMPTY_DELETE,
      );
    }, [
      deleting,
    ]);

  const confirmDelete =
    useCallback(
      async () => {
        const department =
          deleteState.department;

        if (
          !department ||
          deleting
        ) {
          return;
        }

        setDeleting(
          true,
        );

        try {
          await deleteDepartment(
            department.id,
          );

          setNotice({
            type: "success",
            message:
              `${department.name} was deleted successfully.`,
          });

          setDeleteState(
            EMPTY_DELETE,
          );

          await loadData();
        } catch (error) {
          setNotice({
            type: "error",
            message:
              errorMessage(
                error,
                "We could not delete the department. It may still be referenced by employees or leave history.",
              ),
          });
        } finally {
          setDeleting(
            false,
          );
        }
      },
      [
        deleteState.department,
        deleting,
        loadData,
      ],
    );

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="min-w-0 space-y-5 pb-8 sm:space-y-6">
      {/* ==================================================================== */
      /* HEADER                                                                */
      /* ==================================================================== */}

      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#071a35] text-[#d8a415] shadow-sm">
                <Building2
                  size={21}
                  strokeWidth={2}
                />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#b7890c]">
                  Organization
                </p>

                <h1 className="mt-0.5 truncate text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                  Departments
                </h1>
              </div>
            </div>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              Manage departments, employee membership and reporting ownership across your organization.
            </p>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={() =>
                void loadData()
              }
              disabled={
                refreshing
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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
              onClick={
                openCreate
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#d8a415] px-4 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-[#c9960f] focus:outline-none focus:ring-2 focus:ring-[#d8a415] focus:ring-offset-2"
            >
              <Plus
                size={17}
              />
              New department
            </button>
          </div>
        </div>
      </section>

      {/* ==================================================================== */
      /* NOTICES                                                               */
      /* ==================================================================== */}

      {notice && (
        <div
          role="alert"
          className={[
            "flex items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-sm",
            notice.type ===
            "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : notice.type ===
                "warning"
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-rose-200 bg-rose-50 text-rose-800",
          ].join(" ")}
        >
          {notice.type ===
          "success" ? (
            <Check
              size={18}
              className="mt-0.5 shrink-0"
            />
          ) : (
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0"
            />
          )}

          <p className="min-w-0 flex-1 text-sm font-medium leading-6">
            {
              notice.message
            }
          </p>

          <button
            type="button"
            onClick={() =>
              setNotice(
                null,
              )
            }
            aria-label="Dismiss notification"
            className="shrink-0 rounded-lg p-1 transition hover:bg-black/5"
          >
            <X
              size={16}
            />
          </button>
        </div>
      )}

      {pageError && (
        <div
          role="alert"
          className="flex min-w-0 items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-rose-800 shadow-sm"
        >
          <AlertCircle
            size={18}
            className="mt-0.5 shrink-0"
          />

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              Departments could not be loaded
            </p>

            <p className="mt-1 break-words text-xs leading-5 text-rose-700">
              {pageError}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadData()
            }
            disabled={
              refreshing
            }
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Retry
          </button>
        </div>
      )}

      {/* ==================================================================== */
      /* EMPLOYEE WARNING                                                      */
      /* ==================================================================== */}

      {employeeWarning && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-amber-800 shadow-sm"
        >
          <AlertCircle
            size={18}
            className="mt-0.5 shrink-0"
          />

          <div className="min-w-0">
            <p className="text-sm font-semibold">
              Employee reference data unavailable
            </p>

            <p className="mt-1 text-xs leading-5 text-amber-700">
              {
                employeeWarning
              }
            </p>
          </div>
        </div>
      )}

      {/* ==================================================================== */
      /* MAIN                                                                  */
      /* ==================================================================== */}

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* Summary */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Building2
                    size={19}
                  />
                </div>

                <StatusBadge>
                  Organization
                </StatusBadge>
              </div>

              <p className="mt-4 text-2xl font-bold tracking-tight text-slate-950">
                {
                  departments.length
                }
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Total departments
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Users
                    size={19}
                  />
                </div>

                <StatusBadge tone="success">
                  Employees
                </StatusBadge>
              </div>

              <p className="mt-4 text-2xl font-bold tracking-tight text-slate-950">
                {
                  totalEmployees
                }
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Employees in organization
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-[#b7890c]">
                  <Crown
                    size={19}
                  />
                </div>

                <StatusBadge tone="success">
                  Leadership
                </StatusBadge>
              </div>

              <p className="mt-4 text-2xl font-bold tracking-tight text-slate-950">
                {
                  departmentsWithLeads
                }
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Departments with leads
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <ShieldCheck
                    size={19}
                  />
                </div>

                <StatusBadge
                  tone={
                    departmentsWithoutLeads >
                    0
                      ? "warning"
                      : "success"
                  }
                >
                  {
                    departmentsWithoutLeads >
                    0
                      ? "Attention"
                      : "Complete"
                  }
                </StatusBadge>
              </div>

              <p className="mt-4 text-2xl font-bold tracking-tight text-slate-950">
                {
                  departmentsWithoutLeads
                }
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Without a department lead
              </p>
            </div>
          </section>

          {/* Directory */}
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-950">
                    Department directory
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {
                      filteredDepartments.length
                    }{" "}
                    of{" "}
                    {
                      departments.length
                    }{" "}
                    departments shown
                  </p>
                </div>

                <div className="relative w-full lg:max-w-sm">
                  <Search
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="search"
                    value={
                      search
                    }
                    onChange={(
                      event,
                    ) =>
                      setSearch(
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder="Search departments..."
                    aria-label="Search departments"
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#d8a415] focus:ring-2 focus:ring-[#d8a415]/20"
                  />

                  {search && (
                    <button
                      type="button"
                      onClick={() =>
                        setSearch(
                          "",
                        )
                      }
                      aria-label="Clear search"
                      className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      <X
                        size={15}
                      />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {filteredDepartments.length ===
            0 ? (
              <EmptyState
                searching={
                  normalizeText(
                    search,
                  ).length > 0
                }
                onCreate={
                  openCreate
                }
              />
            ) : (
              <>
                {/* ======================================================== */
                /* Desktop table                                               */
                /* ======================================================== */}

                <div className="hidden overflow-x-auto xl:block">
                  <table className="w-full min-w-[900px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80">
                        <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                          Department
                        </th>

                        <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                          Code
                        </th>

                        <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                          Employees
                        </th>

                        <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                          Department lead
                        </th>

                        <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {filteredDepartments.map(
                        (
                          department,
                        ) => {
                          const count =
                            employeeCounts.get(
                              department.id,
                            ) ??
                            0;

                          return (
                            <tr
                              key={
                                department.id
                              }
                              className="transition hover:bg-slate-50/70"
                            >
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#071a35] text-[#d8a415]">
                                    <Building2
                                      size={18}
                                    />
                                  </div>

                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-slate-900">
                                      {
                                        department.name
                                      }
                                    </p>

                                    <p className="mt-0.5 text-xs text-slate-400">
                                      Department
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="px-5 py-4">
                                <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1.5 font-mono text-xs font-bold tracking-wide text-slate-700">
                                  {
                                    department.code
                                  }
                                </span>
                              </td>

                              <td className="px-5 py-4">
                                <div className="flex items-center gap-2">
                                  <Users
                                    size={16}
                                    className="text-slate-400"
                                  />

                                  <span className="text-sm font-semibold text-slate-800">
                                    {
                                      count
                                    }
                                  </span>

                                  <span className="text-xs text-slate-400">
                                    {count ===
                                    1
                                      ? "employee"
                                      : "employees"}
                                  </span>
                                </div>
                              </td>

                              <td className="px-5 py-4">
                                <DepartmentLeadDisplay
                                  department={
                                    department
                                  }
                                />
                              </td>

                              <td className="px-5 py-4">
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEdit(
                                        department,
                                      )
                                    }
                                    aria-label={`Edit ${department.name}`}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                                  >
                                    <Pencil
                                      size={16}
                                    />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      openDelete(
                                        department,
                                      )
                                    }
                                    aria-label={`Delete ${department.name}`}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-300"
                                  >
                                    <Trash2
                                      size={16}
                                    />
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

                {/* ======================================================== */
                /* Mobile / tablet cards                                      */
                /* ======================================================== */}

                <div className="divide-y divide-slate-100 xl:hidden">
                  {filteredDepartments.map(
                    (
                      department,
                    ) => {
                      const count =
                        employeeCounts.get(
                          department.id,
                        ) ??
                        0;

                      return (
                        <article
                          key={
                            department.id
                          }
                          className="min-w-0 p-4 sm:p-5"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#071a35] text-[#d8a415]">
                              <Building2
                                size={19}
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-sm font-bold text-slate-950">
                                  {
                                    department.name
                                  }
                                </h3>

                                <span className="inline-flex rounded-lg bg-slate-100 px-2 py-1 font-mono text-[10px] font-bold tracking-wide text-slate-600">
                                  {
                                    department.code
                                  }
                                </span>
                              </div>

                              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                                <Users
                                  size={14}
                                />

                                <span>
                                  {
                                    count
                                  }{" "}
                                  {count ===
                                  1
                                    ? "employee"
                                    : "employees"}
                                </span>
                              </div>
                            </div>

                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  openEdit(
                                    department,
                                  )
                                }
                                aria-label={`Edit ${department.name}`}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                              >
                                <Pencil
                                  size={16}
                                />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  openDelete(
                                    department,
                                  )
                                }
                                aria-label={`Delete ${department.name}`}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-300"
                              >
                                <Trash2
                                  size={16}
                                />
                              </button>
                            </div>
                          </div>

                          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                              Department lead
                            </p>

                            <DepartmentLeadDisplay
                              department={
                                department
                              }
                            />
                          </div>
                        </article>
                      );
                    },
                  )}
                </div>
              </>
            )}
          </section>

          {/* Data scope */}
          <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck
                size={18}
                className="mt-0.5 shrink-0 text-slate-500"
              />

              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">
                  Organization-scoped data
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Department and employee data is resolved by the authenticated organization. The browser never chooses an organization ID.
                </p>

                {employeesLoaded && (
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {
                      assignedEmployees
                    }{" "}
                    of{" "}
                    {
                      totalEmployees
                    }{" "}
                    employees currently have a department assignment.
                  </p>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {/* Modals */}
      <DepartmentModal
        state={modal}
        form={form}
        setForm={setForm}
        employees={employees}
        employeesLoaded={
          employeesLoaded
        }
        submitting={submitting}
        onClose={
          closeModal
        }
        onSubmit={
          submitDepartment
        }
      />

      <DeleteDepartmentModal
        state={deleteState}
        deleting={deleting}
        onClose={
          closeDelete
        }
        onConfirm={
          confirmDelete
        }
      />
    </div>
  );
}

export default Departments;