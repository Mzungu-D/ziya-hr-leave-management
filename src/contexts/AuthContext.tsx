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

type VerificationChannel = "EMAIL" | "SMS";

interface AuthContextValue extends CurrentUserContext {
  loginMode: LoginMode;
  setLoginMode: (mode: LoginMode) => void;

  pendingVerification: boolean;
  verificationDestination: string | null;
  verificationChannel: VerificationChannel | null;

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
  ) => Promise<{
    success: boolean;
    message?: string;
  }>;

  confirmPasswordReset: (
    payload: PasswordResetConfirmation,
  ) => Promise<{
    success: boolean;
    message?: string;
  }>;
}

const AuthContext =
  createContext<AuthContextValue | undefined>(
    undefined,
  );

/*
 * Frontend permissions are presentation-level permissions.
 *
 * They must NEVER be treated as the application's security
 * boundary. Every protected operation must still be authorized
 * by the backend.
 *
 * These values also ensure that permission state is restrictive
 * while authentication is unavailable.
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

/*
 * Returns the frontend capability map for the authenticated
 * role.
 *
 * IMPORTANT:
 * This is only used to control UI visibility.
 *
 * The backend remains the authoritative authorization layer.
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

/*
 * Determine where the OTP was delivered.
 *
 * The backend determines whether verification is required.
 */
function getVerificationDestination(
  response: LoginResponse,
): string | null {
  if (
    response.authenticationMethod ===
    "PASSWORD"
  ) {
    return null;
  }

  return (
    response.user.phone ??
    response.user.email ??
    null
  );
}

function getVerificationChannel(
  credentials: LoginCredentials,
): VerificationChannel | null {
  if (credentials.phone?.trim()) {
    return "SMS";
  }

  if (credentials.email?.trim()) {
    return "EMAIL";
  }

  return null;
}

function normalizeEmail(
  email: string,
): string {
  return email.trim().toLowerCase();
}

function normalizePhone(
  phone: string,
): string {
  return phone.trim();
}

