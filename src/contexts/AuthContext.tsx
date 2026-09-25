import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getCurrentSession,
  login as loginRequest,
  logout as logoutRequest,
  refreshSession,
  requestOtp,
  requestPasswordReset,
  resetPassword,
  verifyOtp,
} from "../services/auth.service";

import type {
  AuthenticatedUser,
  CurrentUserContext,
  LoginCredentials,
  LoginResponse,
  LogoutResponse,
  OtpRequest,
  OtpVerification,
  PasswordResetConfirmation,
  PasswordResetRequest,
  PermissionSet,
} from "../types/auth";

interface AuthProviderProps {
  children: React.ReactNode;
}

type LoginMode = "EMAIL" | "PHONE";

interface AuthContextValue extends CurrentUserContext {
  loginMode: LoginMode;
  setLoginMode: (mode: LoginMode) => void;

  pendingVerification: boolean;
  verificationDestination: string | null;
  verificationChannel: "EMAIL" | "SMS" | null;

  loginWithEmail: (
    email: string,
    password?: string,
  ) => Promise<LoginResponse>;

  loginWithPhone: (
    phone: string,
    password?: string,
  ) => Promise<LoginResponse>;

  verifyLoginOtp: (
    otp: string,
  ) => Promise<LoginResponse>;

  resendLoginOtp: () => Promise<void>;

  cancelLoginVerification: () => void;

  requestPasswordReset: (
    payload: PasswordResetRequest,
  ) => Promise<{ success: boolean; message?: string }>;

