export type UserRole =
  | "EMPLOYEE"
  | "MANAGER"
  | "HR_ADMIN"
  | "SUPER_ADMIN";

export type AccountStatus =
  | "PENDING"
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED";

export type AuthenticationMethod =
  | "PASSWORD"
  | "OTP"
  | "PASSWORD_AND_OTP";

export type OtpPurpose =
  | "LOGIN"
  | "PASSWORD_RESET"
  | "DEVICE_VERIFICATION";

export interface AuthenticatedUser {
  id: string;
  employeeId: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: UserRole;
  accountStatus: AccountStatus;
  departmentId?: string;
  departmentName?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: AuthenticatedUser;
  expiresAt: string;
  issuedAt: string;
  sessionId: string;
  authenticationMethod: AuthenticationMethod;
}

export interface LoginResult {
  requiresOtp: boolean;
  otpChannel?: "EMAIL";
  maskedDestination?: string;
  pendingVerificationId?: string;
  session?: AuthResponse;
  accessToken?: string;
  refreshToken?: string;
  deviceId?: string;
  refreshCookieMaxAge?: number;
}