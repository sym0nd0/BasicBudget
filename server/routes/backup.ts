import { Router } from 'express';
import type { Request, Response } from 'express';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import db from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { sensitiveActionLimiter } from '../middleware/rate-limit.js';
import { auditLog } from '../services/audit.js';
import { logger } from '../services/logger.js';
import { invalidateCache } from '../services/settings.js';
import { resetOidcClient } from './oidc.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const router = Router();
router.use(requireAuth, requireAdmin);

// Trusted column allowlist per table — derived from schema.sql + migrations in db.ts.
// Used by insertRows to prevent untrusted column names from reaching SQL.
const TABLE_COLUMNS: Record<string, readonly string[]> = {
  users: ['id', 'email', 'display_name', 'password_hash', 'email_verified', 'system_role', 'failed_login_count', 'locked_until', 'created_at', 'updated_at', 'colour_palette', 'notify_updates'],
  households: ['id', 'name', 'created_at'],
  household_members: ['household_id', 'user_id', 'role', 'joined_at'],
  oidc_accounts: ['user_id', 'issuer', 'subject', 'created_at'],
  totp_secrets: ['user_id', 'encrypted_secret', 'iv', 'auth_tag', 'verified', 'created_at'],
  recovery_codes: ['id', 'user_id', 'code_hash', 'used', 'created_at'],
  audit_log: ['id', 'user_id', 'action', 'detail', 'ip_address', 'user_agent', 'created_at'],
  login_alerts: ['id', 'user_id', 'ip_address', 'user_agent', 'fingerprint', 'notified', 'created_at'],
  accounts: ['id', 'household_id', 'user_id', 'name', 'sort_order', 'is_joint', 'created_at'],
  incomes: ['id', 'household_id', 'user_id', 'name', 'amount_pence', 'posting_day', 'contributor_name', 'contributor_user_id', 'is_household', 'gross_or_net', 'is_recurring', 'recurrence_type', 'start_date', 'end_date', 'notes', 'created_at', 'updated_at'],
  expenses: ['id', 'household_id', 'user_id', 'name', 'amount_pence', 'posting_day', 'account_id', 'category', 'is_household', 'split_ratio', 'is_recurring', 'recurrence_type', 'start_date', 'end_date', 'notes', 'created_at', 'updated_at', 'contributor_user_id'],
  debts: ['id', 'household_id', 'user_id', 'name', 'balance_pence', 'interest_rate', 'minimum_payment_pence', 'overpayment_pence', 'compounding_frequency', 'is_recurring', 'recurrence_type', 'posting_day', 'start_date', 'end_date', 'is_household', 'split_ratio', 'notes', 'created_at', 'updated_at', 'reminder_months', 'contributor_user_id'],
  debt_deal_periods: ['id', 'debt_id', 'label', 'interest_rate', 'start_date', 'end_date', 'created_at'],
  debt_notifications_sent: ['id', 'debt_id', 'deal_period_id', 'sent_at'],
  debt_balance_snapshots: ['id', 'debt_id', 'household_id', 'balance_pence', 'recorded_at'],
  savings_goals: ['id', 'household_id', 'user_id', 'name', 'target_amount_pence', 'current_amount_pence', 'monthly_contribution_pence', 'target_date', 'notes', 'created_at', 'updated_at', 'is_household', 'contributor_user_id', 'auto_contribute', 'contribution_day'],
  savings_transactions: ['id', 'savings_goal_id', 'household_id', 'user_id', 'type', 'amount_pence', 'balance_after_pence', 'notes', 'created_at'],
  month_locks: ['year_month', 'household_id', 'locked_at'],
  system_settings: ['key', 'value', 'updated_at'],
};

// Tables to include in backup (all persistent tables — excludes ephemeral)
const BACKUP_TABLES = [
  'users', 'households', 'household_members', 'oidc_accounts',
  'totp_secrets', 'recovery_codes', 'audit_log', 'login_alerts',
  'accounts', 'incomes', 'expenses', 'debts', 'debt_deal_periods',
  'debt_notifications_sent', 'debt_balance_snapshots', 'savings_goals',
  'savings_transactions', 'month_locks', 'system_settings',
] as const;

// Delete order: leaf tables first, then parent tables (respects FK constraints)
const DELETE_ORDER = [
  'savings_transactions', 'debt_balance_snapshots', 'debt_notifications_sent',
  'debt_deal_periods', 'month_locks', 'expenses', 'incomes', 'debts',
  'savings_goals', 'accounts', 'login_alerts', 'audit_log', 'recovery_codes',
  'totp_secrets', 'oidc_accounts', 'reset_tokens', 'sessions',
  'totp_used_tokens', 'household_members', 'system_settings', 'households', 'users',
] as const;

// Insert order: parent tables first, then children
const INSERT_ORDER = [
  'users', 'households', 'household_members', 'oidc_accounts', 'totp_secrets',
  'recovery_codes', 'audit_log', 'login_alerts', 'accounts', 'incomes',
  'expenses', 'debts', 'debt_deal_periods', 'debt_notifications_sent',
  'debt_balance_snapshots', 'savings_goals', 'savings_transactions',
  'month_locks', 'system_settings',
] as const;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

