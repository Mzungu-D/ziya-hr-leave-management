import { randomUUID } from "node:crypto";

import { db } from "../../prisma/db.js";

import { AppError } from "../middleware/error.middleware.js";

import {
  deletePrivateObject,
  safelyDeleteObject,
  uploadProfilePicture,
} from "./storage.service.js";

/**
 * --------------------------------------------------------------------------
 * Types
 * --------------------------------------------------------------------------
 */

export type ProfilePictureActorRole =
  | "EMPLOYEE"
  | "MANAGER"
  | "HR_ADMIN"
  | "SUPER_ADMIN";

export interface SetProfilePictureParams {
  actorEmployeeId: string;
  targetEmployeeId: string;
  buffer: Buffer;
  originalName?: string;
  declaredMimeType?: string;
}

export interface ProfilePictureRecord {
  id: string;
  employeeId: string;
  name: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

/**
 * --------------------------------------------------------------------------
 * Validation
 * --------------------------------------------------------------------------
 */

function requireId(
  value: string,
  fieldName: string,
  errorCode: string,
): string {
  if (typeof value !== "string") {
    throw new AppError(
      400,
      `${fieldName} is required.`,
      errorCode,
    );
  }

  const normalized =
    value.trim();

  if (!normalized) {
    throw new AppError(
      400,
      `${fieldName} is required.`,
      errorCode,
    );
  }

  if (normalized.length > 255) {
    throw new AppError(
      400,
      `${fieldName} is invalid.`,
      `${errorCode}_INVALID`,
    );
  }

  return normalized;
}

/**
 * --------------------------------------------------------------------------
 * Authenticated employee / organization context
 * --------------------------------------------------------------------------
 *
 * Organization identity is NEVER accepted from the request.
 *
 * It is always derived from the authenticated employee.
 *
 * This is one of the primary tenant-isolation controls for this feature.
 */

async function getActor(
  actorEmployeeId: string,
) {
  const employeeId =
    requireId(
      actorEmployeeId,
      "Authenticated employee ID",
      "AUTHENTICATED_EMPLOYEE_ID_REQUIRED",
    );

  const employee =
    await db.orm.public.Employee
      .where({
        id:
          employeeId,
      })
      .first();

  if (!employee) {
    throw new AppError(
      401,
      "The authenticated employee account could not be found.",
      "AUTHENTICATED_EMPLOYEE_NOT_FOUND",
    );
  }

  if (
    employee.status !==
    "ACTIVE"
  ) {
    throw new AppError(
      403,
      "This employee account is not active.",
      "EMPLOYEE_ACCOUNT_INACTIVE",
    );
  }

  return employee;
}

/**
 * --------------------------------------------------------------------------
 * Target employee lookup
 * --------------------------------------------------------------------------
 *
 * The target employee MUST belong to the same organization as the actor.
 *
 * No organization ID is accepted from the client.
 */

async function getTargetEmployee(
  organizationId: string,
  targetEmployeeId: string,
) {
  const normalizedTargetId =
    requireId(
      targetEmployeeId,
      "Target employee ID",
      "TARGET_EMPLOYEE_ID_REQUIRED",
    );

  const employee =
    await db.orm.public.Employee
      .where({
        id:
          normalizedTargetId,

        organizationId,
      })
      .first();

  if (!employee) {
    throw new AppError(
      404,
      "Employee not found.",
      "EMPLOYEE_NOT_FOUND",
    );
  }

  return employee;
}

/**
 * --------------------------------------------------------------------------
 * Authorization
 * --------------------------------------------------------------------------
 *
 * Employees:
 *   - May manage/view their own profile picture.
 *
 * HR_ADMIN:
 *   - May manage/view employees within their organization.
 *
 * SUPER_ADMIN:
 *   - May manage/view employees within their organization.
 *
 * Managers:
 *   - Cannot manage another employee's profile picture.
 *
 * Cross-tenant access:
 *   - Blocked by getTargetEmployee() before this authorization is reached.
 */

function assertProfilePicturePermission(
  actorEmployeeId: string,
  targetEmployeeId: string,
  actorRole: string,
): void {
  const isSelf =
    actorEmployeeId ===
    targetEmployeeId;

  if (isSelf) {
    return;
  }

  if (
    actorRole ===
      "HR_ADMIN" ||
    actorRole ===
      "SUPER_ADMIN"
  ) {
    return;
  }

  throw new AppError(
    403,
    "You do not have permission to manage this employee's profile picture.",
    "PROFILE_PICTURE_FORBIDDEN",
  );
}

/**
 * --------------------------------------------------------------------------
 * Profile document lookup
 * --------------------------------------------------------------------------
 */

async function findProfileDocument(
  organizationId: string,
  employeeId: string,
  documentId: string,
) {
  return db.orm.public.EmployeeDocument
    .where({
      id:
        documentId,

      organizationId,

      employeeId,

      documentType:
        "PROFILE_PHOTO",
    })
    .first();
}

type ProfilePictureDocument =
  NonNullable<
    Awaited<
      ReturnType<
        typeof findProfileDocument
      >
    >
  >;

/**
 * --------------------------------------------------------------------------
 * Safe DTO
 * --------------------------------------------------------------------------
 *
 * Storage keys, object-storage credentials and internal storage metadata are
 * NEVER returned to the client.
 */

function toProfilePictureRecord(
  document: ProfilePictureDocument,
): ProfilePictureRecord {
  return {
    id:
      document.id,

    employeeId:
      document.employeeId,

    name:
      document.name,

    originalName:
      document.originalName,

    mimeType:
      document.mimeType,

    sizeBytes:
      document.sizeBytes,

    createdAt:
      document.createdAt,
  };
}

/**
 * --------------------------------------------------------------------------
 * Set / replace profile picture
 * --------------------------------------------------------------------------
 */

export async function setProfilePicture(
  params: SetProfilePictureParams,
): Promise<ProfilePictureRecord> {
  const actor =
    await getActor(
      params.actorEmployeeId,
    );

  const target =
    await getTargetEmployee(
      actor.organizationId,
      params.targetEmployeeId,
    );

  assertProfilePicturePermission(
    actor.id,
    target.id,
    String(actor.role),
  );

  /**
   * The authenticated employee is ALWAYS the uploader.
   *
   * The browser cannot choose uploadedById.
   */
  const uploadedById =
    actor.id;

  /**
   * Read the currently referenced document before creating the replacement.
   *
   * This is used for cleanup/history.
   *
   * The authoritative employee pointer is re-read inside the transaction.
   */
  const previousDocumentId =
    target.profilePictureDocumentId;

  let previousDocument:
    ProfilePictureDocument | null =
    null;

  if (
    previousDocumentId
  ) {
    previousDocument =
      await findProfileDocument(
        actor.organizationId,
        target.id,
        previousDocumentId,
      );

    if (
      !previousDocument
    ) {
      throw new AppError(
        500,
        "The employee profile picture state is inconsistent.",
        "PROFILE_PICTURE_STATE_INCONSISTENT",
      );
    }

    if (
      previousDocument.status !==
      "ACTIVE"
    ) {
      throw new AppError(
        500,
        "The employee profile picture state is inconsistent.",
        "PROFILE_PICTURE_STATE_INCONSISTENT",
      );
    }
  }

  /**
   * ------------------------------------------------------------------------
   * Upload first
   * ------------------------------------------------------------------------
   *
   * The database will never reference an object that failed to upload.
   */
  const uploaded =
    await uploadProfilePicture({
      organizationId:
        actor.organizationId,

      employeeId:
        target.id,

      buffer:
        params.buffer,

      originalName:
        params.originalName,

      declaredMimeType:
        params.declaredMimeType,
    });

  const newDocumentId =
    randomUUID();

  try {
    await db.transaction(
      async (tx) => {
        /**
         * Re-read the employee inside the transaction.
         */
        const currentEmployee =
          await tx.orm.public.Employee
            .where({
              id:
                target.id,

              organizationId:
                actor.organizationId,
            })
            .first();

        if (
          !currentEmployee
        ) {
          throw new AppError(
            404,
            "Employee not found.",
            "EMPLOYEE_NOT_FOUND",
          );
        }

        /**
         * Determine the authoritative previous document.
         *
         * This protects against stale state when multiple requests arrive
         * close together.
         */
        let authoritativePreviousDocument:
          | ProfilePictureDocument
          | null =
          null;

        const authoritativePreviousId =
          currentEmployee.profilePictureDocumentId;

        if (
          authoritativePreviousId
        ) {
          const candidate =
            await tx.orm.public.EmployeeDocument
              .where({
                id:
                  authoritativePreviousId,

                organizationId:
                  actor.organizationId,

                employeeId:
                  target.id,

                documentType:
                  "PROFILE_PHOTO",
              })
              .first();

          if (!candidate) {
            throw new AppError(
              500,
              "The employee profile picture state is inconsistent.",
              "PROFILE_PICTURE_STATE_INCONSISTENT",
            );
          }

          if (
            candidate.status !==
            "ACTIVE"
          ) {
            throw new AppError(
              500,
              "The employee profile picture state is inconsistent.",
              "PROFILE_PICTURE_STATE_INCONSISTENT",
            );
          }

          authoritativePreviousDocument =
            candidate as ProfilePictureDocument;
        }

        /**
         * Create the new document record.
         */
        await tx.orm.public.EmployeeDocument
          .create({
            id:
              newDocumentId,

            organizationId:
              actor.organizationId,

            employeeId:
              target.id,

            uploadedById,

            documentType:
              "PROFILE_PHOTO",

            status:
              "ACTIVE",

            accessLevel:
              "EMPLOYEE_AND_HR",

            name:
              "Profile picture",

            description:
              null,

            storageKey:
              uploaded.storageKey,

            originalName:
              uploaded.originalName,

            mimeType:
              uploaded.mimeType,

            sizeBytes:
              uploaded.sizeBytes,

            sha256:
              uploaded.sha256,
          });

        /**
         * Update the authoritative employee pointer.
         */
        await tx.orm.public.Employee
          .where({
            id:
              target.id,

            organizationId:
              actor.organizationId,
          })
          .update({
            profilePictureDocumentId:
              newDocumentId,
          });

        /**
         * Archive the authoritative previous document.
         *
         * We retain the DB record for history/audit purposes.
         */
        if (
          authoritativePreviousDocument &&
          authoritativePreviousDocument.id !==
            newDocumentId
        ) {
          await tx.orm.public.EmployeeDocument
            .where({
              id:
                authoritativePreviousDocument.id,

              organizationId:
                actor.organizationId,

              employeeId:
                target.id,

              documentType:
                "PROFILE_PHOTO",

              status:
                "ACTIVE",
            })
            .update({
              status:
                "ARCHIVED",
            });
        }
      },
    );
  } catch (error) {
    /**
     * The new object is not referenced by the database if the transaction
     * failed, so remove it immediately.
     */
    await safelyDeleteObject(
      uploaded.storageKey,
    );

    throw error;
  }

  /**
   * ------------------------------------------------------------------------
   * Reload authoritative state after commit
   * ------------------------------------------------------------------------
   *
   * This detects a concurrent request that subsequently replaced the image.
   */
  const currentEmployee =
    await db.orm.public.Employee
      .where({
        id:
          target.id,

        organizationId:
          actor.organizationId,
      })
      .first();

  if (
    !currentEmployee ||
    currentEmployee.profilePictureDocumentId !==
      newDocumentId
  ) {
    /**
     * Another request won the replacement race.
     *
     * Our object is no longer needed.
     */
    await safelyDeleteObject(
      uploaded.storageKey,
    );

    try {
      await db.orm.public.EmployeeDocument
        .where({
          id:
            newDocumentId,

          organizationId:
            actor.organizationId,

          employeeId:
            target.id,

          documentType:
            "PROFILE_PHOTO",
        })
        .update({
          status:
            "ARCHIVED",
        });
    } catch (cleanupError) {
      console.error(
        "Failed to archive concurrent profile-picture document.",
        cleanupError,
      );
    }

    throw new AppError(
      409,
      "The profile picture was changed by another request. Please try again.",
      "PROFILE_PICTURE_CONFLICT",
    );
  }

  /**
   * Delete the object belonging to the previous authoritative document.
   *
   * Storage cleanup is deliberately outside the database transaction.
   */
  if (
    previousDocument &&
    previousDocument.id !==
      newDocumentId &&
    previousDocument.storageKey !==
      uploaded.storageKey
  ) {
    try {
      await deletePrivateObject(
        previousDocument.storageKey,
      );
    } catch (error) {
      /**
       * The archived DB record remains available so a future cleanup process
       * can retry storage deletion.
       */
      console.error(
        "Previous profile-picture object could not be deleted after replacement.",
        error,
      );
    }
  }

  /**
   * Load the authoritative active document.
   */
  const document =
    await db.orm.public.EmployeeDocument
      .where({
        id:
          newDocumentId,

        organizationId:
          actor.organizationId,

        employeeId:
          target.id,

        documentType:
          "PROFILE_PHOTO",

        status:
          "ACTIVE",
      })
      .first();

  if (!document) {
    throw new AppError(
      500,
      "Profile picture was saved but could not be loaded.",
      "PROFILE_PICTURE_STATE_ERROR",
    );
  }

  return toProfilePictureRecord(
    document as ProfilePictureDocument,
  );
}

/**
 * --------------------------------------------------------------------------
 * Remove profile picture
 * --------------------------------------------------------------------------
 */

export async function removeProfilePicture(
  actorEmployeeId: string,
  targetEmployeeId: string,
): Promise<void> {
  const actor =
    await getActor(
      actorEmployeeId,
    );

  const target =
    await getTargetEmployee(
      actor.organizationId,
      targetEmployeeId,
    );

  assertProfilePicturePermission(
    actor.id,
    target.id,
    String(actor.role),
  );

  const currentDocumentId =
    target.profilePictureDocumentId;

  /**
   * Removal is idempotent.
   */
  if (
    !currentDocumentId
  ) {
    return;
  }

  const document =
    await findProfileDocument(
      actor.organizationId,
      target.id,
      currentDocumentId,
    );

  if (
    !document ||
    document.status !==
      "ACTIVE"
  ) {
    throw new AppError(
      500,
      "The employee profile picture state is inconsistent.",
      "PROFILE_PICTURE_STATE_INCONSISTENT",
    );
  }

  /**
   * Clear the employee pointer and archive the document atomically.
   */
  await db.transaction(
    async (tx) => {
      const currentEmployee =
        await tx.orm.public.Employee
          .where({
            id:
              target.id,

            organizationId:
              actor.organizationId,
          })
          .first();

      if (
        !currentEmployee
      ) {
        throw new AppError(
          404,
          "Employee not found.",
          "EMPLOYEE_NOT_FOUND",
        );
      }

      /**
       * Another request already replaced or removed the picture.
       */
      if (
        currentEmployee.profilePictureDocumentId !==
        currentDocumentId
      ) {
        throw new AppError(
          409,
          "The profile picture was changed by another request. Please try again.",
          "PROFILE_PICTURE_CONFLICT",
        );
      }

      await tx.orm.public.Employee
        .where({
          id:
            target.id,

          organizationId:
            actor.organizationId,
        })
        .update({
          profilePictureDocumentId:
            null,
        });

      await tx.orm.public.EmployeeDocument
        .where({
          id:
            document.id,

          organizationId:
            actor.organizationId,

          employeeId:
            target.id,

          documentType:
            "PROFILE_PHOTO",

          status:
            "ACTIVE",
        })
        .update({
          status:
            "ARCHIVED",
        });
    },
  );

  /**
   * Database state is authoritative after commit.
   *
   * Storage cleanup happens afterwards so a storage failure cannot roll back
   * the already committed database operation.
   */
  try {
    await deletePrivateObject(
      document.storageKey,
    );
  } catch (error) {
    console.error(
      "Profile-picture object could not be deleted after database removal.",
      error,
    );
  }
}

/**
 * --------------------------------------------------------------------------
 * Get current profile-picture metadata
 * --------------------------------------------------------------------------
 *
 * Storage keys are deliberately excluded from the DTO.
 */

export async function getProfilePicture(
  actorEmployeeId: string,
  targetEmployeeId: string,
): Promise<ProfilePictureRecord | null> {
  const actor =
    await getActor(
      actorEmployeeId,
    );

  const target =
    await getTargetEmployee(
      actor.organizationId,
      targetEmployeeId,
    );

  const isSelf =
    actor.id ===
    target.id;

  const isAdministrator =
    actor.role ===
      "HR_ADMIN" ||
    actor.role ===
      "SUPER_ADMIN";

  if (
    !isSelf &&
    !isAdministrator
  ) {
    throw new AppError(
      403,
      "You do not have permission to access this employee's profile picture.",
      "PROFILE_PICTURE_FORBIDDEN",
    );
  }

  const documentId =
    target.profilePictureDocumentId;

  if (!documentId) {
    return null;
  }

  const document =
    await findProfileDocument(
      actor.organizationId,
      target.id,
      documentId,
    );

  if (
    !document ||
    document.status !==
      "ACTIVE"
  ) {
    throw new AppError(
      500,
      "The employee profile picture state is inconsistent.",
      "PROFILE_PICTURE_STATE_INCONSISTENT",
    );
  }

  return toProfilePictureRecord(
    document,
  );
}

/**
 * --------------------------------------------------------------------------
 * Get authorized private profile-picture object
 * --------------------------------------------------------------------------
 *
 * This function is intentionally separate from getProfilePicture().
 *
 * getProfilePicture() returns safe metadata only.
 *
 * This function is used internally by the authenticated image endpoint and
 * returns the private storage key only to the backend.
 *
 * Authorization rules:
 *
 * - Employee: own profile picture only.
 * - HR_ADMIN: any employee in the same organization.
 * - SUPER_ADMIN: any employee in the same organization.
 * - Cross-tenant access: always denied.
 *
 * The storage key is never serialized into an API response.
 */
export async function getProfilePictureObject(
  actorEmployeeId: string,
  targetEmployeeId: string,
): Promise<{
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}> {
  const actor =
    await getActor(
      actorEmployeeId,
    );

  const target =
    await getTargetEmployee(
      actor.organizationId,
      targetEmployeeId,
    );

  assertProfilePicturePermission(
    actor.id,
    target.id,
    String(actor.role),
  );

  if (
    !target.profilePictureDocumentId
  ) {
    throw new AppError(
      404,
      "This employee does not have a profile picture.",
      "PROFILE_PICTURE_NOT_FOUND",
    );
  }

  const document =
    await findProfileDocument(
      actor.organizationId,
      target.id,
      target.profilePictureDocumentId,
    );

  if (
    !document ||
    document.status !==
      "ACTIVE"
  ) {
    throw new AppError(
      500,
      "The employee profile picture state is inconsistent.",
      "PROFILE_PICTURE_STATE_INCONSISTENT",
    );
  }

  if (
    !document.storageKey ||
    !document.storageKey.trim()
  ) {
    throw new AppError(
      500,
      "The employee profile picture storage reference is invalid.",
      "PROFILE_PICTURE_STORAGE_REFERENCE_INVALID",
    );
  }

  /**
   * Profile pictures are normalized to JPEG by the storage service.
   *
   * Refuse unexpected persisted media types rather than blindly streaming
   * arbitrary content.
   */
  if (
    document.mimeType !==
    "image/jpeg"
  ) {
    throw new AppError(
      500,
      "The stored profile picture has an invalid media type.",
      "PROFILE_PICTURE_MEDIA_TYPE_INVALID",
    );
  }

  return {
    storageKey:
      document.storageKey,

    mimeType:
      document.mimeType,

    sizeBytes:
      document.sizeBytes,

    sha256:
      document.sha256,
  };
}