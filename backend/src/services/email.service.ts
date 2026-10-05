import nodemailer, {
  type SendMailOptions,
  type Transporter,
} from "nodemailer";

import { env } from "../config/env.js";
import { AppError } from "../middleware/error.middleware.js";

/**
 * Production email service.
 *
 * Responsibilities:
 * - SMTP transport management
 * - Authentication OTP delivery
 * - Password-reset delivery
 *
 * Security:
 * - SMTP credentials are read only from validated environment
 *   configuration.
 * - OTPs are never logged.
 * - Password-reset URLs are never logged.
 * - User-controlled values are HTML-escaped before being inserted
 *   into HTML email content.
 * - SMTP operations use connection/timeouts rather than allowing
 *   requests to hang indefinitely.
 *
 * Reliability:
 * - A single SMTP transporter is reused by the process.
 * - The transporter is verified before first use.
 * - Delivery failures are converted into controlled application
 *   errors while preserving the original error in server logs.
 */

const SMTP_CONNECTION_TIMEOUT_MS = 10_000;
const SMTP_GREETING_TIMEOUT_MS = 10_000;
const SMTP_SOCKET_TIMEOUT_MS = 20_000;

let transporter: Transporter | null = null;
let transporterVerified = false;

/**
 * Escape text before inserting it into HTML.
 *
 * This is particularly important for email addresses and URLs.
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Validate a basic email address before attempting delivery.
 *
 * Full email validation remains the responsibility of the
 * request validation layer. This prevents obviously malformed
 * addresses from reaching the SMTP transport.
 */
function assertEmailAddress(email: string): string {
  const normalized = email.trim();

  if (!normalized) {
    throw new AppError(
      400,
      "A valid email address is required.",
      "INVALID_EMAIL_ADDRESS",
    );
  }

  if (
    normalized.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      normalized,
    )
  ) {
    throw new AppError(
      400,
      "A valid email address is required.",
      "INVALID_EMAIL_ADDRESS",
    );
  }

  return normalized;
}

/**
 * Validate a value used as an email subject.
 */
function assertSubject(subject: string): string {
  const normalized = subject.trim();

  if (!normalized) {
    throw new AppError(
      500,
      "Email configuration is invalid.",
      "EMAIL_CONFIGURATION_ERROR",
    );
  }

  if (normalized.length > 998) {
    throw new AppError(
      500,
      "Email configuration is invalid.",
      "EMAIL_CONFIGURATION_ERROR",
    );
  }

  return normalized;
}

/**
 * Return the configured sender address.
 */
function getFromAddress(): string {
  const from = env.SMTP_FROM?.trim();

  if (!from) {
    throw new AppError(
      503,
      "Email delivery is not configured.",
      "EMAIL_SERVICE_UNAVAILABLE",
    );
  }

  return from;
}

/**
 * Create the SMTP transporter once and reuse it.
 *
 * Creating a new transporter for every email can create unnecessary
 * TCP/TLS connections and makes delivery less efficient under load.
 */
function getTransporter(): Transporter {
  if (transporter) {
    return transporter;
  }

  if (
    !env.SMTP_HOST ||
    !env.SMTP_USER ||
    !env.SMTP_PASSWORD ||
    !env.SMTP_PORT
  ) {
    throw new AppError(
      503,
      "Email delivery is not configured.",
      "EMAIL_SERVICE_UNAVAILABLE",
    );
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,

    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },

    connectionTimeout:
      SMTP_CONNECTION_TIMEOUT_MS,

    greetingTimeout:
      SMTP_GREETING_TIMEOUT_MS,

    socketTimeout:
      SMTP_SOCKET_TIMEOUT_MS,

    pool: true,

    maxConnections: 5,

    maxMessages: 100,

    disableFileAccess: true,

    disableUrlAccess: true,
  });

  return transporter;
}

/**
 * Verify the SMTP transport before the first delivery.
 *
 * The result is cached for the lifetime of the process.
 */
async function ensureTransporterReady(): Promise<Transporter> {
  const mailer = getTransporter();

  if (transporterVerified) {
    return mailer;
  }

  try {
    await mailer.verify();

    transporterVerified = true;

    return mailer;
  } catch (error) {
    console.error(
      "SMTP transporter verification failed:",
      error,
    );

    throw new AppError(
      503,
      "Email delivery is temporarily unavailable.",
      "EMAIL_SERVICE_UNAVAILABLE",
    );
  }
}