function normalizeOtp(
  otp: string,
): string {
  return otp.trim();
}

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] =
    useState<AuthenticatedUser | null>(
      null,
    );

  const [permissions, setPermissions] =
    useState<PermissionSet | null>(null);

  const [
    isAuthenticated,
    setIsAuthenticated,
  ] = useState(false);

  const [isLoading, setIsLoading] =
    useState(true);

  const [loginMode, setLoginMode] =
    useState<LoginMode>("EMAIL");

  const [
    pendingVerification,
    setPendingVerification,
  ] = useState(false);

  const [
    verificationDestination,
    setVerificationDestination,
  ] = useState<string | null>(null);

  const [
    verificationChannel,
    setVerificationChannel,
  ] =
    useState<VerificationChannel | null>(
      null,
    );

  /*
   * Never store passwords or OTPs in localStorage,
   * sessionStorage, cookies created by JavaScript,
   * IndexedDB, or any other browser persistence layer.
   *
   * This state exists only for the duration of the
   * current login verification flow.
   */
  const [
    lastLoginCredentials,
    setLastLoginCredentials,
  ] =
    useState<LoginCredentials | null>(null);

  /*
   * Establish authenticated application state after
   * the backend has successfully authenticated the user.
   */
  const establishSession = useCallback(
    (response: LoginResponse) => {
      setUser(response.user);

      setPermissions(
        getDefaultPermissionsForRole(
          response.user,
        ),
      );

      setIsAuthenticated(true);

      setPendingVerification(false);
      setVerificationDestination(null);
      setVerificationChannel(null);

      /*
       * Credentials are no longer needed after
       * authentication has completed.
       */
      setLastLoginCredentials(null);

      return response;
    },
    [],
  );

  /*
   * Clear every piece of local authentication state.
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

  /*
   * Restore an existing authenticated session when
   * the application starts.
   *
   * The backend session cookie is the authority.
   */
  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const response =
          await getCurrentSession();

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

  /*
   * Generic login method.
   *
   * The backend decides whether this device/session
   * requires OTP verification.
   */
  const login = useCallback(
    async (
      credentials: LoginCredentials,
    ): Promise<LoginResponse> => {
      const response =
        await loginRequest(credentials);

      /*
       * New/untrusted devices may require OTP.
       *
       * Do not mark the user as authenticated until
       * the OTP has been successfully verified.
       */
      if (
        response.authenticationMethod ===
          "OTP" ||
        response.authenticationMethod ===
          "PASSWORD_AND_OTP"
      ) {
        const destination =
          getVerificationDestination(
            response,
          );

        const channel =
          getVerificationChannel(
            credentials,
          );

        setPendingVerification(true);
        setVerificationDestination(
          destination,
        );
        setVerificationChannel(channel);
        setLastLoginCredentials(
          credentials,
        );

        /*
         * The backend should not consider the
         * application fully authenticated until
         * OTP verification succeeds.
         */
        setIsAuthenticated(false);

        return response;
      }

      return establishSession(response);
    },
    [establishSession],
  );

  /*
   * Email login.
   */
  const loginWithEmail = useCallback(
    async (
      email: string,
      password?: string,
    ): Promise<LoginResponse> => {
      const normalizedEmail =
        normalizeEmail(email);

      if (!normalizedEmail) {
        throw new Error(
          "Email address is required.",
        );
      }

      setLoginMode("EMAIL");

      return login({
        email: normalizedEmail,
        password,
      });
    },
    [login],
  );

  /*
   * Phone login.
   */
  const loginWithPhone = useCallback(
    async (
      phone: string,
      password?: string,
    ): Promise<LoginResponse> => {
      const normalizedPhone =
        normalizePhone(phone);

      if (!normalizedPhone) {
        throw new Error(
          "Phone number is required.",
        );
      }

      setLoginMode("PHONE");

      return login({
        phone: normalizedPhone,
        password,
      });
    },
    [login],
  );

  /*
   * Verify the OTP issued for the current
   * login attempt.
   */
  const verifyLoginOtp = useCallback(
    async (
      otp: string,
    ): Promise<LoginResponse> => {
      if (!lastLoginCredentials) {
        throw new Error(
          "There is no pending login verification.",
        );
      }

      const normalizedOtp =
        normalizeOtp(otp);

      if (!normalizedOtp) {
        throw new Error(
          "Verification code is required.",
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

      const channel =
        getVerificationChannel(
          lastLoginCredentials,
        );

      if (!channel) {
        throw new Error(
          "A valid verification channel is required.",
        );
      }

      const verification: OtpVerification = {
        destination,
        otp: normalizedOtp,
        channel,
      };

      const response =
        await verifyOtp(
          verification,
        );

      return establishSession(response);
    },
    [
      establishSession,
      lastLoginCredentials,
    ],
  );

  /*
   * Resend the current login verification OTP.
   */
  const resendLoginOtp =
    useCallback(async () => {
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

      const channel =
        getVerificationChannel(
          lastLoginCredentials,
        );

      if (!channel) {
        throw new Error(
          "A valid verification channel is required.",
        );
      }

      const payload: OtpRequest = {
        destination,
        channel,
      };

      await requestOtp(payload);

      setPendingVerification(true);
      setVerificationDestination(
        destination,
      );
      setVerificationChannel(channel);
    }, [lastLoginCredentials]);

  /*
   * Cancel the pending OTP flow.
   */
  const cancelLoginVerification =
    useCallback(() => {
      setPendingVerification(false);
      setVerificationDestination(null);
      setVerificationChannel(null);
      setLastLoginCredentials(null);
    }, []);

  /*
   * Logout.
   *
   * Always clear local state, even if the backend
   * request fails.
   */
  const logout = useCallback(
    async (): Promise<LogoutResponse> => {
      try {
        const response =
          await logoutRequest();

        clearSession();

        return response;
      } catch (error) {
        /*
         * Do not leave the browser displaying an
         * authenticated session after a failed
         * logout request.
         */
        clearSession();

        throw error;
      }
    },
    [clearSession],
  );

  /*
   * Refresh the current authenticated session.
   */
  const refreshAuthenticatedSession =
    useCallback(
      async (): Promise<boolean> => {
        try {
          const response =
            await refreshSession();

          establishSession(response);

          return true;
        } catch {
          clearSession();

          return false;
        }
      },
      [clearSession, establishSession],
    );

  /*
   * Request password reset.
   *
   * The backend remains responsible for:
   * - account lookup
   * - rate limiting
   * - token generation
   * - token expiry
   * - delivery
   */
  const handlePasswordResetRequest =
    useCallback(
      async (
        payload: PasswordResetRequest,
      ) => {
        return requestPasswordReset(
          payload,
        );
      },
      [],
    );

  /*
   * Confirm password reset.
   *
   * Password validation and reset-token validation
   * remain backend responsibilities.
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

  /*
   * Keep the context value memoized so consumers do
   * not unnecessarily re-render when unrelated state
   * changes occur.
   */
  const contextValue =
    useMemo<AuthContextValue>(
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
    <AuthContext.Provider
      value={contextValue}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside an AuthProvider.",
    );
  }

  return context;
}