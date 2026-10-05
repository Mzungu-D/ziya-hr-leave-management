#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/8b7a474522489be05d5e48d828eb56cf833e727fd23e236f4c7670860a77a902/contract';
import endContract from '../../snapshots/8b7a474522489be05d5e48d828eb56cf833e727fd23e236f4c7670860a77a902/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'ActivationInvitation',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('employeeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('usedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'ActivationInvitation_status_check_270f8b0f',
            "\"status\" IN ('PENDING', 'USED', 'EXPIRED', 'REVOKED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Department',
        columns: [
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Employee',
        columns: [
          col('authenticationMethod', 'text', {
            notNull: true,
            default: lit('PASSWORD_AND_OTP'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('departmentId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('emailVerified', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('employeeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('firstName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lastLoginAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('lastName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('passwordHash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('phone', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('phoneVerified', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('reportsToId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('role', 'text', {
            notNull: true,
            default: lit('EMPLOYEE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Employee_authenticationMethod_check_218f10fe',
            "\"authenticationMethod\" IN ('PASSWORD', 'OTP', 'PASSWORD_AND_OTP')",
          ),
          checkExpression(
            'Employee_role_check_0b9cc66b',
            "\"role\" IN ('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'SUPER_ADMIN')",
          ),
          checkExpression(
            'Employee_status_check_7eaa581a',
            "\"status\" IN ('PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'LeaveApproval',
        columns: [
          col('action', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('approverId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('comments', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('leaveRequestId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'LeaveApproval_action_check_d3175e14',
            "\"action\" IN ('APPROVED', 'REJECTED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'LeaveBalance',
        columns: [
          col('allocatedDays', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('employeeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('leaveTypeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('pendingDays', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('usedDays', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('year', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'LeaveRequest',
        columns: [
          col('attachmentUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('departmentId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('employeeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('endDate', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('hrApprovedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('leaveTypeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('managerApprovedAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('reason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('rejectedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('rejectionReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('requestedDays', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('startDate', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('submittedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'LeaveRequest_status_check_54d20b85',
            "\"status\" IN ('PENDING', 'MANAGER_APPROVED', 'HR_APPROVED', 'REJECTED', 'CANCELLED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'LeaveType',
        columns: [
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('daysPerYear', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organizationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('requiresDocument', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Organization',
        columns: [
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'OtpVerification',
        columns: [
          col('attempts', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('codeHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('consumedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('employeeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('purpose', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'OtpVerification_purpose_check_9f119a74',
            "\"purpose\" IN ('LOGIN', 'PASSWORD_RESET', 'DEVICE_VERIFICATION')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'UserSession',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deviceFingerprint', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('employeeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ipAddress', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('lastUsedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('refreshTokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('revokedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('userAgent', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ActivationInvitation',
        constraint: 'ActivationInvitation_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Department',
        constraint: 'Department_organizationId_code_key',
        columns: ['organizationId', 'code'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Employee',
        constraint: 'Employee_email_key',
        columns: ['email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Employee',
        constraint: 'Employee_phone_key',
        columns: ['phone'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Employee',
        constraint: 'Employee_organizationId_employeeId_key',
        columns: ['organizationId', 'employeeId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'LeaveBalance',
        constraint: 'LeaveBalance_employeeId_leaveTypeId_year_key',
        columns: ['employeeId', 'leaveTypeId', 'year'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'LeaveType',
        constraint: 'LeaveType_organizationId_code_key',
        columns: ['organizationId', 'code'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Organization',
        constraint: 'Organization_code_key',
        columns: ['code'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'UserSession',
        constraint: 'UserSession_refreshTokenHash_key',
        columns: ['refreshTokenHash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ActivationInvitation',
        index: 'ActivationInvitation_employeeId_idx_087dd4a6',
        columns: ['employeeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Department',
        index: 'Department_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Employee',
        index: 'Employee_departmentId_idx_8e261ed8',
        columns: ['departmentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Employee',
        index: 'Employee_organizationId_departmentId_idx_425ca78f',
        columns: ['organizationId', 'departmentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Employee',
        index: 'Employee_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Employee',
        index: 'Employee_organizationId_reportsToId_idx_5c78cbee',
        columns: ['organizationId', 'reportsToId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Employee',
        index: 'Employee_organizationId_role_idx_35d41160',
        columns: ['organizationId', 'role'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Employee',
        index: 'Employee_organizationId_status_idx_21af5e82',
        columns: ['organizationId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Employee',
        index: 'Employee_reportsToId_idx_3402993a',
        columns: ['reportsToId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'LeaveApproval',
        index: 'LeaveApproval_approverId_idx_a4f46e61',
        columns: ['approverId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'LeaveApproval',
        index: 'LeaveApproval_leaveRequestId_idx_edc6dcb6',
        columns: ['leaveRequestId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'LeaveBalance',
        index: 'LeaveBalance_employeeId_idx_087dd4a6',
        columns: ['employeeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'LeaveBalance',
        index: 'LeaveBalance_leaveTypeId_idx_810d88f1',
        columns: ['leaveTypeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'LeaveRequest',
        index: 'LeaveRequest_departmentId_idx_8e261ed8',
        columns: ['departmentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'LeaveRequest',
        index: 'LeaveRequest_employeeId_idx_087dd4a6',
        columns: ['employeeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'LeaveRequest',
        index: 'LeaveRequest_leaveTypeId_idx_810d88f1',
        columns: ['leaveTypeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'LeaveType',
        index: 'LeaveType_organizationId_idx_2e17ef41',
        columns: ['organizationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'OtpVerification',
        index: 'OtpVerification_employeeId_idx_087dd4a6',
        columns: ['employeeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'UserSession',
        index: 'UserSession_employeeId_idx_087dd4a6',
        columns: ['employeeId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ActivationInvitation',
        foreignKey: {
          name: 'ActivationInvitation_employeeId_fkey',
          columns: ['employeeId'],
          references: { schema: 'public', table: 'Employee', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Department',
        foreignKey: {
          name: 'Department_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'Organization', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Employee',
        foreignKey: {
          name: 'Employee_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'Organization', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Employee',
        foreignKey: {
          name: 'Employee_departmentId_fkey',
          columns: ['departmentId'],
          references: { schema: 'public', table: 'Department', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Employee',
        foreignKey: {
          name: 'Employee_reportsToId_fkey',
          columns: ['reportsToId'],
          references: { schema: 'public', table: 'Employee', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'LeaveApproval',
        foreignKey: {
          name: 'LeaveApproval_leaveRequestId_fkey',
          columns: ['leaveRequestId'],
          references: { schema: 'public', table: 'LeaveRequest', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'LeaveApproval',
        foreignKey: {
          name: 'LeaveApproval_approverId_fkey',
          columns: ['approverId'],
          references: { schema: 'public', table: 'Employee', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'LeaveBalance',
        foreignKey: {
          name: 'LeaveBalance_employeeId_fkey',
          columns: ['employeeId'],
          references: { schema: 'public', table: 'Employee', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'LeaveBalance',
        foreignKey: {
          name: 'LeaveBalance_leaveTypeId_fkey',
          columns: ['leaveTypeId'],
          references: { schema: 'public', table: 'LeaveType', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'LeaveRequest',
        foreignKey: {
          name: 'LeaveRequest_employeeId_fkey',
          columns: ['employeeId'],
          references: { schema: 'public', table: 'Employee', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'LeaveRequest',
        foreignKey: {
          name: 'LeaveRequest_departmentId_fkey',
          columns: ['departmentId'],
          references: { schema: 'public', table: 'Department', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'LeaveRequest',
        foreignKey: {
          name: 'LeaveRequest_leaveTypeId_fkey',
          columns: ['leaveTypeId'],
          references: { schema: 'public', table: 'LeaveType', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'LeaveType',
        foreignKey: {
          name: 'LeaveType_organizationId_fkey',
          columns: ['organizationId'],
          references: { schema: 'public', table: 'Organization', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'OtpVerification',
        foreignKey: {
          name: 'OtpVerification_employeeId_fkey',
          columns: ['employeeId'],
          references: { schema: 'public', table: 'Employee', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'UserSession',
        foreignKey: {
          name: 'UserSession_employeeId_fkey',
          columns: ['employeeId'],
          references: { schema: 'public', table: 'Employee', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
