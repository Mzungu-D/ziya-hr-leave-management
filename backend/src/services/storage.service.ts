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
} from "node:crypto";

import path from "node:path";

import sharp from "sharp";

import {
  fileTypeFromBuffer,
} from "file-type";

import {
  env,
} from "../config/env.js";

import {
  AppError,
} from "../middleware/error.middleware.js";

/**
 * ============================================================================
 * PROFILE PICTURE PRIVATE OBJECT STORAGE
 * ============================================================================
 *
 * Production security properties:
 *
 * - Private object storage only.
 * - No public object URLs.
 * - No user-controlled storage keys.
 * - Strict object-key validation.
 * - Strict upload byte limits.
 * - Strict image dimension limits.
 * - Strict decoded-pixel limits.
 * - Binary file-signature validation.
 * - Sharp decode/re-encode pipeline.
 * - Metadata stripping through normalization.
 * - JPEG-only normalized storage.
 * - Server-generated UUID object names.
 * - SHA-256 integrity hashing.
 * - S3 SHA-256 checksum on upload.
 * - Server-side AES256 encryption.
 * - Explicit private/no-store caching.
 * - Storage errors are never exposed directly to clients.
 * - Download/delete helpers reject arbitrary object keys.
 *
 * Authorization, tenant ownership and database lifecycle remain in:
 *
 *   profile-picture.service.ts
 *
 * This service deliberately does not make employee authorization decisions.
 */

/**
 * ============================================================================
 * CONSTANTS
 * ============================================================================
 */

/**
 * Maximum incoming multipart file size.
 *
 * Multer also enforces this limit before this service receives the buffer.
 */
const MAX_PROFILE_PICTURE_BYTES =
  5 * 1024 * 1024;

/**
 * Maximum source image dimensions.
 */
const MAX_IMAGE_WIDTH =
  4096;

const MAX_IMAGE_HEIGHT =
  4096;

/**
 * Maximum decoded pixel count.
 *
 * This protects the image-processing pipeline against decompression-bomb
 * style images.
 */
const MAX_IMAGE_PIXELS =
  16_000_000;

/**
 * Maximum normalized output size.
 */
const MAX_NORMALIZED_PROFILE_PICTURE_BYTES =
  5 * 1024 * 1024;

/**
 * All stored profile pictures are normalized to JPEG.
 */
const STORED_MIME_TYPE =
  "image/jpeg";

const STORED_EXTENSION =
  ".jpg";

/**
 * Accepted source formats.
 *
 * Keep this allowlist deliberately small.
 */
