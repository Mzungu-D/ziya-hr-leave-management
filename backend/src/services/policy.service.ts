import { randomUUID } from "node:crypto";

import { db } from "../../prisma/db.js";
import { AppError } from "../middleware/error.middleware.js";

type PolicyStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "ARCHIVED";

export interface CreatePolicyParams {
  organizationId: string;
  actorId: string;
  title: string;
  code: string;
  description?: string | null;
  content: string;
  status?: PolicyStatus;
  version?: number;
  effectiveFrom?: string | Date | null;
  effectiveTo?: string | Date | null;
}

export interface UpdatePolicyParams {
  organizationId: string;
  actorId: string;
  policyId: string;
  title?: string;
  code?: string;
  description?: string | null;
  content?: string;
  version?: number;
  effectiveFrom?: string | Date | null;
  effectiveTo?: string | Date | null;
}

export interface ListPoliciesParams {
  organizationId: string;
  actorId: string;
  status?: PolicyStatus;
  search?: string;
}

interface DbRecord {
  id: string;
  organizationId: string;
  title: string;
  code: string;
  description?: string | null;
  content: string;
  status: PolicyStatus;
  version: number;
  effectiveFrom?: string | Date | null;
  effectiveTo?: string | Date | null;
  publishedAt?: string | Date | null;
  archivedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

const POLICY_STATUSES: readonly PolicyStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
];

const MAX_TITLE_LENGTH = 200;
const MAX_CODE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_CONTENT_LENGTH = 1_000_000;

function requireId(
  value: unknown,
  field: string,
  code: string,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(
      400,
      `${field} is required.`,
      code,
    );
  }

  return value.trim();
}

function normalizeText(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throw new AppError(
      400,
      `${field} is required.`,
      "INVALID_POLICY_FIELD",
    );
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new AppError(
      400,
      `${field} is required.`,
      "INVALID_POLICY_FIELD",
    );
  }

  if (normalized.length > maxLength) {
    throw new AppError(
      400,
      `${field} cannot exceed ${maxLength} characters.`,
      "POLICY_FIELD_TOO_LONG",
    );
  }

  return normalized;
}

function normalizeOptionalText(
  value: unknown,
  field: string,
  maxLength: number,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new AppError(
      400,
      `${field} must be text.`,
      "INVALID_POLICY_FIELD",
    );
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw new AppError(
      400,
      `${field} cannot exceed ${maxLength} characters.`,
      "POLICY_FIELD_TOO_LONG",
    );
  }

  return normalized;
}

function normalizeCode(value: unknown): string {
  const code = normalizeText(
    value,
    "Policy code",
    MAX_CODE_LENGTH,
  ).toUpperCase();

  if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) {
    throw new AppError(
      400,
      "Policy code may contain only letters, numbers, underscores and hyphens.",
      "INVALID_POLICY_CODE",
    );
  }

  return code;
}

function normalizeStatus(
  value: unknown,
): PolicyStatus {
  if (
    typeof value !== "string" ||
    !POLICY_STATUSES.includes(
      value.toUpperCase() as PolicyStatus,
    )
  ) {
    throw new AppError(
      400,
      "Invalid policy status.",
      "INVALID_POLICY_STATUS",
    );
  }

  return value.toUpperCase() as PolicyStatus;
}

function normalizeVersion(
  value: unknown,
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 999999
  ) {
    throw new AppError(
      400,
      "Policy version must be a positive whole number.",
      "INVALID_POLICY_VERSION",
    );
  }

  return value;
}

function normalizeDate(
  value: string | Date | null | undefined,
  field: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(
      400,
      `${field} must be a valid date.`,
      "INVALID_POLICY_DATE",
    );
  }

  return date.toISOString();
}

function timestamp(
  value: string | Date | null | undefined,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const result =
    value instanceof Date
      ? value.getTime()
      : new Date(value).getTime();

  return Number.isNaN(result) ? null : result;
}

