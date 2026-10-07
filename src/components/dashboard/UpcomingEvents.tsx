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
          className="flex min-w-0 gap-3 rounded-xl border border-slate-100 p-3"
        >
          <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-200" />

          <div className="min-w-0 flex-1">
            <div className="h-3.5 w-36 max-w-full rounded bg-slate-200" />
            <div className="mt-2 h-3 w-24 max-w-full rounded bg-slate-100" />
            <div className="mt-2 h-3 w-28 max-w-full rounded bg-slate-100" />
          </div>
        </div>
      ))}

      <span className="sr-only">
        Loading upcoming events
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[260px] items-center justify-center px-4 py-8">
      <div className="max-w-xs text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <CalendarDays
            size={22}
            className="text-slate-400"
            aria-hidden="true"
          />
        </div>

        <p className="mt-3 text-sm font-semibold text-slate-700">
          No upcoming events
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-400">
          Holidays, meetings, leave and other scheduled
          events will appear here.
        </p>
      </div>
    </div>
  );
}

export function UpcomingEvents({
  events = [],
  loading = false,
  title = "Upcoming Events",
  subtitle = "Important dates and activities",
  onViewAll,
  onEventClick,
}: UpcomingEventsProps) {
  const safeEvents = Array.isArray(events)
    ? events.filter(
        (event) =>
          event &&
          typeof event.id === "string" &&
          event.id.trim().length > 0 &&
          typeof event.title === "string" &&
          event.title.trim().length > 0 &&
          typeof event.date === "string" &&
          event.date.trim().length > 0 &&
          Object.prototype.hasOwnProperty.call(
            eventTypeConfig,
            event.type,
          ),
      )
    : [];

  return (
    <section
      className="min-w-0 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="upcoming-events-title"
    >
      <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2
            id="upcoming-events-title"
            className="truncate text-base font-bold text-slate-900 sm:text-lg"
          >
            {title}
          </h2>

          <p className="mt-0.5 truncate text-xs text-slate-500 sm:text-sm">
            {subtitle}
          </p>
        </div>

        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-[#a77d00] transition hover:bg-[#d8a415]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2"
            aria-label="View all upcoming events"
          >
            <span className="hidden sm:inline">
              View all
            </span>

            <ChevronRight
              size={15}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      {loading ? (
        <EventSkeleton />
      ) : safeEvents.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="max-h-[500px] space-y-3 overflow-y-auto pr-1">
          {safeEvents.map((event) => {
            const config =
              eventTypeConfig[event.type];

            const Icon = config.icon;

            return (
              <button
                key={event.id}
                type="button"
                onClick={() =>
                  onEventClick?.(event)
                }
                className="group flex w-full min-w-0 items-start gap-3 rounded-xl border border-slate-100 p-3 text-left transition hover:border-slate-200 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2"
                aria-label={`View event: ${event.title}`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.iconClassName}`}
                  aria-hidden="true"
                >
                  <Icon
                    size={18}
                    strokeWidth={2}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <p
                      title={event.title}
                      className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 group-hover:text-slate-900"
                    >
                      {event.title}
                    </p>

                    <span className="hidden max-w-[90px] shrink-0 truncate rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500 sm:inline-flex">
                      {config.label}
                    </span>
                  </div>

                  <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <CalendarDays
                        size={12}
                        className="shrink-0"
                        aria-hidden="true"
                      />

                      <span className="truncate">
                        {event.date}
                      </span>
                    </span>

                    {event.time && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <Clock3
                          size={12}
                          className="shrink-0"
                          aria-hidden="true"
                        />

                        <span className="truncate">
                          {event.time}
                        </span>
                      </span>
                    )}
                  </div>

                  {event.location && (
                    <div className="mt-1 flex min-w-0 items-center gap-1 text-xs text-slate-400">
                      <MapPin
                        size={12}
                        className="shrink-0"
                        aria-hidden="true"
                      />

                      <span
                        title={event.location}
                        className="truncate"
                      >
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

                  <span className="mt-2 inline-flex text-[10px] font-medium text-slate-300 sm:hidden">
                    {config.label}
                  </span>
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