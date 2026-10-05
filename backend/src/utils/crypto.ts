import {
  createHash,
  randomBytes,
  randomInt,
} from "node:crypto";

import bcrypt from "bcryptjs";

/**
 * Password hashing configuration.
 *
 * 12 bcrypt rounds provides a strong production baseline while
 * maintaining reasonable authentication performance.
 */
const BCRYPT_ROUNDS = 12;

/**
 * bcrypt only processes the first 72 bytes of a password.
 *
 * Explicitly enforcing this limit prevents silent truncation
 * and avoids different passwords becoming equivalent.
 */
const BCRYPT_MAX_PASSWORD_BYTES = 72;

/**
 * Opaque token limits.
 *
 * Tokens must have sufficient entropy and should not be allowed
 * to request unreasonable amounts of random data.
 */
const MIN_OPAQUE_TOKEN_BYTES = 16;
const MAX_OPAQUE_TOKEN_BYTES = 128;

/**
 * Authentication OTP configuration.
 */
const OTP_LENGTH = 6;

/**
 * Generate a cryptographically secure opaque token.
 *
 * Used for credentials such as password-reset tokens.
 *
 * The raw token should only exist for the duration required to
 * deliver it to the user. Only its hash should be persisted.
 */
export function generateOpaqueToken(
  bytes = 32,
): string {
  if (
    !Number.isInteger(bytes) ||
    bytes < MIN_OPAQUE_TOKEN_BYTES ||
    bytes > MAX_OPAQUE_TOKEN_BYTES
  ) {
    throw new Error(
      `Opaque token size must be between ${MIN_OPAQUE_TOKEN_BYTES} and ${MAX_OPAQUE_TOKEN_BYTES} bytes.`,
    );
  }

  return randomBytes(bytes).toString("hex");
}

/**
 * Hash an opaque token using SHA-256.
 *
 * The raw token must never be stored in the database.
 */
export function hashOpaqueToken(
  token: string,
): string {
  if (
    typeof token !== "string" ||
    token.length === 0
  ) {
    throw new Error(
      "Cannot hash an empty opaque token.",
    );
  }

  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

/**
 * Generate a cryptographically secure six-digit OTP.
 *
 * randomInt() is used instead of Math.random() because
 * authentication codes are security credentials.
 */
export function generateOtp(): string {
  const upperBound =
    10 ** OTP_LENGTH;

  return randomInt(
    0,
    upperBound,
  )
    .toString()
    .padStart(
      OTP_LENGTH,
      "0",
    );
}

/**
 * Hash an OTP together with the employee identifier and
 * application authentication secret.
 *
 * The employee identifier provides account-specific context,
 * while the server secret prevents an attacker who obtains
 * database records from reproducing OTP hashes independently.
 *
 * OTPs are additionally protected by:
 * - short expiration
 * - limited verification attempts
 * - one active device-verification OTP per employee
 */
export function hashOtp(
  employeeId: string,
  otp: string,
): string {
  const normalizedEmployeeId =
    employeeId.trim();

  const normalizedOtp =
    otp.trim();

  if (!normalizedEmployeeId) {
    throw new Error(
      "Employee ID is required to hash an OTP.",
    );
  }

  if (
    !new RegExp(
      `^\\d{${OTP_LENGTH}}$`,
    ).test(normalizedOtp)
  ) {
    throw new Error(
      "OTP must be a six-digit value.",
    );
  }

  const secret =
    process.env["JWT_ACCESS_SECRET"];

  if (
    !secret ||
    secret.trim().length < 32
  ) {
    throw new Error(
      "JWT_ACCESS_SECRET must be configured with sufficient entropy.",
    );
  }

  return createHash("sha256")
    .update(
      `${employeeId}:${normalizedOtp}:${secret}`,
      "utf8",
    )
    .digest("hex");
}

/**
 * Validate a password before passing it to bcrypt.
 */
function assertPassword(
  password: string,
): void {
  if (
    typeof password !== "string" ||
    password.length === 0
  ) {
    throw new Error(
      "Password cannot be empty.",
    );
  }

  const passwordBytes =
    Buffer.byteLength(
      password,
      "utf8",
    );

  if (
    passwordBytes >
    BCRYPT_MAX_PASSWORD_BYTES
  ) {
    throw new Error(
      `Password cannot exceed ${BCRYPT_MAX_PASSWORD_BYTES} bytes.`,
    );
  }
}

/**
 * Hash a password using bcrypt.
 */
export async function hashPassword(
  password: string,
): Promise<string> {
  assertPassword(password);

  return bcrypt.hash(
    password,
    BCRYPT_ROUNDS,
  );
}

/**
 * Verify a plaintext password against a bcrypt hash.
 *
 * Invalid password input is treated as a failed verification
 * rather than exposing cryptographic implementation details.
 */
export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  if (
    typeof password !== "string" ||
    typeof passwordHash !== "string" ||
    passwordHash.length === 0
  ) {
    return false;
  }

  try {
    assertPassword(password);

    return await bcrypt.compare(
      password,
      passwordHash,
    );
  } catch {
    return false;
  }
}

/**
 * Normalize an email address.
 *
 * Only universal normalization is performed:
 * - surrounding whitespace is removed
 * - characters are converted to lowercase
 *
 * Provider-specific transformations such as removing dots or
 * plus-addressing are intentionally not performed because they
 * can change legitimate email addresses.
 */
export function normalizeEmail(
  email: string,
): string {
  return email
    .trim()
    .toLowerCase();
}

/**
 * Normalize a phone number globally.
 *
 * Ziya is designed to support employees internationally and
 * therefore does not assume Kenya or any other country.
 *
 * Examples:
 *
 *   +254 712 345 678 -> +254712345678
 *   +1 (202) 555-0147 -> +12025550147
 *   +44 20 7946 0958 -> +442079460958
 *   254712345678 -> +254712345678
 *
 * Important:
 * A local number such as 0712345678 cannot safely be converted
 * into an international number without knowing the user's country.
 * The frontend should therefore collect country information when
 * local-number input is supported.
 *
 * Country-specific validation belongs at the request/application
 * layer, where country context is available.
 */
export function normalizePhone(
  phone: string,
): string {
  const cleaned = phone
    .trim()
    .replace(
      /[\s().-]/g,
      "",
    );

  if (!cleaned) {
    return "";
  }

  /**
   * Already using international notation.
   *
   * Example:
   * +254712345678
   * +12025550147
   * +442079460958
   */
  if (cleaned.startsWith("+")) {
    return cleaned;
  }

  /**
   * International number supplied without the leading +.
   *
   * Example:
   * 254712345678 -> +254712345678
   * 12025550147  -> +12025550147
   */
  if (/^\d{8,15}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  /**
   * Do not guess the country for a local number.
   *
   * The request/application layer should validate local numbers
   * using the selected country and convert them to E.164 before
   * persistence.
   */
  return cleaned;
}