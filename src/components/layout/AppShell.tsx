import type { ReactNode } from "react";

import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut, X } from "lucide-react";

import ziyaLogo from "../../assets/zayi.jpg";
import {
  getNavigationForRole,
  isNavigationItemActive,
  supportNavigation,
} from "../../config/navigation";
import { useAuth } from "../../contexts/AuthContext";
import type { UserRole } from "../../types/auth";

import { MobileNavigation } from "./MobileNavigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface AppShellProps {
  children: ReactNode;
}

const DESKTOP_BREAKPOINT = "(min-width: 1024px)";
const SIDEBAR_WIDTH = 248;

function getHomeRoute(role: UserRole): string {
  switch (role) {
    case "EMPLOYEE":
      return "/employee";

    case "MANAGER":
      return "/manager";

    case "HR_ADMIN":
    case "SUPER_ADMIN":
      return "/admin";

    default:
      return "/login";
  }
}

function getUserDisplayName(
  user: NonNullable<ReturnType<typeof useAuth>["user"]>,
): string {
  const fullName = [
    user.firstName?.trim(),
    user.lastName?.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  return fullName || user.email || "User";
}

function getUserInitials(
  user: NonNullable<ReturnType<typeof useAuth>["user"]>,
): string {
  const firstInitial =
    user.firstName?.trim().charAt(0) ?? "";

  const lastInitial =
    user.lastName?.trim().charAt(0) ?? "";

  const initials =
    `${firstInitial}${lastInitial}`.trim();

  if (initials) {
    return initials.toUpperCase();
  }

  return (
    user.email
      ?.trim()
      .charAt(0)
      .toUpperCase() || "U"
  );
}

function getUserRoleLabel(role: UserRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "Super Admin";

    case "HR_ADMIN":
      return "HR Admin";

    case "MANAGER":
      return "Manager";

    case "EMPLOYEE":
      return "Employee";

    default:
      return "User";
  }
}

