import { Link, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";

import {
  getNavigationForRole,
  isNavigationItemActive,
} from "../../config/navigation";

import type { UserRole } from "../../types/auth";

interface MobileNavigationProps {
  role?: UserRole | null;
  onNavigate?: () => void;
  onMoreClick?: () => void;
}

const MAX_PRIMARY_ITEMS = 4;

/*
 * Most-used destinations come first. Everything else stays
 * available through the "More" button, which opens the full drawer.
 */
const PRIORITY = [
  "dashboard",
  "leave-management",
  "leave",
  "approvals",
  "employees",
  "team",
  "calendar",
  "reports",
];

function rank(key: string): number {
  const index = PRIORITY.indexOf(key);
  return index === -1 ? PRIORITY.length : index;
}

export function MobileNavigation({
  role,
  onNavigate,
  onMoreClick,
}: MobileNavigationProps) {
  const location = useLocation();

  if (!role) {
    return null;
  }

  const navigation = getNavigationForRole(role);

  const primaryNavigation = [...navigation]
    .sort((a, b) => rank(a.key) - rank(b.key))
    .slice(0, onMoreClick ? MAX_PRIMARY_ITEMS : 5);

  if (primaryNavigation.length === 0) {
    return null;
  }

  const baseClass =
    "relative flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-1";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden"
      aria-label="Mobile navigation"
    >
      <div className="mx-auto flex max-w-2xl items-stretch justify-around gap-1">
        {primaryNavigation.map((item) => {
          const Icon = item.icon;
          const active = isNavigationItemActive(location.pathname, item);

          return (
            <Link
              key={item.key}
              to={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              className={`${baseClass} ${
                active
                  ? "bg-[#d8a415]/10 text-[#a47700]"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span className="relative flex h-5 w-6 items-center justify-center">
                <Icon
                  size={20}
                  strokeWidth={active ? 2.3 : 1.9}
                  aria-hidden="true"
                />

                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white"
                    aria-label={`${item.badge} notifications`}
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </span>

              <span
                className={`max-w-full truncate text-[10px] font-medium leading-tight sm:text-[11px] ${
                  active ? "font-semibold" : ""
                }`}
                title={item.label}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        {onMoreClick && (
          <button
            type="button"
            onClick={onMoreClick}
            aria-label="Open full menu"
            className={`${baseClass} text-slate-500 hover:bg-slate-50 hover:text-slate-900`}
          >
            <span className="flex h-5 w-6 items-center justify-center">
              <Menu size={20} strokeWidth={1.9} aria-hidden="true" />
            </span>

            <span className="max-w-full truncate text-[10px] font-medium leading-tight sm:text-[11px]">
              More
            </span>
          </button>
        )}
      </div>
    </nav>
  );
}