function getAppVersion(): string {
  try {
    const pkgPath = join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };
    return pkg.version;
  } catch {
    return 'unknown';
  }
}

function insertRows(tableName: string, rows: Record<string, unknown>[]): number {
  if (rows.length === 0) return 0;
  const trusted = TABLE_COLUMNS[tableName];
  if (!trusted) {
    throw new Error(`No column allowlist for table '${tableName}'`);
  }
  const placeholders = trusted.map(() => '?').join(', ');
  const stmt = db.prepare(
    `INSERT INTO ${tableName} (${trusted.join(', ')}) VALUES (${placeholders})`,
  );
  for (const row of rows) {
    stmt.run(...trusted.map(col => row[col] ?? null));
  }
  return rows.length;
}

// GET /api/admin/backup — download full database backup as JSON
router.get('/', sensitiveActionLimiter, (req: Request, res: Response) => {
  const tables: Record<string, unknown[]> = {};
  const readAll = db.transaction(() => {
    for (const table of BACKUP_TABLES) {
      tables[table] = db.prepare(`SELECT * FROM ${table}`).all();
    }
  });
  readAll();

  const backup = {
    backup_type: 'full',
    backup_schema_version: 1,
    app_version: getAppVersion(),
    exported_at: new Date().toISOString(),
    encryption_warning:
      'Encrypted secrets (TOTP 2FA, SMTP password, OIDC client secret) are encrypted with ' +
      'the TOTP_ENCRYPTION_KEY. Restoring on an instance with a different key will make ' +
      'these secrets unrecoverable.',
    tables,
  };

  auditLog(req.userId!, 'admin_backup_created', undefined, req.ip, req.get('user-agent'));
  logger.info('Full database backup created', { userId: req.userId });

  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="basicbudget-backup-${new Date().toISOString().slice(0, 10)}.json"`,
  );
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.json(backup);
});

// POST /api/admin/backup/restore — restore from a backup file (replaces all data atomically)
router.post(
  '/restore',
  sensitiveActionLimiter,
  upload.single('file'),
  (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ message: 'No backup file provided.' });
      return;
    }

    let backup: {
      backup_type?: string;
      backup_schema_version?: number;
      tables?: Record<string, Record<string, unknown>[]>;
    };

    try {
      backup = JSON.parse(req.file.buffer.toString('utf8')) as typeof backup;
    } catch {
      res.status(400).json({ message: 'Invalid JSON in backup file.' });
      return;
    }

    if (backup.backup_type !== 'full') {
      res.status(400).json({
        message: `Invalid backup type: expected 'full', got '${backup.backup_type ?? 'undefined'}'.`,
      });
      return;
    }

    if (backup.backup_schema_version !== 1) {
      res.status(400).json({
        message: `Unsupported backup schema version: ${backup.backup_schema_version ?? 'undefined'}.`,
      });
      return;
    }

    if (!backup.tables || typeof backup.tables !== 'object') {
      res.status(400).json({ message: 'Backup file is missing the tables object.' });
      return;
    }

    const missingTables = BACKUP_TABLES.filter(t => !(t in backup.tables!));
    if (missingTables.length > 0) {
      res.status(400).json({
        message: `Backup is missing required tables: ${missingTables.join(', ')}.`,
      });
      return;
    }

    for (const table of BACKUP_TABLES) {
      if (!Array.isArray(backup.tables[table])) {
        res.status(400).json({ message: `Table '${table}' must be an array.` });
        return;
      }
    }

    const adminUserId = req.userId!;

    try {
      const rowCounts: Record<string, number> = {};

      const restore = db.transaction(() => {
        // Delete all data in FK-safe order (includes ephemeral tables that reference users)
        for (const table of DELETE_ORDER) {
          db.prepare(`DELETE FROM ${table}`).run();
        }

        // Insert backed-up data in parent-first order
        for (const table of INSERT_ORDER) {
          rowCounts[table] = insertRows(table, backup.tables![table]);
        }
      });

      restore();

      // Invalidate in-memory caches so next read re-fetches from the restored DB
      invalidateCache();
      resetOidcClient();

      logger.info('Full database restore completed', { userId: adminUserId, rowCounts });

      // Destroy the current session explicitly before responding.
      // express-session with rolling:true would otherwise re-save this session
      // to the (now-empty) sessions table after the response, undoing the
      // session invalidation. Destroying first sets an internal flag that
      // prevents the post-response re-save.
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          logger.error('Session destroy after restore', { error: (destroyErr as Error).message });
        }

        // Post-restore audit (audit_log was replaced from backup; if adminUserId
        // no longer exists in the restored data, auditLog silently handles it)
        auditLog(adminUserId, 'admin_backup_restored', { tables: rowCounts });

        res.json({
          message:
            'Backup restored successfully. All sessions have been invalidated — ' +
            'you will need to log in again.',
          tables: rowCounts,
        });
      });
    } catch (err) {
      logger.error('Database restore failed', { error: (err as Error).message });
      res.status(500).json({ message: 'Database restore failed. No changes were applied.' });
    }
  },
);

export default router;
