import {
  BarChart3,
  CalendarPlus,
  FileText,
  Plus,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";

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
  icon: typeof Plus;
  iconClassName?: string;
}

interface QuickActionsProps {
  actions?: QuickAction[];
  loading?: boolean;
  title?: string;
  subtitle?: string;
  onAction?: (action: QuickAction) => void;
}

const defaultActions: QuickAction[] = [
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
];

function ActionsSkeleton() {
  return (
    <div
      className="grid animate-pulse grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
      role="status"
      aria-label="Loading quick actions"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="rounded-xl border border-slate-100 p-3"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-200" />

            <div className="min-w-0 flex-1">
              <div className="h-3.5 w-24 rounded bg-slate-200" />
              <div className="mt-2 h-3 w-32 rounded bg-slate-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
      <p className="text-sm font-semibold text-slate-700">
        No quick actions available
      </p>

      <p className="mt-1 text-xs text-slate-400">
        Actions available to your role will appear here.
      </p>
    </div>
  );
}

export function QuickActions({
  actions = defaultActions,
  loading = false,
  title = "Quick Actions",
  subtitle = "Frequently used HR tools",
  onAction,
}: QuickActionsProps) {
  return (
    <section
      className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="quick-actions-title"
    >
      <div className="mb-4">
        <h2
          id="quick-actions-title"
          className="text-base font-bold text-slate-900 sm:text-lg"
        >
          {title}
        </h2>

        <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
          {subtitle}
        </p>
      </div>

      {loading ? (
        <ActionsSkeleton />
      ) : actions.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {actions.map((action) => {
            const Icon = action.icon;

            return (
              <button
                key={action.id}
                type="button"
                onClick={() => onAction?.(action)}
                className="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-slate-200 hover:bg-slate-50 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    action.iconClassName ??
                    "bg-slate-100 text-slate-600"
                  }`}
                  aria-hidden="true"
                >
                  <Icon size={18} strokeWidth={2} />
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    title={action.label}
                    className="truncate text-sm font-semibold text-slate-800 group-hover:text-slate-900"
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

                <Plus
                  size={16}
                  className="shrink-0 text-slate-300 transition group-hover:rotate-90 group-hover:text-[#b88900]"
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