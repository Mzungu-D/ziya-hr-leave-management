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

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();

  const {
    user,
    logout,
    isLoading: authLoading,
  } = useAuth();

  const [mobileNavigationOpen, setMobileNavigationOpen] =
    useState(false);

  /*
   * ProtectedRoute is responsible for preventing unauthenticated
   * users from reaching AppShell.
   *
   * While authentication state is still being restored, keep the
   * shell from making assumptions about the user's role.
   */
  const userRole = user?.role ?? null;

  /*
   * Navigation is derived exclusively from the authenticated user's
   * role. The frontend uses this for presentation only; backend
   * authorization remains the security authority.
   */
  const workspaceNavigation = useMemo(
    () =>
      userRole
        ? getNavigationForRole(userRole)
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

  /*
   * Close the mobile drawer whenever the route changes.
   */
  useEffect(() => {
    setMobileNavigationOpen(false);
  }, [location.pathname]);

  /*
   * Prevent background scrolling while the mobile navigation drawer
   * is open.
   *
   * The previous inline overflow value is restored on cleanup so
   * AppShell never permanently changes the application's body state.
   */
  useEffect(() => {
    if (!mobileNavigationOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavigationOpen]);

  /*
   * Close the drawer with Escape.
   */
  useEffect(() => {
    if (!mobileNavigationOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNavigationOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileNavigationOpen]);

  /*
   * If the user rotates a device or resizes the browser from mobile
   * to desktop while the drawer is open, close the drawer and restore
   * normal page scrolling.
   */
  useEffect(() => {
    const mediaQuery = window.matchMedia(
      "(min-width: 1024px)",
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
   * AuthContext owns session invalidation and local auth state.
   * ProtectedRoute will handle redirecting to /login once the
   * authenticated state becomes false.
   */
  const handleSignOut = async () => {
    setMobileNavigationOpen(false);

    try {
      await logout();
    } catch {
      /*
       * Logout errors are intentionally not surfaced here.
       * AuthContext remains responsible for clearing the local
       * session state even when the backend request fails.
       */
    }
  };

  /*
   * During session restoration, ProtectedRoute normally prevents
   * this component from rendering. This defensive guard prevents
   * role-sensitive navigation from being rendered without a user.
   */
  if (authLoading || !user || !userRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div
          className="flex flex-col items-center gap-4"
          role="status"
          aria-live="polite"
        >
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-md">
            <img
              src={ziyaLogo}
              alt="Ziya logo"
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

      <div className="min-h-screen lg:pl-[248px]">
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
          MOBILE DRAWER
         ============================================================ */}

      {mobileNavigationOpen && (
        <>
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] lg:hidden"
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
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg">
                  <img
                    src={ziyaLogo}
                    alt="Ziya logo"
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

              <nav aria-label="Mobile workspace navigation">
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
                {supportNavigation.map(
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

              <button
                type="button"
                onClick={handleSignOut}
                className="mt-1 flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-300 transition hover:bg-red-500/10 hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
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
          </aside>
        </>
      )}
    </div>
  );
}