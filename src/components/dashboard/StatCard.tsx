import type { LucideIcon } from "lucide-react";

export type StatCardTrendDirection = "up" | "down" | "neutral";

export interface StatCardProps {
  label: string;
  value: string | number;
  comparison?: string;
  trend?: string;
  trendDirection?: StatCardTrendDirection;
  icon: LucideIcon;
  iconClassName?: string;
  onClick?: () => void;
  className?: string;
  loading?: boolean;
  ariaLabel?: string;
}

const trendStyles: Record<
  StatCardTrendDirection,
  {
    text: string;
    arrow: string;
  }
> = {
  up: {
    text: "text-emerald-600",
    arrow: "↑",
  },
  down: {
    text: "text-red-500",
    arrow: "↓",
  },
  neutral: {
    text: "text-slate-500",
    arrow: "→",
  },
};

function LoadingState() {
  return (
    <div
      className="animate-pulse"
      aria-label="Loading statistic"
      role="status"
    >
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 shrink-0 rounded-xl bg-slate-200" />

        <div className="min-w-0 flex-1">
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="mt-2 h-8 w-20 rounded bg-slate-200" />
          <div className="mt-2 h-3 w-32 rounded bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  comparison,
  trend,
  trendDirection = "neutral",
  icon: Icon,
  iconClassName = "bg-blue-50 text-blue-600",
  onClick,
  className = "",
  loading = false,
  ariaLabel,
}: StatCardProps) {
  const isInteractive = typeof onClick === "function";
  const trendStyle = trendStyles[trendDirection];

  const cardClasses = [
    "min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm",
    "transition duration-200",
    "sm:p-5",
    isInteractive
      ? "cursor-pointer hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2"
      : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (loading) {
    return (
      <div className={cardClasses}>
        <LoadingState />
      </div>
    );
  }

  const content = (
    <div className="flex items-start gap-3">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
        aria-hidden="true"
      >
        <Icon size={21} strokeWidth={2} />
      </div>

      <div className="min-w-0 flex-1">
        <p
          title={label}
          className="truncate text-xs font-medium text-slate-500 sm:text-sm"
        >
          {label}
        </p>

        <p
          title={String(value)}
          className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
        >
          {value}
        </p>

        {(trend || comparison) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
            {trend && (
              <span className={`font-semibold ${trendStyle.text}`}>
                <span aria-hidden="true">{trendStyle.arrow}</span>{" "}
                {trend}
              </span>
            )}

            {comparison && (
              <span className="text-slate-400">{comparison}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (isInteractive) {
    return (
      <button
        type="button"
        className={`w-full text-left ${cardClasses}`}
        onClick={onClick}
        aria-label={ariaLabel ?? `${label}: ${value}`}
      >
        {content}
      </button>
    );
  }

  return <div className={cardClasses}>{content}</div>;
}