function assertEffectiveDateRange(
  effectiveFrom: string | null,
  effectiveTo: string | null,
): void {
  if (!effectiveFrom || !effectiveTo) {
    return;
  }

  const from = timestamp(effectiveFrom);
  const to = timestamp(effectiveTo);

  if (
    from === null ||
    to === null ||
    to < from
  ) {
    throw new AppError(
      400,
      "Effective end date cannot be earlier than the effective start date.",
      "INVALID_POLICY_DATE_RANGE",
    );
  }
}

function toPublicPolicy(
  policy: DbRecord,
) {
  return {
    id: policy.id,
    organizationId: policy.organizationId,
    title: policy.title,
    code: policy.code,
    description: policy.description ?? null,
    content: policy.content,
    status: policy.status,
    version: policy.version,
    effectiveFrom: policy.effectiveFrom ?? null,
    effectiveTo: policy.effectiveTo ?? null,
    publishedAt: policy.publishedAt ?? null,
    archivedAt: policy.archivedAt ?? null,
    createdAt: policy.createdAt,
    updatedAt: policy.updatedAt,
  };
}

function normalizeSearch(
  value: unknown,
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

async function ensureOrganization(
  organizationId: string,
): Promise<void> {
  const organization =
    await db.orm.public.Organization
      .where({ id: organizationId })
      .first();

  if (!organization) {
    throw new AppError(
      404,
      "Organization not found.",
      "ORGANIZATION_NOT_FOUND",
    );
  }
}

async function ensurePolicyInOrganization(
  organizationId: string,
  policyId: string,
): Promise<DbRecord> {
  const policy =
    await db.orm.public.Policy
      .where({ id: policyId })
      .first();

  if (
    !policy ||
    policy.organizationId !== organizationId
  ) {
    throw new AppError(
      404,
      "Policy not found.",
      "POLICY_NOT_FOUND",
    );
  }

  return policy as DbRecord;
}

function assertPolicyCanBeEdited(
  policy: DbRecord,
): void {
  if (policy.status === "ARCHIVED") {
    throw new AppError(
      409,
      "Archived policies cannot be edited.",
      "ARCHIVED_POLICY_IMMUTABLE",
    );
  }
}

function assertPolicyCanBePublished(
  policy: DbRecord,
): void {
  if (policy.status === "ARCHIVED") {
    throw new AppError(
      409,
      "An archived policy cannot be published.",
      "ARCHIVED_POLICY_CANNOT_BE_PUBLISHED",
    );
  }
}

function assertNoInvalidPublishedState(
  status: PolicyStatus,
  effectiveFrom: string | null,
): void {
  if (
    status === "PUBLISHED" &&
    effectiveFrom
  ) {
    const effectiveTimestamp =
      timestamp(effectiveFrom);

    if (
      effectiveTimestamp !== null &&
      effectiveTimestamp > Date.now()
    ) {
      return;
    }
  }
}

/**
 * List policies belonging exclusively to the authenticated
 * organization's tenant.
 */
export async function listPolicies(
  params: ListPoliciesParams,
) {
  const organizationId = requireId(
    params.organizationId,
    "Organization ID",
    "ORGANIZATION_ID_REQUIRED",
  );

  requireId(
    params.actorId,
    "Actor ID",
    "ACTOR_ID_REQUIRED",
  );

  await ensureOrganization(
    organizationId,
  );

  const policies =
    await db.orm.public.Policy
      .where({
        organizationId,
      })
      .all();

  const search =
    normalizeSearch(params.search);

  const requestedStatus =
    params.status
      ? normalizeStatus(params.status)
      : null;

  const filtered = policies
    .filter((policy: DbRecord) => {
      if (
        requestedStatus &&
        policy.status !== requestedStatus
      ) {
        return false;
      }

      if (!search) {
        return true;
      }

      const haystack = [
        policy.title,
        policy.code,
        policy.description ?? "",
        policy.content,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    })
    .sort(
      (
        a: DbRecord,
        b: DbRecord,
      ) => {
        const aTime =
          timestamp(a.updatedAt) ?? 0;

        const bTime =
          timestamp(b.updatedAt) ?? 0;

        return bTime - aTime;
      },
    );

  return filtered.map(
    (policy: DbRecord) =>
      toPublicPolicy(policy),
  );
}

/**
 * Retrieve one policy from the authenticated tenant.
 */
export async function getPolicy(
  organizationId: string,
  actorId: string,
  policyId: string,
) {
  const normalizedOrganizationId =
    requireId(
      organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  requireId(
    actorId,
    "Actor ID",
    "ACTOR_ID_REQUIRED",
  );

  const normalizedPolicyId =
    requireId(
      policyId,
      "Policy ID",
      "POLICY_ID_REQUIRED",
    );

  const policy =
    await ensurePolicyInOrganization(
      normalizedOrganizationId,
      normalizedPolicyId,
    );

  return toPublicPolicy(policy);
}

/**
 * Create a new draft policy.
 *
 * New policies are intentionally created as DRAFT unless the
 * caller explicitly requests another status. Publication should
 * normally happen through publishPolicy().
 */
export async function createPolicy(
  params: CreatePolicyParams,
) {
  const organizationId =
    requireId(
      params.organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  const actorId =
    requireId(
      params.actorId,
      "Actor ID",
      "ACTOR_ID_REQUIRED",
    );

  void actorId;

  await ensureOrganization(
    organizationId,
  );

  const title =
    normalizeText(
      params.title,
      "Policy title",
      MAX_TITLE_LENGTH,
    );

  const code =
    normalizeCode(params.code);

  const description =
    normalizeOptionalText(
      params.description,
      "Policy description",
      MAX_DESCRIPTION_LENGTH,
    );

  const content =
    normalizeText(
      params.content,
      "Policy content",
      MAX_CONTENT_LENGTH,
    );

  const status =
    params.status === undefined
      ? "DRAFT"
      : normalizeStatus(params.status);

  const version =
    params.version === undefined
      ? 1
      : normalizeVersion(params.version);

  const effectiveFrom =
    normalizeDate(
      params.effectiveFrom,
      "Effective start date",
    );

  const effectiveTo =
    normalizeDate(
      params.effectiveTo,
      "Effective end date",
    );

  assertEffectiveDateRange(
    effectiveFrom,
    effectiveTo,
  );

  if (
    status === "PUBLISHED"
  ) {
    assertNoInvalidPublishedState(
      status,
      effectiveFrom,
    );
  }

  const existing =
    await db.orm.public.Policy
      .where({
        organizationId,
        code,
      })
      .first();

  if (existing) {
    throw new AppError(
      409,
      "A policy with this code already exists in this organization.",
      "POLICY_CODE_ALREADY_EXISTS",
    );
  }

  const now =
    new Date().toISOString();

  const policy =
    await db.orm.public.Policy.create({
      id: randomUUID(),
      organizationId,
      title,
      code,
      description,
      content,
      status,
      version,
      effectiveFrom,
      effectiveTo,
      publishedAt:
        status === "PUBLISHED"
          ? now
          : null,
      archivedAt:
        status === "ARCHIVED"
          ? now
          : null,
      createdAt: now,
      updatedAt: now,
    });

  return toPublicPolicy(
    policy as DbRecord,
  );
}

/**
 * Update editable policy fields.
 *
 * Archived policies are immutable.
 */
export async function updatePolicy(
  params: UpdatePolicyParams,
) {
  const organizationId =
    requireId(
      params.organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  requireId(
    params.actorId,
    "Actor ID",
    "ACTOR_ID_REQUIRED",
  );

  const policyId =
    requireId(
      params.policyId,
      "Policy ID",
      "POLICY_ID_REQUIRED",
    );

  const existing =
    await ensurePolicyInOrganization(
      organizationId,
      policyId,
    );

  assertPolicyCanBeEdited(
    existing,
  );

  const updateData: Record<
    string,
    unknown
  > = {};

  if (
    params.title !== undefined
  ) {
    updateData.title =
      normalizeText(
        params.title,
        "Policy title",
        MAX_TITLE_LENGTH,
      );
  }

  if (
    params.code !== undefined
  ) {
    const code =
      normalizeCode(params.code);

    const duplicate =
      await db.orm.public.Policy
        .where({
          organizationId,
          code,
        })
        .first();

    if (
      duplicate &&
      duplicate.id !== existing.id
    ) {
      throw new AppError(
        409,
        "A policy with this code already exists in this organization.",
        "POLICY_CODE_ALREADY_EXISTS",
      );
    }

    updateData.code = code;
  }

  if (
    params.description !== undefined
  ) {
    updateData.description =
      normalizeOptionalText(
        params.description,
        "Policy description",
        MAX_DESCRIPTION_LENGTH,
      );
  }

  if (
    params.content !== undefined
  ) {
    updateData.content =
      normalizeText(
        params.content,
        "Policy content",
        MAX_CONTENT_LENGTH,
      );
  }

  if (
    params.version !== undefined
  ) {
    updateData.version =
      normalizeVersion(
        params.version,
      );
  }

  if (
    params.effectiveFrom !== undefined
  ) {
    updateData.effectiveFrom =
      normalizeDate(
        params.effectiveFrom,
        "Effective start date",
      );
  }

  if (
    params.effectiveTo !== undefined
  ) {
    updateData.effectiveTo =
      normalizeDate(
        params.effectiveTo,
        "Effective end date",
      );
  }

  const effectiveFrom =
    params.effectiveFrom !== undefined
      ? (updateData.effectiveFrom as
          string | null)
      : existing.effectiveFrom
        ? new Date(
            existing.effectiveFrom,
          ).toISOString()
        : null;

  const effectiveTo =
    params.effectiveTo !== undefined
      ? (updateData.effectiveTo as
          string | null)
      : existing.effectiveTo
        ? new Date(
            existing.effectiveTo,
          ).toISOString()
        : null;

  assertEffectiveDateRange(
    effectiveFrom,
    effectiveTo,
  );

  if (
    Object.keys(updateData).length === 0
  ) {
    return toPublicPolicy(existing);
  }

  updateData.updatedAt =
    new Date().toISOString();

  const updated =
    await db.orm.public.Policy
      .where({
        id: existing.id,
      })
      .update(updateData);

  return toPublicPolicy(
    updated as DbRecord,
  );
}

/**
 * Publish a draft policy.
 *
 * Publishing is tenant-scoped and deliberately implemented
 * separately from generic update operations so publication
 * timestamps cannot be accidentally manipulated by ordinary
 * edits.
 */
export async function publishPolicy(
  organizationId: string,
  actorId: string,
  policyId: string,
) {
  const normalizedOrganizationId =
    requireId(
      organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  requireId(
    actorId,
    "Actor ID",
    "ACTOR_ID_REQUIRED",
  );

  const normalizedPolicyId =
    requireId(
      policyId,
      "Policy ID",
      "POLICY_ID_REQUIRED",
    );

  const existing =
    await ensurePolicyInOrganization(
      normalizedOrganizationId,
      normalizedPolicyId,
    );

  assertPolicyCanBePublished(
    existing,
  );

  if (
    existing.status === "PUBLISHED"
  ) {
    return toPublicPolicy(existing);
  }

  const now =
    new Date().toISOString();

  const updated =
    await db.orm.public.Policy
      .where({
        id: existing.id,
      })
      .update({
        status: "PUBLISHED",
        publishedAt: now,
        archivedAt: null,
        updatedAt: now,
      });

  return toPublicPolicy(
    updated as DbRecord,
  );
}

/**
 * Archive a policy.
 *
 * Archived policies remain available for audit/history but
 * cannot subsequently be edited or published.
 */
export async function archivePolicy(
  organizationId: string,
  actorId: string,
  policyId: string,
) {
  const normalizedOrganizationId =
    requireId(
      organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  requireId(
    actorId,
    "Actor ID",
    "ACTOR_ID_REQUIRED",
  );

  const normalizedPolicyId =
    requireId(
      policyId,
      "Policy ID",
      "POLICY_ID_REQUIRED",
    );

  const existing =
    await ensurePolicyInOrganization(
      normalizedOrganizationId,
      normalizedPolicyId,
    );

  if (
    existing.status === "ARCHIVED"
  ) {
    return toPublicPolicy(existing);
  }

  const now =
    new Date().toISOString();

  const updated =
    await db.orm.public.Policy
      .where({
        id: existing.id,
      })
      .update({
        status: "ARCHIVED",
        archivedAt: now,
        updatedAt: now,
      });

  return toPublicPolicy(
    updated as DbRecord,
  );
}

/**
 * Restore an archived policy to DRAFT.
 *
 * Restoration does not publish the policy automatically.
 */
export async function restorePolicy(
  organizationId: string,
  actorId: string,
  policyId: string,
) {
  const normalizedOrganizationId =
    requireId(
      organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  requireId(
    actorId,
    "Actor ID",
    "ACTOR_ID_REQUIRED",
  );

  const normalizedPolicyId =
    requireId(
      policyId,
      "Policy ID",
      "POLICY_ID_REQUIRED",
    );

  const existing =
    await ensurePolicyInOrganization(
      normalizedOrganizationId,
      normalizedPolicyId,
    );

  if (
    existing.status !== "ARCHIVED"
  ) {
    return toPublicPolicy(existing);
  }

  const now =
    new Date().toISOString();

  const updated =
    await db.orm.public.Policy
      .where({
        id: existing.id,
      })
      .update({
        status: "DRAFT",
        archivedAt: null,
        updatedAt: now,
      });

  return toPublicPolicy(
    updated as DbRecord,
  );
}

/**
 * Delete a policy.
 *
 * Hard deletion is intentionally restricted to DRAFT policies.
 * Published and archived records remain available for history,
 * compliance and auditability.
 */
export async function deletePolicy(
  organizationId: string,
  actorId: string,
  policyId: string,
): Promise<void> {
  const normalizedOrganizationId =
    requireId(
      organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  requireId(
    actorId,
    "Actor ID",
    "ACTOR_ID_REQUIRED",
  );

  const normalizedPolicyId =
    requireId(
      policyId,
      "Policy ID",
      "POLICY_ID_REQUIRED",
    );

  const existing =
    await ensurePolicyInOrganization(
      normalizedOrganizationId,
      normalizedPolicyId,
    );

  if (
    existing.status !== "DRAFT"
  ) {
    throw new AppError(
      409,
      "Only draft policies can be permanently deleted.",
      "POLICY_DELETE_FORBIDDEN",
    );
  }

  await db.orm.public.Policy
    .where({
      id: existing.id,
    })
    .delete();
}

/**
 * Return high-level policy statistics for the current tenant.
 */
export async function getPolicySummary(
  organizationId: string,
  actorId: string,
) {
  const normalizedOrganizationId =
    requireId(
      organizationId,
      "Organization ID",
      "ORGANIZATION_ID_REQUIRED",
    );

  requireId(
    actorId,
    "Actor ID",
    "ACTOR_ID_REQUIRED",
  );

  await ensureOrganization(
    normalizedOrganizationId,
  );

  const policies =
    await db.orm.public.Policy
      .where({
        organizationId:
          normalizedOrganizationId,
      })
      .all();

  let draft = 0;
  let published = 0;
  let archived = 0;

  for (
    const policy of policies as DbRecord[]
  ) {
    if (policy.status === "DRAFT") {
      draft += 1;
    } else if (
      policy.status === "PUBLISHED"
    ) {
      published += 1;
    } else if (
      policy.status === "ARCHIVED"
    ) {
      archived += 1;
    }
  }

  return {
    total: policies.length,
    draft,
    published,
    archived,
  };
}