import {
  BarChart3,
  CalendarPlus,
  FileText,
  Plus,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ============================================================================
   TYPES
============================================================================ */

export type QuickActionId =
  | "add-employee"
  | "leave-request"
  | "reports"
  | "employees"
  | "policies"
  | "settings";

export interface QuickAction {
  id: QuickActionId;
  label: string;
  description: string;
  icon: LucideIcon;
  iconClassName?: string;
}

interface QuickActionsProps {
  actions?: QuickAction[];
  loading?: boolean;
  title?: string;
  subtitle?: string;
  onAction?: (action: QuickAction) => void;
}

/* ============================================================================
   DEFAULT SYSTEM ACTIONS

   These are navigation capabilities, not dashboard/mock data.
   They remain available when the parent does not provide a customized
   role-based action list.
============================================================================ */

const DEFAULT_ACTIONS: readonly QuickAction[] = Object.freeze([
  {
    id: "add-employee",
    label: "Add Employee",
    description: "Create a new employee profile",
    icon: UserPlus,
    iconClassName: "bg-blue-50 text-blue-600",
  },
  {
    id: "leave-request",
    label: "Manage Leave",
    description: "Review leave requests",
    icon: CalendarPlus,
    iconClassName: "bg-amber-50 text-amber-600",
  },
  {
    id: "reports",
    label: "View Reports",
    description: "Open HR reports and analytics",
    icon: BarChart3,
    iconClassName: "bg-emerald-50 text-emerald-600",
  },
  {
    id: "employees",
    label: "Employees",
    description: "Browse employee directory",
    icon: Users,
    iconClassName: "bg-violet-50 text-violet-600",
  },
  {
    id: "policies",
    label: "Leave Policies",
    description: "Manage leave policies",
    icon: FileText,
    iconClassName: "bg-rose-50 text-rose-600",
  },
  {
    id: "settings",
    label: "System Settings",
    description: "Configure HR portal settings",
    icon: Settings,
    iconClassName: "bg-slate-100 text-slate-600",
  },
]);

/* ============================================================================
   HELPERS
============================================================================ */

function isValidQuickAction(
  action: QuickAction | null | undefined,
): action is QuickAction {
  if (!action) {
    return false;
  }

  if (
    typeof action.id !== "string" ||
    typeof action.label !== "string" ||
    typeof action.description !== "string" ||
    typeof action.icon !== "function"
  ) {
    return false;
  }

  return (
    action.label.trim().length > 0 &&
    action.description.trim().length > 0
  );
}

function normalizeActions(
  actions: QuickAction[] | undefined,
): QuickAction[] {
  const source = actions ?? [...DEFAULT_ACTIONS];

  const seen = new Set<QuickActionId>();

  return source.filter((action) => {
    if (!isValidQuickAction(action)) {
      return false;
    }

    if (seen.has(action.id)) {
      return false;
    }

    seen.add(action.id);

    return true;
  });
}

/* ============================================================================
   LOADING STATE
============================================================================ */

function ActionsSkeleton() {
  return (
    <div
      className="grid min-w-0 animate-pulse grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
      role="status"
      aria-label="Loading quick actions"
      aria-busy="true"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={`quick-action-skeleton-${index}`}
          className="min-w-0 rounded-xl border border-slate-100 bg-white p-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="h-10 w-10 shrink-0 rounded-xl bg-slate-200"
              aria-hidden="true"
            />

            <div className="min-w-0 flex-1">
              <div
                className="h-3.5 w-24 max-w-full rounded bg-slate-200"
                aria-hidden="true"
              />

              <div
                className="mt-2 h-3 w-32 max-w-full rounded bg-slate-100"
                aria-hidden="true"
              />
            </div>

            <div
              className="h-4 w-4 shrink-0 rounded bg-slate-100"
              aria-hidden="true"
            />
          </div>
        </div>
      ))}

      <span className="sr-only">
        Loading available HR actions
      </span>
    </div>
  );
}

/* ============================================================================
   EMPTY STATE
============================================================================ */

function EmptyState() {
  return (
    <div
      className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center"
      role="status"
    >
      <div
        className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm"
        aria-hidden="true"
      >
        <Plus size={18} />
      </div>

      <p className="mt-3 text-sm font-semibold text-slate-700">
        No quick actions available
      </p>

      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-400">
        Actions available to your role will appear here.
      </p>
    </div>
  );
}

/* ============================================================================
   QUICK ACTIONS
============================================================================ */

export function QuickActions({
  actions,
  loading = false,
  title = "Quick Actions",
  subtitle = "Frequently used HR tools",
  onAction,
}: QuickActionsProps) {
  const normalizedActions = normalizeActions(actions);

  const hasActionHandler =
    typeof onAction === "function";

  const handleAction = (action: QuickAction) => {
    if (!hasActionHandler) {
      return;
    }

    onAction(action);
  };

  return (
    <section
      className="min-w-0 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="quick-actions-title"
    >
      {/* ====================================================================
          HEADER
      =================================================================== */}

      <div className="mb-4 min-w-0">
        <h2
          id="quick-actions-title"
          className="truncate text-base font-bold text-slate-900 sm:text-lg"
        >
          {title}
        </h2>

        <p className="mt-0.5 truncate text-xs text-slate-500 sm:text-sm">
          {subtitle}
        </p>
      </div>

      {/* ====================================================================
          CONTENT
      =================================================================== */}

      {loading ? (
        <ActionsSkeleton />
      ) : normalizedActions.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {normalizedActions.map((action) => {
            const Icon = action.icon;

            const iconClassName =
              action.iconClassName ??
              "bg-slate-100 text-slate-600";

            return (
              <button
                key={action.id}
                type="button"
                onClick={() => handleAction(action)}
                disabled={!hasActionHandler}
                aria-label={`${action.label}: ${action.description}`}
                className={[
                  "group flex min-w-0 w-full items-center gap-3",
                  "rounded-xl border border-slate-100 p-3",
                  "text-left transition duration-200",
                  "focus:outline-none focus-visible:ring-2",
                  "focus-visible:ring-[#c89b20]",
                  "focus-visible:ring-offset-2",

                  hasActionHandler
                    ? [
                        "cursor-pointer",
                        "hover:-translate-y-0.5",
                        "hover:border-slate-200",
                        "hover:bg-slate-50",
                        "hover:shadow-sm",
                      ].join(" ")
                    : [
                        "cursor-default",
                        "opacity-80",
                      ].join(" "),
                ].join(" ")}
              >
                {/* Icon */}
                <div
                  className={[
                    "flex h-10 w-10 shrink-0 items-center",
                    "justify-center rounded-xl",
                    iconClassName,
                  ].join(" ")}
                  aria-hidden="true"
                >
                  <Icon
                    size={18}
                    strokeWidth={2}
                  />
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <p
                    title={action.label}
                    className={[
                      "truncate text-sm font-semibold",
                      "text-slate-800",
                      hasActionHandler
                        ? "group-hover:text-slate-900"
                        : "",
                    ].join(" ")}
                  >
                    {action.label}
                  </p>

                  <p
                    title={action.description}
                    className="mt-0.5 truncate text-xs text-slate-400"
                  >
                    {action.description}
                  </p>
                </div>

                {/* Action indicator */}
                <Plus
                  size={16}
                  className={[
                    "shrink-0 transition",
                    hasActionHandler
                      ? [
                          "text-slate-300",
                          "group-hover:rotate-90",
                          "group-hover:text-[#b88900]",
                        ].join(" ")
                      : "text-slate-200",
                  ].join(" ")}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default QuickActions;