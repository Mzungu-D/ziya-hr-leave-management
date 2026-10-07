import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AppShell } from "./components/layout/AppShell";
import { AuthProvider } from "./contexts/AuthContext";

import { Login } from "./pages/auth/Login";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { LeaveTypes } from "./pages/admin/LeaveTypes";
import { EmployeeDashboard } from "./pages/employee/EmployeeDashboard";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* =====================================================
              Public Routes
          ====================================================== */}

          <Route
            path="/login"
            element={<Login />}
          />

          {/* =====================================================
              Employee Workspace
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

          {/* =====================================================
              HR / Admin Workspace
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
              Leave Types
              -----------------------------------------------------
              Leave Types are organization-scoped by the backend.
              The frontend does not accept or send organizationId.
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
              Application Root
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
              Unknown Routes
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