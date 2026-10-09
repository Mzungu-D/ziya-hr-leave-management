import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AppShell } from "./components/layout/AppShell";
import { AuthProvider } from "./contexts/AuthContext";

import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { Approvals } from "./pages/admin/Approvals";
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

import { ApplyLeave } from "./pages/employee/ApplyLeave";
import { EmployeeDashboard } from "./pages/employee/EmployeeDashboard";
import { LeaveManagement } from "./pages/employee/LeaveManagement";

import { HelpSupport } from "./pages/HelpSupport";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* =====================================================
              PUBLIC ROUTES
          ====================================================== */}

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
              APPLICATION ROOT
          ====================================================== */}

          <Route
            path="/"
            element={
              <Navigate
                to="/login"
                replace
              />
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