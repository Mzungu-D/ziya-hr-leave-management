#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/8e37243d7ec9ff3d780b315ebc63a2f3852f2a0bc786ac92d7b20701f51aae31/contract';
import startContract from '../../snapshots/8e37243d7ec9ff3d780b315ebc63a2f3852f2a0bc786ac92d7b20701f51aae31/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ebfe5672af13b5ba7704279bcf6df9a04e4e0f0f4d27aa85277c8a7c3108aa2b/contract';
import endContract from '../../snapshots/ebfe5672af13b5ba7704279bcf6df9a04e4e0f0f4d27aa85277c8a7c3108aa2b/contract.json' with { type: 'json' };
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
        table: 'SystemSetting',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', {
            notNull: true,
            default: lit('STRING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('value', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'SystemSetting_type_check_50739480',
            "\"type\" IN ('STRING', 'INTEGER', 'BOOLEAN', 'JSON')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'SystemSetting',
        constraint: 'SystemSetting_organizationId_key_key',
        columns: ['organizationId', 'key'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'SystemSetting',
        index: 'SystemSetting_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'SystemSetting',
        index: 'SystemSetting_organizationId_type_idx_ff4b8294',
        columns: ['organizationId', 'type'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'SystemSetting',
        foreignKey: {
          name: 'SystemSetting_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'Organization', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
