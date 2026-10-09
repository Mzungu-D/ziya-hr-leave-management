import {
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FileText,
  HelpCircle,
  Home,
  Users,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";
import type { UserRole } from "../types/auth";

export interface NavigationItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  description?: string;
  roles: UserRole[];
}

/**
 * HR/Admin workspace navigation.
 *
 * This is intentionally limited to the approved HR/Admin workspace:
 * Dashboard
 * Employees
 * Leave Management
 * Leave Types
 * Approvals
 * Policies
 * Departments
 * Holidays & Calendar
 * Reports & Analytics
 *
 * Settings, audit logs, notifications and user administration are
 * not exposed through this primary workspace navigation.
 *
 * Backend authorization remains the security authority. These role
 * definitions control presentation only.
 */
export const adminNavigation: NavigationItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/admin",
    icon: Home,
    description: "HR overview and key workforce information",
    roles: ["HR_ADMIN", "SUPER_ADMIN"],
  },
  {
    key: "employees",
    label: "Employees",
    href: "/admin/employees",
    icon: Users,
    description: "Employee directory and workforce records",
    roles: ["HR_ADMIN", "SUPER_ADMIN"],
  },
  {
    key: "leave-management",
    label: "Leave Management",
    href: "/admin/leave",
    icon: CalendarDays,
    description: "Manage leave requests, balances and leave activity",
    roles: ["HR_ADMIN", "SUPER_ADMIN"],
  },
  {
    key: "leave-types",
    label: "Leave Types",
    href: "/admin/leave-types",
    icon: FileText,
    description: "Configure available leave types and entitlements",
    roles: ["HR_ADMIN", "SUPER_ADMIN"],
  },
  {
    key: "approvals",
    label: "Approvals",
    href: "/admin/approvals",
    icon: ClipboardCheck,
    description: "Review and process pending leave requests",
    roles: ["HR_ADMIN", "SUPER_ADMIN"],
  },
  {
    key: "policies",
    label: "Policies",
    href: "/admin/policies",
    icon: FileText,
    description: "Configure leave policies and entitlement rules",
    roles: ["HR_ADMIN", "SUPER_ADMIN"],
  },
  {
    key: "departments",
    label: "Departments",
    href: "/admin/departments",
    icon: Building2,
    description: "Manage departments and reporting structures",
    roles: ["HR_ADMIN", "SUPER_ADMIN"],
  },
  {
    key: "holidays",
    label: "Holidays & Calendar",
    href: "/admin/holidays",
    icon: CalendarDays,
    description: "Manage public holidays and organizational calendar",
    roles: ["HR_ADMIN", "SUPER_ADMIN"],
  },
  {
    key: "reports",
    label: "Reports & Analytics",
    href: "/admin/reports",
    icon: BarChart3,
    description: "Workforce and leave analytics",
    roles: ["HR_ADMIN", "SUPER_ADMIN"],
  },
];

/**
 * Employee workspace navigation.
 */
export const employeeNavigation: NavigationItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/employee",
    icon: Home,
    description: "Your HR overview",
    roles: ["EMPLOYEE"],
  },
  {
    key: "leave",
    label: "My Leave",
    href: "/employee/leave",
    icon: CalendarDays,
    description: "Apply for and manage your leave",
    roles: ["EMPLOYEE"],
  },
  {
    key: "calendar",
    label: "Calendar",
    href: "/employee/calendar",
    icon: CalendarDays,
    description: "View your leave and important dates",
    roles: ["EMPLOYEE"],
  },
  {
    key: "team",
    label: "My Team",
    href: "/employee/team",
    icon: Users,
    description: "View your team members",
    roles: ["EMPLOYEE"],
  },
];

/**
 * Manager workspace navigation.
 */
export const managerNavigation: NavigationItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/manager",
    icon: Home,
    description: "Team overview and leave activity",
    roles: ["MANAGER"],
  },
  {
    key: "team",
    label: "My Team",
    href: "/manager/team",
    icon: Users,
    description: "View and manage your team",
    roles: ["MANAGER"],
  },
  {
    key: "approvals",
    label: "Leave Approvals",
    href: "/manager/approvals",
    icon: ClipboardCheck,
    description: "Review your team's leave requests",
    roles: ["MANAGER"],
  },
  {
    key: "calendar",
    label: "Team Calendar",
    href: "/manager/calendar",
    icon: CalendarDays,
    description: "View team leave and important dates",
    roles: ["MANAGER"],
  },
  {
    key: "reports",
    label: "Reports",
    href: "/manager/reports",
    icon: BarChart3,
    description: "Team leave reports and analytics",
    roles: ["MANAGER"],
  },
];

/**
 * Shared support navigation.
 *
 * This is rendered separately from the workspace navigation so
 * Help & Support remains visually separated from the main modules.
 */
export const supportNavigation: NavigationItem[] = [
  {
    key: "help",
    label: "Help & Support",
    href: "/help",
    icon: HelpCircle,
    description: "Get help with the HR system",
    roles: ["EMPLOYEE", "MANAGER", "HR_ADMIN", "SUPER_ADMIN"],
  },
];

export const navigationGroups = {
  admin: adminNavigation,
  employee: employeeNavigation,
  manager: managerNavigation,
  support: supportNavigation,
} as const;

/**
 * Returns only the primary workspace navigation permitted for
 * the authenticated user's role.
 *
 * The returned navigation is presentation-level only.
 * API/backend authorization must independently enforce access.
 */
export function getNavigationForRole(
  role: UserRole,
): NavigationItem[] {
  switch (role) {
    case "EMPLOYEE":
      return employeeNavigation;

    case "MANAGER":
      return managerNavigation;

    case "HR_ADMIN":
    case "SUPER_ADMIN":
      return adminNavigation;

    default:
      return [];
  }
}

/**
 * Determines whether a navigation item represents the current route.
 *
 * Root workspace routes require an exact match so `/admin` does
 * not incorrectly remain active on `/admin/employees`.
 *
 * Child routes remain active for nested URLs, for example:
 * `/admin/employees/123`
 * remains active under Employees.
 */
export function isNavigationItemActive(
  currentPath: string,
  item: NavigationItem,
): boolean {
  const normalizedCurrentPath = normalizePath(currentPath);
  const normalizedItemPath = normalizePath(item.href);

  const workspaceRoots = new Set([
    "/admin",
    "/employee",
    "/manager",
  ]);

  if (workspaceRoots.has(normalizedItemPath)) {
    return normalizedCurrentPath === normalizedItemPath;
  }

  return (
    normalizedCurrentPath === normalizedItemPath ||
    normalizedCurrentPath.startsWith(`${normalizedItemPath}/`)
  );
}

/**
 * Normalizes application paths before route comparison.
 *
 * This prevents trailing-slash differences from breaking active
 * navigation state while preserving the root `/`.
 */
function normalizePath(path: string): string {
  if (!path || path === "/") {
    return "/";
  }

  const withoutTrailingSlash = path.replace(/\/+$/, "");

  return withoutTrailingSlash || "/";
}