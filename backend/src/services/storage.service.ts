import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";
import {
  createHash,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";

import { env } from "../config/env.js";
import { AppError } from "../middleware/error.middleware.js";

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

const MAX_PROFILE_PICTURE_BYTES = 5 * 1024 * 1024;
const MAX_NORMALIZED_PROFILE_PICTURE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_WIDTH = 4096;
const MAX_IMAGE_HEIGHT = 4096;
const MAX_IMAGE_PIXELS = 16_000_000;

const MAX_ONBOARDING_DOCUMENT_BYTES = 10 * 1024 * 1024;

const PRIVATE_CACHE_CONTROL = "private, no-store, max-age=0";
const PROFILE_PICTURE_PREFIX = "profile-pictures";
const ONBOARDING_DOCUMENT_PREFIX = "onboarding-documents";

const STORED_PROFILE_PICTURE_MIME = "image/jpeg";

const ALLOWED_PROFILE_PICTURE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const ALLOWED_ONBOARDING_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export const ONBOARDING_DOCUMENT_TYPES = [
  "IDENTIFICATION",
  "KRA_CERTIFICATE",
  "NSSF_PROOF",
  "SHA_PROOF",
  "OTHER",
] as const;

export type OnboardingDocumentType =
  (typeof ONBOARDING_DOCUMENT_TYPES)[number];

export type OnboardingDocumentMimeType =
  | "application/pdf"
  | "image/jpeg"
  | "image/png";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PROFILE_PICTURE_FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/i;

/* -------------------------------------------------------------------------- */
/* Storage client                                                             */
/* -------------------------------------------------------------------------- */

interface StorageContext {
  client: S3Client;
  bucket: string;
}

function createStorageContext(): StorageContext {
  const endpoint = env.S3_ENDPOINT?.trim();
  const region = env.S3_REGION?.trim();
  const accessKeyId = env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY?.trim();
  const bucket = env.S3_BUCKET_NAME?.trim();

  if (
    !endpoint ||
    !region ||
    !accessKeyId ||
    !secretAccessKey ||
    !bucket
  ) {
    throw new AppError(
      503,
      "Private file storage is not configured.",
      "STORAGE_NOT_CONFIGURED",
    );
  }

  let parsedEndpoint: URL;

  try {
    parsedEndpoint = new URL(endpoint);
  } catch {
    throw new AppError(
      503,
      "The private storage endpoint is invalid.",
      "STORAGE_CONFIGURATION_INVALID",
    );
  }

  if (
    parsedEndpoint.protocol !== "https:" &&
    parsedEndpoint.hostname !== "localhost" &&
    parsedEndpoint.hostname !== "127.0.0.1"
  ) {
    throw new AppError(
      503,
      "Private storage must use HTTPS.",
      "STORAGE_HTTPS_REQUIRED",
    );
  }

  return {
    client: new S3Client({
      endpoint: parsedEndpoint.toString(),
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: false,
    }),
    bucket,
  };
}

/* -------------------------------------------------------------------------- */
/* Public interfaces                                                          */
/* -------------------------------------------------------------------------- */

export interface ProfilePictureUploadInput {
  organizationId: string;
  employeeId: string;
  buffer: Buffer;
  originalName?: string;
  declaredMimeType?: string;
}

export interface ProfilePictureUploadResult {
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  width: number;
  height: number;
}

export interface PrivateObjectDownload {
  body: Buffer;
  contentType?: string;
  contentLength?: number;
  metadata?: Record<string, string>;
  etag?: string;
}

export interface StoredObjectVerification {
  exists: boolean;
  contentType?: string;
  contentLength?: number;
  sha256?: string;
  etag?: string;
}

export interface OnboardingDocumentUploadInput {
  organizationId: string;
  employeeId: string;
  documentType: OnboardingDocumentType;
  buffer: Buffer;
  originalName?: string;
}

export interface OnboardingDocumentUploadResult {
  storageKey: string;
  originalName: string;
  mimeType: OnboardingDocumentMimeType;
  sizeBytes: number;
  sha256: string;
}

export interface OnboardingDocumentDownloadResult {
  body: Buffer;
  contentType: OnboardingDocumentMimeType;
  contentLength: number;
  sha256: string;
  etag?: string;
}

/* -------------------------------------------------------------------------- */
/* Common validation helpers                                                  */
/* -------------------------------------------------------------------------- */

function assertNonEmptyIdentifier(
  value: string,
  fieldName: string,
): string {
  if (typeof value !== "string") {
    throw new AppError(
      400,
      `${fieldName} is required.`,
      "STORAGE_IDENTIFIER_INVALID",
    );
  }

  const normalized = value.trim();

  if (
    !normalized ||
    normalized.length > 255 ||
    normalized.includes("/") ||
    normalized.includes("\\") ||
    normalized.includes("..") ||
    /[\u0000-\u001F\u007F]/.test(normalized)
  ) {
    throw new AppError(
      400,
      `${fieldName} is invalid.`,
      "STORAGE_IDENTIFIER_INVALID",
    );
  }

  return normalized;
}

function sanitizeOriginalName(originalName?: string): string {
  if (typeof originalName !== "string" || !originalName.trim()) {
    return "uploaded-file";
  }

  const sanitized = path
    .basename(originalName)
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim();

  return sanitized ? sanitized.slice(0, 255) : "uploaded-file";
}

function calculateSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function verifySha256(
  expectedHex: string,
  actualHex: string,
): boolean {
  if (
    !/^[a-f0-9]{64}$/i.test(expectedHex) ||
    !/^[a-f0-9]{64}$/i.test(actualHex)
  ) {
    return false;
  }

  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHex, "hex");

  return (
    expected.length === actual.length &&
    timingSafeEqual(expected, actual)
  );
}

