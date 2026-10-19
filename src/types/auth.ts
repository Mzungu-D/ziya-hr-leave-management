export type UserRole =
  | "EMPLOYEE"
  | "MANAGER"
  | "HR_ADMIN"
  | "SUPER_ADMIN";

export type AccountStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "PENDING";

export type AuthenticationMethod =
  | "PASSWORD"
  | "OTP"
  | "PASSWORD_AND_OTP";

export interface AuthenticatedUser {
  id: string;
  employeeId?: string;
  organizationId: string;

  firstName: string;
  lastName: string;

  email: string;
  phone?: string;

  role: UserRole;
  accountStatus: AccountStatus;

  departmentId?: string;
  departmentName?: string;

  jobTitle?: string;
  profilePictureUrl?: string;

  emailVerified: boolean;
  phoneVerified: boolean;

  lastLoginAt?: string;

  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  user: AuthenticatedUser;

  accessToken: string;
  refreshToken?: string;

  expiresAt: string;
  authenticationMethod: AuthenticationMethod;

  issuedAt: string;
  sessionId: string;
}

export interface LoginCredentials {
  email?: string;
  phone?: string;
  password?: string;
  otp?: string;
}

export interface LoginResponse {
  requiresOtp?: boolean;
  user: AuthenticatedUser;

  accessToken: string;
  refreshToken?: string;

  expiresAt: string;
  sessionId: string;

  authenticationMethod: AuthenticationMethod;
}

export interface LogoutResponse {
  success: boolean;
  message?: string;
}

export interface PasswordResetRequest {
  email?: string;
  phone?: string;
}

export interface PasswordResetConfirmation {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface OtpRequest {
  destination: string;
  channel: "EMAIL" | "SMS";
}

export interface OtpVerification {
  destination: string;
  otp: string;
  channel: "EMAIL" | "SMS";
}

export interface PermissionSet {
  canViewEmployees: boolean;
  canCreateEmployees: boolean;
  canEditEmployees: boolean;
  canDeactivateEmployees: boolean;

  canViewLeaveRequests: boolean;
  canCreateLeaveRequests: boolean;
  canApproveLeaveRequests: boolean;
  canRejectLeaveRequests: boolean;
  canCancelLeaveRequests: boolean;

  canManageLeavePolicies: boolean;
  canManageDepartments: boolean;
  canManageHolidays: boolean;

  canViewReports: boolean;
  canExportReports: boolean;

  canManageUsers: boolean;
  canManageRoles: boolean;

  canViewAuditLogs: boolean;

  canManageSystemSettings: boolean;
}

export interface CurrentUserContext {
  user: AuthenticatedUser | null;
  permissions: PermissionSet | null;

  isAuthenticated: boolean;
  isLoading: boolean;

  login: (
    credentials: LoginCredentials,
  ) => Promise<LoginResponse>;

  logout: () => Promise<LogoutResponse>;

  refreshSession: () => Promise<boolean>;
}