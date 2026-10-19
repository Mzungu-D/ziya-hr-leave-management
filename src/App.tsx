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

import leaveManagementCover from "./assets/LEAVE.png";
import ziyaLogo from "./assets/zayi.jpg";

/* ============================================================
   PUBLIC WELCOME PAGE
============================================================ */

function WelcomePage() {
  return (
    <main className="relative flex min-h-screen w-full items-center overflow-hidden bg-[#071a35]">
      <img
        src={leaveManagementCover}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />

      <div className="absolute inset-0 bg-gradient-to-r from-[#071a35]/95 via-[#071a35]/70 to-[#071a35]/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#071a35]/60 via-transparent to-[#071a35]/20" />

      <div className="relative z-10 flex min-h-screen w-full flex-col p-6 sm:p-10 lg:p-14">
        <header className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg">
            <img
              src={ziyaLogo}
              alt="Ziya logo"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight text-white sm:text-xl">
              Ziya People and Culture
            </p>
            <p className="mt-1 text-[10px] font-semibold tracking-[0.2em] text-slate-200">
              PEOPLE · CULTURE · GROWTH
            </p>
          </div>
        </header>

        <section className="my-auto max-w-2xl py-16">
          <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#f1c43b] backdrop-blur">
            Employee experience
          </span>

          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Empowering people.
            <span className="block text-[#f1c43b]">Building stronger organisations.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-slate-200 sm:text-lg">
            One secure workspace for leave management, employee services, and connected teams.
          </p>

          <Link
            to="/login"
            className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#d8a415] px-7 py-3 font-semibold text-[#071a35] shadow-lg transition-colors hover:bg-[#edbd36] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#071a35]"
          >
            Sign in to continue
          </Link>
        </section>

        <footer className="text-xs font-medium tracking-wide text-white/75">
          Ziya People and Culture · People first. Always.
        </footer>
      </div>
    </main>
  );
}
/* ============================================================
   LOGIN PAGE WITH RETURN NAVIGATION

   The existing Login component remains responsible for
   authentication, OTP verification and password recovery.
============================================================ */

function LoginPage() {
  return (
    <>
      <Login />
    </>
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

          {/* Existing authentication flow with back navigation */}
          <Route
            path="/login"
            element={<LoginPage />}
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
              MANAGER WORKSPACE â€” DASHBOARD
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
              MANAGER WORKSPACE â€” LEAVE APPROVALS
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
              MANAGER WORKSPACE â€” MY TEAM
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
              HR / ADMIN â€” EMPLOYEES
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
              HR / ADMIN â€” LEAVE MANAGEMENT
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
              HR / ADMIN â€” LEAVE TYPES
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
              HR / ADMIN â€” LEAVE APPROVALS
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
              HR / ADMIN â€” POLICIES
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
              HR / ADMIN â€” DEPARTMENTS
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
              HR / ADMIN â€” HOLIDAYS & CALENDAR
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
              HR / ADMIN â€” REPORTS & ANALYTICS
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
              HR / ADMIN â€” SYSTEM SETTINGS
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
              HR / ADMIN â€” AUDIT LOGS
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