/**
 * Send an email.
 *
 * Delivery errors are deliberately not exposed to callers with
 * SMTP-specific details.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const to = assertEmailAddress(
    params.to,
  );

  const subject = assertSubject(
    params.subject,
  );

  if (!params.text.trim()) {
    throw new AppError(
      500,
      "Email content is not configured correctly.",
      "EMAIL_CONFIGURATION_ERROR",
    );
  }

  if (!params.html.trim()) {
    throw new AppError(
      500,
      "Email content is not configured correctly.",
      "EMAIL_CONFIGURATION_ERROR",
    );
  }

  const mailer =
    await ensureTransporterReady();

  const message: SendMailOptions = {
    from: getFromAddress(),
    to,
    subject,
    text: params.text,
    html: params.html,

    /**
     * Prevent Nodemailer from attempting to load arbitrary
     * files or remote resources through message options.
     */
    disableFileAccess: true,
    disableUrlAccess: true,
  };

  try {
    await mailer.sendMail(message);
  } catch (error) {
    /**
     * Do not expose SMTP credentials, connection details,
     * provider responses, or raw Nodemailer errors to clients.
     */
    console.error(
      "Email delivery failed:",
      error,
    );

    /**
     * The cached verification state may no longer reflect
     * the actual SMTP connection state. Force verification
     * on the next attempt.
     */
    transporterVerified = false;

    throw new AppError(
      503,
      "Email delivery is temporarily unavailable.",
      "EMAIL_DELIVERY_FAILED",
    );
  }
}

/**
 * Send a login/device-verification OTP.
 */
