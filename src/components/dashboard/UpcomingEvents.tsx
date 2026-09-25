import {
  CalendarDays,
  ChevronRight,
  Clock3,
  MapPin,
} from "lucide-react";

export type UpcomingEventType =
  | "holiday"
  | "leave"
  | "meeting"
  | "event";

export interface UpcomingEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  description?: string;
  type: UpcomingEventType;
}

interface UpcomingEventsProps {
  events?: UpcomingEvent[];
  loading?: boolean;
  title?: string;
  subtitle?: string;
  onViewAll?: () => void;
  onEventClick?: (event: UpcomingEvent) => void;
}

const defaultEvents: UpcomingEvent[] = [
  {
    id: "EV-001",
    title: "Team Planning Meeting",
    date: "26 Sep 2026",
    time: "10:00 AM",
    location: "Board Room",
    description: "Monthly planning session with department leads.",
    type: "meeting",
  },
  {
    id: "EV-002",
    title: "Amina Hassan on Annual Leave",
    date: "28 Sep 2026",
    time: "All day",
    description: "Employee leave period begins.",
    type: "leave",
  },
  {
    id: "EV-003",
    title: "Huduma Day",
    date: "10 Oct 2026",
    description: "Public holiday.",
    type: "holiday",
  },
  {
    id: "EV-004",
    title: "HR Policy Review",
    date: "14 Oct 2026",
    time: "2:00 PM",
    location: "HR Meeting Room",
    description: "Quarterly review of HR policies and procedures.",
    type: "event",
  },
];

const eventTypeConfig: Record<
  UpcomingEventType,
  {
    label: string;
    iconClassName: string;
    icon: typeof CalendarDays;
  }
> = {
  holiday: {
    label: "Holiday",
    iconClassName: "bg-amber-50 text-amber-600",
    icon: CalendarDays,
  },
  leave: {
    label: "Leave",
    iconClassName: "bg-blue-50 text-blue-600",
    icon: CalendarDays,
  },
  meeting: {
    label: "Meeting",
    iconClassName: "bg-violet-50 text-violet-600",
    icon: Clock3,
  },
  event: {
    label: "Event",
    iconClassName: "bg-emerald-50 text-emerald-600",
    icon: CalendarDays,
  },
};

function EventSkeleton() {
  return (
    <div
      className="animate-pulse space-y-3"
      role="status"
      aria-label="Loading upcoming events"
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="flex gap-3 rounded-xl border border-slate-100 p-3"
        >
          <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-200" />

          <div className="min-w-0 flex-1">
            <div className="h-3.5 w-36 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-24 rounded bg-slate-100" />
            <div className="mt-2 h-3 w-28 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[260px] items-center justify-center px-4 py-8">
      <div className="max-w-xs text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <CalendarDays size={22} className="text-slate-400" />
        </div>

        <p className="mt-3 text-sm font-semibold text-slate-700">
          No upcoming events
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-400">
          Holidays, meetings, leave and other scheduled events will
          appear here.
        </p>
      </div>
    </div>
  );
}

export function UpcomingEvents({
  events = defaultEvents,
  loading = false,
  title = "Upcoming Events",
  subtitle = "Important dates and activities",
  onViewAll,
  onEventClick,
}: UpcomingEventsProps) {
  return (
    <section
      className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="upcoming-events-title"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="upcoming-events-title"
            className="text-base font-bold text-slate-900 sm:text-lg"
          >
            {title}
          </h2>

          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
            {subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-[#a77d00] transition hover:bg-[#d8a415]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2"
        >
          <span className="hidden sm:inline">View all</span>
          <ChevronRight size={15} />
        </button>
      </div>

      {loading ? (
        <EventSkeleton />
      ) : events.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const config = eventTypeConfig[event.type];
            const Icon = config.icon;

            return (
              <button
                key={event.id}
                type="button"
                onClick={() => onEventClick?.(event)}
                className="group flex w-full min-w-0 items-start gap-3 rounded-xl border border-slate-100 p-3 text-left transition hover:border-slate-200 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.iconClassName}`}
                  aria-hidden="true"
                >
                  <Icon size={18} strokeWidth={2} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      title={event.title}
                      className="min-w-0 truncate text-sm font-semibold text-slate-800 group-hover:text-slate-900"
                    >
                      {event.title}
                    </p>

                    <span className="hidden shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500 sm:inline-flex">
                      {config.label}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays size={12} />
                      {event.date}
                    </span>

                    {event.time && (
                      <span className="inline-flex items-center gap-1">
                        <Clock3 size={12} />
                        {event.time}
                      </span>
                    )}
                  </div>

                  {event.location && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                      <MapPin size={12} />
                      <span className="truncate">
                        {event.location}
                      </span>
                    </div>
                  )}

                  {event.description && (
                    <p
                      title={event.description}
                      className="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-500"
                    >
                      {event.description}
                    </p>
                  )}
                </div>

                <ChevronRight
                  size={16}
                  className="mt-1 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500"
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