import { useEffect, useMemo, useState } from "react";

import { Link, useLocation } from "react-router-dom";

import { LogOut, UserRound } from "lucide-react";

import ziyaLogo from "../../assets/zayi.jpg";

import {
  getNavigationForRole,
  isNavigationItemActive,
  supportNavigation,
} from "../../config/navigation";

import { useAuth } from "../../contexts/AuthContext";

const SIDEBAR_BACKGROUND = "#071a35";
const ACTIVE_BACKGROUND = "#d8a415";

const roleLabels: Record<string, string> = {
  EMPLOYEE: "Employee",
  MANAGER: "Manager",
  HR_ADMIN: "HR Administrator",
  SUPER_ADMIN: "Super Administrator",
};

function getUserDisplayName(
  firstName?: string | null,
  lastName?: string | null,
): string {
  const name = [firstName, lastName]
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    )
    .map((value) => value.trim())
    .join(" ");

  return name || "Ziya HR User";
}

function getUserInitials(
  firstName?: string | null,
  lastName?: string | null,
): string {
  const firstInitial =
    typeof firstName === "string"
      ? firstName.trim().charAt(0)
      : "";

  const lastInitial =
    typeof lastName === "string"
      ? lastName.trim().charAt(0)
      : "";

  const initials = `${firstInitial}${lastInitial}`.toUpperCase();

  return initials || "U";
}

function getRoleLabel(role?: string | null): string {
  if (!role) {
    return "User";
  }

  return (
    roleLabels[role] ??
    role
      .replace(/\_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
}

function getHomeRoute(role?: string | null): string {
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

export function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  /*
   * Navigation is derived exclusively from the authenticated user's
   * role. The frontend controls presentation only; backend
   * authorization remains the security authority.
   */
  const workspaceNavigation = useMemo(
    () => (user ? getNavigationForRole(user.role) : []),
    [user],
  );

  const visibleSupportNavigation = useMemo(
    () =>
      user
        ? supportNavigation.filter(
            (item) =>
              !item.roles ||
              item.roles.includes(user.role),
          )
        : [],
    [user],
  );

  const homeRoute = useMemo(
    () => getHomeRoute(user?.role),
    [user?.role],
  );

  const userName = useMemo(
    () =>
      getUserDisplayName(
        user?.firstName,
        user?.lastName,
      ),
    [user?.firstName, user?.lastName],
  );

  const userRole = useMemo(
    () => getRoleLabel(user?.role),
    [user?.role],
  );

  const userInitials = useMemo(
    () =>
      getUserInitials(
        user?.firstName,
        user?.lastName,
      ),
    [user?.firstName, user?.lastName],
  );

  const avatarUrl =
    typeof user?.profilePictureUrl === "string" &&
    user.profilePictureUrl.trim().length > 0
      ? user.profilePictureUrl.trim()
      : undefined;

  /*
   * If the authenticated user changes or their profile picture changes,
   * allow the new image to load again.
   */
  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  const showAvatar =
    Boolean(avatarUrl) && !avatarFailed;

  /*
   * Sign out through AuthContext.
   *
   * AuthContext owns session invalidation and authentication state.
   * The sidebar only controls the button state while the request is
   * being processed.
   */
  const handleSignOut = async (): Promise<void> => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);

    try {
      await logout();
    } catch {
      /*
       * AuthContext is responsible for authentication state.
       *
       * We intentionally do not manufacture a local redirect or
       * client-side session state here. If the backend request fails,
       * the authentication context remains the source of truth.
       */
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col overflow-hidden bg-[#071a35] text-white lg:flex"
      style={{ backgroundColor: SIDEBAR_BACKGROUND }}
      aria-label="ziya People & Culture navigation"
    >
      {/* ============================================================
          BRAND
          ============================================================ */}
      <div className="flex h-[82px] shrink-0 items-center border-b border-white/10 px-5">
        <Link
          to={homeRoute}
          aria-label="ziya People & Culture home"
          className="flex min-w-0 items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8a415] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071a35]"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg">
            <img
              src={ziyaLogo}
              alt="ziya People & Culture"
              width={44}
              height={44}
              decoding="async"
              className="h-full w-full object-contain"
            />
          </div>

          <div className="min-w-0">
            <div className="truncate text-xl font-bold tracking-tight text-white">
              ziya
            </div>

            <div className="mt-0.5 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
              People &amp; Culture
            </div>
          </div>
        </Link>
      </div>

      {/* ============================================================
          WORKSPACE NAVIGATION
          ============================================================ */}
      <nav
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-5 [scrollbar-color:rgba(255,255,255,0.2)_transparent] [scrollbar-width:thin]"
        aria-label="Workspace navigation"
      >
        <div className="mb-3 px-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Workspace
          </p>
        </div>

        <div className="space-y-1">
          {workspaceNavigation.map((item) => {
            const Icon = item.icon;

            const active = isNavigationItemActive(
              location.pathname,
              item,
            );

            return (
              <Link
                key={item.key}
                to={item.href}
                aria-current={active ? "page" : undefined}
                title={item.description ?? item.label}
                className={`group flex min-h-[46px] w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8a415] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071a35] ${
                  active
                    ? "bg-[#d8a415] text-white shadow-lg shadow-[#d8a415]/20"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
                style={
                  active
                    ? {
                        backgroundColor:
                          ACTIVE_BACKGROUND,
                      }
                    : undefined
                }
              >
                <Icon
                  size={19}
                  strokeWidth={active ? 2.2 : 1.8}
                  className="shrink-0"
                  aria-hidden="true"
                />

                <span className="min-w-0 flex-1 truncate">
                  {item.label}
                </span>

                {item.badge !== undefined && (
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
          })}
        </div>
      </nav>

      {/* ============================================================
          SUPPORT + USER + SIGN OUT
          ============================================================ */}
      <div className="shrink-0 border-t border-white/10 bg-[#071a35] p-3">
        {/* Support */}
        <div className="mb-2">
          {visibleSupportNavigation.map((item) => {
            const Icon = item.icon;

            const active = isNavigationItemActive(
              location.pathname,
              item,
            );

            return (
              <Link
                key={item.key}
                to={item.href}
                aria-current={active ? "page" : undefined}
                title={item.description ?? item.label}
                className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8a415] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071a35] ${
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

                <span className="min-w-0 flex-1 truncate">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* ==========================================================
            AUTHENTICATED USER
            ========================================================== */}
        <div className="my-3 flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5">
          {showAvatar ? (
            <img
              src={avatarUrl}
              alt={`${userName} profile`}
              width={40}
              height={40}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-white/20"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white ring-1 ring-white/20"
              aria-hidden="true"
            >
              {userInitials || (
                <UserRound size={18} />
              )}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p
              className="truncate text-sm font-semibold text-white"
              title={userName}
            >
              {userName}
            </p>

            <p
              className="mt-0.5 truncate text-xs text-slate-400"
              title={userRole}
            >
              {userRole}
            </p>
          </div>
        </div>

        {/* ==========================================================
            SIGN OUT
            ========================================================== */}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          aria-label={
            isSigningOut
              ? "Signing out of ziya People & Culture"
              : "Sign out of ziya People & Culture"
          }
          aria-busy={isSigningOut}
          className="mt-1 flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-300 transition-colors duration-150 hover:bg-red-500/10 hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071a35] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut
            size={19}
            strokeWidth={1.8}
            className="shrink-0"
            aria-hidden="true"
          />

          <span className="min-w-0 truncate">
            {isSigningOut
              ? "Signing Out..."
              : "Sign Out"}
          </span>
        </button>
      </div>
    </aside>
  );
}