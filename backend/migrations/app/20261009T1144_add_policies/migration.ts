#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/7374180be4733f944d4d6282c736012ff356237bd0ccfaa45ce3dbb770a51791/contract';
import endContract from '../../snapshots/7374180be4733f944d4d6282c736012ff356237bd0ccfaa45ce3dbb770a51791/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/76c8d0f3f6f2fa79c58c7d371f612adda87dc8a089be64d4f80b142900b9a1d2/contract';
import startContract from '../../snapshots/76c8d0f3f6f2fa79c58c7d371f612adda87dc8a089be64d4f80b142900b9a1d2/contract.json' with { type: 'json' };
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
      this.createTable({
        schema: 'public',
        table: 'Policy',
        columns: [
          col('archivedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('content', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('effectiveFrom', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('effectiveTo', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('publishedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Policy_status_check_bc64f66b',
            "\"status\" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Policy',
        constraint: 'Policy_organizationId_code_key',
        columns: ['organizationId', 'code'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Policy',
        index: 'Policy_organizationId_effectiveFrom_idx_46424589',
        columns: ['organizationId', 'effectiveFrom'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Policy',
        index: 'Policy_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Policy',
        index: 'Policy_organizationId_publishedAt_idx_d5b94591',
        columns: ['organizationId', 'publishedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Policy',
        index: 'Policy_organizationId_status_idx_21af5e82',
        columns: ['organizationId', 'status'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Policy',
        foreignKey: {
          name: 'Policy_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'Organization', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