const ALLOWED_INPUT_MIME_TYPES =
  new Set<string>([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

/**
 * Profile pictures are authorization-sensitive resources.
 *
 * Do not allow browsers, proxies or intermediary caches to retain them.
 */
const PRIVATE_CACHE_CONTROL =
  "private, no-store, max-age=0";

/**
 * Storage namespace.
 */
const PROFILE_PICTURE_PREFIX =
  "profile-pictures";

/**
 * Server-generated profile-picture object filename.
 *
 * randomUUID() produces the UUID portion.
 */
const PROFILE_PICTURE_FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/i;

/**
 * ============================================================================
 * STORAGE CLIENT
 * ============================================================================
 */

interface StorageContext {
  client: S3Client;
  bucket: string;
}

/**
 * Creates the S3 client lazily.
 *
 * Missing storage configuration produces a controlled 503 rather than causing
 * the entire application to fail during module import.
 */
function createStorageContext(): StorageContext {
  const endpoint =
    typeof env.S3_ENDPOINT === "string"
      ? env.S3_ENDPOINT.trim()
      : "";

  const region =
    typeof env.S3_REGION === "string"
      ? env.S3_REGION.trim()
      : "";

  const accessKeyId =
    typeof env.S3_ACCESS_KEY_ID === "string"
      ? env.S3_ACCESS_KEY_ID.trim()
      : "";

  const secretAccessKey =
    typeof env.S3_SECRET_ACCESS_KEY === "string"
      ? env.S3_SECRET_ACCESS_KEY.trim()
      : "";

  const bucket =
    typeof env.S3_BUCKET_NAME === "string"
      ? env.S3_BUCKET_NAME.trim()
      : "";

  if (
    !endpoint ||
    !region ||
    !accessKeyId ||
    !secretAccessKey ||
    !bucket
  ) {
    throw new AppError(
      503,
      "Profile picture storage is not configured.",
      "PROFILE_PICTURE_STORAGE_NOT_CONFIGURED",
    );
  }

  /**
   * The endpoint and credentials come exclusively from trusted server-side
   * configuration.
   *
   * They must never be derived from request input.
   *
   * Railway's current S3-compatible buckets use virtual-hosted addressing,
   * therefore path-style addressing remains disabled.
   */
  const client =
    new S3Client({
      endpoint,

      region,

      credentials: {
        accessKeyId,

        secretAccessKey,
      },

      forcePathStyle:
        false,
    });

  return {
    client,

    bucket,
  };
}

/**
 * ============================================================================
 * PUBLIC TYPES
 * ============================================================================
 */

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

/**
 * ============================================================================
 * GENERIC VALIDATION
 * ============================================================================
 */

/**
 * Validates an identifier that will participate in an object-storage path.
 *
 * User-controlled path separators, control characters and traversal sequences
 * are never accepted.
 */
function assertNonEmptyIdentifier(
  value: string,
  fieldName: string,
): string {
  if (
    typeof value !== "string"
  ) {
    throw new AppError(
      400,
      `${fieldName} is required.`,
      "STORAGE_IDENTIFIER_INVALID",
    );
  }

  const normalized =
    value.trim();

  if (!normalized) {
    throw new AppError(
      400,
      `${fieldName} is required.`,
      "STORAGE_IDENTIFIER_INVALID",
    );
  }

  if (
    normalized.includes("/") ||
    normalized.includes("\\") ||
    normalized.includes("\0") ||
    /[\u0000-\u001F\u007F]/.test(
      normalized,
    )
  ) {
    throw new AppError(
      400,
      `${fieldName} is invalid.`,
      "STORAGE_IDENTIFIER_INVALID",
    );
  }

  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.includes("..")
  ) {
    throw new AppError(
      400,
      `${fieldName} is invalid.`,
      "STORAGE_IDENTIFIER_INVALID",
    );
  }

  if (
    normalized.length > 255
  ) {
    throw new AppError(
      400,
      `${fieldName} is invalid.`,
      "STORAGE_IDENTIFIER_INVALID",
    );
  }

  return normalized;
}

/**
 * ============================================================================
 * ORIGINAL FILENAME
 * ============================================================================
 *
 * The original filename is metadata only.
 *
 * It is NEVER used as an S3 object key.
 */
function sanitizeOriginalName(
  originalName?: string,
): string {
  if (
    typeof originalName !== "string" ||
    !originalName.trim()
  ) {
    return "profile-picture.jpg";
  }

  let baseName: string;

  try {
    baseName =
      path.basename(
        originalName,
      );
  } catch {
    return "profile-picture.jpg";
  }

  const sanitized =
    baseName
      .replace(
        /[\u0000-\u001F\u007F]/g,
        "",
      )
      .replace(
        /[\\/:\"*?<>|]/g,
        "_",
      )
      .trim();

  if (!sanitized) {
    return "profile-picture.jpg";
  }

  return sanitized.slice(
    0,
    255,
  );
}

/**
 * ============================================================================
 * IMAGE VALIDATION
 * ============================================================================
 */

interface ImageInspection {
  mimeType: string;

  width: number;

  height: number;
}

/**
 * Creates a Sharp instance with restrictive decoding options.
 *
 * IMPORTANT:
 *
 * Do not change this return type to:
 *
 *   sharp.Sharp
 *
 * The installed Sharp typings in this project do not expose Sharp through a
 * namespace type. ReturnType<typeof sharp> is the correct type here.
 */
function createRestrictedSharp(
  buffer: Buffer,
): ReturnType<typeof sharp> {
  return sharp(
    buffer,
    {
      /**
       * Apply the pixel limit during decoding itself.
       *
       * This is stronger than checking the dimensions only after decoding.
       */
      limitInputPixels:
        MAX_IMAGE_PIXELS,

      /**
       * Reduce unnecessary memory pressure where supported.
       */
      sequentialRead:
        true,

      /**
       * Treat decoder warnings as processing failures.
       */
      failOn:
        "warning",
    },
  );
}

/**
 * Validates actual binary content and image characteristics.
 *
 * Browser-supplied Content-Type is deliberately not trusted.
 */
async function validateImageBuffer(
  buffer: Buffer,
): Promise<ImageInspection> {
  if (
    !Buffer.isBuffer(buffer)
  ) {
    throw new AppError(
      400,
      "Uploaded file is invalid.",
      "PROFILE_PICTURE_FILE_INVALID",
    );
  }

  if (
    buffer.length === 0
  ) {
    throw new AppError(
      400,
      "Uploaded file is empty.",
      "PROFILE_PICTURE_FILE_EMPTY",
    );
  }

  if (
    buffer.length >
    MAX_PROFILE_PICTURE_BYTES
  ) {
    throw new AppError(
      413,
      "Profile picture must not exceed 5 MB.",
      "PROFILE_PICTURE_TOO_LARGE",
    );
  }

  /**
   * Inspect the actual binary signature.
   *
   * Do not trust the multipart Content-Type header.
   */
  let detectedType:
    Awaited<
      ReturnType<
        typeof fileTypeFromBuffer
      >
    >;

  try {
    detectedType =
      await fileTypeFromBuffer(
        buffer,
      );
  } catch {
    throw new AppError(
      415,
      "The uploaded file format could not be determined.",
      "PROFILE_PICTURE_FORMAT_UNKNOWN",
    );
  }

  if (
    !detectedType ||
    !ALLOWED_INPUT_MIME_TYPES.has(
      detectedType.mime,
    )
  ) {
    throw new AppError(
      415,
      "Unsupported profile picture format. JPEG, PNG, and WebP images are allowed.",
      "PROFILE_PICTURE_FORMAT_UNSUPPORTED",
    );
  }

  /**
   * Decode with the restricted Sharp instance.
   */
  let metadata:
    Awaited<
      ReturnType<
        ReturnType<typeof sharp>["metadata"]
      >
    >;

  try {
    metadata =
      await createRestrictedSharp(
        buffer,
      ).metadata();
  } catch {
    throw new AppError(
      400,
      "The uploaded image could not be decoded safely.",
      "PROFILE_PICTURE_IMAGE_INVALID",
    );
  }

  const width =
    metadata.width ?? 0;

  const height =
    metadata.height ?? 0;

  if (
    !Number.isSafeInteger(
      width,
    ) ||
    !Number.isSafeInteger(
      height,
    ) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new AppError(
      400,
      "The uploaded image has invalid dimensions.",
      "PROFILE_PICTURE_DIMENSIONS_INVALID",
    );
  }

  if (
    width >
      MAX_IMAGE_WIDTH ||
    height >
      MAX_IMAGE_HEIGHT
  ) {
    throw new AppError(
      413,
      "Profile picture dimensions are too large.",
      "PROFILE_PICTURE_DIMENSIONS_TOO_LARGE",
    );
  }

  const pixels =
    width * height;

  if (
    !Number.isSafeInteger(
      pixels,
    ) ||
    pixels >
      MAX_IMAGE_PIXELS
  ) {
    throw new AppError(
      413,
      "Profile picture contains too many pixels.",
      "PROFILE_PICTURE_PIXELS_TOO_LARGE",
    );
  }

  return {
    mimeType:
      detectedType.mime,

    width,

    height,
  };
}

/**
 * ============================================================================
 * IMAGE NORMALIZATION
 * ============================================================================
 *
 * Every accepted image is:
 *
 * 1. decoded
 * 2. orientation-normalized
 * 3. resized within limits
 * 4. re-encoded as JPEG
 * 5. independently verified
 *
 * The original uploaded binary is never served.
 */
async function normalizeProfileImage(
  buffer: Buffer,
): Promise<{
  buffer: Buffer;

  width: number;

  height: number;
}> {
  /**
   * Validate the source before processing.
   */
  await validateImageBuffer(
    buffer,
  );

  let output:
    Buffer;

  try {
    output =
      await createRestrictedSharp(
        buffer,
      )
        /**
         * Apply EXIF orientation before normalization.
         */
        .rotate()

        /**
         * Keep the image within the approved maximum dimensions.
         */
        .resize({
          width:
            MAX_IMAGE_WIDTH,

          height:
            MAX_IMAGE_HEIGHT,

          fit:
            "inside",

          withoutEnlargement:
            true,

          kernel:
            sharp.kernel.lanczos3,
        })

        /**
         * Normalize all accepted source formats to JPEG.
         */
        .jpeg({
          quality:
            88,

          progressive:
            true,

          mozjpeg:
            true,

          chromaSubsampling:
            "4:4:4",

          force:
            true,
        })

        .toBuffer();
  } catch {
    throw new AppError(
      400,
      "Unable to safely process the profile picture.",
      "PROFILE_PICTURE_PROCESSING_FAILED",
    );
  }

  if (
    !Buffer.isBuffer(output) ||
    output.length === 0
  ) {
    throw new AppError(
      500,
      "Processed profile picture is empty.",
      "PROFILE_PICTURE_PROCESSING_FAILED",
    );
  }

  if (
    output.length >
    MAX_NORMALIZED_PROFILE_PICTURE_BYTES
  ) {
    throw new AppError(
      413,
      "Processed profile picture exceeds the 5 MB limit.",
      "PROFILE_PICTURE_TOO_LARGE",
    );
  }

  /**
   * Verify the actual output format rather than assuming Sharp produced JPEG.
   */
  let outputType:
    Awaited<
      ReturnType<
        typeof fileTypeFromBuffer
      >
    >;

  try {
    outputType =
      await fileTypeFromBuffer(
        output,
      );
  } catch {
    throw new AppError(
      500,
      "Processed profile picture could not be verified.",
      "PROFILE_PICTURE_VERIFICATION_FAILED",
    );
  }

  if (
    !outputType ||
    outputType.mime !==
      STORED_MIME_TYPE
  ) {
    throw new AppError(
      500,
      "Processed profile picture has an invalid format.",
      "PROFILE_PICTURE_VERIFICATION_FAILED",
    );
  }

  /**
   * Verify the normalized image dimensions again.
   */
  let outputMetadata:
    Awaited<
      ReturnType<
        ReturnType<typeof sharp>["metadata"]
      >
    >;

  try {
    outputMetadata =
      await createRestrictedSharp(
        output,
      ).metadata();
  } catch {
    throw new AppError(
      500,
      "Processed profile picture could not be verified.",
      "PROFILE_PICTURE_VERIFICATION_FAILED",
    );
  }

  const width =
    outputMetadata.width ?? 0;

  const height =
    outputMetadata.height ?? 0;

  if (
    !Number.isSafeInteger(
      width,
    ) ||
    !Number.isSafeInteger(
      height,
    ) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new AppError(
      500,
      "Processed profile picture has invalid dimensions.",
      "PROFILE_PICTURE_DIMENSIONS_INVALID",
    );
  }

  if (
    width >
      MAX_IMAGE_WIDTH ||
    height >
      MAX_IMAGE_HEIGHT ||
    width * height >
      MAX_IMAGE_PIXELS
  ) {
    throw new AppError(
      500,
      "Processed profile picture exceeds the permitted dimensions.",
      "PROFILE_PICTURE_DIMENSIONS_TOO_LARGE",
    );
  }

  return {
    buffer:
      output,

    width,

    height,
  };
}

/**
 * ============================================================================
 * HASHING
 * ============================================================================
 */

function calculateSha256(
  buffer: Buffer,
): string {
  return createHash(
    "sha256",
  )
    .update(buffer)
    .digest("hex");
}

/**
 * ============================================================================
 * STORAGE KEY GENERATION
 * ============================================================================
 *
 * User-provided filenames are never incorporated into the object key.
 */
function createProfilePictureStorageKey(
  organizationId: string,
  employeeId: string,
): string {
  const organization =
    encodeURIComponent(
      assertNonEmptyIdentifier(
        organizationId,
        "organizationId",
      ),
    );

  const employee =
    encodeURIComponent(
      assertNonEmptyIdentifier(
        employeeId,
        "employeeId",
      ),
    );

  return [
    "organizations",

    organization,

    "employees",

    employee,

    PROFILE_PICTURE_PREFIX,

    `${randomUUID()}${STORED_EXTENSION}`,
  ].join("/");
}

/**
 * ============================================================================
 * STORAGE KEY VALIDATION
 * ============================================================================
 *
 * Storage helpers must never operate on arbitrary S3 keys.
 *
 * Valid structure:
 *
 * organizations/
 *   {organizationId}/
 *   employees/
 *   {employeeId}/
 *   profile-pictures/
 *   {uuid}.jpg
 */
function assertProfilePictureStorageKey(
  storageKey: string,
): string {
  if (
    typeof storageKey !==
    "string"
  ) {
    throw new AppError(
      400,
      "Storage key is invalid.",
      "PROFILE_PICTURE_STORAGE_KEY_INVALID",
    );
  }

  const key =
    storageKey.trim();

  if (!key) {
    throw new AppError(
      400,
      "Storage key is invalid.",
      "PROFILE_PICTURE_STORAGE_KEY_INVALID",
    );
  }

  if (
    key.length > 1024
  ) {
    throw new AppError(
      400,
      "Storage key is invalid.",
      "PROFILE_PICTURE_STORAGE_KEY_INVALID",
    );
  }

  /**
   * Reject path traversal, malformed separators and control characters.
   */
  if (
    key.includes("\\") ||
    key.includes("\0") ||
    /[\u0000-\u001F\u007F]/.test(
      key,
    ) ||
    key.includes("//") ||
    key.includes("/./") ||
    key.includes("/../") ||
    key.startsWith("../") ||
    key.startsWith("/") ||
    key.endsWith("/")
  ) {
    throw new AppError(
      400,
      "Storage key is invalid.",
      "PROFILE_PICTURE_STORAGE_KEY_INVALID",
    );
  }

  const parts =
    key.split("/");

  /**
   * Exact structure:
   *
   * 0 organizations
   * 1 organization ID
   * 2 employees
   * 3 employee ID
   * 4 profile-pictures
   * 5 UUID.jpg
   */
  if (
    parts.length !== 6
  ) {
    throw new AppError(
      400,
      "Storage key is invalid.",
      "PROFILE_PICTURE_STORAGE_KEY_INVALID",
    );
  }

  const [
    organizationsSegment,

    organizationId,

    employeesSegment,

    employeeId,

    profilePicturesSegment,

    filename,
  ] = parts;

  if (
    organizationsSegment !==
      "organizations" ||
    employeesSegment !==
      "employees" ||
    profilePicturesSegment !==
      PROFILE_PICTURE_PREFIX
  ) {
    throw new AppError(
      400,
      "Storage key is invalid.",
      "PROFILE_PICTURE_STORAGE_KEY_INVALID",
    );
  }

  if (
    !organizationId ||
    !employeeId
  ) {
    throw new AppError(
      400,
      "Storage key is invalid.",
      "PROFILE_PICTURE_STORAGE_KEY_INVALID",
    );
  }

  /**
   * Object filenames must be server-generated UUIDs with the normalized
   * JPEG extension.
   */
  if (
    !PROFILE_PICTURE_FILENAME_PATTERN.test(
      filename,
    )
  ) {
    throw new AppError(
      400,
      "Storage key is invalid.",
      "PROFILE_PICTURE_STORAGE_KEY_INVALID",
    );
  }

  return key;
}

/**
 * ============================================================================
 * UPLOAD
 * ============================================================================
 */

export async function uploadProfilePicture(
  input: ProfilePictureUploadInput,
): Promise<ProfilePictureUploadResult> {
  const organizationId =
    assertNonEmptyIdentifier(
      input.organizationId,
      "organizationId",
    );

  const employeeId =
    assertNonEmptyIdentifier(
      input.employeeId,
      "employeeId",
    );

  const originalName =
    sanitizeOriginalName(
      input.originalName,
    );

  /**
   * The browser-declared MIME type is intentionally ignored.
   *
   * Actual binary inspection occurs inside validateImageBuffer().
   */
  void input.declaredMimeType;

  /**
   * Decode, validate, normalize and verify the image before uploading it.
   */
  const normalized =
    await normalizeProfileImage(
      input.buffer,
    );

  /**
   * Hash the exact normalized bytes that will be stored.
   */
  const sha256 =
    calculateSha256(
      normalized.buffer,
    );

  /**
   * Generate a server-controlled storage key.
   */
  const storageKey =
    createProfilePictureStorageKey(
      organizationId,
      employeeId,
    );

  const {
    client,

    bucket,
  } =
    createStorageContext();

  try {
    await client.send(
      new PutObjectCommand({
        Bucket:
          bucket,

        Key:
          storageKey,

        Body:
          normalized.buffer,

        ContentType:
          STORED_MIME_TYPE,

        ContentLength:
          normalized.buffer.length,

        CacheControl:
          PRIVATE_CACHE_CONTROL,

        /**
         * Keep only metadata required for operational verification.
         */
        Metadata: {
          organizationid:
            organizationId,

          employeeid:
            employeeId,

          sha256,
        },

        /**
         * Server-side encryption.
         */
        ServerSideEncryption:
          "AES256",

        /**
         * Integrity protection.
         *
         * AWS expects the SHA-256 digest in base64 representation.
         */
        ChecksumSHA256:
          Buffer.from(
            sha256,
            "hex",
          ).toString(
            "base64",
          ),
      }),
    );
  } catch (error) {
    /**
     * Never expose raw AWS/S3 errors to the client.
     */
    console.error(
      "Failed to upload profile picture to private object storage.",
      {
        error,

        organizationId,

        employeeId,
      },
    );

    throw new AppError(
      503,
      "Profile picture could not be stored.",
      "PROFILE_PICTURE_STORAGE_UPLOAD_FAILED",
    );
  }

  return {
    storageKey,

    originalName,

    mimeType:
      STORED_MIME_TYPE,

    sizeBytes:
      normalized.buffer.length,

    sha256,

    width:
      normalized.width,

    height:
      normalized.height,
  };
}

/**
 * ============================================================================
 * PRIVATE OBJECT DOWNLOAD
 * ============================================================================
 *
 * Authorization MUST already have happened in profile-picture.service.ts.
 *
 * This function is not a public authorization boundary.
 */
export async function downloadPrivateObject(
  storageKey: string,
): Promise<{
  body: NonNullable<
    GetObjectCommandOutput["Body"]
  >;

  contentType?: string;

  contentLength?: number;
}> {
  const key =
    assertProfilePictureStorageKey(
      storageKey,
    );

  const {
    client,

    bucket,
  } =
    createStorageContext();

  try {
    const result =
      await client.send(
        new GetObjectCommand({
          Bucket:
            bucket,

          Key:
            key,
        }),
      );

    if (
      !result.Body
    ) {
      throw new AppError(
        404,
        "Stored profile picture was not found.",
        "PROFILE_PICTURE_OBJECT_NOT_FOUND",
      );
    }

    /**
     * Only normalized JPEG profile pictures are allowed to leave storage.
     */
    if (
      result.ContentType &&
      result.ContentType !==
        STORED_MIME_TYPE
    ) {
      console.error(
        "Stored profile picture has unexpected content type.",
        {
          key,

          contentType:
            result.ContentType,
        },
      );

      throw new AppError(
        500,
        "Stored profile picture failed integrity validation.",
        "PROFILE_PICTURE_OBJECT_INVALID",
      );
    }

    /**
     * Never stream an unexpectedly large object.
     */
    if (
      typeof result.ContentLength ===
        "number" &&
      (
        result.ContentLength <= 0 ||
        result.ContentLength >
          MAX_NORMALIZED_PROFILE_PICTURE_BYTES
      )
    ) {
      console.error(
        "Stored profile picture has invalid size.",
        {
          key,

          contentLength:
            result.ContentLength,
        },
      );

      throw new AppError(
        500,
        "Stored profile picture failed integrity validation.",
        "PROFILE_PICTURE_OBJECT_INVALID",
      );
    }

    return {
      body:
        result.Body,

      contentType:
        result.ContentType,

      contentLength:
        result.ContentLength,
    };
  } catch (error) {
    if (
      error instanceof
      AppError
    ) {
      throw error;
    }

    console.error(
      "Failed to retrieve private profile picture.",
      {
        error,

        key,
      },
    );

    throw new AppError(
      503,
      "Stored profile picture could not be retrieved.",
      "PROFILE_PICTURE_STORAGE_READ_FAILED",
    );
  }
}

/**
 * ============================================================================
 * OBJECT EXISTENCE
 * ============================================================================
 *
 * Returns false only for an actual S3 404.
 *
 * Network, credentials and provider failures remain errors.
 */
export async function objectExists(
  storageKey: string,
): Promise<boolean> {
  const key =
    assertProfilePictureStorageKey(
      storageKey,
    );

  const {
    client,

    bucket,
  } =
    createStorageContext();

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket:
          bucket,

        Key:
          key,
      }),
    );

    return true;
  } catch (error) {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "$metadata" in error
        ? (
            error as {
              $metadata?: {
                httpStatusCode?: number;
              };
            }
          ).$metadata
            ?.httpStatusCode
        : undefined;

    if (
      statusCode === 404
    ) {
      return false;
    }

    console.error(
      "Failed to check profile picture object existence.",
      {
        error,

        key,
      },
    );

    throw new AppError(
      503,
      "Profile picture storage could not be checked.",
      "PROFILE_PICTURE_STORAGE_CHECK_FAILED",
    );
  }
}

