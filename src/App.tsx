import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { ProtectedRoute } from "./components/auth/ProtectedRoute";

import { AppShell } from "./components/layout/AppShell";

import { AuthProvider } from "./contexts/AuthContext";

import { AdminDashboard } from "./pages/admin/AdminDashboard";

import { Approvals } from "./pages/admin/Approvals";

import AuditLogs from "./pages/admin/AuditLogs";

import { Departments } from "./pages/admin/Departments";

import { Employees } from "./pages/admin/Employees";

import { HolidaysCalendar } from "./pages/admin/HolidaysCalendar";

import {
  LeaveManagement as AdminLeaveManagement,
} from "./pages/admin/LeaveManagement";

import { LeaveTypes } from "./pages/admin/LeaveTypes";

import { Policies } from "./pages/admin/Policies";

import { Reports } from "./pages/admin/Reports";

import SystemSettings from "./pages/admin/SystemSettings";

import { Login } from "./pages/auth/Login";

import ApplyLeave from "./pages/employee/ApplyLeave";

import { EmployeeDashboard } from "./pages/employee/EmployeeDashboard";

import { LeaveManagement } from "./pages/employee/LeaveManagement";

import { ManagerDashboard } from "./pages/manager/ManagerDashboard";

import { ManagerApprovals } from "./pages/manager/ManagerApprovals";

import Team from "./pages/manager/Team";

import { ManagerCalendar } from "./pages/manager/ManagerCalendar";

import { ManagerReports } from "./pages/manager/ManagerReports";

import { HelpSupport } from "./pages/HelpSupport";

import Notifications from "./pages/Notifications";

import ziyaLogo from "./assets/zayi.jpg";

import leaveManagementCover from "./assets/LEAVE.png";

/* ============================================================
   PUBLIC WELCOME PAGE
============================================================ */

