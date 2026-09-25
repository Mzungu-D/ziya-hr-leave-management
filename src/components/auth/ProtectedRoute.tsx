import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { UserRole } from "../../types/auth";
import { useAuth } from "../../contexts/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

function LoadingScreen() {
  return (
    <div
      className="flex min-h-[60vh] items-center justify-center px-4"
      role="status"
      aria-live="polite"
      aria-label="Checking authentication"
    >
      <div className="flex flex-col items-center text-center">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200" />

          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#d8a415]" />
        </div>

        <p className="mt-4 text-sm font-medium text-slate-700">
          Checking your session...
        </p>

        <p className="mt-1 text-xs text-slate-500">
          Please wait while we securely restore your session.
        </p>
      </div>
    </div>
  );
}

function AccessDenied({
  userRole,
}: {
  userRole: UserRole;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
            />
            <line
              x1="15"
              y1="9"
              x2="9"
              y2="15"
            />
            <line
              x1="9"
              y1="9"
              x2="15"
              y2="15"
            />
          </svg>
        </div>

        <h1 className="mt-5 text-xl font-bold tracking-tight text-slate-900">
          Access restricted
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Your account does not have permission to access
          this area of Ziya HR.
        </p>

        <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Current account role
          </p>

          <p className="mt-1 text-sm font-semibold text-slate-800">
            {formatRole(userRole)}
          </p>
        </div>

        <p className="mt-5 text-xs leading-5 text-slate-400">
          If you believe you should have access, contact your
          HR administrator.
        </p>
      </div>
    </div>
  );
}

function formatRole(role: UserRole): string {
  switch (role) {
    case "EMPLOYEE":
      return "Employee";

    case "MANAGER":
      return "Manager";

    case "HR_ADMIN":
      return "HR Administrator";

    case "SUPER_ADMIN":
      return "Super Administrator";

    default:
      return "User";
  }
}

export function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const location = useLocation();
  const {
    user,
    isAuthenticated,
    isLoading,
  } = useAuth();

  /*
   * Do not make authorization decisions until the existing
   * session has finished restoring.
   */
  if (isLoading) {
    return <LoadingScreen />;
  }

  /*
   * No authenticated session:
   * redirect to login while preserving the requested path.
   */
  if (!isAuthenticated || !user) {
    const returnPath =
      `${location.pathname}${location.search}${location.hash}`;

    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: returnPath,
        }}
      />
    );
  }

  /*
   * Authentication succeeded, but this particular route may
   * be restricted to specific roles.
   */
  if (
    allowedRoles &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(user.role)
  ) {
    return (
      <AccessDenied
        userRole={user.role}
      />
    );
  }

  return <>{children}</>;
}