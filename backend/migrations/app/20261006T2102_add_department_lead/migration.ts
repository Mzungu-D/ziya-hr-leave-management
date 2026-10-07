#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/2522cd9bed1079eb41f751f4314117097090437518d5bf95f20f4ffb607e9da0/contract';
import startContract from '../../snapshots/2522cd9bed1079eb41f751f4314117097090437518d5bf95f20f4ffb607e9da0/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/76c8d0f3f6f2fa79c58c7d371f612adda87dc8a089be64d4f80b142900b9a1d2/contract';
import endContract from '../../snapshots/76c8d0f3f6f2fa79c58c7d371f612adda87dc8a089be64d4f80b142900b9a1d2/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Department',
        column: col('departmentLeadId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'Department',
        index: 'Department_departmentLeadId_idx_3e7e9cfd',
        columns: ['departmentLeadId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Department',
        index: 'Department_organizationId_departmentLeadId_idx_a8c4d16a',
        columns: ['organizationId', 'departmentLeadId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Department',
        foreignKey: {
          name: 'Department_departmentLeadId_fkey',
          columns: ['departmentLeadId'],
          references: { schema: 'public', table: 'Employee', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