/**
 * ============================================================================
 * VERIFY STORED OBJECT
 * ============================================================================
 *
 * Reads object metadata without downloading the object body.
 */
export async function verifyStoredObject(
  storageKey: string,
): Promise<{
  contentType?: string;

  contentLength?: number;

  metadata: Record<
    string,
    string
  >;
}> {
  const key =
    assertProfilePictureStorageKey(
      storageKey,
    );

  const {
    client,

    bucket,
  } =
    createStorageContext();

  try {
    const result =
      await client.send(
        new HeadObjectCommand({
          Bucket:
            bucket,

          Key:
            key,
        }),
      );

    if (
      result.ContentType &&
      result.ContentType !==
        STORED_MIME_TYPE
    ) {
      throw new AppError(
        500,
        "Stored profile picture has an invalid content type.",
        "PROFILE_PICTURE_OBJECT_INVALID",
      );
    }

    if (
      typeof result.ContentLength ===
        "number" &&
      (
        result.ContentLength <= 0 ||
        result.ContentLength >
          MAX_NORMALIZED_PROFILE_PICTURE_BYTES
      )
    ) {
      throw new AppError(
        500,
        "Stored profile picture has an invalid size.",
        "PROFILE_PICTURE_OBJECT_INVALID",
      );
    }

    return {
      contentType:
        result.ContentType,

      contentLength:
        result.ContentLength,

      metadata:
        result.Metadata ??
        {},
    };
  } catch (error) {
    if (
      error instanceof
      AppError
    ) {
      throw error;
    }

    console.error(
      "Failed to verify stored profile picture.",
      {
        error,

        key,
      },
    );

    throw new AppError(
      503,
      "Stored profile picture could not be verified.",
      "PROFILE_PICTURE_STORAGE_VERIFY_FAILED",
    );
  }
}

