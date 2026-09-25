import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FileText,
  HelpCircle,
  Home,
  Settings,
  ShieldCheck,
  UserCog,
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
  roles?: UserRole[];
}

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
    roles: ["HR_ADMIN", "SUPER_ADMIN", "MANAGER"],
  },
  {
    key: "leave-management",
    label: "Leave Management",
    href: "/admin/leave",
    icon: CalendarDays,
    description: "Manage leave requests, balances and policies",
    roles: ["HR_ADMIN", "SUPER_ADMIN", "MANAGER"],
  },
  {
    key: "approvals",
    label: "Approvals",
    href: "/admin/approvals",
    icon: ClipboardCheck,
    description: "Review and process pending leave requests",
    roles: ["HR_ADMIN", "SUPER_ADMIN", "MANAGER"],
  },
  {
    key: "policies",
    label: "Policies",
    href: "/admin/policies",
    icon: FileText,
    description: "Configure leave policies and entitlements",
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
    roles: ["HR_ADMIN", "SUPER_ADMIN", "MANAGER"],
  },
  {
    key: "settings",
    label: "System Settings",
    href: "/admin/settings",
    icon: Settings,
    description: "Configure system-wide HR settings",
    roles: ["HR_ADMIN", "SUPER_ADMIN"],
  },
  {
    key: "audit-logs",
    label: "Audit Logs",
    href: "/admin/audit-logs",
    icon: ShieldCheck,
    description: "Review security and system activity",
    roles: ["HR_ADMIN", "SUPER_ADMIN"],
  },
  {
    key: "notifications",
    label: "Notifications",
    href: "/admin/notifications",
    icon: Bell,
    description: "System and workflow notifications",
    roles: ["EMPLOYEE", "MANAGER", "HR_ADMIN", "SUPER_ADMIN"],
  },
  {
    key: "user-management",
    label: "User Management",
    href: "/admin/users",
    icon: UserCog,
    description: "Manage system users, roles and access",
    roles: ["HR_ADMIN", "SUPER_ADMIN"],
  },
];

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
  {
    key: "notifications",
    label: "Notifications",
    href: "/employee/notifications",
    icon: Bell,
    description: "View your notifications",
    roles: ["EMPLOYEE"],
  },
];

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
  {
    key: "notifications",
    label: "Notifications",
    href: "/manager/notifications",
    icon: Bell,
    description: "View your notifications",
    roles: ["MANAGER"],
  },
];

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
};

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

export function isNavigationItemActive(
  currentPath: string,
  item: NavigationItem,
): boolean {
  const rootPaths = ["/admin", "/employee", "/manager"];

  if (rootPaths.includes(item.href)) {
    return currentPath === item.href;
  }

  return (
    currentPath === item.href ||
    currentPath.startsWith(`${item.href}/`)
  );
}