export async function sendLoginOtpEmail(
  email: string,
  otp: string,
): Promise<void> {
  const recipient =
    assertEmailAddress(email);

  const normalizedOtp =
    otp.trim();

  if (
    !/^\d{4,8}$/.test(
      normalizedOtp,
    )
  ) {
    throw new AppError(
      500,
      "Unable to prepare the verification email.",
      "EMAIL_CONFIGURATION_ERROR",
    );
  }

  const ttl =
    String(env.OTP_TTL_MINUTES);

  const safeRecipient =
    escapeHtml(recipient);

  const safeOtp =
    escapeHtml(normalizedOtp);

  const subject =
    "Your Ziya HR verification code";

  const text =
    [
      "Ziya HR",
      "",
      `Your verification code is: ${normalizedOtp}`,
      "",
      `This code expires in ${ttl} minutes.`,
      "",
      "If you did not attempt to sign in, contact your HR administrator immediately.",
    ].join("\n");

  const html = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1"
    >
    <title>Ziya HR Verification Code</title>
  </head>

  <body
    style="
      margin:0;
      padding:0;
      background:#f8fafc;
      color:#0f172a;
      font-family:Arial,Helvetica,sans-serif;
    "
  >
    <div
      style="
        max-width:600px;
        margin:0 auto;
        padding:32px 20px;
      "
    >
      <div
        style="
          background:#ffffff;
          border:1px solid #e2e8f0;
          border-radius:12px;
          padding:32px;
        "
      >
        <div
          style="
            font-size:20px;
            font-weight:700;
            margin-bottom:24px;
          "
        >
          Ziya HR
        </div>

        <h1
          style="
            margin:0 0 16px;
            font-size:24px;
            line-height:1.3;
          "
        >
          Verification code
        </h1>

        <p
          style="
            margin:0 0 24px;
            color:#475569;
            font-size:15px;
            line-height:1.6;
          "
        >
          Use the verification code below to complete your
          sign-in to Ziya HR.
        </p>

        <div
          style="
            margin:24px 0;
            padding:20px;
            background:#f8fafc;
            border:1px solid #e2e8f0;
            border-radius:8px;
            text-align:center;
          "
        >
          <div
            style="
              font-size:30px;
              font-weight:700;
              letter-spacing:8px;
              color:#0f172a;
            "
          >
            ${safeOtp}
          </div>
        </div>

        <p
          style="
            margin:0 0 12px;
            color:#475569;
            font-size:14px;
            line-height:1.6;
          "
        >
          This code expires in
          <strong>${escapeHtml(ttl)} minutes</strong>.
        </p>

        <p
          style="
            margin:0;
            color:#64748b;
            font-size:13px;
            line-height:1.6;
          "
        >
          If you did not attempt to sign in to Ziya HR,
          contact your HR administrator immediately.
        </p>

        <p
          style="
            margin:24px 0 0;
            color:#94a3b8;
            font-size:12px;
          "
        >
          This message was sent to ${safeRecipient}.
        </p>
      </div>
    </div>
  </body>
</html>
`;

  await sendEmail({
    to: recipient,
    subject,
    text,
    html,
  });
}

/**
 * Send a password-reset email.
 */
export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
): Promise<void> {
  const recipient =
    assertEmailAddress(email);

  const normalizedUrl =
    resetUrl.trim();

  if (!normalizedUrl) {
    throw new AppError(
      500,
      "Unable to prepare the password-reset email.",
      "EMAIL_CONFIGURATION_ERROR",
    );
  }

  /**
   * The reset URL is generated internally by the authentication
   * service. Restrict it to HTTPS in production so that a malformed
   * configuration cannot create an insecure password-reset link.
   */
  if (
    env.NODE_ENV === "production" &&
    !normalizedUrl.startsWith("https://")
  ) {
    throw new AppError(
      500,
      "Password-reset email configuration is invalid.",
      "EMAIL_CONFIGURATION_ERROR",
    );
  }

  const ttl =
    String(
      env.PASSWORD_RESET_TTL_MINUTES,
    );

  const safeRecipient =
    escapeHtml(recipient);

  const safeResetUrl =
    escapeHtml(normalizedUrl);

  const subject =
    "Reset your Ziya HR password";

  const text =
    [
      "Ziya HR",
      "",
      "A password reset was requested for your account.",
      "",
      "Use the following link to reset your password:",
      normalizedUrl,
      "",
      `This link expires in ${ttl} minutes.`,
      "",
      "If you did not request a password reset, you can safely ignore this email.",
    ].join("\n");

  const html = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1"
    >
    <title>Reset your Ziya HR password</title>
  </head>

  <body
    style="
      margin:0;
      padding:0;
      background:#f8fafc;
      color:#0f172a;
      font-family:Arial,Helvetica,sans-serif;
    "
  >
    <div
      style="
        max-width:600px;
        margin:0 auto;
        padding:32px 20px;
      "
    >
      <div
        style="
          background:#ffffff;
          border:1px solid #e2e8f0;
          border-radius:12px;
          padding:32px;
        "
      >
        <div
          style="
            font-size:20px;
            font-weight:700;
            margin-bottom:24px;
          "
        >
          Ziya HR
        </div>

        <h1
          style="
            margin:0 0 16px;
            font-size:24px;
            line-height:1.3;
          "
        >
          Reset your password
        </h1>

        <p
          style="
            margin:0 0 20px;
            color:#475569;
            font-size:15px;
            line-height:1.6;
          "
        >
          A password reset was requested for your Ziya HR
          account.
        </p>

        <p
          style="
            margin:0 0 24px;
            color:#475569;
            font-size:15px;
            line-height:1.6;
          "
        >
          Click the button below to create a new password.
        </p>

        <p style="margin:0 0 24px;">
          <a
            href="${safeResetUrl}"
            style="
              display:inline-block;
              padding:13px 22px;
              background:#0f172a;
              color:#ffffff;
              text-decoration:none;
              border-radius:7px;
              font-size:14px;
              font-weight:600;
            "
          >
            Reset Password
          </a>
        </p>

        <p
          style="
            margin:0 0 12px;
            color:#475569;
            font-size:14px;
            line-height:1.6;
          "
        >
          This link expires in
          <strong>${escapeHtml(ttl)} minutes</strong>.
        </p>

        <p
          style="
            margin:0;
            color:#64748b;
            font-size:13px;
            line-height:1.6;
          "
        >
          If you did not request this password reset,
          you can safely ignore this email.
        </p>

        <p
          style="
            margin:24px 0 0;
            color:#94a3b8;
            font-size:12px;
          "
        >
          This message was sent to ${safeRecipient}.
        </p>
      </div>
    </div>
  </body>
</html>
`;

  await sendEmail({
    to: recipient,
    subject,
    text,
    html,
  });
}