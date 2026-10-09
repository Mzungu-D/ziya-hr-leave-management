import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Archive,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Edit3,
  FileText,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
} from "lucide-react";

import {
  archivePolicy,
  createPolicy,
  deletePolicy,
  getPolicy,
  getPolicySummary,
  listPolicies,
  publishPolicy,
  restorePolicy,
  updatePolicy,
  type Policy,
  type PolicyStatus,
  type PolicySummary,
} from "../../services/policy.service";

/**
 * --------------------------------------------------------------------------
 * Constants
 * --------------------------------------------------------------------------
 */

const EMPTY_SUMMARY: PolicySummary = {
  total: 0,
  draft: 0,
  published: 0,
  archived: 0,
};

const STATUS_OPTIONS: Array<{
  value: "ALL" | PolicyStatus;
  label: string;
}> = [
  {
    value: "ALL",
    label: "All Policies",
  },
  {
    value: "DRAFT",
    label: "Draft",
  },
  {
    value: "PUBLISHED",
    label: "Published",
  },
  {
    value: "ARCHIVED",
    label: "Archived",
  },
];

type ModalMode =
  | "create"
  | "edit"
  | "publish"
  | "archive"
  | "restore"
  | "delete"
  | null;

interface PolicyFormState {
  title: string;
  code: string;
  description: string;
  content: string;
  version: string;
  effectiveFrom: string;
  effectiveTo: string;
}

const EMPTY_FORM: PolicyFormState = {
  title: "",
  code: "",
  description: "",
  content: "",
  version: "1",
  effectiveFrom: "",
  effectiveTo: "",
};

/**
 * --------------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------------
 */

