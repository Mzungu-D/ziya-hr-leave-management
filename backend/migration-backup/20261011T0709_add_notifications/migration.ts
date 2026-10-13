#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/36bdf7d5d238f8e718a902a75f64ac7f0e2b079f60d0362eff3e004e6def1078/contract';
import endContract from '../../snapshots/36bdf7d5d238f8e718a902a75f64ac7f0e2b079f60d0362eff3e004e6def1078/contract.json' with { type: 'json' };
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
        table: 'AuditLog',
        columns: [
          col('action', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('actorId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('entityId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('entityType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ipAddress', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('metadata', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('summary', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userAgent', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
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
      this.addColumn({
        schema: 'public',
        table: 'Department',
        column: col('departmentLeadId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
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
      this.addUnique({
        schema: 'public',
        table: 'SystemSetting',
        constraint: 'SystemSetting_organizationId_key_key',
        columns: ['organizationId', 'key'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditLog',
        index: 'AuditLog_actorId_createdAt_idx_0e9f1adf',
        columns: ['actorId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditLog',
        index: 'AuditLog_actorId_idx_a58f6b4b',
        columns: ['actorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditLog',
        index: 'AuditLog_entityType_entityId_idx_ea0fa809',
        columns: ['entityType', 'entityId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditLog',
        index: 'AuditLog_organizationId_action_createdAt_idx_75e53eb6',
        columns: ['organizationId', 'action', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditLog',
        index: 'AuditLog_organizationId_createdAt_idx_c52d1cc3',
        columns: ['organizationId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditLog',
        index: 'AuditLog_organizationId_entityType_createdAt_idx_102cd6c9',
        columns: ['organizationId', 'entityType', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditLog',
        index: 'AuditLog_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
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
      this.createIndex({
        schema: 'public',
        table: 'Organization',
        index: 'Organization_code_idx_8e43b86b',
        columns: ['code'],
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
        table: 'AuditLog',
        foreignKey: {
          name: 'AuditLog_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'Organization', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AuditLog',
        foreignKey: {
          name: 'AuditLog_actorId_fkey',
          columns: ['actorId'],
          references: { schema: 'public', table: 'Employee', columns: ['id'] },
          onDelete: 'setNull',
        },
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
      this.addForeignKey({
        schema: 'public',
        table: 'Policy',
        foreignKey: {
          name: 'Policy_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'Organization', columns: ['id'] },
        },
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