  confirmPasswordReset: (
    payload: PasswordResetConfirmation,
  ) => Promise<{ success: boolean; message?: string }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

/**
 * Default permissions are intentionally restrictive.
 *
 * The backend should provide the authoritative permission set.
 * These defaults prevent the frontend from accidentally granting
 * access while authentication/permission data is loading.
 */
const EMPTY_PERMISSIONS: PermissionSet = {
  canViewEmployees: false,
  canCreateEmployees: false,
  canEditEmployees: false,
  canDeactivateEmployees: false,

  canViewLeaveRequests: false,
  canCreateLeaveRequests: false,
  canApproveLeaveRequests: false,
  canRejectLeaveRequests: false,
  canCancelLeaveRequests: false,

  canManageLeavePolicies: false,
  canManageDepartments: false,
  canManageHolidays: false,

  canViewReports: false,
  canExportReports: false,

  canManageUsers: false,
  canManageRoles: false,

  canViewAuditLogs: false,

  canManageSystemSettings: false,
};

/**
 * Resolve permissions from the authenticated user.
 *
 * The backend remains the source of truth for authorization.
 * This frontend mapping is only a temporary typed foundation until
 * the backend returns explicit permissions.
 */
function getDefaultPermissionsForRole(
  user: AuthenticatedUser,
): PermissionSet {
  switch (user.role) {
    case "SUPER_ADMIN":
      return {
        canViewEmployees: true,
        canCreateEmployees: true,
        canEditEmployees: true,
        canDeactivateEmployees: true,

        canViewLeaveRequests: true,
        canCreateLeaveRequests: true,
        canApproveLeaveRequests: true,
        canRejectLeaveRequests: true,
        canCancelLeaveRequests: true,

        canManageLeavePolicies: true,
        canManageDepartments: true,
        canManageHolidays: true,

        canViewReports: true,
        canExportReports: true,

        canManageUsers: true,
        canManageRoles: true,

        canViewAuditLogs: true,

        canManageSystemSettings: true,
      };

    case "HR_ADMIN":
      return {
        canViewEmployees: true,
        canCreateEmployees: true,
        canEditEmployees: true,
        canDeactivateEmployees: true,

        canViewLeaveRequests: true,
        canCreateLeaveRequests: true,
        canApproveLeaveRequests: true,
        canRejectLeaveRequests: true,
        canCancelLeaveRequests: true,

        canManageLeavePolicies: true,
        canManageDepartments: true,
        canManageHolidays: true,

        canViewReports: true,
        canExportReports: true,

        canManageUsers: true,
        canManageRoles: false,

        canViewAuditLogs: true,

        canManageSystemSettings: true,
      };

    case "MANAGER":
      return {
        canViewEmployees: true,
        canCreateEmployees: false,
        canEditEmployees: false,
        canDeactivateEmployees: false,

        canViewLeaveRequests: true,
        canCreateLeaveRequests: true,
        canApproveLeaveRequests: true,
        canRejectLeaveRequests: true,
        canCancelLeaveRequests: false,

        canManageLeavePolicies: false,
        canManageDepartments: false,
        canManageHolidays: false,

        canViewReports: true,
        canExportReports: true,

        canManageUsers: false,
        canManageRoles: false,

        canViewAuditLogs: false,

        canManageSystemSettings: false,
      };

    case "EMPLOYEE":
      return {
        canViewEmployees: false,
        canCreateEmployees: false,
        canEditEmployees: false,
        canDeactivateEmployees: false,

        canViewLeaveRequests: true,
        canCreateLeaveRequests: true,
        canApproveLeaveRequests: false,
        canRejectLeaveRequests: false,
        canCancelLeaveRequests: true,

        canManageLeavePolicies: false,
        canManageDepartments: false,
        canManageHolidays: false,

        canViewReports: false,
        canExportReports: false,

        canManageUsers: false,
        canManageRoles: false,

        canViewAuditLogs: false,

        canManageSystemSettings: false,
      };

    default:
      return EMPTY_PERMISSIONS;
  }
}

/**
 * Never persist passwords or OTPs in browser storage.
 *
 * Authentication tokens should preferably be maintained through
 * secure HTTP-only cookies by the backend.
 */
function getVerificationDestination(
  response: LoginResponse,
): string | null {
  if (response.authenticationMethod === "PASSWORD") {
    return null;
  }

  return response.user.phone ?? response.user.email ?? null;
}

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] =
    useState<AuthenticatedUser | null>(null);

  const [permissions, setPermissions] =
    useState<PermissionSet | null>(null);

  const [isAuthenticated, setIsAuthenticated] =
    useState(false);

  const [isLoading, setIsLoading] = useState(true);

  const [loginMode, setLoginMode] =
    useState<LoginMode>("EMAIL");

  const [pendingVerification, setPendingVerification] =
    useState(false);

  const [verificationDestination, setVerificationDestination] =
    useState<string | null>(null);

  const [verificationChannel, setVerificationChannel] =
    useState<"EMAIL" | "SMS" | null>(null);

  const [lastLoginCredentials, setLastLoginCredentials] =
    useState<LoginCredentials | null>(null);

  /**
   * Apply a successful authentication response.
   */
  const establishSession = useCallback(
    (response: LoginResponse) => {
      setUser(response.user);
      setPermissions(
        getDefaultPermissionsForRole(response.user),
      );
      setIsAuthenticated(true);

      setPendingVerification(false);
      setVerificationDestination(null);
      setVerificationChannel(null);

      setLastLoginCredentials(null);

      return response;
    },
    [],
  );

  /**
   * Clear all local authentication state.
   */
  const clearSession = useCallback(() => {
    setUser(null);
    setPermissions(null);
    setIsAuthenticated(false);

    setPendingVerification(false);
    setVerificationDestination(null);
    setVerificationChannel(null);

    setLastLoginCredentials(null);
  }, []);

  /**
   * Restore an existing authenticated session when the
   * application starts.
   *
   * The backend decides whether the session is still valid.
   */
  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const response = await getCurrentSession();

        if (!mounted) {
          return;
        }

        establishSession(response);
      } catch {
        if (!mounted) {
          return;
        }

        clearSession();
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void restoreSession();

    return () => {
      mounted = false;
    };
  }, [clearSession, establishSession]);

  /**
   * Generic login method.
   *
   * The backend determines whether the current device is already
   * trusted. If verification is required, the response should use
   * OTP authentication and the UI will move into verification mode.
   */
  const login = useCallback(
    async (
      credentials: LoginCredentials,
    ): Promise<LoginResponse> => {
      const response = await loginRequest(credentials);

      if (
        response.authenticationMethod === "OTP" ||
        response.authenticationMethod ===
          "PASSWORD_AND_OTP"
      ) {
        const destination =
          getVerificationDestination(response);

        setPendingVerification(true);
        setVerificationDestination(destination);

        setVerificationChannel(
          response.user.phone
            ? "SMS"
            : response.user.email
              ? "EMAIL"
              : null,
        );

        setLastLoginCredentials(credentials);

        /*
         * The backend should not return an authenticated session
         * until the OTP has been successfully verified.
         */
        return response;
      }

      return establishSession(response);
    },
    [establishSession],
  );

  /**
   * Email login.
   */
  const loginWithEmail = useCallback(
    async (
      email: string,
      password?: string,
    ): Promise<LoginResponse> => {
      setLoginMode("EMAIL");

      return login({
        email: email.trim().toLowerCase(),
        password,
      });
    },
    [login],
  );

  /**
   * Phone login.
   */
  const loginWithPhone = useCallback(
    async (
      phone: string,
      password?: string,
    ): Promise<LoginResponse> => {
      setLoginMode("PHONE");

      return login({
        phone: phone.trim(),
        password,
      });
    },
    [login],
  );

  /**
   * Verify the OTP issued for a new/untrusted device.
   */
  const verifyLoginOtp = useCallback(
    async (otp: string): Promise<LoginResponse> => {
      if (!lastLoginCredentials) {
        throw new Error(
          "There is no pending login verification.",
        );
      }

      const destination =
        lastLoginCredentials.phone ??
        lastLoginCredentials.email;

      if (!destination) {
        throw new Error(
          "A phone number or email address is required for verification.",
        );
      }

      const channel: "EMAIL" | "SMS" =
        lastLoginCredentials.phone
          ? "SMS"
          : "EMAIL";

      const verification: OtpVerification = {
        destination,
        otp: otp.trim(),
        channel,
      };

      const response = await verifyOtp(
        verification,
      );

      return establishSession(response);
    },
    [establishSession, lastLoginCredentials],
  );

  /**
   * Resend the login verification code.
   */
  const resendLoginOtp = useCallback(async () => {
    if (!lastLoginCredentials) {
      throw new Error(
        "There is no pending login verification.",
      );
    }

    const destination =
      lastLoginCredentials.phone ??
      lastLoginCredentials.email;

    if (!destination) {
      throw new Error(
        "A phone number or email address is required.",
      );
    }

    const channel: "EMAIL" | "SMS" =
      lastLoginCredentials.phone
        ? "SMS"
        : "EMAIL";

    const payload: OtpRequest = {
      destination,
      channel,
    };

    await requestOtp(payload);
  }, [lastLoginCredentials]);

  /**
   * Cancel a pending OTP verification.
   */
  const cancelLoginVerification = useCallback(() => {
    setPendingVerification(false);
    setVerificationDestination(null);
    setVerificationChannel(null);
    setLastLoginCredentials(null);
  }, []);

  /**
   * Logout.
   */
  const logout = useCallback(
    async (): Promise<LogoutResponse> => {
      try {
        const response = await logoutRequest();

        clearSession();

        return response;
      } catch (error) {
        /*
         * Clear the local session even when the network request
         * fails. This prevents a stale authenticated UI state.
         */
        clearSession();

        throw error;
      }
    },
    [clearSession],
  );

  /**
   * Refresh the authenticated session.
   */
  const refreshAuthenticatedSession =
    useCallback(async (): Promise<boolean> => {
      try {
        const response = await refreshSession();

        establishSession(response);

        return true;
      } catch {
        clearSession();

        return false;
      }
    }, [clearSession, establishSession]);

  /**
   * Request password reset.
   */
  const handlePasswordResetRequest = useCallback(
    async (
      payload: PasswordResetRequest,
    ) => {
      return requestPasswordReset(payload);
    },
    [],
  );

  /**
   * Confirm password reset.
   */
  const handlePasswordResetConfirmation =
    useCallback(
      async (
        payload: PasswordResetConfirmation,
      ) => {
        return resetPassword(payload);
      },
      [],
    );

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      user,
      permissions,
      isAuthenticated,
      isLoading,

      login,
      logout,
      refreshSession:
        refreshAuthenticatedSession,

      loginMode,
      setLoginMode,

      pendingVerification,
      verificationDestination,
      verificationChannel,

      loginWithEmail,
      loginWithPhone,

      verifyLoginOtp,
      resendLoginOtp,
      cancelLoginVerification,

      requestPasswordReset:
        handlePasswordResetRequest,

      confirmPasswordReset:
        handlePasswordResetConfirmation,
    }),
    [
      user,
      permissions,
      isAuthenticated,
      isLoading,
      login,
      logout,
      refreshAuthenticatedSession,
      loginMode,
      pendingVerification,
      verificationDestination,
      verificationChannel,
      loginWithEmail,
      loginWithPhone,
      verifyLoginOtp,
      resendLoginOtp,
      cancelLoginVerification,
      handlePasswordResetRequest,
      handlePasswordResetConfirmation,
    ],
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside an AuthProvider.",
    );
  }

  return context;
}