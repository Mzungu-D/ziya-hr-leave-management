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
 * - Employee account invitation delivery
 *
 * Security:
 * - SMTP credentials are read only from validated environment
 *   configuration.
 * - OTPs are never logged.
 * - Password-reset and activation URLs are never logged.
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
 * Validate a link placed inside an email.
 *
 * Links are generated internally by the application. In production they
 * must use HTTPS so a misconfiguration cannot produce an insecure link.
 * The original string is returned so tokens are never altered.
 */
function assertLinkUrl(
  url: string,
  errorMessage: string,
): string {
  const normalized = url.trim();

  if (
    !normalized ||
    normalized.length > 2048
  ) {
    throw new AppError(
      500,
      errorMessage,
      "EMAIL_CONFIGURATION_ERROR",
    );
  }

  let parsed: URL;

  try {
    parsed = new URL(normalized);
  } catch {
    throw new AppError(
      500,
      errorMessage,
      "EMAIL_CONFIGURATION_ERROR",
    );
  }

  const isHttps =
    parsed.protocol === "https:";

  const isHttp =
    parsed.protocol === "http:";

  if (
    !isHttps &&
    !(
      isHttp &&
      env.NODE_ENV !== "production"
    )
  ) {
    throw new AppError(
      500,
      errorMessage,
      "EMAIL_CONFIGURATION_ERROR",
    );
  }

  return normalized;
}

// CHANGED: display name shown to recipients
const SENDER_NAME = "Ziya People & Culture";

/**
 * Return the configured sender.
 *
 * SMTP_FROM must be a bare email address (validated in env.ts). The
 * display name is added here.
 */
// CHANGED: returns { name, address } instead of a plain string
function getFromAddress(): {
  name: string;
  address: string;
} {
  const from = env.SMTP_FROM?.trim();

  if (!from) {
    throw new AppError(
      503,
      "Email delivery is not configured.",
      "EMAIL_SERVICE_UNAVAILABLE",
    );
  }

  return {
    name: SENDER_NAME,
    address: from,
  };
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

/* -------------------------------------------------------------------------- */
/* Shared email design                                                        */
/* -------------------------------------------------------------------------- */

const BRAND = {
  navy: "#071a35",
  gold: "#d8a415",
  goldDark: "#b88900",
  text: "#0f172a",
  muted: "#475569",
  faint: "#94a3b8",
  border: "#e2e8f0",
  page: "#f1f5f9",
  panel: "#f8fafc",
} as const;

const FONT = "Arial,Helvetica,sans-serif";

/**
 * Render the shared Ziya email layout.
 *
 * Email clients have limited CSS support, so the layout uses tables and
 * inline styles. Every dynamic value is escaped before being inserted.
 * `contentHtml` must be built only from the render helpers below.
 */
function renderEmailLayout(input: {
  title: string;
  preheader: string;
  heading: string;
  contentHtml: string;
  recipient: string;
}): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${escapeHtml(input.title)}</title>
  </head>

  <body style="margin:0;padding:0;background-color:${BRAND.page};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${BRAND.page};">
      ${escapeHtml(input.preheader)}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.page};">
      <tr>
        <td align="center" style="padding:32px 16px;">

          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

            <tr>
              <td style="background-color:${BRAND.navy};padding:24px 32px;border-radius:12px 12px 0 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" width="44" height="44" style="width:44px;height:44px;background-color:${BRAND.gold};border-radius:10px;font-family:${FONT};font-size:22px;font-weight:700;color:${BRAND.navy};">Z</td>
                    <td style="padding-left:12px;font-family:${FONT};">
                      <div style="font-size:20px;font-weight:700;color:#ffffff;line-height:1.1;">ziya</div>
                      <div style="font-size:10px;font-weight:600;letter-spacing:2px;color:${BRAND.gold};margin-top:3px;">PEOPLE &amp; CULTURE</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="background-color:#ffffff;padding:36px 32px;border-left:1px solid ${BRAND.border};border-right:1px solid ${BRAND.border};border-bottom:1px solid ${BRAND.border};border-radius:0 0 12px 12px;font-family:${FONT};">
                <h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;font-weight:700;color:${BRAND.text};">${escapeHtml(input.heading)}</h1>
                ${input.contentHtml}
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:20px 8px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${BRAND.faint};">
                This message was sent to ${escapeHtml(input.recipient)}.<br>
                Ziya People &amp; Culture &middot; Automated message
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Paragraph. `html` must already be safe (escape dynamic parts first).
 */
