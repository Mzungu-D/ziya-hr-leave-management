#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2522cd9bed1079eb41f751f4314117097090437518d5bf95f20f4ffb607e9da0/contract';
import endContract from '../../snapshots/2522cd9bed1079eb41f751f4314117097090437518d5bf95f20f4ffb607e9da0/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/8b7a474522489be05d5e48d828eb56cf833e727fd23e236f4c7670860a77a902/contract';
import startContract from '../../snapshots/8b7a474522489be05d5e48d828eb56cf833e727fd23e236f4c7670860a77a902/contract.json' with { type: 'json' };
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
        table: 'EmployeeDocument',
        columns: [
          col('accessLevel', 'text', {
            notNull: true,
            default: lit('EMPLOYEE_AND_HR'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('documentType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('employeeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('mimeType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('originalName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sha256', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sizeBytes', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('storageKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('uploadedById', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'EmployeeDocument_accessLevel_check_ee3aba27',
            "\"accessLevel\" IN ('EMPLOYEE_AND_HR', 'HR_ONLY')",
          ),
          checkExpression(
            'EmployeeDocument_documentType_check_e45d017a',
            "\"documentType\" IN ('PROFILE_PHOTO', 'NATIONAL_ID', 'PASSPORT', 'KRA_PIN', 'NSSF', 'SHA', 'HELB', 'EMPLOYMENT_CONTRACT', 'ACADEMIC_CERTIFICATE', 'PROFESSIONAL_CERTIFICATE', 'STATUTORY_DOCUMENT', 'OTHER')",
          ),
          checkExpression(
            'EmployeeDocument_status_check_b7c57345',
            "\"status\" IN ('ACTIVE', 'ARCHIVED', 'DELETED')",
          ),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'Employee',
        column: col('profilePictureDocumentId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'Employee',
        constraint: 'Employee_profilePictureDocumentId_key',
        columns: ['profilePictureDocumentId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'EmployeeDocument',
        constraint: 'EmployeeDocument_storageKey_key',
        columns: ['storageKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EmployeeDocument',
        index: 'EmployeeDocument_employeeId_idx_087dd4a6',
        columns: ['employeeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EmployeeDocument',
        index: 'EmployeeDocument_employeeId_status_idx_e746ea39',
        columns: ['employeeId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EmployeeDocument',
        index: 'EmployeeDocument_organizationId_documentType_idx_8669346d',
        columns: ['organizationId', 'documentType'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EmployeeDocument',
        index: 'EmployeeDocument_organizationId_employeeId_idx_f6f89764',
        columns: ['organizationId', 'employeeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EmployeeDocument',
        index: 'EmployeeDocument_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EmployeeDocument',
        index: 'EmployeeDocument_organizationId_status_idx_21af5e82',
        columns: ['organizationId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'EmployeeDocument',
        index: 'EmployeeDocument_uploadedById_idx_b92fad21',
        columns: ['uploadedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Organization',
        index: 'Organization_code_idx_8e43b86b',
        columns: ['code'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'EmployeeDocument',
        foreignKey: {
          name: 'EmployeeDocument_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'Organization', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'EmployeeDocument',
        foreignKey: {
          name: 'EmployeeDocument_employeeId_fkey',
          columns: ['employeeId'],
          references: { schema: 'public', table: 'Employee', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'EmployeeDocument',
        foreignKey: {
          name: 'EmployeeDocument_uploadedById_fkey',
          columns: ['uploadedById'],
          references: { schema: 'public', table: 'Employee', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Employee',
        foreignKey: {
          name: 'Employee_profilePictureDocumentId_fkey',
          columns: ['profilePictureDocumentId'],
          references: { schema: 'public', table: 'EmployeeDocument', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
