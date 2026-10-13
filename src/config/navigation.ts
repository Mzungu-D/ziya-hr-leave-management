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

const WORKSPACE_ROOTS = new Set([
  "/admin",
  "/employee",
  "/manager",
]);

/**
 * HR/Admin workspace navigation.
 *
 * These paths must match the routes registered in App.tsx.
 * Navigation visibility is for presentation only. The backend
 * remains responsible for enforcing authentication and permissions.
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
    href: "/admin/leave-management",
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

/**
 * Central navigation groups.
 */
export const navigationGroups = {
  admin: adminNavigation,
  employee: employeeNavigation,
  manager: managerNavigation,
  support: supportNavigation,
} as const;

/**
 * Return workspace navigation for the authenticated user's role.
 *
 * This function controls UI visibility only. It is not an
 * authorization mechanism.
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
 * Normalize a path for consistent comparisons.
 *
 * Examples:
 * /admin/         -> /admin
 * /admin/leave/   -> /admin/leave
 * /              -> /
 */
function normalizePath(path: string): string {
  if (!path || path === "/") {
    return "/";
  }

  const withoutTrailingSlashes = path.replace(/\/+$/, "");

  return withoutTrailingSlashes || "/";
}

/**
 * Determine whether a navigation item matches the current route.
 *
 * Workspace root routes require an exact match, so the Dashboard
 * item does not remain active on child pages.
 *
 * Nested routes remain active under their parent navigation item.
 */
export function isNavigationItemActive(
  currentPath: string,
  item: NavigationItem,
): boolean {
  const current = normalizePath(currentPath);
  const target = normalizePath(item.href);

  if (WORKSPACE_ROOTS.has(target)) {
    return current === target;
  }

  return current === target || current.startsWith(`${target}/`);
}