function renderParagraph(
  html: string,
  tone: "body" | "muted" = "body",
): string {
  const color =
    tone === "body"
      ? BRAND.muted
      : "#64748b";

  const size =
    tone === "body"
      ? 15
      : 13;

  return `<p style="margin:0 0 16px;font-size:${size}px;line-height:1.6;color:${color};">${html}</p>`;
}

function renderSubheading(text: string): string {
  return `<h2 style="margin:28px 0 14px;font-size:15px;line-height:1.4;font-weight:700;color:${BRAND.text};">${escapeHtml(text)}</h2>`;
}

function renderButton(
  label: string,
  url: string,
): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
  <tr>
    <td align="center" style="background-color:${BRAND.navy};border-radius:8px;">
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

function renderLinkFallback(url: string): string {
  return `<p style="margin:0 0 20px;font-size:12px;line-height:1.6;color:#64748b;">If the button does not work, copy and paste this link into your browser:<br><a href="${escapeHtml(url)}" style="color:${BRAND.goldDark};word-break:break-all;">${escapeHtml(url)}</a></p>`;
}

function renderCodeBox(code: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
  <tr>
    <td align="center" style="background-color:${BRAND.panel};border:1px solid ${BRAND.border};border-radius:10px;padding:22px;font-family:${FONT};font-size:32px;font-weight:700;letter-spacing:8px;color:${BRAND.text};">${escapeHtml(code)}</td>
  </tr>
</table>`;
}

function renderSteps(steps: string[]): string {
  const rows = steps
    .map(
      (step, index) => `
  <tr>
    <td valign="top" width="36" style="width:36px;padding:0 12px 12px 0;">
      <div style="width:24px;height:24px;line-height:24px;text-align:center;border-radius:12px;background-color:${BRAND.gold};color:${BRAND.navy};font-family:${FONT};font-size:12px;font-weight:700;">${index + 1}</div>
    </td>
    <td valign="top" style="padding:2px 0 12px;font-family:${FONT};font-size:14px;line-height:1.5;color:${BRAND.muted};">${escapeHtml(step)}</td>
  </tr>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}
</table>`;
}

function renderInfoPanel(
  title: string,
  items: string[],
): string {
  const listItems = items
    .map(
      (item) =>
        `<li style="margin:0 0 6px;">${escapeHtml(item)}</li>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
  <tr>
    <td style="background-color:${BRAND.panel};border:1px solid ${BRAND.border};border-left:4px solid ${BRAND.gold};border-radius:8px;padding:16px 20px;font-family:${FONT};">
      <div style="margin:0 0 10px;font-size:13px;font-weight:700;color:${BRAND.text};">${escapeHtml(title)}</div>
      <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6;color:${BRAND.muted};">${listItems}</ul>
    </td>
  </tr>