function isNotFound(error: unknown): boolean {
  const candidate = error as {
    $metadata?: { httpStatusCode?: number };
    name?: string;
    Code?: string;
  };

  return (
    candidate?.$metadata?.httpStatusCode === 404 ||
    candidate?.name === "NotFound" ||
    candidate?.Code === "NoSuchKey" ||
    candidate?.Code === "NotFound"
  );
}

/* -------------------------------------------------------------------------- */
/* Profile-picture storage-key validation                                     */
/* -------------------------------------------------------------------------- */

function createProfilePictureStorageKey(
  organizationId: string,
  employeeId: string,
): string {
  return [
    "organizations",
    encodeURIComponent(
      assertNonEmptyIdentifier(organizationId, "organizationId"),
    ),
    "employees",
    encodeURIComponent(
      assertNonEmptyIdentifier(employeeId, "employeeId"),
    ),
    PROFILE_PICTURE_PREFIX,
    `${randomUUID()}.jpg`,
  ].join("/");
}

function assertProfilePictureStorageKey(
  storageKey: string,
): string {
  if (
    typeof storageKey !== "string" ||
    storageKey.length > 1024 ||
    storageKey.startsWith("/") ||
    storageKey.endsWith("/") ||
    storageKey.includes("\\") ||
    storageKey.includes("//") ||
    /[\u0000-\u001F\u007F]/.test(storageKey)
  ) {
    throw new AppError(
      400,
      "The profile-picture storage key is invalid.",
      "PROFILE_PICTURE_STORAGE_KEY_INVALID",
    );
  }

  const parts = storageKey.split("/");

  if (
    parts.length !== 6 ||
    parts[0] !== "organizations" ||
    parts[2] !== "employees" ||
    parts[4] !== PROFILE_PICTURE_PREFIX ||
    !parts[1] ||
    !parts[3] ||
    !PROFILE_PICTURE_FILENAME_PATTERN.test(parts[5])
  ) {
    throw new AppError(
      400,
      "The profile-picture storage key is invalid.",
      "PROFILE_PICTURE_STORAGE_KEY_INVALID",
    );
  }

  return storageKey;
}

/* -------------------------------------------------------------------------- */
/* Profile-picture validation and processing                                  */
/* -------------------------------------------------------------------------- */

