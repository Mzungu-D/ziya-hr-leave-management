#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/36bdf7d5d238f8e718a902a75f64ac7f0e2b079f60d0362eff3e004e6def1078/contract';
import endContract from '../../snapshots/36bdf7d5d238f8e718a902a75f64ac7f0e2b079f60d0362eff3e004e6def1078/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/80ea4775956c42bfdc68a9ad7128212defc8eb883c7e92ff3aa752c1d4351c6b/contract';
import startContract from '../../snapshots/80ea4775956c42bfdc68a9ad7128212defc8eb883c7e92ff3aa752c1d4351c6b/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'Notification',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('href', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('readAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('recipientId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Notification_type_check_acab4d1e',
            "\"type\" IN ('LEAVE_REQUEST_SUBMITTED', 'LEAVE_REQUEST_APPROVED', 'LEAVE_REQUEST_REJECTED', 'LEAVE_REQUEST_CANCELLED', 'LEAVE_REQUEST_REVIEW_REQUIRED', 'SYSTEM')",
          ),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Notification',
        index: 'Notification_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Notification',
        index: 'Notification_organizationId_recipientId_createdAt_idx_2c0e7243',
        columns: ['organizationId', 'recipientId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Notification',
        index: 'Notification_organizationId_recipientId_readAt_idx_2dab4878',
        columns: ['organizationId', 'recipientId', 'readAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Notification',
        index: 'Notification_recipientId_idx_c9527cf8',
        columns: ['recipientId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Notification',
        foreignKey: {
          name: 'Notification_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'Organization', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Notification',
        foreignKey: {
          name: 'Notification_recipientId_fkey',
          columns: ['recipientId'],
          references: { schema: 'public', table: 'Employee', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
