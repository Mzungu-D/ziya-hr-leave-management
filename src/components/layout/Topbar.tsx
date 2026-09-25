import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  Menu,
  Search,
  UserRound,
  X,
} from "lucide-react";

import { useAuth } from "../../contexts/AuthContext";

interface TopbarProps {
  userName?: string;
  userRole?: string;
  userInitials?: string;
  userAvatarUrl?: string;
  notificationCount?: number;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  onMenuClick?: () => void;
  onNotificationsClick?: () => void;
  onProfileClick?: () => void;
}

const roleLabels: Record<string, string> = {
  EMPLOYEE: "Employee",
  MANAGER: "Manager",
  HR_ADMIN: "HR Administrator",
  SUPER_ADMIN: "Super Administrator",
};

function getUserInitials(
  firstName?: string,
  lastName?: string,
): string {
  const firstInitial = firstName?.trim().charAt(0) ?? "";
  const lastInitial = lastName?.trim().charAt(0) ?? "";

  const initials = `${firstInitial}${lastInitial}`.toUpperCase();

  if (initials) {
    return initials;
  }

  return "U";
}

function getRoleLabel(role?: string): string {
  if (!role) {
    return "User";
  }

  return roleLabels[role] ?? role.replace(/_/g, " ");
}

export function Topbar({
  userName,
  userRole,
  userInitials,
  userAvatarUrl,
  notificationCount = 0,
  searchValue,
  searchPlaceholder = "Search employees, leave requests, departments...",
  onSearchChange,
  onMenuClick,
  onNotificationsClick,
  onProfileClick,
}: TopbarProps) {
  const { user } = useAuth();

  const authenticatedUserName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : undefined;

  const resolvedUserName =
    userName ??
    authenticatedUserName ??
    "Ziya HR User";

  const resolvedUserRole =
    userRole ??
    getRoleLabel(user?.role);

  const resolvedUserInitials =
    userInitials ??
    getUserInitials(
      user?.firstName,
      user?.lastName,
    );

  const resolvedUserAvatarUrl =
    userAvatarUrl ??
    user?.profilePictureUrl;

  const [internalSearchValue, setInternalSearchValue] =
    useState(searchValue ?? "");

  const searchInputRef =
    useRef<HTMLInputElement>(null);

  const isControlled = searchValue !== undefined;

  const currentSearchValue = isControlled
    ? searchValue
    : internalSearchValue;

  useEffect(() => {
    if (searchValue !== undefined) {
      setInternalSearchValue(searchValue);
    }
  }, [searchValue]);

  /*
   * Global search shortcut:
   * Ctrl + K on Windows/Linux
   * Cmd + K on macOS
   */
  useEffect(() => {
    const handleKeyboardShortcut = (
      event: KeyboardEvent,
    ) => {
      const isSearchShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k";

      if (!isSearchShortcut) {
        return;
      }

      event.preventDefault();

      searchInputRef.current?.focus();
    };

    window.addEventListener(
      "keydown",
      handleKeyboardShortcut,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyboardShortcut,
      );
    };
  }, []);

  const handleSearchChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value;

    if (!isControlled) {
      setInternalSearchValue(value);
    }

    onSearchChange?.(value);
  };

  const clearSearch = () => {
    if (!isControlled) {
      setInternalSearchValue("");
    }

    onSearchChange?.("");

    searchInputRef.current?.focus();
  };

  const hasNotifications = notificationCount > 0;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-[0_1px_3px_rgba(15,23,42,0.03)] backdrop-blur">
      <div className="flex min-h-[72px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* Mobile navigation trigger */}
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2 lg:hidden"
          aria-label="Open navigation menu"
          title="Open navigation"
        >
          <Menu
            size={20}
            strokeWidth={2}
          />
        </button>

        {/* Search */}
        <div className="relative min-w-0 flex-1 lg:max-w-[620px]">
          <Search
            size={19}
            strokeWidth={1.9}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />

          <input
            ref={searchInputRef}
            type="search"
            value={currentSearchValue}
            onChange={handleSearchChange}
            placeholder={searchPlaceholder}
            aria-label="Search the HR portal"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-20 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#c89b20] focus:bg-white focus:ring-2 focus:ring-[#c89b20]/10"
          />

          {/* Search controls */}
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {currentSearchValue.length > 0 && (
              <button
                type="button"
                onClick={clearSearch}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20]"
                aria-label="Clear search"
                title="Clear search"
              >
                <X size={15} />
              </button>
            )}

            <kbd className="hidden h-6 items-center rounded-md border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-400 shadow-sm sm:inline-flex">
              Ctrl K
            </kbd>
          </div>
        </div>

        {/* Right-side controls */}
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
          {/* Notifications */}
          <button
            type="button"
            onClick={onNotificationsClick}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2"
            aria-label={
              hasNotifications
                ? `${notificationCount} unread notifications`
                : "Notifications"
            }
            title="Notifications"
          >
            <Bell
              size={21}
              strokeWidth={1.9}
            />

            {hasNotifications && (
              <span
                className="absolute right-1 top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white"
                aria-hidden="true"
              >
                {notificationCount > 99
                  ? "99+"
                  : notificationCount}
              </span>
            )}
          </button>

          {/* Profile */}
          <button
            type="button"
            onClick={onProfileClick}
            className="group flex min-w-0 items-center gap-2 rounded-xl p-1.5 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89b20] focus-visible:ring-offset-2 sm:gap-3"
            aria-label={`Open profile menu for ${resolvedUserName}`}
          >
            {/* Avatar */}
            {resolvedUserAvatarUrl ? (
              <img
                src={resolvedUserAvatarUrl}
                alt={`${resolvedUserName} profile`}
                className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                  event.currentTarget.nextElementSibling?.removeAttribute(
                    "hidden",
                  );
                }}
              />
            ) : null}

            {/* Default avatar / fallback */}
            <div
              hidden={Boolean(resolvedUserAvatarUrl)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 ring-1 ring-slate-200"
              aria-hidden="true"
            >
              {resolvedUserInitials ? (
                resolvedUserInitials
              ) : (
                <UserRound size={16} />
              )}
            </div>

            {/* User information */}
            <div className="hidden min-w-0 text-left sm:block">
              <div
                title={resolvedUserName}
                className="max-w-[180px] truncate text-sm font-semibold text-slate-900"
              >
                {resolvedUserName}
              </div>

              <div
                title={resolvedUserRole}
                className="max-w-[180px] truncate text-xs text-slate-500"
              >
                {resolvedUserRole}
              </div>
            </div>

            <ChevronDown
              size={17}
              strokeWidth={1.8}
              className="hidden shrink-0 text-slate-400 transition-transform group-hover:text-slate-600 sm:block"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </header>
  );
}