export function AppShell({
  children,
}: AppShellProps) {
  const location = useLocation();

  const {
    user,
    logout,
    isLoading: authLoading,
  } = useAuth();

  const [
    mobileNavigationOpen,
    setMobileNavigationOpen,
  ] = useState(false);

  const userRole = user?.role ?? null;

  /*
   * Workspace navigation is always derived from the
   * authenticated user's role.
   *
   * This controls presentation only.
   * Backend authorization remains the security authority.
   */
  const workspaceNavigation = useMemo(
    () =>
      userRole
        ? getNavigationForRole(userRole)
        : [],
    [userRole],
  );

  /*
   * Support navigation is also role-aware.
   */
  const visibleSupportNavigation = useMemo(
    () =>
      userRole
        ? supportNavigation.filter((item) =>
            item.roles.includes(userRole),
          )
        : [],
    [userRole],
  );

  const homeRoute = useMemo(
    () =>
      userRole
        ? getHomeRoute(userRole)
        : "/login",
    [userRole],
  );

  const userDisplayName = useMemo(
    () =>
      user
        ? getUserDisplayName(user)
        : "User",
    [user],
  );

  const userInitials = useMemo(
    () =>
      user
        ? getUserInitials(user)
        : "U",
    [user],
  );

  const userRoleLabel = useMemo(
    () =>
      userRole
        ? getUserRoleLabel(userRole)
        : "User",
    [userRole],
  );

  /*
   * Close the mobile drawer whenever navigation occurs.
   */
  useEffect(() => {
    setMobileNavigationOpen(false);
  }, [location.pathname]);

  /*
   * Prevent the page behind the mobile drawer from
   * scrolling while the drawer is open.
   */
  useEffect(() => {
    if (!mobileNavigationOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [mobileNavigationOpen]);

  /*
   * Escape closes the mobile navigation drawer.
   */
  useEffect(() => {
    if (!mobileNavigationOpen) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        setMobileNavigationOpen(false);
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
  }, [mobileNavigationOpen]);

  /*
   * If the viewport changes from mobile/tablet to
   * desktop, automatically close the mobile drawer.
   */
  useEffect(() => {
    const mediaQuery = window.matchMedia(
      DESKTOP_BREAKPOINT,
    );

    const handleViewportChange = (
      event: MediaQueryListEvent,
    ) => {
      if (event.matches) {
        setMobileNavigationOpen(false);
      }
    };

    mediaQuery.addEventListener(
      "change",
      handleViewportChange,
    );

    return () => {
      mediaQuery.removeEventListener(
        "change",
        handleViewportChange,
      );
    };
  }, []);

  /*
   * Sign out through AuthContext.
   *
   * AuthContext owns authentication/session state.
   * We deliberately do not duplicate authentication
   * state inside AppShell.
   */
  const handleSignOut = async () => {
    setMobileNavigationOpen(false);

    try {
      await logout();
    } catch {
      /*
       * AuthContext is responsible for clearing the
       * local authentication state even if the backend
       * logout request fails.
       */
    }
  };

  /*
   * Defensive authentication loading state.
   *
   * ProtectedRoute normally prevents unauthenticated
   * users from reaching AppShell. This additional guard
   * prevents role-sensitive navigation from rendering
   * while authentication state is being restored.
   */
  if (
    authLoading ||
    !user ||
    !userRole
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div
          className="flex flex-col items-center gap-4"
          role="status"
          aria-live="polite"
          aria-label="Loading workspace"
        >
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-md">
            <img
              src={ziyaLogo}
              alt="Ziya HR"
              className="h-full w-full object-contain"
            />
          </div>

          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <span
              className="h-2 w-2 animate-pulse rounded-full bg-[#d8a415]"
              aria-hidden="true"
            />

            Loading your workspace...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-50 text-slate-900">
      {/* ============================================================
          DESKTOP SIDEBAR
         ============================================================ */}

      <Sidebar />

      {/* ============================================================
          MAIN APPLICATION AREA
         ============================================================ */}

      <div
        className="min-h-screen"
        style={{
          paddingLeft: `${SIDEBAR_WIDTH}px`,
        }}
      >
        <Topbar
          onMenuClick={() =>
            setMobileNavigationOpen(true)
          }
        />

        <main
          id="main-content"
          className="w-full px-4 pb-24 pt-4 sm:px-6 md:px-8 lg:px-8 lg:pb-8"
        >
          <div className="mx-auto w-full max-w-[1800px]">
            {children}
          </div>
        </main>
      </div>

      {/* ============================================================
          MOBILE BOTTOM NAVIGATION
         ============================================================ */}

      <MobileNavigation
        role={userRole}
        onNavigate={() =>
          setMobileNavigationOpen(false)
        }
      />

      {/* ============================================================
          MOBILE NAVIGATION DRAWER
         ============================================================ */}

      {mobileNavigationOpen && (
        <>
          {/* Backdrop */}

          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-40 cursor-default bg-slate-950/50 backdrop-blur-[2px] lg:hidden"
            onClick={() =>
              setMobileNavigationOpen(false)
            }
          />

          {/* Drawer */}

          <aside
            className="fixed inset-y-0 left-0 z-50 flex w-[290px] max-w-[88vw] flex-col bg-[#071a35] text-white shadow-2xl lg:hidden"
            aria-label="Mobile navigation menu"
          >
            {/* ======================================================
                DRAWER HEADER
               ====================================================== */}

            <div className="flex h-[82px] shrink-0 items-center justify-between border-b border-white/10 px-4">
              <Link
                to={homeRoute}
                onClick={() =>
                  setMobileNavigationOpen(false)
                }
                className="flex min-w-0 items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8a415]"
                aria-label="Go to workspace dashboard"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg">
                  <img
                    src={ziyaLogo}
                    alt="Ziya HR"
                    className="h-full w-full object-contain"
                  />
                </div>

                <div className="min-w-0">
                  <div className="truncate text-lg font-bold tracking-tight text-white">
                    Ziya HR
                  </div>

                  <div className="mt-0.5 whitespace-nowrap text-[8px] font-medium tracking-[0.14em] text-slate-300">
                    PEOPLE • TIME • TOGETHER
                  </div>
                </div>
              </Link>

              <button
                type="button"
                onClick={() =>
                  setMobileNavigationOpen(false)
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8a415]"
                aria-label="Close navigation menu"
              >
                <X
                  size={20}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </button>
            </div>

            {/* ======================================================
                DRAWER CONTENT
               ====================================================== */}

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
              <div className="mb-3 px-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Workspace
                </p>
              </div>

              <nav
                aria-label="Mobile workspace navigation"
              >
                <div className="space-y-1">
                  {workspaceNavigation.map(
                    (item) => {
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
                          onClick={() =>
                            setMobileNavigationOpen(
                              false,
                            )
                          }
                          aria-current={
                            active
                              ? "page"
                              : undefined
                          }
                          className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8a415] ${
                            active
                              ? "bg-[#d8a415] text-white shadow-lg shadow-[#d8a415]/20"
                              : "text-slate-300 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <Icon
                            size={19}
                            strokeWidth={
                              active ? 2.2 : 1.8
                            }
                            className="shrink-0"
                            aria-hidden="true"
                          />

                          <span className="min-w-0 flex-1 truncate">
                            {item.label}
                          </span>

                          {item.badge !==
                            undefined && (
                            <span
                              className={`flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                                active
                                  ? "bg-white text-[#b88900]"
                                  : "bg-red-500 text-white"
                              }`}
                              aria-label={`${item.badge} notifications`}
                            >
                              {item.badge > 99
                                ? "99+"
                                : item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    },
                  )}
                </div>
              </nav>
            </div>

            {/* ======================================================
                DRAWER FOOTER
               ====================================================== */}

            <div className="shrink-0 border-t border-white/10 bg-[#071a35] p-3">
              <nav aria-label="Support navigation">
                {visibleSupportNavigation.map(
                  (item) => {
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
                        onClick={() =>
                          setMobileNavigationOpen(
                            false,
                          )
                        }
                        aria-current={
                          active
                            ? "page"
                            : undefined
                        }
                        className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8a415] ${
                          active
                            ? "bg-white/10 text-white"
                            : "text-slate-300 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <Icon
                          size={19}
                          strokeWidth={1.8}
                          className="shrink-0"
                          aria-hidden="true"
                        />

                        <span className="truncate">
                          {item.label}
                        </span>
                      </Link>
                    );
                  },
                )}
              </nav>

              {/* ====================================================
                  MOBILE USER
                 ==================================================== */}

              <div className="mt-3 border-t border-white/10 pt-3">
                <div className="mb-2 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#d8a415] text-xs font-bold text-white"
                    aria-hidden="true"
                  >
                    {user.profilePictureUrl ? (
                      <img
                        src={
                          user.profilePictureUrl
                        }
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      userInitials
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {userDisplayName}
                    </p>

                    <p className="truncate text-xs text-slate-400">
                      {userRoleLabel}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-300 transition hover:bg-red-500/10 hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                  aria-label="Sign out of Ziya HR"
                >
                  <LogOut
                    size={19}
                    strokeWidth={1.8}
                    className="shrink-0"
                    aria-hidden="true"
                  />

                  <span className="truncate">
                    Sign Out
                  </span>
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}