</table>`;
}

/**
 * Format a duration in hours as "N hours" or "N days".
 */
function formatDuration(hours: number): string {
  if (hours % 24 === 0) {
    const days = hours / 24;

    return days === 1
      ? "1 day"
      : `${days} days`;
  }

  return hours === 1
    ? "1 hour"
    : `${hours} hours`;
}

/* -------------------------------------------------------------------------- */
/* Login verification code                                                    */
/* -------------------------------------------------------------------------- */

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

  const html = renderEmailLayout({
    title: "Ziya HR Verification Code",
    preheader: `Your Ziya HR verification code expires in ${ttl} minutes.`,
    heading: "Verification code",
    recipient,
    contentHtml: [
      renderParagraph(
        "Use the verification code below to complete your sign-in to Ziya HR.",
      ),
      renderCodeBox(normalizedOtp),
      renderParagraph(
        `This code expires in <strong>${escapeHtml(ttl)} minutes</strong>.`,
      ),
      renderParagraph(
        "If you did not attempt to sign in to Ziya HR, contact your HR administrator immediately.",
        "muted",
      ),
    ].join("\n"),
  });

  await sendEmail({
    to: recipient,
    subject,
    text,
    html,
  });
}

/* -------------------------------------------------------------------------- */
/* Password reset                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Send a password-reset email.
 */
export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
): Promise<void> {
  const recipient =
    assertEmailAddress(email);

  /**
   * The reset URL is generated internally by the authentication
   * service. In production it must be HTTPS so that a malformed
   * configuration cannot create an insecure password-reset link.
   */
  const normalizedUrl =
    assertLinkUrl(
      resetUrl,
      "Password-reset email configuration is invalid.",
    );

  const ttl =
    String(
      env.PASSWORD_RESET_TTL_MINUTES,
    );

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

  const html = renderEmailLayout({
    title: "Reset your Ziya HR password",
    preheader: `Reset your Ziya HR password. This link expires in ${ttl} minutes.`,
    heading: "Reset your password",
    recipient,
    contentHtml: [
      renderParagraph(
        "A password reset was requested for your Ziya HR account. Select the button below to create a new password.",
      ),
      renderButton(
        "Reset password",
        normalizedUrl,
      ),
      renderLinkFallback(normalizedUrl),
      renderParagraph(
        `This link expires in <strong>${escapeHtml(ttl)} minutes</strong>.`,
      ),
      renderParagraph(
        "If you did not request this password reset, you can safely ignore this email. Your password will not change.",
        "muted",
      ),
    ].join("\n"),
  });

  await sendEmail({
    to: recipient,
    subject,
    text,
    html,
  });
}

/* -------------------------------------------------------------------------- */
/* Employee invitation                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Send an account invitation to a newly created employee.
 *
 * The activation URL and its expiry are produced by the activation
 * workflow. This function only validates and delivers them.
 */
export async function sendEmployeeInviteEmail(params: {
  email: string;
  firstName: string;
  activationUrl: string;
  expiresInHours: number;
}): Promise<void> {
  const recipient =
    assertEmailAddress(
      params.email,
    );

  const activationUrl =
    assertLinkUrl(
      params.activationUrl,
      "Invitation email configuration is invalid.",
    );

  const hours =
    params.expiresInHours;

  if (
    !Number.isInteger(hours) ||
    hours < 1 ||
    hours > 720
  ) {
    throw new AppError(
      500,
      "Invitation email configuration is invalid.",
      "EMAIL_CONFIGURATION_ERROR",
    );
  }

  const firstName =
    params.firstName
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 100) || "there";

  const duration =
    formatDuration(hours);

  const subject =
    "Welcome to Ziya HR — activate your account";

  const text =
    [
      "Ziya HR",
      "",
      `Hello ${firstName},`,
      "",
      "Your Ziya HR account has been created. Activate it to set your password and sign in to the employee portal.",
      "",
      "Activate your account:",
      activationUrl,
      "",
      "What happens next:",
      "1. Create a secure password for your account.",
      "2. Sign in and complete your onboarding form.",
      "3. HR reviews your details and confirms your onboarding.",
      "",
      "Have these ready:",
      "- National ID or passport number",
      "- KRA PIN, NSSF and SHA numbers",
      "- Bank account or M-Pesa details",
      "- Two emergency contacts and your next-of-kin details",
      "",
      `This link expires in ${duration}. If it has expired, ask HR to send you a new invitation.`,
      "",
      "If you were not expecting this invitation, you can ignore this email.",
    ].join("\n");

  const html = renderEmailLayout({
    title: "Welcome to Ziya HR",
    preheader:
      "Your Ziya HR account is ready. Activate it to get started.",
    heading: "Welcome to Ziya HR",
    recipient,
    contentHtml: [
      renderParagraph(
        `Hello ${escapeHtml(firstName)},`,
      ),
      renderParagraph(
        "Your Ziya HR account has been created. Activate it to set your password and sign in to the employee portal.",
      ),
      renderButton(
        "Activate your account",
        activationUrl,
      ),
      renderLinkFallback(activationUrl),
      renderSubheading("What happens next"),
      renderSteps([
        "Create a secure password for your account.",
        "Sign in and complete your onboarding form.",
        "HR reviews your details and confirms your onboarding.",
      ]),
      renderInfoPanel(
        "Have these ready",
        [
          "National ID or passport number",
          "KRA PIN, NSSF and SHA numbers",
          "Bank account or M-Pesa details",
          "Two emergency contacts and your next-of-kin details",
        ],
      ),
      renderParagraph(
        `This link expires in <strong>${escapeHtml(duration)}</strong>. If it has expired, ask HR to send you a new invitation.`,
      ),
      renderParagraph(
        "If you were not expecting this invitation, you can ignore this email.",
        "muted",
      ),
    ].join("\n"),
  });

  await sendEmail({
    to: recipient,
    subject,
    text,
    html,
  });
}