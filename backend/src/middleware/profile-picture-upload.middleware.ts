import type {
  NextFunction,
  Request,
  Response,
} from "express";

import multer, {
  MulterError,
} from "multer";

import { AppError } from "./error.middleware.js";

/**
 * --------------------------------------------------------------------------
 * Security limits
 * --------------------------------------------------------------------------
 */

const MAX_FILE_SIZE_BYTES =
  5 * 1024 * 1024;

const MAX_FILES =
  1;

const MAX_FIELDS =
  0;

const MAX_PARTS =
  1;

const MAX_FIELD_NAME_LENGTH =
  100;

const MAX_HEADER_PAIRS =
  2000;

/**
 * --------------------------------------------------------------------------
 * Multer configuration
 * --------------------------------------------------------------------------
 *
 * Memory storage is intentional.
 *
 * The uploaded bytes are never written to the Railway application
 * filesystem. They are passed directly to the image validation and
 * normalization pipeline.
 *
 * The browser supplied MIME type is NOT trusted here.
 * Actual content validation happens in storage.service.ts.
 */

const profilePictureUpload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      fileSize:
        MAX_FILE_SIZE_BYTES,

      files:
        MAX_FILES,

      fields:
        MAX_FIELDS,

      parts:
        MAX_PARTS,

      fieldNameSize:
        MAX_FIELD_NAME_LENGTH,

      headerPairs:
        MAX_HEADER_PAIRS,
    },
  });

/**
 * --------------------------------------------------------------------------
 * Multer error translation
 * --------------------------------------------------------------------------
 */

function translateMulterError(
  error: MulterError,
): AppError {
  switch (error.code) {
    case "LIMIT_FILE_SIZE":
      return new AppError(
        413,
        "Profile picture must not exceed 5 MB.",
        "PROFILE_PICTURE_TOO_LARGE",
      );

    case "LIMIT_FILE_COUNT":
      return new AppError(
        400,
        "Only one profile picture may be uploaded at a time.",
        "PROFILE_PICTURE_TOO_MANY_FILES",
      );

    case "LIMIT_UNEXPECTED_FILE":
      return new AppError(
        400,
        "Only the profile picture file may be uploaded.",
        "PROFILE_PICTURE_UNEXPECTED_FILE",
      );

    case "LIMIT_FIELD_COUNT":
      return new AppError(
        400,
        "Unexpected form fields were supplied.",
        "PROFILE_PICTURE_UNEXPECTED_FIELDS",
      );

    case "LIMIT_PART_COUNT":
      return new AppError(
        400,
        "The upload request contains too many parts.",
        "PROFILE_PICTURE_TOO_MANY_PARTS",
      );

    case "LIMIT_FIELD_KEY":
      return new AppError(
        400,
        "The upload field name is invalid.",
        "PROFILE_PICTURE_FIELD_NAME_INVALID",
      );

    case "LIMIT_FIELD_VALUE":
      return new AppError(
        400,
        "An upload field value is too large.",
        "PROFILE_PICTURE_FIELD_VALUE_TOO_LARGE",
      );

    default:
      return new AppError(
        400,
        "The profile picture upload request is invalid.",
        "PROFILE_PICTURE_UPLOAD_INVALID",
      );
  }
}

/**
 * --------------------------------------------------------------------------
 * Multipart upload parser
 * --------------------------------------------------------------------------
 *
 * Expected multipart/form-data field:
 *
 *     file
 *
 * The resulting file is exposed as req.file.
 */

export function parseProfilePictureUpload(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  profilePictureUpload.single(
    "file",
  )(
    req,
    res,
    (error?: unknown) => {
      if (!error) {
        next();
        return;
      }

      if (
        error instanceof
        MulterError
      ) {
        next(
          translateMulterError(
            error,
          ),
        );
        return;
      }

      next(
        new AppError(
          400,
          "The profile picture upload could not be processed.",
          "PROFILE_PICTURE_UPLOAD_FAILED",
        ),
      );
    },
  );
}