async function validateProfilePicture(
  buffer: Buffer,
): Promise<{ width: number; height: number }> {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new AppError(
      400,
      "An image file is required.",
      "PROFILE_PICTURE_FILE_INVALID",
    );
  }

  if (buffer.length > MAX_PROFILE_PICTURE_BYTES) {
    throw new AppError(
      413,
      "Profile pictures must not exceed 5 MB.",
      "PROFILE_PICTURE_TOO_LARGE",
    );
  }

  const detected = await fileTypeFromBuffer(buffer);

  if (!detected || !ALLOWED_PROFILE_PICTURE_TYPES.has(detected.mime)) {
    throw new AppError(
      415,
      "Only JPEG, PNG, and WebP profile pictures are supported.",
      "PROFILE_PICTURE_FORMAT_UNSUPPORTED",
    );
  }

  let metadata: import("sharp").Metadata;

  try {
    metadata = await sharp(buffer, {
      limitInputPixels: MAX_IMAGE_PIXELS,
      failOn: "warning",
      sequentialRead: true,
    }).metadata();
  } catch {
    throw new AppError(
      400,
      "The uploaded image could not be decoded.",
      "PROFILE_PICTURE_IMAGE_INVALID",
    );
  }

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > MAX_IMAGE_WIDTH ||
    height > MAX_IMAGE_HEIGHT ||
    width * height > MAX_IMAGE_PIXELS
  ) {
    throw new AppError(
      413,
      "The image dimensions exceed the permitted limits.",
      "PROFILE_PICTURE_DIMENSIONS_INVALID",
    );
  }

  return { width, height };
}

async function normalizeProfilePicture(
  buffer: Buffer,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  await validateProfilePicture(buffer);

  let normalized: Buffer;

  try {
    normalized = await sharp(buffer, {
      limitInputPixels: MAX_IMAGE_PIXELS,
      failOn: "warning",
      sequentialRead: true,
    })
      .rotate()
      .resize({
        width: MAX_IMAGE_WIDTH,
        height: MAX_IMAGE_HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 88,
        progressive: true,
        mozjpeg: true,
      })
      .toBuffer();
  } catch {
    throw new AppError(
      400,
      "The uploaded profile picture could not be processed.",
      "PROFILE_PICTURE_PROCESSING_FAILED",
    );
  }

  if (
    normalized.length === 0 ||
    normalized.length > MAX_NORMALIZED_PROFILE_PICTURE_BYTES
  ) {
    throw new AppError(
      413,
      "The processed profile picture is too large.",
      "PROFILE_PICTURE_TOO_LARGE",
    );
  }

  const detected = await fileTypeFromBuffer(normalized);

  if (!detected || detected.mime !== STORED_PROFILE_PICTURE_MIME) {
    throw new AppError(
      500,
      "The processed profile picture failed verification.",
      "PROFILE_PICTURE_VERIFICATION_FAILED",
    );
  }

  const metadata = await sharp(normalized, {
    limitInputPixels: MAX_IMAGE_PIXELS,
  }).metadata();

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (
    width <= 0 ||
    height <= 0 ||
    width > MAX_IMAGE_WIDTH ||
    height > MAX_IMAGE_HEIGHT ||
    width * height > MAX_IMAGE_PIXELS
  ) {
    throw new AppError(
      500,
      "The processed profile picture has invalid dimensions.",
      "PROFILE_PICTURE_DIMENSIONS_INVALID",
    );
  }

  return { buffer: normalized, width, height };
}
/* -------------------------------------------------------------------------- */
/* Upload profile picture                                                     */
/* -------------------------------------------------------------------------- */

export async function uploadProfilePicture(
  input: ProfilePictureUploadInput,
): Promise<ProfilePictureUploadResult> {
  const organizationId = assertNonEmptyIdentifier(
    input.organizationId,
    "organizationId",
  );

  const employeeId = assertNonEmptyIdentifier(
    input.employeeId,
    "employeeId",
  );

  const normalized = await normalizeProfilePicture(input.buffer);
  const sha256 = calculateSha256(normalized.buffer);
  const storageKey = createProfilePictureStorageKey(
    organizationId,
    employeeId,
  );

  const { client, bucket } = createStorageContext();

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        Body: normalized.buffer,
        ContentLength: normalized.buffer.length,
        ContentType: STORED_PROFILE_PICTURE_MIME,
        ContentDisposition: 'inline; filename="profile-picture.jpg"',
        CacheControl: PRIVATE_CACHE_CONTROL,
        ServerSideEncryption: "AES256",
        ChecksumSHA256: Buffer.from(sha256, "hex").toString("base64"),
        Metadata: {
          purpose: "profile-picture",
          organizationid: organizationId,
          employeeid: employeeId,
          sha256,
        },
      }),
    );
  } catch {
    throw new AppError(
      502,
      "The profile picture could not be stored.",
      "PROFILE_PICTURE_UPLOAD_FAILED",
    );
  } finally {
    client.destroy();
  }

  return {
    storageKey,
    originalName: sanitizeOriginalName(input.originalName),
    mimeType: STORED_PROFILE_PICTURE_MIME,
    sizeBytes: normalized.buffer.length,
    sha256,
    width: normalized.width,
    height: normalized.height,
  };
}