function WelcomePage() {
  return (
    <main className="relative flex min-h-screen w-full flex-col overflow-hidden bg-[#071a35]">
      {/* Full cover image.
          object-contain preserves the complete original image
          without cropping or stretching it. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={leaveManagementCover}
          alt="Ziya People welcome cover"
          className="h-full w-full object-contain object-center"
        />
      </div>

      {/* Subtle background treatment behind the image */}
      <div
        className="pointer-events-none absolute inset-0 bg-[#071a35]/10"
        aria-hidden="true"
      />

      {/* Welcome page header */}
      <header className="relative z-10 flex w-full items-center justify-between gap-4 px-5 py-4 sm:px-8 sm:py-6 lg:px-12">
        <Link
          to="/"
          aria-label="Ziya People home"
          className="flex min-w-0 items-center gap-3 rounded-xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#d8a415] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071a35]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg sm:h-11 sm:w-11">
            <img
              src={ziyaLogo}
              alt="Ziya logo"
              className="h-full w-full object-contain"
            />
          </span>

          <span className="min-w-0">
            <span className="block truncate text-base font-bold tracking-tight text-white sm:text-lg">
              Ziya People
            </span>

            <span className="hidden text-[10px] font-semibold tracking-[0.18em] text-slate-200 sm:block">
              PEOPLE · TIME · TOGETHER
            </span>
          </span>
        </Link>

        {/* Small sign-in button */}
        <Link
          to="/login"
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-white/30 bg-[#d8a415] px-4 py-2 text-sm font-semibold text-[#071a35] shadow-md transition-colors hover:bg-[#edbd36] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#071a35] sm:px-5"
        >
          Sign in
        </Link>
      </header>

      {/* Accessible page description */}
      <section className="sr-only" aria-label="Welcome to Ziya People">
        <h1>Welcome to Ziya People</h1>
        <p>
          Your employee leave management workspace.
          Sign in to continue to your account.
        </p>
        <Link to="/login">Sign in to Ziya People</Link>
      </section>
    </main>
  );
}

/* ============================================================
   APPLICATION ROUTES
============================================================ */

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* =====================================================
              PUBLIC ROUTES
          ====================================================== */}

          {/* Public welcome page */}
          <Route
            path="/"
            element={<WelcomePage />}
          />

          {/* Existing authentication flow */}
          <Route
            path="/login"
            element={<Login />}
          />

          {/* =====================================================
              EMPLOYEE WORKSPACE
          ====================================================== */}

          <Route
            path="/employee"
            element={
              <ProtectedRoute
                allowedRoles={["EMPLOYEE"]}
              >
                <AppShell>
                  <EmployeeDashboard />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/employee/apply-leave"
            element={
              <ProtectedRoute
                allowedRoles={["EMPLOYEE"]}
              >
                <AppShell>
                  <ApplyLeave />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/employee/leave"
            element={
              <ProtectedRoute
                allowedRoles={["EMPLOYEE"]}
              >
                <AppShell>
                  <LeaveManagement />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* =====================================================
              MANAGER WORKSPACE — DASHBOARD
          ====================================================== */}

          <Route
            path="/manager"
            element={
              <ProtectedRoute
                allowedRoles={["MANAGER"]}
              >
                <AppShell>
                  <ManagerDashboard />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* =====================================================
              MANAGER WORKSPACE — LEAVE APPROVALS
          ====================================================== */}

          <Route
            path="/manager/approvals"
            element={
              <ProtectedRoute
                allowedRoles={["MANAGER"]}
              >
                <AppShell>
                  <ManagerApprovals />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* =====================================================
              MANAGER WORKSPACE — MY TEAM
          ====================================================== */}

          <Route
            path="/manager/team"
            element={
              <ProtectedRoute
                allowedRoles={["MANAGER"]}
              >
                <AppShell>
                  <Team />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/manager/calendar"
            element={
              <ProtectedRoute
                allowedRoles={["MANAGER"]}
              >
                <AppShell>
                  <ManagerCalendar />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/manager/reports"
            element={
              <ProtectedRoute
                allowedRoles={["MANAGER"]}
              >
                <AppShell>
                  <ManagerReports />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* =====================================================
              HR / ADMIN WORKSPACE
          ====================================================== */}

          <Route
            path="/admin"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "HR_ADMIN",
                  "SUPER_ADMIN",
                ]}
              >
                <AppShell>
                  <AdminDashboard />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* =====================================================
              HR / ADMIN — EMPLOYEES
          ====================================================== */}

          <Route
            path="/admin/employees"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "HR_ADMIN",
                  "SUPER_ADMIN",
                ]}
              >
                <AppShell>
                  <Employees />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* =====================================================
              HR / ADMIN — LEAVE MANAGEMENT
          ====================================================== */}

          <Route
            path="/admin/leave-management"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "HR_ADMIN",
                  "SUPER_ADMIN",
                ]}
              >
                <AppShell>
                  <AdminLeaveManagement />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* =====================================================
              HR / ADMIN — LEAVE TYPES
          ====================================================== */}

          <Route
            path="/admin/leave-types"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "HR_ADMIN",
                  "SUPER_ADMIN",
                ]}
              >
                <AppShell>
                  <LeaveTypes />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* =====================================================
              HR / ADMIN — LEAVE APPROVALS
              HR MAKES THE FINAL DECISION
          ====================================================== */}

          <Route
            path="/admin/approvals"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "HR_ADMIN",
                  "SUPER_ADMIN",
                ]}
              >
                <AppShell>
                  <Approvals />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* =====================================================
              HR / ADMIN — POLICIES
          ====================================================== */}

          <Route
            path="/admin/policies"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "HR_ADMIN",
                  "SUPER_ADMIN",
                ]}
              >
                <AppShell>
                  <Policies />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* =====================================================
              HR / ADMIN — DEPARTMENTS
          ====================================================== */}

          <Route
            path="/admin/departments"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "HR_ADMIN",
                  "SUPER_ADMIN",
                ]}
              >
                <AppShell>
                  <Departments />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* =====================================================
              HR / ADMIN — HOLIDAYS & CALENDAR
          ====================================================== */}

          <Route
            path="/admin/holidays"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "HR_ADMIN",
                  "SUPER_ADMIN",
                ]}
              >
                <AppShell>
                  <HolidaysCalendar />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* =====================================================
              HR / ADMIN — REPORTS & ANALYTICS
          ====================================================== */}

          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "HR_ADMIN",
                  "SUPER_ADMIN",
                ]}
              >
                <AppShell>
                  <Reports />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* =====================================================
              HR / ADMIN — SYSTEM SETTINGS
          ====================================================== */}

          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "HR_ADMIN",
                  "SUPER_ADMIN",
                ]}
              >
                <AppShell>
                  <SystemSettings />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* =====================================================
              HR / ADMIN — AUDIT LOGS
          ====================================================== */}

          <Route
            path="/admin/audit-logs"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "HR_ADMIN",
                  "SUPER_ADMIN",
                ]}
              >
                <AppShell>
                  <AuditLogs />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* =====================================================
              EMPLOYEE NOTIFICATIONS
          ====================================================== */}

          <Route
            path="/employee/notifications"
            element={
              <ProtectedRoute
                allowedRoles={["EMPLOYEE"]}
              >
                <AppShell>
                  <Notifications />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* =====================================================
              MANAGER NOTIFICATIONS
          ====================================================== */}

          <Route
            path="/manager/notifications"
            element={
              <ProtectedRoute
                allowedRoles={["MANAGER"]}
              >
                <AppShell>
                  <Notifications />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* =====================================================
              HR / ADMIN NOTIFICATIONS
          ====================================================== */}

          <Route
            path="/admin/notifications"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "HR_ADMIN",
                  "SUPER_ADMIN",
                ]}
              >
                <AppShell>
                  <Notifications />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* =====================================================
              HELP & SUPPORT
          ====================================================== */}

          <Route
            path="/help"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "EMPLOYEE",
                  "MANAGER",
                  "HR_ADMIN",
                  "SUPER_ADMIN",
                ]}
              >
                <AppShell>
                  <HelpSupport />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* =====================================================
              UNKNOWN ROUTES
          ====================================================== */}

          <Route
            path="*"
            element={
              <Navigate
                to="/"
                replace
              />
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
