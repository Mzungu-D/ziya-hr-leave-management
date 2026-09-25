import {
  AlertCircle,
  ArrowRight,
  Bell,
  CalendarDays,
  Info,
  Megaphone,
  Pin,
} from "lucide-react";

export type AnnouncementPriority = "normal" | "important" | "urgent";

export interface Announcement {
  id: string;
  title: string;
  message: string;
  publishedAt: string;
  author?: string;
  category?: string;
  priority?: AnnouncementPriority;
  pinned?: boolean;
  expiresAt?: string;
}

interface AnnouncementsProps {
  announcements?: Announcement[];
  loading?: boolean;
  title?: string;
  subtitle?: string;
  maxItems?: number;
  onViewAll?: () => void;
  onAnnouncementClick?: (announcement: Announcement) => void;
}

const defaultAnnouncements: Announcement[] = [
  {
    id: "ANN-001",
    title: "September Leave Planning",
    message:
      "Please submit planned leave requests early to help managers coordinate team coverage.",
    publishedAt: "Today",
    author: "HR Department",
    category: "Leave Management",
    priority: "important",
    pinned: true,
  },
  {
    id: "ANN-002",
    title: "Upcoming Public Holiday",
    message:
      "Employees are reminded that the upcoming public holiday will be observed across the organization.",
    publishedAt: "Yesterday",
    author: "HR Department",
    category: "Holiday",
    priority: "normal",
  },
  {
    id: "ANN-003",
    title: "HR Policy Review",
    message:
      "The HR team is reviewing company policies. Employees will be notified when updated policies are published.",
    publishedAt: "2 days ago",
    author: "People Operations",
    category: "Policy",
    priority: "normal",
  },
  {
    id: "ANN-004",
    title: "System Maintenance",
    message:
      "Scheduled maintenance may temporarily affect access to selected HR services.",
    publishedAt: "3 days ago",
    author: "IT Support",
    category: "System",
    priority: "urgent",
  },
];

const priorityConfig: Record<
  AnnouncementPriority,
  {
    label: string;
    iconClassName: string;
    icon: typeof Bell;
  }
> = {
  normal: {
    label: "Announcement",
    iconClassName: "bg-blue-50 text-blue-600",
    icon: Bell,
  },
  important: {
    label: "Important",
    iconClassName: "bg-amber-50 text-amber-600",
    icon: AlertCircle,
  },
  urgent: {
    label: "Urgent",
    iconClassName: "bg-red-50 text-red-600",
    icon: AlertCircle,
  },
};

function AnnouncementSkeleton() {
  return (
    <div
      className="animate-pulse space-y-3"
      role="status"
      aria-label="Loading announcements"
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="flex gap-3 rounded-xl border border-slate-100 p-3"
        >
          <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-200" />

          <div className="min-w-0 flex-1">
            <div className="h-3.5 w-40 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-full rounded bg-slate-100" />
            <div className="mt-1.5 h-3 w-3/4 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[250px] items-center justify-center px-4 py-8">
      <div className="max-w-xs text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <Megaphone size={22} className="text-slate-400" />
        </div>

        <p className="mt-3 text-sm font-semibold text-slate-700">
          No announcements
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-400">
          Important HR and company announcements will appear here.
        </p>
      </div>
    </div>
  );
}

export function Announcements({
  announcements = defaultAnnouncements,
  loading = false,
  title = "Announcements",
  subtitle = "Latest HR and company updates",
  maxItems = 4,
  onViewAll,
  onAnnouncementClick,
}: AnnouncementsProps) {
  const visibleAnnouncements = announcements.slice(0, maxItems);

  return (
    <section
      className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="announcements-title"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#d8a415]/10 text-[#a77d00]">
              <Megaphone size={16} />
            </div>

            <h2
              id="announcements-title"
              className="text-base font-bold text-slate-900 sm:text-lg"
            >
              {title}
            </h2>
          </div>

          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            {subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-[#a77d00] transition hover:bg-[#d8a415]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2"
        >
          <span className="hidden sm:inline">View all</span>
          <ArrowRight size={15} />
        </button>
      </div>

      {loading ? (
        <AnnouncementSkeleton />
      ) : visibleAnnouncements.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {visibleAnnouncements.map((announcement) => {
            const priority =
              announcement.priority ?? "normal";

            const config = priorityConfig[priority];
            const Icon = config.icon;

            return (
              <button
                key={announcement.id}
                type="button"
                onClick={() =>
                  onAnnouncementClick?.(announcement)
                }
                className={`group w-full min-w-0 rounded-xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2 ${
                  announcement.pinned
                    ? "border-[#d8a415]/20 bg-[#d8a415]/[0.03] hover:border-[#d8a415]/40"
                    : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.iconClassName}`}
                    aria-hidden="true"
                  >
                    <Icon size={18} strokeWidth={2} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3
                            title={announcement.title}
                            className="min-w-0 truncate text-sm font-semibold text-slate-800 group-hover:text-slate-900"
                          >
                            {announcement.title}
                          </h3>

                          {announcement.pinned && (
                            <span
                              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#d8a415]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#a77d00]"
                              title="Pinned announcement"
                            >
                              <Pin size={9} />
                              Pinned
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-500">
                      {announcement.message}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays size={12} />
                        {announcement.publishedAt}
                      </span>

                      {announcement.author && (
                        <span className="truncate">
                          By {announcement.author}
                        </span>
                      )}

                      {announcement.category && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-500">
                          {announcement.category}
                        </span>
                      )}
                    </div>
                  </div>

                  <ArrowRight
                    size={16}
                    className="mt-1 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500"
                    aria-hidden="true"
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!loading &&
        visibleAnnouncements.length > 0 &&
        announcements.length > maxItems && (
          <button
            type="button"
            onClick={onViewAll}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2"
          >
            View all {announcements.length} announcements
            <ArrowRight size={14} />
          </button>
        )}

      <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
        <Info
          size={14}
          className="mt-0.5 shrink-0 text-slate-400"
        />

        <p className="text-[11px] leading-4 text-slate-500">
          Announcements are managed by authorized HR and system
          administrators.
        </p>
      </div>
    </section>
  );
}