/* -------------------------------------------------------------------------- */
/* Bounded object stream reader                                               */
/* -------------------------------------------------------------------------- */

async function streamToBuffer(
  output: GetObjectCommandOutput,
  maximumBytes: number,
): Promise<Buffer> {
  if (!output.Body) {
    throw new AppError(
      404,
      "The stored file was not found.",
      "STORAGE_OBJECT_NOT_FOUND",
    );
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  try {
    for await (const chunk of output.Body as AsyncIterable<
      Uint8Array | Buffer | string
    >) {
      const part = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk);

      totalBytes += part.length;

      if (totalBytes > maximumBytes) {
        throw new AppError(
          413,
          "The stored file exceeds the permitted size.",
          "STORAGE_OBJECT_TOO_LARGE",
        );
      }

      chunks.push(part);
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      502,
      "The stored file could not be read.",
      "STORAGE_OBJECT_READ_FAILED",
    );
  }

  return Buffer.concat(chunks, totalBytes);
}

/* -------------------------------------------------------------------------- */
/* Download profile picture                                                  */
/* -------------------------------------------------------------------------- */

export async function downloadPrivateObject(
  storageKey: string,
): Promise<PrivateObjectDownload> {
  const key = assertProfilePictureStorageKey(storageKey);
  const { client, bucket } = createStorageContext();

  try {
    const output = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    if (
      typeof output.ContentLength === "number" &&
      (
        output.ContentLength < 0 ||
        output.ContentLength > MAX_NORMALIZED_PROFILE_PICTURE_BYTES
      )
    ) {
      throw new AppError(
        502,
        "The stored profile picture has an invalid size.",
        "STORAGE_OBJECT_SIZE_INVALID",
      );
    }

    if (
      output.ContentType &&
      output.ContentType.toLowerCase() !== STORED_PROFILE_PICTURE_MIME
    ) {
      throw new AppError(
        502,
        "The stored profile picture has an invalid content type.",
        "STORAGE_OBJECT_TYPE_INVALID",
      );
    }

    const body = await streamToBuffer(
      output,
      MAX_NORMALIZED_PROFILE_PICTURE_BYTES,
    );

    const detected = await fileTypeFromBuffer(body);

    if (!detected || detected.mime !== STORED_PROFILE_PICTURE_MIME) {
      throw new AppError(
        502,
        "The stored profile picture failed format verification.",
        "STORAGE_OBJECT_TYPE_INVALID",
      );
    }

    const expectedSha256 = output.Metadata?.sha256;

    if (
      expectedSha256 &&
      !verifySha256(expectedSha256, calculateSha256(body))
    ) {
      throw new AppError(
        502,
        "The stored profile picture failed integrity verification.",
        "STORAGE_OBJECT_INTEGRITY_FAILED",
      );
    }

    return {
      body,
      contentType: STORED_PROFILE_PICTURE_MIME,
      contentLength: body.length,
      metadata: output.Metadata,
      etag: output.ETag,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (isNotFound(error)) {
      throw new AppError(
        404,
        "The profile picture was not found.",
        "STORAGE_OBJECT_NOT_FOUND",
      );
    }

    throw new AppError(
      502,
      "The profile picture could not be retrieved.",
      "PROFILE_PICTURE_DOWNLOAD_FAILED",
    );
  } finally {
    client.destroy();
  }
}

/* -------------------------------------------------------------------------- */
/* Check profile-picture existence                                            */
/* -------------------------------------------------------------------------- */

export async function objectExists(
  storageKey: string,
): Promise<boolean> {
  const key = assertProfilePictureStorageKey(storageKey);
  const { client, bucket } = createStorageContext();

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    return true;
  } catch (error) {
    if (isNotFound(error)) {
      return false;
    }

    throw new AppError(
      502,
      "The profile picture could not be checked.",
      "STORAGE_OBJECT_CHECK_FAILED",
    );
  } finally {
    client.destroy();
  }
}

/* -------------------------------------------------------------------------- */
/* Verify profile-picture metadata                                            */
/* -------------------------------------------------------------------------- */