function formatDate(
  value: string | Date | null | undefined,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(
  value: string | Date | null | undefined,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toDateInputValue(
  value: string | Date | null | undefined,
): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function getPolicyErrorMessage(
  error: unknown,
): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error
  ) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function getInitials(title: string): string {
  const words = title
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "P";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function statusLabel(status: PolicyStatus): string {
  switch (status) {
    case "PUBLISHED":
      return "Published";

    case "ARCHIVED":
      return "Archived";

    case "DRAFT":
    default:
      return "Draft";
  }
}

function statusClasses(status: PolicyStatus): string {
  switch (status) {
    case "PUBLISHED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "ARCHIVED":
      return "border-slate-200 bg-slate-100 text-slate-600";

    case "DRAFT":
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function statusIcon(status: PolicyStatus) {
  switch (status) {
    case "PUBLISHED":
      return CheckCircle2;

    case "ARCHIVED":
      return Archive;

    case "DRAFT":
    default:
      return Clock3;
  }
}

function policyToForm(
  policy: Policy,
): PolicyFormState {
  return {
    title: policy.title,
    code: policy.code,
    description: policy.description ?? "",
    content: policy.content,
    version: String(policy.version),
    effectiveFrom: toDateInputValue(
      policy.effectiveFrom,
    ),
    effectiveTo: toDateInputValue(
      policy.effectiveTo,
    ),
  };
}

/**
 * --------------------------------------------------------------------------
 * Status badge
 * --------------------------------------------------------------------------
 */

function StatusBadge({
  status,
}: {
  status: PolicyStatus;
}) {
  const Icon = statusIcon(status);

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        "text-xs font-semibold",
        statusClasses(status),
      ].join(" ")}
    >
      <Icon className="h-3.5 w-3.5" />
      {statusLabel(status)}
    </span>
  );
}

/**
 * --------------------------------------------------------------------------
 * Summary card
 * --------------------------------------------------------------------------
 */

function SummaryCard({
  label,
  value,
  icon: Icon,
  description,
}: {
  label: string;
  value: number;
  icon: typeof FileText;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {description}
          </p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
      </div>
    </div>
  );
}

/**
 * --------------------------------------------------------------------------
 * Policies page
 * --------------------------------------------------------------------------
 */

export function Policies() {
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [summary, setSummary] =
    useState<PolicySummary>(EMPTY_SUMMARY);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(
    null,
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | PolicyStatus
  >("ALL");

  const [selectedPolicy, setSelectedPolicy] =
    useState<Policy | null>(null);

  const [detailLoading, setDetailLoading] =
    useState(false);

  const [detailError, setDetailError] =
    useState<string | null>(null);

  const [modalMode, setModalMode] =
    useState<ModalMode>(null);

  const [form, setForm] =
    useState<PolicyFormState>(EMPTY_FORM);

  const [submitting, setSubmitting] =
    useState(false);

  const [actionError, setActionError] =
    useState<string | null>(null);

  const [mobileFiltersOpen, setMobileFiltersOpen] =
    useState(false);

  /**
   * ------------------------------------------------------------------------
   * Cleanup
   * ------------------------------------------------------------------------
   */

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  /**
   * ------------------------------------------------------------------------
   * Load policies
   * ------------------------------------------------------------------------
   */

  const loadPolicies = useCallback(
    async (options?: {
      silent?: boolean;
    }) => {
      abortRef.current?.abort();

      const controller = new AbortController();

      abortRef.current = controller;

      const silent = options?.silent ?? false;

      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError(null);

      try {
        const [policyData, summaryData] =
          await Promise.all([
            listPolicies({
              status:
                statusFilter === "ALL"
                  ? undefined
                  : statusFilter,
              search:
                search.trim() || undefined,
              signal: controller.signal,
            }),

            getPolicySummary({
              signal: controller.signal,
            }),
          ]);

        if (!mountedRef.current) {
          return;
        }

        setPolicies(policyData);
        setSummary(summaryData);
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }

        if (!mountedRef.current) {
          return;
        }

        setError(
          getPolicyErrorMessage(requestError),
        );
      } finally {
        if (!mountedRef.current) {
          return;
        }

        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, statusFilter],
  );

  /**
   * ------------------------------------------------------------------------
   * Initial/filter loading
   * ------------------------------------------------------------------------
   */

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPolicies();
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadPolicies]);

  /**
   * ------------------------------------------------------------------------
   * Local filtering
   * ------------------------------------------------------------------------
   *
   * The API already performs tenant-scoped filtering. This additional local
   * filtering keeps the UI responsive while preserving the server as the
   * source of truth.
   */

  const visiblePolicies = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return policies.filter((policy) => {
      if (
        statusFilter !== "ALL" &&
        policy.status !== statusFilter
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        policy.title,
        policy.code,
        policy.description ?? "",
        policy.content,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [policies, search, statusFilter]);

  /**
   * ------------------------------------------------------------------------
   * Open create modal
   * ------------------------------------------------------------------------
   */

  const openCreate = useCallback(() => {
    setSelectedPolicy(null);
    setForm(EMPTY_FORM);
    setActionError(null);
    setModalMode("create");
  }, []);

  /**
   * ------------------------------------------------------------------------
   * Open edit modal
   * ------------------------------------------------------------------------
   */

  const openEdit = useCallback(
    (policy: Policy) => {
      if (policy.status === "ARCHIVED") {
        return;
      }

      setSelectedPolicy(policy);
      setForm(policyToForm(policy));
      setActionError(null);
      setModalMode("edit");
    },
    [],
  );

  /**
   * ------------------------------------------------------------------------
   * Open details
   * ------------------------------------------------------------------------
   */

  const openDetails = useCallback(
    async (policy: Policy) => {
      setSelectedPolicy(policy);
      setDetailLoading(true);
      setDetailError(null);

      try {
        const latest = await getPolicy(
          policy.id,
        );

        if (!mountedRef.current) {
          return;
        }

        setSelectedPolicy(latest);
      } catch (requestError) {
        if (!mountedRef.current) {
          return;
        }

        setDetailError(
          getPolicyErrorMessage(requestError),
        );
      } finally {
        if (mountedRef.current) {
          setDetailLoading(false);
        }
      }
    },
    [],
  );

  /**
   * ------------------------------------------------------------------------
   * Close modal
   * ------------------------------------------------------------------------
   */

  const closeModal = useCallback(() => {
    if (submitting) {
      return;
    }

    setModalMode(null);
    setActionError(null);
    setForm(EMPTY_FORM);
  }, [submitting]);

  /**
   * ------------------------------------------------------------------------
   * Close details
   * ------------------------------------------------------------------------
   */

  const closeDetails = useCallback(() => {
    if (submitting) {
      return;
    }

    setSelectedPolicy(null);
    setDetailError(null);
  }, [submitting]);

  /**
   * ------------------------------------------------------------------------
   * Create/update policy
   * ------------------------------------------------------------------------
   */

  const handleSubmitPolicy = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setSubmitting(true);
    setActionError(null);

    try {
      const version = Number(form.version);

      if (
        !Number.isInteger(version) ||
        version < 1
      ) {
        throw new Error(
          "Policy version must be a positive whole number.",
        );
      }

      if (!form.title.trim()) {
        throw new Error(
          "Policy title is required.",
        );
      }

      if (!form.code.trim()) {
        throw new Error(
          "Policy code is required.",
        );
      }

      if (!form.content.trim()) {
        throw new Error(
          "Policy content is required.",
        );
      }

      if (
        form.effectiveFrom &&
        form.effectiveTo &&
        new Date(form.effectiveTo) <
          new Date(form.effectiveFrom)
      ) {
        throw new Error(
          "Effective end date cannot be earlier than the effective start date.",
        );
      }

      if (modalMode === "create") {
        const created = await createPolicy({
          title: form.title.trim(),
          code: form.code.trim(),
          description:
            form.description.trim() || null,
          content: form.content,
          version,
          effectiveFrom:
            form.effectiveFrom || null,
          effectiveTo:
            form.effectiveTo || null,
        });

        if (!mountedRef.current) {
          return;
        }

        setPolicies((current) => [
          created,
          ...current.filter(
            (policy) =>
              policy.id !== created.id,
          ),
        ]);

        setSelectedPolicy(created);

        setModalMode(null);
        setForm(EMPTY_FORM);

        await loadPolicies({
          silent: true,
        });

        return;
      }

      if (
        modalMode === "edit" &&
        selectedPolicy
      ) {
        const updated = await updatePolicy(
          selectedPolicy.id,
          {
            title: form.title.trim(),
            code: form.code.trim(),
            description:
              form.description.trim() || null,
            content: form.content,
            version,
            effectiveFrom:
              form.effectiveFrom || null,
            effectiveTo:
              form.effectiveTo || null,
          },
        );

        if (!mountedRef.current) {
          return;
        }

        setPolicies((current) =>
          current.map((policy) =>
            policy.id === updated.id
              ? updated
              : policy,
          ),
        );

        setSelectedPolicy(updated);

        setModalMode(null);
        setForm(EMPTY_FORM);

        await loadPolicies({
          silent: true,
        });
      }
    } catch (requestError) {
      if (!mountedRef.current) {
        return;
      }

      setActionError(
        getPolicyErrorMessage(requestError),
      );
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  /**
   * ------------------------------------------------------------------------
   * Policy lifecycle action
   * ------------------------------------------------------------------------
   */

  const handlePolicyAction = async () => {
    if (
      !selectedPolicy ||
      submitting ||
      !modalMode
    ) {
      return;
    }

    setSubmitting(true);
    setActionError(null);

    try {
      let updated: Policy | null = null;

      switch (modalMode) {
        case "publish":
          updated = await publishPolicy(
            selectedPolicy.id,
          );
          break;

        case "archive":
          updated = await archivePolicy(
            selectedPolicy.id,
          );
          break;

        case "restore":
          updated = await restorePolicy(
            selectedPolicy.id,
          );
          break;

        case "delete":
          await deletePolicy(
            selectedPolicy.id,
          );
          break;

        default:
          break;
      }

      if (!mountedRef.current) {
        return;
      }

      if (modalMode === "delete") {
        setPolicies((current) =>
          current.filter(
            (policy) =>
              policy.id !==
              selectedPolicy.id,
          ),
        );

        setSelectedPolicy(null);
      } else if (updated) {
        setPolicies((current) =>
          current.map((policy) =>
            policy.id === updated!.id
              ? updated!
              : policy,
          ),
        );

        setSelectedPolicy(updated);
      }

      setModalMode(null);

      await loadPolicies({
        silent: true,
      });
    } catch (requestError) {
      if (!mountedRef.current) {
        return;
      }

      setActionError(
        getPolicyErrorMessage(requestError),
      );
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  /**
   * ------------------------------------------------------------------------
   * Keyboard handling
   * ------------------------------------------------------------------------
   */

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (modalMode && !submitting) {
        setModalMode(null);
        setActionError(null);
        return;
      }

      if (selectedPolicy && !submitting) {
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
    modalMode,
    selectedPolicy,
    submitting,
    closeDetails,
  ]);

  /**
   * ------------------------------------------------------------------------
   * Render
   * ------------------------------------------------------------------------
   */

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        {/* ---------------------------------------------------------------- */}
        {/* Header */}
        {/* ---------------------------------------------------------------- */}

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <BookOpen className="h-4 w-4" />

              <span>HR Administration</span>

              <ChevronRight className="h-4 w-4" />

              <span className="text-slate-700">
                Policies
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Policies
            </h1>

            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Create, manage, publish and maintain
              organization policies.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#c9a227] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#b8921f] focus:outline-none focus:ring-2 focus:ring-[#c9a227]/40 focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" />

            Create Policy
          </button>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Summary */}
        {/* ---------------------------------------------------------------- */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Total Policies"
            value={summary.total}
            icon={FileText}
            description="All policies in this organization"
          />

          <SummaryCard
            label="Draft"
            value={summary.draft}
            icon={Clock3}
            description="Policies currently being prepared"
          />

          <SummaryCard
            label="Published"
            value={summary.published}
            icon={CheckCircle2}
            description="Policies currently published"
          />

          <SummaryCard
            label="Archived"
            value={summary.archived}
            icon={Archive}
            description="Historical or retired policies"
          />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Toolbar */}
        {/* ---------------------------------------------------------------- */}

        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 flex-1 lg:max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search policies, codes or content..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#c9a227] focus:bg-white focus:ring-2 focus:ring-[#c9a227]/20"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setMobileFiltersOpen(
                    (current) => !current,
                  )
                }
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 lg:hidden"
              >
                <Filter className="h-4 w-4" />
                Filter
              </button>

              <div className="hidden items-center gap-2 lg:flex">
                {STATUS_OPTIONS.map(
                  (option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setStatusFilter(
                          option.value,
                        )
                      }
                      className={[
                        "rounded-xl px-3.5 py-2.5 text-sm font-medium transition",
                        statusFilter ===
                        option.value
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-100",
                      ].join(" ")}
                    >
                      {option.label}
                    </button>
                  ),
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  void loadPolicies({
                    silent: true,
                  })
                }
                disabled={refreshing}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                title="Refresh policies"
              >
                <RefreshCw
                  className={[
                    "h-4 w-4",
                    refreshing
                      ? "animate-spin"
                      : "",
                  ].join(" ")}
                />

                <span className="hidden sm:inline">
                  Refresh
                </span>
              </button>
            </div>
          </div>

          {mobileFiltersOpen && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 lg:hidden">
              {STATUS_OPTIONS.map(
                (option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setStatusFilter(
                        option.value,
                      );
                      setMobileFiltersOpen(
                        false,
                      );
                    }}
                    className={[
                      "rounded-xl px-3.5 py-2 text-sm font-medium transition",
                      statusFilter ===
                      option.value
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600",
                    ].join(" ")}
                  >
                    {option.label}
                  </button>
                ),
              )}
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Error */}
        {/* ---------------------------------------------------------------- */}

        {error && (
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

              <div>
                <p className="text-sm font-semibold text-red-800">
                  Unable to load policies
                </p>

                <p className="mt-1 text-sm text-red-700">
                  {error}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadPolicies()
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Loading */}
        {/* ---------------------------------------------------------------- */}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 shadow-sm">
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#c9a227]" />

              <p className="mt-4 text-sm font-semibold text-slate-800">
                Loading policies
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Retrieving policies from the production API.
              </p>
            </div>
          </div>
        ) : visiblePolicies.length === 0 ? (
          /* -------------------------------------------------------------- */
          /* Empty state */
          /* -------------------------------------------------------------- */

          <div className="rounded-2xl border border-slate-200 bg-white p-12 shadow-sm">
            <div className="mx-auto flex max-w-md flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                <FileText className="h-7 w-7 text-slate-500" />
              </div>

              <h2 className="mt-5 text-lg font-semibold text-slate-900">
                No policies found
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                {search.trim() ||
                statusFilter !== "ALL"
                  ? "No policies match the current search or filter."
                  : "Your organization does not have any policies yet."}
              </p>

              {!search.trim() &&
                statusFilter === "ALL" && (
                  <button
                    type="button"
                    onClick={openCreate}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#c9a227] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#b8921f]"
                  >
                    <Plus className="h-4 w-4" />
                    Create First Policy
                  </button>
                )}
            </div>
          </div>
        ) : (
          <>
            {/* ------------------------------------------------------------ */}
            {/* Desktop table */}
            {/* ------------------------------------------------------------ */}

            <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Policy
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Code
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Status
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Version
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Effective
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {visiblePolicies.map(
                      (policy) => (
                        <tr
                          key={policy.id}
                          className="transition hover:bg-slate-50/80"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700">
                                {getInitials(
                                  policy.title,
                                )}
                              </div>

                              <div className="min-w-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void openDetails(
                                      policy,
                                    )
                                  }
                                  className="max-w-[320px] truncate text-left text-sm font-semibold text-slate-900 hover:text-[#a6841f]"
                                >
                                  {policy.title}
                                </button>

                                {policy.description && (
                                  <p className="mt-1 max-w-[360px] truncate text-xs text-slate-500">
                                    {
                                      policy.description
                                    }
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-700">
                              {policy.code}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <StatusBadge
                              status={
                                policy.status
                              }
                            />
                          </td>

                          <td className="px-5 py-4 text-sm font-medium text-slate-700">
                            v{policy.version}
                          </td>

                          <td className="px-5 py-4">
                            <div className="text-sm text-slate-700">
                              {formatDate(
                                policy.effectiveFrom,
                              )}
                            </div>

                            {policy.effectiveTo && (
                              <div className="mt-1 text-xs text-slate-400">
                                to{" "}
                                {formatDate(
                                  policy.effectiveTo,
                                )}
                              </div>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  void openDetails(
                                    policy,
                                  )
                                }
                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                View
                              </button>

                              {policy.status !==
                                "ARCHIVED" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openEdit(
                                      policy,
                                    )
                                  }
                                  className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                  title="Edit policy"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ------------------------------------------------------------ */}
            {/* Mobile cards */}
            {/* ------------------------------------------------------------ */}

            <div className="space-y-3 lg:hidden">
              {visiblePolicies.map(
                (policy) => (
                  <div
                    key={policy.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700">
                        {getInitials(
                          policy.title,
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() =>
                                void openDetails(
                                  policy,
                                )
                              }
                              className="text-left text-sm font-semibold text-slate-900"
                            >
                              {policy.title}
                            </button>

                            <p className="mt-1 font-mono text-xs text-slate-500">
                              {policy.code}
                            </p>
                          </div>

                          <StatusBadge
                            status={
                              policy.status
                            }
                          />
                        </div>

                        {policy.description && (
                          <p className="mt-3 line-clamp-2 text-sm leading-5 text-slate-500">
                            {
                              policy.description
                            }
                          </p>
                        )}

                        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                              Version
                            </p>

                            <p className="mt-1 text-sm font-medium text-slate-700">
                              v{policy.version}
                            </p>
                          </div>

                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                              Effective
                            </p>

                            <p className="mt-1 text-sm font-medium text-slate-700">
                              {formatDate(
                                policy.effectiveFrom,
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void openDetails(
                                policy,
                              )
                            }
                            className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            View Policy
                          </button>

                          {policy.status !==
                            "ARCHIVED" && (
                            <button
                              type="button"
                              onClick={() =>
                                openEdit(
                                  policy,
                                )
                              }
                              className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"
                              title="Edit policy"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          </>
        )}
      </div>

      {/* ================================================================== */}
      {/* Details drawer */}
      {/* ================================================================== */}

      {selectedPolicy && !modalMode && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close policy details"
            onClick={closeDetails}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Policy Details
                </p>

                <h2 className="mt-1 truncate text-lg font-bold text-slate-900">
                  {selectedPolicy.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeDetails}
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {detailLoading ? (
                <div className="flex min-h-[300px] items-center justify-center">
                  <Loader2 className="h-7 w-7 animate-spin text-[#c9a227]" />
                </div>
              ) : detailError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-800">
                    Unable to load policy
                  </p>

                  <p className="mt-1 text-sm text-red-700">
                    {detailError}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      status={
                        selectedPolicy.status
                      }
                    />

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      v{selectedPolicy.version}
                    </span>

                    <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-xs font-semibold text-slate-600">
                      {selectedPolicy.code}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Effective From
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {formatDate(
                          selectedPolicy.effectiveFrom,
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Effective To
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {formatDate(
                          selectedPolicy.effectiveTo,
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Published
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {formatDateTime(
                          selectedPolicy.publishedAt,
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Last Updated
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {formatDateTime(
                          selectedPolicy.updatedAt,
                        )}
                      </p>
                    </div>
                  </div>

                  {selectedPolicy.description && (
                    <section>
                      <h3 className="text-sm font-bold text-slate-900">
                        Description
                      </h3>

                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                        {
                          selectedPolicy.description
                        }
                      </p>
                    </section>
                  )}

                  <section>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-bold text-slate-900">
                        Policy Content
                      </h3>

                      <ShieldCheck className="h-5 w-5 text-slate-400" />
                    </div>

                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                        {selectedPolicy.content}
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </div>

            {/* Drawer actions */}
            <div className="border-t border-slate-200 bg-white p-4">
              <div className="flex flex-wrap gap-2">
                {selectedPolicy.status ===
                  "DRAFT" && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        openEdit(
                          selectedPolicy,
                        )
                      }
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:flex-none"
                    >
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setModalMode(
                          "publish",
                        )
                      }
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 sm:flex-none"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Publish
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setModalMode("delete")
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </>
                )}

                {selectedPolicy.status ===
                  "PUBLISHED" && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        openEdit(
                          selectedPolicy,
                        )
                      }
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:flex-none"
                    >
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setModalMode(
                          "archive",
                        )
                      }
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 sm:flex-none"
                    >
                      <Archive className="h-4 w-4" />
                      Archive
                    </button>
                  </>
                )}

                {selectedPolicy.status ===
                  "ARCHIVED" && (
                  <button
                    type="button"
                    onClick={() =>
                      setModalMode("restore")
                    }
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#c9a227] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#b8921f] sm:flex-none"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Restore to Draft
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ================================================================== */}
      {/* Create/Edit modal */}
      {/* ================================================================== */}

      {(modalMode === "create" ||
        modalMode === "edit") && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5">
          <button
            type="button"
            aria-label="Close policy form"
            onClick={closeModal}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
          />

          <div className="relative flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {modalMode ===
                  "create"
                    ? "New Policy"
                    : "Edit Policy"}
                </p>

                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  {modalMode ===
                  "create"
                    ? "Create Policy"
                    : "Edit Policy"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitPolicy}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="flex-1 space-y-5 overflow-y-auto p-5">
                {actionError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <div className="flex items-start gap-3">
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

                      <p className="text-sm text-red-700">
                        {actionError}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="policy-title"
                      className="mb-1.5 block text-sm font-semibold text-slate-700"
                    >
                      Policy Title
                    </label>

                    <input
                      id="policy-title"
                      value={form.title}
                      onChange={(event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            title:
                              event.target
                                .value,
                          }),
                        )
                      }
                      maxLength={200}
                      required
                      placeholder="e.g. Annual Leave Policy"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-[#c9a227] focus:ring-2 focus:ring-[#c9a227]/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="policy-code"
                      className="mb-1.5 block text-sm font-semibold text-slate-700"
                    >
                      Policy Code
                    </label>

                    <input
                      id="policy-code"
                      value={form.code}
                      onChange={(event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            code:
                              event.target
                                .value
                                .toUpperCase(),
                          }),
                        )
                      }
                      maxLength={100}
                      required
                      placeholder="e.g. HR-LEAVE-001"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 font-mono text-sm text-slate-900 outline-none focus:border-[#c9a227] focus:ring-2 focus:ring-[#c9a227]/20"
                    />

                    <p className="mt-1.5 text-xs text-slate-400">
                      Letters, numbers, underscores and
                      hyphens only.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="policy-version"
                      className="mb-1.5 block text-sm font-semibold text-slate-700"
                    >
                      Version
                    </label>

                    <input
                      id="policy-version"
                      type="number"
                      min={1}
                      step={1}
                      value={form.version}
                      onChange={(event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            version:
                              event.target
                                .value,
                          }),
                        )
                      }
                      required
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-[#c9a227] focus:ring-2 focus:ring-[#c9a227]/20"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="policy-description"
                      className="mb-1.5 block text-sm font-semibold text-slate-700"
                    >
                      Description
                    </label>

                    <textarea
                      id="policy-description"
                      value={form.description}
                      onChange={(event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            description:
                              event.target
                                .value,
                          }),
                        )
                      }
                      maxLength={2000}
                      rows={3}
                      placeholder="Brief description of this policy..."
                      className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-[#c9a227] focus:ring-2 focus:ring-[#c9a227]/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="policy-effective-from"
                      className="mb-1.5 block text-sm font-semibold text-slate-700"
                    >
                      Effective From
                    </label>

                    <input
                      id="policy-effective-from"
                      type="date"
                      value={
                        form.effectiveFrom
                      }
                      onChange={(event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            effectiveFrom:
                              event.target
                                .value,
                          }),
                        )
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-[#c9a227] focus:ring-2 focus:ring-[#c9a227]/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="policy-effective-to"
                      className="mb-1.5 block text-sm font-semibold text-slate-700"
                    >
                      Effective To
                    </label>

                    <input
                      id="policy-effective-to"
                      type="date"
                      value={form.effectiveTo}
                      onChange={(event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            effectiveTo:
                              event.target
                                .value,
                          }),
                        )
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-[#c9a227] focus:ring-2 focus:ring-[#c9a227]/20"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="policy-content"
                      className="mb-1.5 block text-sm font-semibold text-slate-700"
                    >
                      Policy Content
                    </label>

                    <textarea
                      id="policy-content"
                      value={form.content}
                      onChange={(event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            content:
                              event.target
                                .value,
                          }),
                        )
                      }
                      maxLength={1_000_000}
                      rows={12}
                      required
                      placeholder="Enter the full policy content..."
                      className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-[#c9a227] focus:ring-2 focus:ring-[#c9a227]/20"
                    />

                    <div className="mt-1.5 flex justify-end text-xs text-slate-400">
                      {form.content.length.toLocaleString()}{" "}
                      / 1,000,000
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 p-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#c9a227] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#b8921f] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}

                  {modalMode ===
                  "create"
                    ? "Create Policy"
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* Confirmation modal */}
      {/* ================================================================== */}

      {modalMode !== null &&
        modalMode !== "create" &&
        modalMode !== "edit" && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close confirmation"
              onClick={closeModal}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            />

            <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                {modalMode ===
                  "publish" && (
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                )}

                {modalMode ===
                  "archive" && (
                  <Archive className="h-6 w-6 text-slate-700" />
                )}

                {modalMode ===
                  "restore" && (
                  <RotateCcw className="h-6 w-6 text-[#a6841f]" />
                )}

                {modalMode ===
                  "delete" && (
                  <Trash2 className="h-6 w-6 text-red-600" />
                )}
              </div>

              <h2 className="mt-5 text-lg font-bold text-slate-900">
                {modalMode ===
                  "publish" &&
                  "Publish this policy?"}

                {modalMode ===
                  "archive" &&
                  "Archive this policy?"}

                {modalMode ===
                  "restore" &&
                  "Restore this policy?"}

                {modalMode ===
                  "delete" &&
                  "Delete this policy?"}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                {modalMode ===
                  "publish" &&
                  "This policy will become published and available as the organization's current policy."}

                {modalMode ===
                  "archive" &&
                  "The policy will be archived and become immutable. It will remain available for historical records."}

                {modalMode ===
                  "restore" &&
                  "The archived policy will be restored to Draft status. It will not be published automatically."}

                {modalMode ===
                  "delete" &&
                  "This permanently deletes the draft policy. Published and archived policies cannot be deleted."}
              </p>

              {actionError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-700">
                    {actionError}
                  </p>
                </div>
              )}

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void handlePolicyAction()
                  }
                  disabled={submitting}
                  className={[
                    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60",
                    modalMode ===
                    "delete"
                      ? "bg-red-600 hover:bg-red-700"
                      : modalMode ===
                        "publish"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-slate-900 hover:bg-slate-800",
                  ].join(" ")}
                >
                  {submitting && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}

                  {modalMode ===
                    "publish" &&
                    "Publish Policy"}

                  {modalMode ===
                    "archive" &&
                    "Archive Policy"}

                  {modalMode ===
                    "restore" &&
                    "Restore Policy"}

                  {modalMode ===
                    "delete" &&
                    "Delete Policy"}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

export default Policies;