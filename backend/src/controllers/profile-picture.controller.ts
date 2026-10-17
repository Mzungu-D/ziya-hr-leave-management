
import type {
  Request,
  Response,
} from "express";

import {
  Readable,
} from "node:stream";

import {
  getProfilePicture,
  getProfilePictureObject,
  removeProfilePicture,
  setProfilePicture,
} from "../services/profile-picture.service.js";

import {
  downloadPrivateObject,
} from "../services/storage.service.js";

import {
  AppError,
} from "../middleware/error.middleware.js";

const MAX_EMPLOYEE_ID_LENGTH =
  255;

function requireAuthenticatedEmployee(
  req: Request,
): string {
  const employeeId =
    req.auth?.employeeId;

  if (
    typeof employeeId !== "string" ||
    employeeId.trim().length === 0
  ) {
    throw new AppError(
      401,
      "Authentication required.",
      "AUTHENTICATION_REQUIRED",
    );
  }

  return employeeId.trim();
}

function requireTargetEmployeeId(
  req: Request,
): string {
  const employeeId =
    req.params.employeeId;

  if (
    typeof employeeId !== "string" ||
    employeeId.trim().length === 0
  ) {
    throw new AppError(
      400,
      "Employee ID is required.",
      "EMPLOYEE_ID_REQUIRED",
    );
  }

  const normalizedEmployeeId =
    employeeId.trim();

  if (
    normalizedEmployeeId.length >
    MAX_EMPLOYEE_ID_LENGTH
  ) {
    throw new AppError(
      400,
      "Employee ID is invalid.",
      "EMPLOYEE_ID_INVALID",
    );
  }

  return normalizedEmployeeId;
}

function requireProfilePictureFile(
  req: Request,
): NonNullable<Request["file"]> {
  const file =
    req.file;

  if (!file) {
    throw new AppError(
      400,
      "A profile picture file is required.",
      "PROFILE_PICTURE_FILE_REQUIRED",
    );
  }

  if (
    !Buffer.isBuffer(file.buffer) ||
    file.buffer.length === 0
  ) {
    throw new AppError(
      400,
      "The uploaded profile picture is invalid.",
      "PROFILE_PICTURE_FILE_INVALID",
    );
  }

  return file;
}

/**
 * --------------------------------------------------------------------------
 * Get profile-picture metadata
 * --------------------------------------------------------------------------
 */

export async function getProfilePictureController(
  req: Request,
  res: Response,
): Promise<void> {
  const actorEmployeeId =
    requireAuthenticatedEmployee(req);

  const targetEmployeeId =
    requireTargetEmployeeId(req);

  const profilePicture =
    await getProfilePicture(
      actorEmployeeId,
      targetEmployeeId,
    );

  res.status(200).json({
    success:
      true,

    data:
      profilePicture,
  });
}

/**
 * --------------------------------------------------------------------------
 * Stream private profile-picture image
 * --------------------------------------------------------------------------
 *
 * The image remains in private Railway object storage.
 *
 * The client never receives:
 *
 * - S3 credentials
 * - bucket credentials
 * - storage key
 * - public object URL
 *
 * The backend authorizes the request and streams the private object.
 */

export async function getProfilePictureImageController(
  req: Request,
  res: Response,
): Promise<void> {
  const actorEmployeeId =
    requireAuthenticatedEmployee(req);

  const targetEmployeeId =
    requireTargetEmployeeId(req);

  const profilePicture =
    await getProfilePictureObject(
      actorEmployeeId,
      targetEmployeeId,
    );

  const storedObject =
    await downloadPrivateObject(
      profilePicture.storageKey,
    );

  /**
   * Profile pictures are normalized to JPEG by the storage service.
   */
  if (
    profilePicture.mimeType !==
    "image/jpeg"
  ) {
    throw new AppError(
      500,
      "The stored profile picture has an invalid media type.",
      "PROFILE_PICTURE_MEDIA_TYPE_INVALID",
    );
  }

  res.setHeader(
    "Cache-Control",
    "private, no-store",
  );

  res.setHeader(
    "Pragma",
    "no-cache",
  );

  res.setHeader(
    "Expires",
    "0",
  );

  res.setHeader(
    "Content-Type",
    "image/jpeg",
  );

  res.setHeader(
    "X-Content-Type-Options",
    "nosniff",
  );

  res.setHeader(
    "Content-Disposition",
    "inline",
  );

  if (
    typeof storedObject.contentLength ===
      "number" &&
    Number.isSafeInteger(
      storedObject.contentLength,
    ) &&
    storedObject.contentLength >= 0
  ) {
    res.setHeader(
      "Content-Length",
      String(
        storedObject.contentLength,
      ),
    );
  }

  const body =
    storedObject.body;

  /**
   * AWS SDK Node.js runtime normally exposes a readable stream.
   * Use a runtime type check rather than casting a Buffer to a stream.
   */
  if (
    body instanceof Readable
  ) {
    body.pipe(res);
    return;
  }

  /**
   * Defensive fallback for SDK/runtime implementations that expose a
   * transformToByteArray() body instead of a Node.js readable stream.
   */
  const transformableBody =
    body as unknown as {
      transformToByteArray?: () => Promise<
        Uint8Array
      >;
    };

  if (
    typeof transformableBody
      .transformToByteArray !==
    "function"
  ) {
    throw new AppError(
      503,
      "The stored profile picture could not be streamed.",
      "PROFILE_PICTURE_STREAM_UNAVAILABLE",
    );
  }

  const bytes =
    await transformableBody
      .transformToByteArray();

  res.end(
    Buffer.from(bytes),
  );
}

/**
 * --------------------------------------------------------------------------
 * Upload / replace profile picture
 * --------------------------------------------------------------------------
 */

export async function uploadProfilePictureController(
  req: Request,
  res: Response,
): Promise<void> {
  const actorEmployeeId =
    requireAuthenticatedEmployee(req);

  const targetEmployeeId =
    requireTargetEmployeeId(req);

  const file =
    requireProfilePictureFile(req);

  const result =
    await setProfilePicture({
      actorEmployeeId,

      targetEmployeeId,

      buffer:
        file.buffer,

      originalName:
        typeof file.originalname ===
        "string"
          ? file.originalname
          : undefined,

      declaredMimeType:
        typeof file.mimetype ===
        "string"
          ? file.mimetype
          : undefined,
    });

  res.status(200).json({
    success:
      true,

    data:
      result,
  });
}

/**
 * --------------------------------------------------------------------------
 * Remove profile picture
 * --------------------------------------------------------------------------
 */

export async function removeProfilePictureController(
  req: Request,
  res: Response,
): Promise<void> {
  const actorEmployeeId =
    requireAuthenticatedEmployee(req);

  const targetEmployeeId =
    requireTargetEmployeeId(req);

  await removeProfilePicture(
    actorEmployeeId,
    targetEmployeeId,
  );

  res.status(200).json({
    success:
      true,

    data: {
      employeeId:
        targetEmployeeId,

      profilePictureRemoved:
        true,
    },
  });
}
