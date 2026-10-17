#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/36bdf7d5d238f8e718a902a75f64ac7f0e2b079f60d0362eff3e004e6def1078/contract';
import startContract from '../../snapshots/36bdf7d5d238f8e718a902a75f64ac7f0e2b079f60d0362eff3e004e6def1078/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e8c934381ba4f989d052c74eb066d69df9e3fffeacd20a5117eb2a4681f9e7a0/contract';
import endContract from '../../snapshots/e8c934381ba4f989d052c74eb066d69df9e3fffeacd20a5117eb2a4681f9e7a0/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'Notification',
        constraint: 'Notification_type_check_acab4d1e',
      }),
      this.createTable({
        schema: 'public',
        table: 'OnboardingSubmission',
        columns: [
          col('completedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('consentData', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('employeeData', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('employeeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('hrData', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reviewedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('reviewedById', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('submittedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'OnboardingSubmission_status_check_b33a2c88',
            "\"status\" IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'RETURNED', 'COMPLETED')",
          ),
        ],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'Notification',
        constraint: 'Notification_type_check_b6ccc330',
        expression:
          "\"type\" IN ('LEAVE_REQUEST_SUBMITTED', 'LEAVE_REQUEST_APPROVED', 'LEAVE_REQUEST_REJECTED', 'LEAVE_REQUEST_CANCELLED', 'LEAVE_REQUEST_REVIEW_REQUIRED', 'ONBOARDING_SUBMITTED', 'SYSTEM')",
      }),
      this.addUnique({
        schema: 'public',
        table: 'OnboardingSubmission',
        constraint: 'OnboardingSubmission_employeeId_key',
        columns: ['employeeId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'OnboardingSubmission',
        constraint: 'OnboardingSubmission_organizationId_employeeId_key',
        columns: ['organizationId', 'employeeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'OnboardingSubmission',
        index: 'OnboardingSubmission_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'OnboardingSubmission',
        index: 'OnboardingSubmission_reviewedById_idx_e2835478',
        columns: ['reviewedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'OnboardingSubmission',
        index: 'onboard_org_reviewer_idx',
        columns: ['organizationId', 'reviewedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'OnboardingSubmission',
        index: 'onboard_org_status_submitted_idx',
        columns: ['organizationId', 'status', 'submittedAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'OnboardingSubmission',
        foreignKey: {
          name: 'OnboardingSubmission_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'Organization', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'OnboardingSubmission',
        foreignKey: {
          name: 'OnboardingSubmission_employeeId_fkey',
          columns: ['employeeId'],
          references: { schema: 'public', table: 'Employee', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'OnboardingSubmission',
        foreignKey: {
          name: 'OnboardingSubmission_reviewedById_fkey',
          columns: ['reviewedById'],
          references: { schema: 'public', table: 'Employee', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