export async function verifyStoredObject(
  storageKey: string,
): Promise<StoredObjectVerification> {
  const key = assertProfilePictureStorageKey(storageKey);
  const { client, bucket } = createStorageContext();

  try {
    const output = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    const contentLength = output.ContentLength;

    if (
      typeof contentLength === "number" &&
      (
        contentLength < 0 ||
        contentLength > MAX_NORMALIZED_PROFILE_PICTURE_BYTES
      )
    ) {
      throw new AppError(
        502,
        "The stored profile picture has an invalid size.",
        "STORAGE_OBJECT_SIZE_INVALID",
      );
    }

    if (
      output.ContentType &&
      output.ContentType.toLowerCase() !== STORED_PROFILE_PICTURE_MIME
    ) {
      throw new AppError(
        502,
        "The stored profile picture has an invalid content type.",
        "STORAGE_OBJECT_TYPE_INVALID",
      );
    }

    return {
      exists: true,
      contentType: output.ContentType,
      contentLength,
      sha256: output.Metadata?.sha256,
      etag: output.ETag,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (isNotFound(error)) {
      return { exists: false };
    }

    throw new AppError(
      502,
      "The profile picture could not be verified.",
      "STORAGE_OBJECT_VERIFY_FAILED",
    );
  } finally {
    client.destroy();
  }
}

/* -------------------------------------------------------------------------- */
/* Delete profile picture                                                     */
/* -------------------------------------------------------------------------- */

export async function deletePrivateObject(
  storageKey: string,
): Promise<void> {
  const key = assertProfilePictureStorageKey(storageKey);
  const { client, bucket } = createStorageContext();

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
  } catch {
    throw new AppError(
      502,
      "The profile picture could not be deleted.",
      "PROFILE_PICTURE_DELETE_FAILED",
    );
  } finally {
    client.destroy();
  }
}

