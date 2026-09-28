import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import ziyaLogo from "../../assets/zayi.jpg";
import leaveManagementCover from "../../assets/LEAVE.png";
import { useAuth } from "../../contexts/AuthContext";

type LoginMethod = "EMAIL" | "PHONE";

type AuthScreen =
  | "LOGIN"
  | "LOGIN_OTP"
  | "FORGOT_PASSWORD"
  | "RESET_PASSWORD"
  | "PASSWORD_RESET_SUCCESS";

interface LoginLocationState {
  from?: string;
}

const REMEMBERED_IDENTIFIER_KEY =
  "ziya_hr_remembered_identifier";

function getDestinationForRole(
  role:
    | "EMPLOYEE"
    | "MANAGER"
    | "HR_ADMIN"
    | "SUPER_ADMIN",
): string {
  switch (role) {
    case "EMPLOYEE":
      return "/employee";

    case "MANAGER":
      return "/manager";

    case "HR_ADMIN":
    case "SUPER_ADMIN":
      return "/admin";

    default:
      return "/admin";
  }
}

function getFriendlyAuthError(
  error: unknown,
): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    const message = (
      error as { message?: unknown }
    ).message;

    if (
      typeof message === "string" &&
      message.trim()
    ) {
      return message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

function isValidKenyanPhone(
  value: string,
): boolean {
  const normalized = value.replace(
    /[\s()-]/g,
    "",
  );

  return /^(?:\+254|254|0)(?:7\d{8}|1\d{8})$/.test(
    normalized,
  );
}

function normalizePhone(value: string): string {
  const cleaned = value.replace(
    /[\s()-]/g,
    "",
  );

  if (cleaned.startsWith("0")) {
    return `+254${cleaned.slice(1)}`;
  }

  if (cleaned.startsWith("254")) {
    return `+${cleaned}`;
  }

  return cleaned;
}

function getStoredIdentifier(): {
  method: LoginMethod;
  value: string;
} | null {
  try {
    const stored = localStorage.getItem(
      REMEMBERED_IDENTIFIER_KEY,
    );

    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as {
      method?: LoginMethod;
      value?: string;
    };

    if (
      (parsed.method === "EMAIL" ||
        parsed.method === "PHONE") &&
      typeof parsed.value === "string" &&
      parsed.value.trim()
    ) {
      return {
        method: parsed.method,
        value: parsed.value,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function saveRememberedIdentifier(
  method: LoginMethod,
  value: string,
): void {
  try {
    localStorage.setItem(
      REMEMBERED_IDENTIFIER_KEY,
      JSON.stringify({
        method,
        value,
      }),
    );
  } catch {
    // Remember-me convenience must never prevent login.
  }
}

function clearRememberedIdentifier(): void {
  try {
    localStorage.removeItem(
      REMEMBERED_IDENTIFIER_KEY,
    );
  } catch {
    // Ignore storage failures.
  }
}

interface MessageProps {
  type: "error" | "success";
  children: ReactNode;
}

function Message({
  type,
  children,
}: MessageProps) {
  const isError = type === "error";

  return (
    <div
      className={`flex gap-3 rounded-xl border p-3.5 text-sm ${
        isError
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
      role={isError ? "alert" : "status"}
    >
      {isError ? (
        <AlertCircle
          size={18}
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        />
      ) : (
        <CheckCircle2
          size={18}
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        />
      )}

      <p className="leading-5">
        {children}
      </p>
    </div>
  );
}

interface MethodTabsProps {
  value: LoginMethod;
  onChange: (method: LoginMethod) => void;
  disabled?: boolean;
}

function MethodTabs({
  value,
  onChange,
  disabled = false,
}: MethodTabsProps) {
  return (
    <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("EMAIL")}
        aria-pressed={value === "EMAIL"}
        className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8a415] focus-visible:ring-offset-1 ${
          value === "EMAIL"
            ? "bg-white text-[#071a35] shadow-sm"
            : "text-slate-500 hover:text-slate-800"
        } disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <Mail
          size={17}
          strokeWidth={1.9}
          aria-hidden="true"
        />
        Email
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("PHONE")}
        aria-pressed={value === "PHONE"}
        className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8a415] focus-visible:ring-offset-1 ${
          value === "PHONE"
            ? "bg-white text-[#071a35] shadow-sm"
            : "text-slate-500 hover:text-slate-800"
        } disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <Phone
          size={17}
          strokeWidth={1.9}
          aria-hidden="true"
        />
        Phone
      </button>
    </div>
  );
}

interface PasswordFieldProps {
  id: string;
  name: string;
  label: string;
  value: string;
  placeholder: string;
  visible: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
  disabled?: boolean;
  autoComplete?: string;
  hideLabel?: boolean;
}

function PasswordField({
  id,
  name,
  label,
  value,
  placeholder,
  visible,
  onChange,
  onToggle,
  disabled = false,
  autoComplete,
  hideLabel = false,
}: PasswordFieldProps) {
  return (
    <div>
      {!hideLabel && (
        <label
          htmlFor={id}
          className="mb-2 block text-sm font-semibold text-slate-700"
        >
          {label}
        </label>
      )}

      <div className="relative">
        <KeyRound
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />

        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          placeholder={placeholder}
          disabled={disabled}
          className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#d8a415] focus:ring-4 focus:ring-[#d8a415]/10 disabled:cursor-not-allowed disabled:bg-slate-50"
        />

        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8a415] disabled:cursor-not-allowed"
          aria-label={
            visible
              ? `Hide ${label.toLowerCase()}`
              : `Show ${label.toLowerCase()}`
          }
        >
          {visible ? (
            <EyeOff
              size={18}
              aria-hidden="true"
            />
          ) : (
            <Eye
              size={18}
              aria-hidden="true"
            />
          )}
        </button>
      </div>
    </div>
  );
}

interface LoadingButtonProps {
  children: ReactNode;
  loadingText: string;
  isLoading: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}

function LoadingButton({
  children,
  loadingText,
  isLoading,
  disabled = false,
  type = "submit",
  onClick,
}: LoadingButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#d8a415] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#bd8e0d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d8a415] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isLoading ? (
        <>
          <RefreshCw
            size={18}
            className="animate-spin"
            aria-hidden="true"
          />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    isAuthenticated,
    isLoading: authLoading,
    pendingVerification,
    verificationDestination,
    verificationChannel,
    loginWithEmail,
    loginWithPhone,
    verifyLoginOtp,
    resendLoginOtp,
    cancelLoginVerification,
    requestPasswordReset,
    confirmPasswordReset,
  } = useAuth();

  const locationState =
    location.state as LoginLocationState | null;

  const returnPath = locationState?.from;

  const [screen, setScreen] =
    useState<AuthScreen>("LOGIN");

  const [loginMethod, setLoginMethod] =
    useState<LoginMethod>("EMAIL");

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] =
    useState("");

  const [rememberMe, setRememberMe] =
    useState(true);

  const [showPassword, setShowPassword] =
    useState(false);

  const [showNewPassword, setShowNewPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [otp, setOtp] = useState("");

  const [resetIdentifier, setResetIdentifier] =
    useState("");

  const [resetMethod, setResetMethod] =
    useState<LoginMethod>("EMAIL");

  const [resetCode, setResetCode] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [isResending, setIsResending] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [success, setSuccess] =
    useState<string | null>(null);

  const [resendCooldown, setResendCooldown] =
    useState(0);

  const [verificationAttempts, setVerificationAttempts] =
    useState(0);

  useEffect(() => {
    const remembered =
      getStoredIdentifier();

    if (!remembered) {
      return;
    }

    setLoginMethod(remembered.method);

    if (remembered.method === "EMAIL") {
      setEmail(remembered.value);
    } else {
      setPhone(remembered.value);
    }
  }, []);

  useEffect(() => {
    if (pendingVerification) {
      setScreen("LOGIN_OTP");
      setOtp("");
      setError(null);
      setSuccess(null);
      setResendCooldown(30);
    }
  }, [pendingVerification]);

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setResendCooldown(
        (current) =>
          current > 0 ? current - 1 : 0,
      );
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [resendCooldown]);

  const passwordStrength = useMemo(() => {
    const value = newPassword;

    let score = 0;

    if (value.length >= 8) score += 1;
    if (/[A-Z]/.test(value)) score += 1;
    if (/[a-z]/.test(value)) score += 1;
    if (/\d/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value))
      score += 1;

    if (score <= 2) {
      return {
        label: "Weak",
        width: "w-1/3",
        text: "text-red-600",
      };
    }

    if (score <= 4) {
      return {
        label: "Good",
        width: "w-2/3",
        text: "text-amber-600",
      };
    }

    return {
      label: "Strong",
      width: "w-full",
      text: "text-emerald-600",
    };
  }, [newPassword]);

  const maskedDestination = useMemo(() => {
    if (!verificationDestination) {
      return "your registered contact";
    }

    if (verificationChannel === "SMS") {
      const value = verificationDestination;

      if (value.length <= 6) {
        return value;
      }

      return `${value.slice(
        0,
        4,
      )}••••${value.slice(-3)}`;
    }

    const [
      name,
      domain,
    ] = verificationDestination.split("@");

    if (!domain) {
      return verificationDestination;
    }

    return `${name.slice(
      0,
      2,
    )}•••@${domain}`;
  }, [
    verificationDestination,
    verificationChannel,
  ]);

  if (
    !authLoading &&
    isAuthenticated
  ) {
    return (
      <Navigate
        to={returnPath ?? "/admin"}
        replace
      />
    );
  }

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const handleMethodChange = (
    method: LoginMethod,
  ) => {
    if (isSubmitting) {
      return;
    }

    setLoginMethod(method);
    clearMessages();
  };

  const handleLoginSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    clearMessages();

    if (loginMethod === "EMAIL") {
      const normalizedEmail =
        email.trim().toLowerCase();

      if (!normalizedEmail) {
        setError(
          "Please enter your email address.",
        );
        return;
      }

      if (!isValidEmail(normalizedEmail)) {
        setError(
          "Please enter a valid email address.",
        );
        return;
      }

      if (!password) {
        setError(
          "Please enter your password.",
        );
        return;
      }

      try {
        setIsSubmitting(true);

        if (rememberMe) {
          saveRememberedIdentifier(
            "EMAIL",
            normalizedEmail,
          );
        } else {
          clearRememberedIdentifier();
        }

        const response =
          await loginWithEmail(
            normalizedEmail,
            password,
          );

        if (
          response.authenticationMethod ===
            "OTP" ||
          response.authenticationMethod ===
            "PASSWORD_AND_OTP"
        ) {
          setSuccess(
            "We've sent a verification code to your registered contact.",
          );

          return;
        }

        navigate(
          returnPath ??
            getDestinationForRole(
              response.user.role,
            ),
          {
            replace: true,
          },
        );
      } catch (loginError) {
        setError(
          getFriendlyAuthError(
            loginError,
          ),
        );
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    const normalizedPhone =
      normalizePhone(phone);

    if (!normalizedPhone) {
      setError(
        "Please enter your phone number.",
      );
      return;
    }

    if (
      !isValidKenyanPhone(
        normalizedPhone,
      )
    ) {
      setError(
        "Please enter a valid Kenyan mobile number.",
      );
      return;
    }

    if (!password) {
      setError(
        "Please enter your password.",
      );
      return;
    }

    try {
      setIsSubmitting(true);

      if (rememberMe) {
        saveRememberedIdentifier(
          "PHONE",
          normalizedPhone,
        );
      } else {
        clearRememberedIdentifier();
      }

      const response =
        await loginWithPhone(
          normalizedPhone,
          password,
        );

      if (
        response.authenticationMethod ===
          "OTP" ||
        response.authenticationMethod ===
          "PASSWORD_AND_OTP"
      ) {
        setSuccess(
          "We've sent a verification code to your registered phone.",
        );

        return;
      }

      navigate(
        returnPath ??
          getDestinationForRole(
            response.user.role,
          ),
        {
          replace: true,
        },
      );
    } catch (loginError) {
      setError(
        getFriendlyAuthError(
          loginError,
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    clearMessages();

    const normalizedOtp =
      otp.replace(/\D/g, "");

    if (normalizedOtp.length !== 6) {
      setError(
        "Please enter the 6-digit verification code.",
      );
      return;
    }

    if (verificationAttempts >= 5) {
      setError(
        "Too many verification attempts. Please request a new code.",
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const response =
        await verifyLoginOtp(
          normalizedOtp,
        );

      navigate(
        returnPath ??
          getDestinationForRole(
            response.user.role,
          ),
        {
          replace: true,
        },
      );
    } catch (verificationError) {
      setVerificationAttempts(
        (current) => current + 1,
      );

      setError(
        getFriendlyAuthError(
          verificationError,
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendLoginOtp =
    async () => {
      if (
        isResending ||
        resendCooldown > 0
      ) {
        return;
      }

      clearMessages();

      try {
        setIsResending(true);

        await resendLoginOtp();

        setResendCooldown(30);
        setVerificationAttempts(0);

        setSuccess(
          "A new verification code has been sent.",
        );
      } catch (resendError) {
        setError(
          getFriendlyAuthError(
            resendError,
          ),
        );
      } finally {
        setIsResending(false);
      }
    };

  const handleCancelLoginVerification =
    () => {
      cancelLoginVerification();

      setScreen("LOGIN");
      setOtp("");
      setVerificationAttempts(0);
      clearMessages();
    };

  const handlePasswordResetRequest =
    async (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      clearMessages();

      const identifier =
        resetIdentifier.trim();

      if (!identifier) {
        setError(
          resetMethod === "EMAIL"
            ? "Please enter your email address."
            : "Please enter your phone number.",
        );

        return;
      }

      if (
        resetMethod === "EMAIL" &&
        !isValidEmail(identifier)
      ) {
        setError(
          "Please enter a valid email address.",
        );

        return;
      }

      const normalizedIdentifier =
        resetMethod === "PHONE"
          ? normalizePhone(identifier)
          : identifier.toLowerCase();

      if (
        resetMethod === "PHONE" &&
        !isValidKenyanPhone(
          normalizedIdentifier,
        )
      ) {
        setError(
          "Please enter a valid Kenyan mobile number.",
        );

        return;
      }

      try {
        setIsSubmitting(true);

        await requestPasswordReset({
          ...(resetMethod === "EMAIL"
            ? {
                email:
                  normalizedIdentifier,
              }
            : {
                phone:
                  normalizedIdentifier,
              }),
        });

        setResetIdentifier(
          normalizedIdentifier,
        );

        setScreen("RESET_PASSWORD");

        setSuccess(
          "If an account exists for that contact, a verification code has been sent.",
        );
      } catch (resetError) {
        setError(
          getFriendlyAuthError(
            resetError,
          ),
        );
      } finally {
        setIsSubmitting(false);
      }
    };

  const handlePasswordResetConfirmation =
    async (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      clearMessages();

      if (!resetCode.trim()) {
        setError(
          "Please enter the verification code.",
        );
        return;
      }

      if (resetCode.trim().length !== 6) {
        setError(
          "Please enter the 6-digit verification code.",
        );
        return;
      }

      if (newPassword.length < 8) {
        setError(
          "Your new password must contain at least 8 characters.",
        );
        return;
      }

      if (
        newPassword !== confirmPassword
      ) {
        setError(
          "The passwords do not match.",
        );
        return;
      }

      if (
        passwordStrength.label ===
        "Weak"
      ) {
        setError(
          "Please choose a stronger password using uppercase letters, lowercase letters, numbers and a special character.",
        );
        return;
      }

      try {
        setIsSubmitting(true);

        await confirmPasswordReset({
          token: resetCode.trim(),
          password: newPassword,
          confirmPassword,
        });

        setScreen(
          "PASSWORD_RESET_SUCCESS",
        );

        setResetCode("");
        setNewPassword("");
        setConfirmPassword("");
        setSuccess(null);
      } catch (resetError) {
        setError(
          getFriendlyAuthError(
            resetError,
          ),
        );
      } finally {
        setIsSubmitting(false);
      }
    };

  const handleBackToLogin = () => {
    setScreen("LOGIN");
    setError(null);
    setSuccess(null);
    setResetCode("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const renderLogin = () => (
    <>
      <div>
        <p className="text-sm font-semibold text-[#b88900]">
          Welcome back
        </p>

        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Sign in to Ziya HR
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Use your registered email or phone
          number to access your account.
        </p>
      </div>

      <div className="mt-7">
        <MethodTabs
          value={loginMethod}
          onChange={handleMethodChange}
          disabled={isSubmitting}
        />
      </div>

      <form
        className="mt-6 space-y-5"
        onSubmit={handleLoginSubmit}
        noValidate
      >
        {loginMethod === "EMAIL" ? (
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Email address
            </label>

            <div className="relative">
              <Mail
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />

              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value,
                  )
                }
                placeholder="you@company.com"
                disabled={isSubmitting}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#d8a415] focus:ring-4 focus:ring-[#d8a415]/10 disabled:cursor-not-allowed disabled:bg-slate-50"
              />
            </div>
          </div>
        ) : (
          <div>
            <label
              htmlFor="phone"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Phone number
            </label>

            <div className="relative">
              <Phone
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />

              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                value={phone}
                onChange={(event) =>
                  setPhone(
                    event.target.value,
                  )
                }
                placeholder="0712 345 678"
                disabled={isSubmitting}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#d8a415] focus:ring-4 focus:ring-[#d8a415]/10 disabled:cursor-not-allowed disabled:bg-slate-50"
              />
            </div>

            <p className="mt-2 text-xs text-slate-400">
              Kenyan mobile numbers are
              supported.
            </p>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-slate-700"
            >
              Password
            </label>

            <button
              type="button"
              onClick={() => {
                setScreen(
                  "FORGOT_PASSWORD",
                );
                clearMessages();
              }}
              className="text-xs font-semibold text-[#a47700] transition hover:text-[#7f5d00] focus:outline-none focus-visible:underline"
            >
              Forgot password?
            </button>
          </div>

          <PasswordField
            id="password"
            name="password"
            label="Password"
            value={password}
            placeholder="Enter your password"
            visible={showPassword}
            onChange={setPassword}
            onToggle={() =>
              setShowPassword(
                (current) => !current,
              )
            }
            disabled={isSubmitting}
            autoComplete="current-password"
            hideLabel
          />
        </div>

        <div className="flex items-start gap-3">
          <input
            id="remember-me"
            name="remember-me"
            type="checkbox"
            checked={rememberMe}
            onChange={(event) =>
              setRememberMe(
                event.target.checked,
              )
            }
            disabled={isSubmitting}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#d8a415] focus:ring-[#d8a415]"
          />

          <label
            htmlFor="remember-me"
            className="cursor-pointer"
          >
            <span className="block text-sm font-semibold text-slate-700">
              Remember me
            </span>

            <span className="mt-0.5 block text-xs leading-5 text-slate-400">
              We'll remember this email or
              phone number on this device.
              Your password is handled by your
              browser's secure password manager.
            </span>
          </label>
        </div>

        {error && (
          <Message type="error">
            {error}
          </Message>
        )}

        {success && (
          <Message type="success">
            {success}
          </Message>
        )}

        <LoadingButton
          isLoading={isSubmitting}
          loadingText="Signing in..."
        >
          Sign in
        </LoadingButton>
      </form>
    </>
  );

  const renderLoginOtp = () => (
    <>
      <button
        type="button"
        onClick={
          handleCancelLoginVerification
        }
        disabled={isSubmitting}
        className="flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900 focus:outline-none focus-visible:underline disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ArrowLeft
          size={17}
          aria-hidden="true"
        />
        Back to sign in
      </button>

      <div className="mt-7">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#d8a415]/10 text-[#a47700]">
          <ShieldCheck
            size={27}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </div>

        <h2 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
          Verify your device
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          For your security, enter the 6-digit
          verification code we sent to{" "}
          <span className="font-semibold text-slate-700">
            {maskedDestination}
          </span>
          .
        </p>
      </div>

      <form
        className="mt-7 space-y-5"
        onSubmit={handleOtpSubmit}
        noValidate
      >
        <div>
          <label
            htmlFor="login-otp"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            Verification code
          </label>

          <input
            id="login-otp"
            name="login-otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(event) => {
              setOtp(
                event.target.value
                  .replace(/\D/g, "")
                  .slice(0, 6),
              );
              setError(null);
            }}
            placeholder="000000"
            autoFocus
            disabled={isSubmitting}
            className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 text-center text-2xl font-bold tracking-[0.45em] text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-[#d8a415] focus:ring-4 focus:ring-[#d8a415]/10 disabled:cursor-not-allowed disabled:bg-slate-50"
          />
        </div>

        {error && (
          <Message type="error">
            {error}
          </Message>
        )}

        {success && (
          <Message type="success">
            {success}
          </Message>
        )}

        <LoadingButton
          isLoading={isSubmitting}
          loadingText="Verifying..."
          disabled={otp.length !== 6}
        >
          Verify &amp; continue
        </LoadingButton>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-slate-500">
          Didn't receive the code?
        </p>

        <button
          type="button"
          onClick={
            handleResendLoginOtp
          }
          disabled={
            isResending ||
            resendCooldown > 0
          }
          className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-[#a47700] transition hover:text-[#7f5d00] focus:outline-none focus-visible:underline disabled:cursor-not-allowed disabled:text-slate-400"
        >
          {isResending ? (
            <>
              <RefreshCw
                size={15}
                className="animate-spin"
                aria-hidden="true"
              />
              Sending...
            </>
          ) : resendCooldown > 0 ? (
            `Resend code in ${resendCooldown}s`
          ) : (
            <>
              <RefreshCw
                size={15}
                aria-hidden="true"
              />
              Resend code
            </>
          )}
        </button>
      </div>

      <div className="mt-7 rounded-xl bg-slate-50 p-4">
        <div className="flex gap-3">
          <ShieldCheck
            size={18}
            className="mt-0.5 shrink-0 text-[#b88900]"
            aria-hidden="true"
          />

          <p className="text-xs leading-5 text-slate-500">
            A verification code is required
            when signing in from a new or
            unrecognized device.
          </p>
        </div>
      </div>
    </>
  );

  const renderForgotPassword = () => (
    <>
      <button
        type="button"
        onClick={handleBackToLogin}
        className="flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900 focus:outline-none focus-visible:underline"
      >
        <ArrowLeft
          size={17}
          aria-hidden="true"
        />
        Back to sign in
      </button>

      <div className="mt-7">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#d8a415]/10 text-[#a47700]">
          <KeyRound
            size={27}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </div>

        <h2 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
          Reset your password
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Enter your registered email or phone
          number and we'll send you a secure
          verification code.
        </p>
      </div>

      <div className="mt-7">
        <MethodTabs
          value={resetMethod}
          onChange={(method) => {
            setResetMethod(method);
            clearMessages();
          }}
        />
      </div>

      <form
        className="mt-6 space-y-5"
        onSubmit={
          handlePasswordResetRequest
        }
        noValidate
      >
        <div>
          <label
            htmlFor="reset-identifier"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            {resetMethod === "EMAIL"
              ? "Email address"
              : "Phone number"}
          </label>

          <div className="relative">
            {resetMethod === "EMAIL" ? (
              <Mail
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
            ) : (
              <Phone
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
            )}

            <input
              id="reset-identifier"
              name="reset-identifier"
              type={
                resetMethod === "EMAIL"
                  ? "email"
                  : "tel"
              }
              inputMode={
                resetMethod === "EMAIL"
                  ? "email"
                  : "tel"
              }
              autoComplete={
                resetMethod === "EMAIL"
                  ? "email"
                  : "tel"
              }
              value={resetIdentifier}
              onChange={(event) =>
                setResetIdentifier(
                  event.target.value,
                )
              }
              placeholder={
                resetMethod === "EMAIL"
                  ? "you@company.com"
                  : "0712 345 678"
              }
              disabled={isSubmitting}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#d8a415] focus:ring-4 focus:ring-[#d8a415]/10 disabled:bg-slate-50"
            />
          </div>
        </div>

        {error && (
          <Message type="error">
            {error}
          </Message>
        )}

        <LoadingButton
          isLoading={isSubmitting}
          loadingText="Sending code..."
        >
          Send verification code
        </LoadingButton>
      </form>

      <p className="mt-5 text-center text-xs leading-5 text-slate-400">
        For security, we won't reveal whether
        the supplied contact belongs to an
        account.
      </p>
    </>
  );

  const renderResetPassword = () => (
    <>
      <button
        type="button"
        onClick={handleBackToLogin}
        className="flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900 focus:outline-none focus-visible:underline"
      >
        <ArrowLeft
          size={17}
          aria-hidden="true"
        />
        Back to sign in
      </button>

      <div className="mt-7">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#d8a415]/10 text-[#a47700]">
          <ShieldCheck
            size={27}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </div>

        <h2 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
          Create a new password
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Enter the verification code we sent
          to your registered contact, then
          choose a new password.
        </p>
      </div>

      <form
        className="mt-7 space-y-5"
        onSubmit={
          handlePasswordResetConfirmation
        }
        noValidate
      >
        <div>
          <label
            htmlFor="reset-code"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            Verification code
          </label>

          <input
            id="reset-code"
            name="reset-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={resetCode}
            onChange={(event) =>
              setResetCode(
                event.target.value
                  .replace(/\D/g, "")
                  .slice(0, 6),
              )
            }
            placeholder="000000"
            className="h-13 w-full rounded-xl border border-slate-200 px-4 text-center text-xl font-bold tracking-[0.4em] outline-none focus:border-[#d8a415] focus:ring-4 focus:ring-[#d8a415]/10"
          />
        </div>

        <PasswordField
          id="new-password"
          name="new-password"
          label="New password"
          value={newPassword}
          placeholder="Create a strong password"
          visible={showNewPassword}
          onChange={setNewPassword}
          onToggle={() =>
            setShowNewPassword(
              (current) => !current,
            )
          }
          autoComplete="new-password"
        />

        {newPassword && (
          <div className="-mt-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full transition-all ${passwordStrength.width} ${
                  passwordStrength.label ===
                  "Weak"
                    ? "bg-red-500"
                    : passwordStrength.label ===
                        "Good"
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
              />
            </div>

            <p
              className={`mt-1 text-xs font-semibold ${passwordStrength.text}`}
            >
              {passwordStrength.label} password
            </p>
          </div>
        )}

        <PasswordField
          id="confirm-password"
          name="confirm-password"
          label="Confirm new password"
          value={confirmPassword}
          placeholder="Repeat your new password"
          visible={showConfirmPassword}
          onChange={setConfirmPassword}
          onToggle={() =>
            setShowConfirmPassword(
              (current) => !current,
            )
          }
          autoComplete="new-password"
        />

        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold text-slate-700">
            Password requirements
          </p>

          <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-500">
            <li>
              • At least 8 characters
            </li>
            <li>
              • Uppercase and lowercase letters
            </li>
            <li>
              • At least one number
            </li>
            <li>
              • At least one special character
            </li>
          </ul>
        </div>

        {error && (
          <Message type="error">
            {error}
          </Message>
        )}

        <LoadingButton
          isLoading={isSubmitting}
          loadingText="Updating password..."
        >
          Update password
        </LoadingButton>
      </form>
    </>
  );

  const renderPasswordResetSuccess =
    () => (
      <div className="py-5 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2
            size={32}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </div>

        <h2 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
          Password updated
        </h2>

        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">
          Your password has been changed
          successfully. You can now sign in
          using your new password.
        </p>

        <LoadingButton
          type="button"
          isLoading={false}
          loadingText=""
          onClick={handleBackToLogin}
        >
          Continue to sign in
        </LoadingButton>
      </div>
    );

  const renderAuthenticationScreen =
    () => {
      switch (screen) {
        case "LOGIN":
          return renderLogin();

        case "LOGIN_OTP":
          return renderLoginOtp();

        case "FORGOT_PASSWORD":
          return renderForgotPassword();

        case "RESET_PASSWORD":
          return renderResetPassword();

        case "PASSWORD_RESET_SUCCESS":
          return renderPasswordResetSuccess();

        default:
          return renderLogin();
      }
    };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f8fafc]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.08fr)_minmax(440px,0.92fr)]">
        {/* ============================================================
            DESKTOP BRAND / COVER PANEL
           ============================================================ */}
        <section className="relative hidden min-h-screen overflow-hidden bg-[#071a35] lg:block">
          {/* Cover image */}
          <img
            src={leaveManagementCover}
            alt="Ziya HR leave management workspace"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />

          {/* Professional brand overlay */}
          <div className="absolute inset-0 bg-[#071a35]/55" />

          <div className="absolute inset-0 bg-gradient-to-br from-[#071a35]/90 via-[#071a35]/45 to-[#071a35]/65" />

          {/* Subtle gold accent */}
          <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-[#d8a415]/15 blur-3xl" />

          <div className="absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl" />

          {/* Brand content */}
          <div className="relative z-10 flex min-h-screen w-full flex-col justify-between p-8 xl:p-12 2xl:p-14">
            <div>
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-2xl">
                  <img
                    src={ziyaLogo}
                    alt="Ziya logo"
                    className="h-full w-full object-contain"
                  />
                </div>

                <div>
                  <div className="text-2xl font-bold tracking-tight text-white">
                    Ziya HR
                  </div>

                  <div className="mt-1 text-[10px] font-semibold tracking-[0.2em] text-slate-200">
                    PEOPLE • TIME • TOGETHER
                  </div>
                </div>
              </div>

              <div className="mt-[clamp(8rem,18vh,13rem)] max-w-2xl">
                <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-md">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#f1c43b]">
                    Human Resources
                  </span>
                </div>

                <h1 className="mt-5 max-w-xl text-4xl font-bold leading-tight tracking-tight text-white xl:text-5xl 2xl:text-6xl">
                  Everything your people need,
                  <span className="block text-[#f1c43b]">
                    in one place.
                  </span>
                </h1>

                <p className="mt-6 max-w-xl text-base leading-7 text-slate-200 xl:text-lg">
                  Manage leave, employees,
                  approvals, policies and
                  workforce information through
                  one secure HR platform.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white backdrop-blur-md">
                    Leave Management
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white backdrop-blur-md">
                    Employee Management
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white backdrop-blur-md">
                    Approvals &amp; Policies
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-200">
              <ShieldCheck
                size={17}
                className="shrink-0 text-[#f1c43b]"
                aria-hidden="true"
              />

              <span>
                Secure access with trusted-device
                verification.
              </span>
            </div>
          </div>
        </section>

        {/* ============================================================
            AUTHENTICATION PANEL
           ============================================================ */}
        <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 xl:px-12">
          <div className="w-full max-w-md">
            {/* Mobile branding */}
            <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white shadow-md">
                <img
                  src={ziyaLogo}
                  alt="Ziya logo"
                  className="h-full w-full object-contain"
                />
              </div>

              <div>
                <div className="text-xl font-bold tracking-tight text-[#071a35]">
                  Ziya HR
                </div>

                <div className="text-[8px] font-semibold tracking-[0.16em] text-slate-500">
                  PEOPLE • TIME • TOGETHER
                </div>
              </div>
            </div>

            {/* Mobile cover */}
            <div className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-[#071a35] shadow-sm lg:hidden">
              <div className="relative h-40 overflow-hidden sm:h-48">
                <img
                  src={leaveManagementCover}
                  alt="Ziya HR leave management"
                  className="absolute inset-0 h-full w-full object-cover"
                />

                <div className="absolute inset-0 bg-[#071a35]/45" />

                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#f1c43b]">
                    Ziya HR
                  </p>

                  <p className="mt-1 text-lg font-bold text-white sm:text-xl">
                    Leave management made simple.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.07)] sm:p-8">
              {renderAuthenticationScreen()}
            </div>

            <p className="mt-5 text-center text-xs leading-5 text-slate-400">
              Your access is protected by Ziya HR
              security controls. Never share your
              password or verification code with
              anyone.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}