/**
 * ============================================================================
 * DELETE PRIVATE OBJECT
 * ============================================================================
 *
 * Deletes only objects belonging to the profile-picture namespace.
 */
export async function deletePrivateObject(
  storageKey: string,
): Promise<void> {
  const key =
    assertProfilePictureStorageKey(
      storageKey,
    );

  const {
    client,

    bucket,
  } =
    createStorageContext();

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket:
          bucket,

        Key:
          key,
      }),
    );
  } catch (error) {
    console.error(
      "Failed to delete private profile picture.",
      {
        error,

        key,
      },
    );

    throw new AppError(
      503,
      "Stored profile picture could not be deleted.",
      "PROFILE_PICTURE_STORAGE_DELETE_FAILED",
    );
  }
}

/**
 * ============================================================================
 * BEST-EFFORT CLEANUP
 * ============================================================================
 *
 * Used when:
 *
 * 1. object upload succeeds
 * 2. database transaction fails
 *
 * The database remains authoritative.
 *
 * This function attempts to remove the orphaned object without replacing the
 * original database/transaction error.
 */
export async function safelyDeleteObject(
  storageKey: string,
): Promise<void> {
  try {
    await deletePrivateObject(
      storageKey,
    );
  } catch (error) {
    console.error(
      "Best-effort profile-picture object cleanup failed.",
      {
        error,

        storageKey,
      },
    );
  }
}