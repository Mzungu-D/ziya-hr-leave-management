import { Link, useLocation } from "react-router-dom";

import {
  getNavigationForRole,
  isNavigationItemActive,
} from "../../config/navigation";

import type { UserRole } from "../../types/auth";

interface MobileNavigationProps {
  role?: UserRole | null;
  onNavigate?: () => void;
}

const MAX_PRIMARY_ITEMS = 5;

export function MobileNavigation({
  role,
  onNavigate,
}: MobileNavigationProps) {
  const location = useLocation();

  /*
   * Do not assume a role.
   *
   * During authentication/session restoration there may be
   * no authenticated role yet. In that state the component
   * renders nothing rather than exposing administrator
   * navigation by default.
   */
  if (!role) {
    return null;
  }

  /*
   * Navigation is centrally controlled by the authenticated
   * user's role.
   *
   * The backend remains the final authorization authority.
   * This component only controls the mobile presentation layer.
   */
  const navigation = getNavigationForRole(role);

  /*
   * The bottom navigation is intentionally limited to the
   * highest-frequency destinations.
   *
   * The complete role-specific navigation remains available
   * through the mobile drawer in AppShell.
   */
  const primaryNavigation = navigation.slice(
    0,
    MAX_PRIMARY_ITEMS,
  );

  /*
   * Do not render an empty navigation bar.
   *
   * This protects against an invalid or incomplete navigation
   * configuration without displaying an unusable mobile shell.
   */
  if (primaryNavigation.length === 0) {
    return null;
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden"
      aria-label="Mobile navigation"
    >
      <div className="mx-auto flex max-w-xl items-stretch justify-around gap-1">
        {primaryNavigation.map((item) => {
          const Icon = item.icon;

          const active =
            isNavigationItemActive(
              location.pathname,
              item,
            );

          return (
            <Link
              key={item.key}
              to={item.href}
              onClick={onNavigate}
              aria-current={
                active ? "page" : undefined
              }
              aria-label={item.label}
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-1 ${
                active
                  ? "bg-[#d8a415]/10 text-[#a47700]"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span className="relative flex h-5 w-6 items-center justify-center">
                <Icon
                  size={20}
                  strokeWidth={
                    active ? 2.3 : 1.9
                  }
                  aria-hidden="true"
                />

                {item.badge !== undefined &&
                  item.badge > 0 && (
                    <span
                      className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white"
                      aria-label={`${item.badge} notifications`}
                    >
                      {item.badge > 99
                        ? "99+"
                        : item.badge}
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
      </div>
    </nav>
  );
}