export async function safelyDeleteObject(
  storageKey: string,
): Promise<boolean> {
  try {
    await deletePrivateObject(storageKey);
    return true;
  } catch (error) {
    console.error("Profile-picture cleanup failed.", {
      error,
      storageKey,
    });

    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Onboarding document storage-key validation                                 */
/* -------------------------------------------------------------------------- */

function assertOnboardingDocumentType(
  value: string,
): OnboardingDocumentType {
  if (
    !ONBOARDING_DOCUMENT_TYPES.includes(
      value as OnboardingDocumentType,
    )
  ) {
    throw new AppError(
      400,
      "The onboarding document type is invalid.",
      "ONBOARDING_DOCUMENT_TYPE_INVALID",
    );
  }

  return value as OnboardingDocumentType;
}

function createOnboardingDocumentStorageKey(
  organizationId: string,
  employeeId: string,
  documentType: OnboardingDocumentType,
): string {
  return [
    "organizations",
    encodeURIComponent(
      assertNonEmptyIdentifier(organizationId, "organizationId"),
    ),
    "employees",
    encodeURIComponent(
      assertNonEmptyIdentifier(employeeId, "employeeId"),
    ),
    ONBOARDING_DOCUMENT_PREFIX,
    assertOnboardingDocumentType(documentType).toLowerCase(),
    randomUUID(),
  ].join("/");
}

function assertOnboardingDocumentStorageKey(
  storageKey: string,
): string {
  if (
    typeof storageKey !== "string" ||
    storageKey.length === 0 ||
    storageKey.length > 1024 ||
    storageKey.startsWith("/") ||
    storageKey.endsWith("/") ||
    storageKey.includes("\\") ||
    storageKey.includes("//") ||
    /[\u0000-\u001F\u007F]/.test(storageKey)
  ) {
    throw new AppError(
      400,
      "The onboarding document storage key is invalid.",
      "ONBOARDING_DOCUMENT_STORAGE_KEY_INVALID",
    );
  }

  const parts = storageKey.split("/");

  if (
    parts.length !== 7 ||
    parts[0] !== "organizations" ||
    parts[2] !== "employees" ||
    parts[4] !== ONBOARDING_DOCUMENT_PREFIX ||
    parts.some((part) => !part || part === "." || part === "..")
  ) {
    throw new AppError(
      400,
      "The onboarding document storage key is invalid.",
      "ONBOARDING_DOCUMENT_STORAGE_KEY_INVALID",
    );
  }

  let organizationId: string;
  let employeeId: string;

  try {
    organizationId = decodeURIComponent(parts[1]);
    employeeId = decodeURIComponent(parts[3]);
  } catch {
    throw new AppError(
      400,
      "The onboarding document storage key is invalid.",
      "ONBOARDING_DOCUMENT_STORAGE_KEY_INVALID",
    );
  }

  assertNonEmptyIdentifier(organizationId, "organizationId");
  assertNonEmptyIdentifier(employeeId, "employeeId");

  const validFolders = ONBOARDING_DOCUMENT_TYPES.map((type) =>
    type.toLowerCase(),
  );

  if (
    !validFolders.includes(parts[5]) ||
    !UUID_PATTERN.test(parts[6])
  ) {
    throw new AppError(
      400,
      "The onboarding document storage key is invalid.",
      "ONBOARDING_DOCUMENT_STORAGE_KEY_INVALID",
    );
  }

  return storageKey;
}
/* -------------------------------------------------------------------------- */
/* Validate onboarding document                                               */
/* -------------------------------------------------------------------------- */

async function validateOnboardingDocument(
  buffer: Buffer,
): Promise<OnboardingDocumentMimeType> {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new AppError(
      400,
      "An onboarding document is required.",
      "ONBOARDING_DOCUMENT_INVALID",
    );
  }

  if (buffer.length > MAX_ONBOARDING_DOCUMENT_BYTES) {
    throw new AppError(
      413,
      "Onboarding documents must not exceed 10 MB.",
      "ONBOARDING_DOCUMENT_TOO_LARGE",
    );
  }

  let detected: Awaited<ReturnType<typeof fileTypeFromBuffer>>;

  try {
    detected = await fileTypeFromBuffer(buffer);
  } catch {
    throw new AppError(
      415,
      "The document format could not be verified.",
      "ONBOARDING_DOCUMENT_FORMAT_UNKNOWN",
    );
  }

  if (
    !detected ||
    !ALLOWED_ONBOARDING_DOCUMENT_TYPES.has(detected.mime)
  ) {
    throw new AppError(
      415,
      "Only PDF, JPEG, and PNG onboarding documents are supported.",
      "ONBOARDING_DOCUMENT_FORMAT_UNSUPPORTED",
    );
  }

  return detected.mime as OnboardingDocumentMimeType;
}

/* -------------------------------------------------------------------------- */
/* Upload onboarding document                                                 */
/* -------------------------------------------------------------------------- */

export async function uploadOnboardingDocument(
  input: OnboardingDocumentUploadInput,
): Promise<OnboardingDocumentUploadResult> {
  const organizationId = assertNonEmptyIdentifier(
    input.organizationId,
    "organizationId",
  );

  const employeeId = assertNonEmptyIdentifier(
    input.employeeId,
    "employeeId",
  );

  const documentType = assertOnboardingDocumentType(input.documentType);
  const mimeType = await validateOnboardingDocument(input.buffer);
  const originalName = sanitizeOriginalName(input.originalName);
  const sha256 = calculateSha256(input.buffer);

  const storageKey = createOnboardingDocumentStorageKey(
    organizationId,
    employeeId,
    documentType,
  );

  const { client, bucket } = createStorageContext();

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        Body: input.buffer,
        ContentLength: input.buffer.length,
        ContentType: mimeType,
        ContentDisposition: "attachment",
        CacheControl: PRIVATE_CACHE_CONTROL,
        ServerSideEncryption: "AES256",
        ChecksumSHA256: Buffer.from(sha256, "hex").toString("base64"),
        Metadata: {
          purpose: "onboarding-document",
          organizationid: organizationId,
          employeeid: employeeId,
          documenttype: documentType,
          sha256,
        },
      }),
    );
  } catch {
    throw new AppError(
      502,
      "The onboarding document could not be stored.",
      "ONBOARDING_DOCUMENT_UPLOAD_FAILED",
    );
  } finally {
    client.destroy();
  }

  return {
    storageKey,
    originalName,
    mimeType,
    sizeBytes: input.buffer.length,
    sha256,
  };
}

/* -------------------------------------------------------------------------- */
/* Download onboarding document                                               */
/* -------------------------------------------------------------------------- */

