#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/76c8d0f3f6f2fa79c58c7d371f612adda87dc8a089be64d4f80b142900b9a1d2/contract';
import startContract from '../../snapshots/76c8d0f3f6f2fa79c58c7d371f612adda87dc8a089be64d4f80b142900b9a1d2/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/8e37243d7ec9ff3d780b315ebc63a2f3852f2a0bc786ac92d7b20701f51aae31/contract';
import endContract from '../../snapshots/8e37243d7ec9ff3d780b315ebc63a2f3852f2a0bc786ac92d7b20701f51aae31/contract.json' with { type: 'json' };
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
        table: 'Holiday',
        columns: [
          col('category', 'text', {
            notNull: true,
            default: lit('PUBLIC'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('countryCode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('date', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('isRecurring', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('isReligious', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('regionCode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('religion', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
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
        table: 'Holiday',
        constraint: 'Holiday_organizationId_name_date_key',
        columns: ['organizationId', 'name', 'date'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Policy',
        constraint: 'Policy_organizationId_code_key',
        columns: ['organizationId', 'code'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Holiday',
        index: 'Holiday_organizationId_category_idx_a0ddcd26',
        columns: ['organizationId', 'category'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Holiday',
        index: 'Holiday_organizationId_countryCode_idx_e568249f',
        columns: ['organizationId', 'countryCode'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Holiday',
        index: 'Holiday_organizationId_date_idx_eac2a339',
        columns: ['organizationId', 'date'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Holiday',
        index: 'Holiday_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Holiday',
        index: 'Holiday_organizationId_isActive_idx_c89f2a48',
        columns: ['organizationId', 'isActive'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Holiday',
        index: 'Holiday_organizationId_regionCode_idx_25c621f9',
        columns: ['organizationId', 'regionCode'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Holiday',
        index: 'Holiday_organizationId_religion_idx_2e0d4dd3',
        columns: ['organizationId', 'religion'],
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
        table: 'Holiday',
        foreignKey: {
          name: 'Holiday_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'Organization', columns: ['id'] },
        },
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
