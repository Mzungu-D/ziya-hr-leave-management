import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut, UserRound } from "lucide-react";

import ziyaLogo from "../../assets/zayi.jpg";
import {
  getNavigationForRole,
  isNavigationItemActive,
  supportNavigation,
} from "../../config/navigation";
import { useAuth } from "../../contexts/AuthContext";

const roleLabels: Record<string, string> = {
  EMPLOYEE: "Employee",
  MANAGER: "Manager",
  HR_ADMIN: "HR Administrator",
  SUPER_ADMIN: "Super Administrator",
};

export function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  /*
   * Do not show administrator navigation when the authenticated
   * user's role is unavailable.
   */
  const workspaceNavigation = user
    ? getNavigationForRole(user.role)
    : [];

  const homeRoute =
    user?.role === "EMPLOYEE"
      ? "/employee"
      : user?.role === "MANAGER"
        ? "/manager"
        : "/admin";

  const userName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : "Ziya HR User";

  const userRole = user
    ? (roleLabels[user.role] ?? user.role.replace(/_/g, " "))
    : "User";

  const userInitials = user
    ? `${user.firstName.trim().charAt(0)}${user.lastName
        .trim()
        .charAt(0)}`.toUpperCase() || "U"
    : "U";

  const avatarUrl = user?.profilePictureUrl;

  const showAvatar = Boolean(avatarUrl) && !avatarFailed;

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);

    try {
      await logout();
    } catch {
      /*
       * Keep the button available if the logout request fails.
       * AuthContext owns session invalidation and error handling.
       */
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col overflow-hidden bg-[#071a35] text-white lg:flex">
      {/* Brand */}
      <div className="flex h-[82px] shrink-0 items-center border-b border-white/10 px-5">
        <Link
          to={homeRoute}
          className="flex min-w-0 items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8a415] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071a35]"
          aria-label="Ziya HR Dashboard"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg">
            <img
              src={ziyaLogo}
              alt="Ziya logo"
              className="h-full w-full object-contain"
            />
          </div>

          <div className="min-w-0">
            <div className="truncate text-xl font-bold tracking-tight text-white">
              Ziya HR
            </div>

            <div className="mt-0.5 whitespace-nowrap text-[10px] font-medium tracking-[0.18em] text-slate-300">
              PEOPLE • TIME • TOGETHER
            </div>
          </div>
        </Link>
      </div>

      {/* Main navigation */}
      <nav
        className="min-h-0 flex-1 overflow-y-auto px-3 py-5 [scrollbar-color:rgba(255,255,255,0.2)_transparent] [scrollbar-width:thin]"
        aria-label="Main navigation"
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
                title={item.description}
                className={`group flex min-h-[46px] w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8a415] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071a35] ${
                  active
                    ? "bg-[#d8a415] text-white shadow-lg shadow-[#d8a415]/20"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
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
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom navigation */}
      <div className="shrink-0 border-t border-white/10 bg-[#071a35] p-3">
        <div className="mb-1">
          {supportNavigation.map((item) => {
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
                title={item.description}
                className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8a415] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071a35] ${
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

                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Authenticated user */}
        <div className="my-3 flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5">
          {showAvatar ? (
            <img
              key={avatarUrl}
              src={avatarUrl}
              alt={`${userName} profile`}
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-white/20"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white ring-1 ring-white/20"
              aria-hidden="true"
            >
              {userInitials || <UserRound size={18} />}
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

        {/* Sign out */}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="mt-1 flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-300 transition hover:bg-red-500/10 hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071a35] disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Sign out of Ziya HR"
        >
          <LogOut
            size={19}
            strokeWidth={1.8}
            className="shrink-0"
            aria-hidden="true"
          />

          <span className="truncate">
            {isSigningOut ? "Signing Out..." : "Sign Out"}
          </span>
        </button>
      </div>
    </aside>
  );
}