export async function downloadOnboardingDocument(
  storageKey: string,
): Promise<OnboardingDocumentDownloadResult> {
  const key = assertOnboardingDocumentStorageKey(storageKey);
  const { client, bucket } = createStorageContext();

  try {
    const output = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    if (
      typeof output.ContentLength !== "number" ||
      !Number.isSafeInteger(output.ContentLength) ||
      output.ContentLength <= 0 ||
      output.ContentLength > MAX_ONBOARDING_DOCUMENT_BYTES
    ) {
      throw new AppError(
        502,
        "The stored onboarding document has an invalid size.",
        "ONBOARDING_DOCUMENT_SIZE_INVALID",
      );
    }

    const parts = key.split("/");
    const keyOrganizationId = decodeURIComponent(parts[1]);
    const keyEmployeeId = decodeURIComponent(parts[3]);
    const keyDocumentType = parts[5].toUpperCase().replace(/-/g, "_");

    /*
     * Verify that the object's metadata agrees with its storage key.
     * Authorization still belongs in the route/service that calls this
     * function; matching metadata does not establish user permissions.
     */
    if (
      output.Metadata?.purpose !== "onboarding-document" ||
      output.Metadata?.organizationid !== keyOrganizationId ||
      output.Metadata?.employeeid !== keyEmployeeId ||
      output.Metadata?.documenttype !== keyDocumentType
    ) {
      throw new AppError(
        502,
        "The stored onboarding document failed ownership metadata verification.",
        "ONBOARDING_DOCUMENT_METADATA_INVALID",
      );
    }

    const contentType = output.ContentType;

    if (
      !contentType ||
      !ALLOWED_ONBOARDING_DOCUMENT_TYPES.has(contentType)
    ) {
      throw new AppError(
        502,
        "The stored onboarding document has an invalid content type.",
        "ONBOARDING_DOCUMENT_TYPE_INVALID",
      );
    }

    const body = await streamToBuffer(
      output,
      MAX_ONBOARDING_DOCUMENT_BYTES,
    );

    if (body.length !== output.ContentLength) {
      throw new AppError(
        502,
        "The stored onboarding document failed size verification.",
        "ONBOARDING_DOCUMENT_SIZE_MISMATCH",
      );
    }

    const detectedType = await fileTypeFromBuffer(body);

    if (!detectedType || detectedType.mime !== contentType) {
      throw new AppError(
        502,
        "The stored onboarding document failed format verification.",
        "ONBOARDING_DOCUMENT_TYPE_MISMATCH",
      );
    }

    const actualSha256 = calculateSha256(body);
    const expectedSha256 = output.Metadata?.sha256;

    if (
      !expectedSha256 ||
      !verifySha256(expectedSha256, actualSha256)
    ) {
      throw new AppError(
        502,
        "The stored onboarding document failed integrity verification.",
        "ONBOARDING_DOCUMENT_INTEGRITY_FAILED",
      );
    }

    return {
      body,
      contentType: contentType as OnboardingDocumentMimeType,
      contentLength: body.length,
      sha256: actualSha256,
      etag: output.ETag,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (isNotFound(error)) {
      throw new AppError(
        404,
        "The onboarding document was not found.",
        "ONBOARDING_DOCUMENT_NOT_FOUND",
      );
    }

    throw new AppError(
      502,
      "The onboarding document could not be retrieved.",
      "ONBOARDING_DOCUMENT_DOWNLOAD_FAILED",
    );
  } finally {
    client.destroy();
  }
}

/* -------------------------------------------------------------------------- */
/* Delete onboarding document                                                 */
/* -------------------------------------------------------------------------- */

export async function deleteOnboardingDocumentObject(
  storageKey: string,
): Promise<void> {
  const key = assertOnboardingDocumentStorageKey(storageKey);
  const { client, bucket } = createStorageContext();

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
  } catch {
    throw new AppError(
      502,
      "The onboarding document could not be deleted.",
      "ONBOARDING_DOCUMENT_DELETE_FAILED",
    );
  } finally {
    client.destroy();
  }
}

/**
 * Best-effort cleanup for failed workflows.
 *
 * A false result must be logged and, where appropriate, retried by a cleanup
 * job. Do not silently treat failed cleanup as successful deletion.
 */
export async function safelyDeleteOnboardingDocumentObject(
  storageKey: string,
): Promise<boolean> {
  try {
    await deleteOnboardingDocumentObject(storageKey);
    return true;
  } catch (error) {
    console.error("Onboarding document cleanup failed.", {
      error,
      storageKey,
    });

    return false;
  }
}