import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import db from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { auditLog } from '../services/audit.js';
import {
  setSetting,
  getSetting,
  getSmtpConfigMasked,
  getOidcConfigMasked,
  invalidateCache,
} from '../services/settings.js';
import { DEFAULT_EXPENSE_CATEGORIES, getExpenseCategories } from './categories.js';
import { resetOidcClient } from './oidc.js';
import { sendTestEmail } from '../services/email.js';
import { logger } from '../services/logger.js';
import type { LogLevel } from '../services/logger.js';
import { getBackupConfig, getAutoBackupStatus, restartScheduler, autoBackupConfigSchema } from '../services/autoBackup.js';

const router = Router();

// All admin routes require auth + admin role
router.use(requireAuth, requireAdmin);

// ─── User management ──────────────────────────────────────────────────────────

// GET /api/admin/users
router.get('/users', (req: Request, res: Response) => {
  const page = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query['limit'] as string) ?? '20', 10)));
  const offset = (page - 1) * limit;

  const totalRow = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

  const rows = db.prepare(`
    SELECT
      u.id, u.email, u.display_name, u.system_role, u.email_verified,
      u.locked_until, u.created_at,
      (SELECT COUNT(*) FROM totp_secrets ts WHERE ts.user_id = u.id AND ts.verified = 1) as has_totp,
      (SELECT COUNT(*) FROM oidc_accounts o WHERE o.user_id = u.id) as has_oidc,
      (SELECT COUNT(*) FROM household_members hm WHERE hm.user_id = u.id) as household_count
    FROM users u
    ORDER BY u.created_at ASC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as Record<string, unknown>[];

  const data = rows.map(row => ({
    id: row['id'] as string,
    email: row['email'] as string,
    display_name: row['display_name'] as string,
    system_role: row['system_role'] as string,
    email_verified: Boolean(row['email_verified']),
    locked_until: row['locked_until'] as string | null,
    created_at: row['created_at'] as string,
    has_totp: (row['has_totp'] as number) > 0,
    has_oidc: (row['has_oidc'] as number) > 0,
    household_count: row['household_count'] as number,
  }));

  res.json({ data, total: totalRow.count, page, limit });
});

// GET /api/admin/users/:id
router.get('/users/:id', (req: Request, res: Response) => {
  const userId = req.params['id'] as string;

  const row = db.prepare(`
    SELECT
      u.id, u.email, u.display_name, u.system_role, u.email_verified,
      u.locked_until, u.created_at,
      (SELECT COUNT(*) FROM totp_secrets ts WHERE ts.user_id = u.id AND ts.verified = 1) as has_totp,
      (SELECT COUNT(*) FROM oidc_accounts o WHERE o.user_id = u.id) as has_oidc,
      (SELECT COUNT(*) FROM household_members hm WHERE hm.user_id = u.id) as household_count
    FROM users u
    WHERE u.id = ?
  `).get(userId) as Record<string, unknown> | undefined;

  if (!row) { res.status(404).json({ message: 'User not found' }); return; }

  res.json({
    id: row['id'] as string,
    email: row['email'] as string,
    display_name: row['display_name'] as string,
    system_role: row['system_role'] as string,
    email_verified: Boolean(row['email_verified']),
    locked_until: row['locked_until'] as string | null,
    created_at: row['created_at'] as string,
    has_totp: (row['has_totp'] as number) > 0,
    has_oidc: (row['has_oidc'] as number) > 0,
    household_count: row['household_count'] as number,
  });
});

// PUT /api/admin/users/:id/role
router.put('/users/:id/role', (req: Request, res: Response) => {
  const userId = req.params['id'] as string;
  const result = z.object({ role: z.enum(['admin', 'user']) }).safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.issues[0]?.message ?? 'Validation error' });
    return;
  }
  const { role } = result.data;

  if (userId === req.userId) {
    res.status(400).json({ message: 'You cannot change your own role' });
    return;
  }

  // Check that we're not removing the last admin
  if (role === 'user') {
    const adminCount = db.prepare(`SELECT COUNT(*) as count FROM users WHERE system_role = 'admin'`).get() as { count: number };
    const targetRow = db.prepare('SELECT system_role FROM users WHERE id = ?').get(userId) as { system_role: string } | undefined;
    if (!targetRow) { res.status(404).json({ message: 'User not found' }); return; }
    if (targetRow.system_role === 'admin' && adminCount.count <= 1) {
      res.status(400).json({ message: 'Cannot demote the sole admin. Promote another user first.' });
      return;
    }
  }

  const info = db.prepare(`UPDATE users SET system_role = ?, updated_at = datetime('now') WHERE id = ?`).run(role, userId);
  if (info.changes === 0) { res.status(404).json({ message: 'User not found' }); return; }

  auditLog(req.userId!, `admin_role_change`, { target_user_id: userId, new_role: role }, req.ip, req.get('user-agent'));
  res.json({ message: 'Role updated' });
});

// PUT /api/admin/users/:id/lock
router.put('/users/:id/lock', (req: Request, res: Response) => {
  const userId = req.params['id'] as string;
  const result = z.object({ locked: z.boolean() }).safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.issues[0]?.message ?? 'Validation error' });
    return;
  }
  const { locked } = result.data;

  if (userId === req.userId) {
    res.status(400).json({ message: 'You cannot lock your own account' });
    return;
  }

  const lockedUntil = locked ? '9999-12-31T23:59:59.000Z' : null;
  const info = db.prepare(`UPDATE users SET locked_until = ?, updated_at = datetime('now') WHERE id = ?`).run(lockedUntil, userId);
  if (info.changes === 0) { res.status(404).json({ message: 'User not found' }); return; }

  // Invalidate all sessions for the locked user
  if (locked) {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  }

  auditLog(req.userId!, locked ? 'admin_user_locked' : 'admin_user_unlocked', { target_user_id: userId }, req.ip, req.get('user-agent'));
  res.json({ message: locked ? 'User locked' : 'User unlocked' });
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', (req: Request, res: Response) => {
  const userId = req.params['id'] as string;

  if (userId === req.userId) {
    res.status(400).json({ message: 'You cannot delete your own account' });
    return;
  }

  // Check for sole admin
  const targetRow = db.prepare('SELECT system_role FROM users WHERE id = ?').get(userId) as { system_role: string } | undefined;
  if (!targetRow) { res.status(404).json({ message: 'User not found' }); return; }
  if (targetRow.system_role === 'admin') {
    const adminCount = db.prepare(`SELECT COUNT(*) as count FROM users WHERE system_role = 'admin'`).get() as { count: number };
    if (adminCount.count <= 1) {
      res.status(400).json({ message: 'Cannot delete the sole admin.' });
      return;
    }
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  auditLog(req.userId!, 'admin_user_deleted', { target_user_id: userId }, req.ip, req.get('user-agent'));
  res.status(204).send();
});

// ─── SMTP settings ────────────────────────────────────────────────────────────

// GET /api/admin/settings/smtp
router.get('/settings/smtp', (_req: Request, res: Response) => {
  const cfg = getSmtpConfigMasked();
  res.json(cfg ?? { host: '', port: 587, secure: false, user: '', pass: '', from: '' });
});

const smtpSchema = z.object({
  host: z.string(),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  user: z.string(),
  pass: z.string(),
  from: z.string(),
});

// PUT /api/admin/settings/smtp
router.put('/settings/smtp', (req: Request, res: Response) => {
  const result = smtpSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.issues[0]?.message ?? 'Validation error' });
    return;
  }
  const { host, port, secure, user, pass, from } = result.data;

  setSetting('smtp.host', host);
  setSetting('smtp.port', String(port));
  setSetting('smtp.secure', secure ? 'true' : 'false');
  setSetting('smtp.user', user);
  // Only update pass if it's not the mask placeholder
  if (pass && pass !== '••••••••') {
    setSetting('smtp.pass', pass);
  }
  setSetting('smtp.from', from);

  auditLog(req.userId!, 'admin_smtp_updated', {}, req.ip, req.get('user-agent'));
  res.json({ message: 'SMTP settings updated' });
});

// POST /api/admin/settings/smtp/test
router.post('/settings/smtp/test', async (req: Request, res: Response) => {
  const userRow = db.prepare('SELECT email FROM users WHERE id = ?').get(req.userId!) as { email: string } | undefined;
  if (!userRow) { res.status(404).json({ message: 'User not found' }); return; }

  try {
    await sendTestEmail(userRow.email);
    auditLog(req.userId!, 'admin_smtp_test', { to: userRow.email }, req.ip, req.get('user-agent'));
    res.json({ message: `Test email sent to ${userRow.email}` });
  } catch (err) {
    res.status(500).json({ message: `SMTP test failed: ${err instanceof Error ? err.message : String(err)}` });
  }
});

// ─── OIDC settings ────────────────────────────────────────────────────────────

// GET /api/admin/settings/oidc
router.get('/settings/oidc', (_req: Request, res: Response) => {
  const cfg = getOidcConfigMasked();
  res.json(cfg ?? { issuer_url: '', client_id: '', client_secret: '' });
});

const oidcSchema = z.object({
  issuer_url: z.string(),
  client_id: z.string(),
  client_secret: z.string(),
});

// PUT /api/admin/settings/oidc
router.put('/settings/oidc', (req: Request, res: Response) => {
  const result = oidcSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.issues[0]?.message ?? 'Validation error' });
    return;
  }
  const { issuer_url, client_id, client_secret } = result.data;

  setSetting('oidc.issuer_url', issuer_url);
  setSetting('oidc.client_id', client_id);
  if (client_secret && client_secret !== '••••••••') {
    setSetting('oidc.client_secret', client_secret);
  }

  // Invalidate cached OIDC client so it rebuilds with new settings
  invalidateCache();
  resetOidcClient();

  auditLog(req.userId!, 'admin_oidc_updated', {}, req.ip, req.get('user-agent'));
  res.json({ message: 'OIDC settings updated' });
});

// ─── Audit log ────────────────────────────────────────────────────────────────

// GET /api/admin/audit-log
router.get('/audit-log', (req: Request, res: Response) => {
  const page = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query['limit'] as string) ?? '50', 10)));
  const offset = (page - 1) * limit;
  const filterUserId = (req.query['user_id'] as string | undefined) ?? '';
  const filterAction = (req.query['action'] as string | undefined) ?? '';

  let where = '1=1';
  const params: unknown[] = [];

  if (filterUserId) {
    where += ' AND al.user_id = ?';
    params.push(filterUserId);
  }
  if (filterAction) {
    where += ' AND al.action LIKE ?';
    params.push(`%${filterAction}%`);
  }

  const totalRow = db.prepare(`SELECT COUNT(*) as count FROM audit_log al WHERE ${where}`).get(...params as []) as { count: number };

  const rows = db.prepare(`
    SELECT al.id, al.user_id, al.action, al.detail, al.ip_address, al.created_at,
           u.email as user_email
    FROM audit_log al
    LEFT JOIN users u ON u.id = al.user_id
    WHERE ${where}
    ORDER BY al.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params as [], limit, offset) as Record<string, unknown>[];

  const data = rows.map(row => ({
    id: row['id'] as string,
    user_id: row['user_id'] as string | null,
    user_email: row['user_email'] as string | undefined,
    action: row['action'] as string,
    detail: row['detail'] as string | null,
    ip_address: row['ip_address'] as string | null,
    created_at: row['created_at'] as string,
  }));

  res.json({ data, total: totalRow.count, page, limit });
});

// GET /api/admin/settings/categories
router.get('/settings/categories', (_req: Request, res: Response) => {
  res.json(getExpenseCategories());
});

// PUT /api/admin/settings/categories
router.put('/settings/categories', (req: Request, res: Response) => {
  const schema = z.object({
    categories: z.array(z.string().min(1).max(50)).min(1).max(50),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.issues[0]?.message ?? 'Validation error' });
    return;
  }
  setSetting('expense_categories', JSON.stringify(result.data.categories));
  auditLog(req.userId!, 'admin_categories_updated', { count: result.data.categories.length }, req.ip, req.get('user-agent'));
  res.json({ message: 'Categories updated.', categories: result.data.categories });
});

// DELETE /api/admin/settings/categories (reset to defaults)
router.delete('/settings/categories', (req: Request, res: Response) => {
  setSetting('expense_categories', JSON.stringify(DEFAULT_EXPENSE_CATEGORIES));
  auditLog(req.userId!, 'admin_categories_reset', {}, req.ip, req.get('user-agent'));
  res.json({ message: 'Categories reset to defaults.', categories: DEFAULT_EXPENSE_CATEGORIES });
});

// ─── Logging settings ─────────────────────────────────────────────────────────

const VALID_LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
const loggingSchema = z.object({ level: z.enum(VALID_LOG_LEVELS) });

// GET /api/admin/settings/logging
router.get('/settings/logging', (_req: Request, res: Response) => {
  const level = (getSetting('log.level') ?? 'info') as LogLevel;
  res.json({ level });
});

// PUT /api/admin/settings/logging
router.put('/settings/logging', (req: Request, res: Response) => {
  const result = loggingSchema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ message: result.error.issues[0]?.message ?? 'Validation error' }); return; }
  const { level } = result.data;
  setSetting('log.level', level);
  auditLog(req.userId!, 'admin_log_level_changed', { level }, req.ip, req.get('user-agent'));
  logger.info('Log level changed by admin', { level, admin_id: req.userId });
  res.json({ message: `Log level set to ${level}` });
});

// ─── Registration settings ────────────────────────────────────────────────────

const registrationSchema = z.object({ disabled: z.boolean() });

// GET /api/admin/settings/registration
router.get('/settings/registration', (_req: Request, res: Response) => {
  const disabled = getSetting('registration.disabled') === 'true';
  res.json({ disabled });
});

// PUT /api/admin/settings/registration
router.put('/settings/registration', (req: Request, res: Response) => {
  const result = registrationSchema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ message: result.error.issues[0]?.message ?? 'Validation error' }); return; }
  const { disabled } = result.data;
  setSetting('registration.disabled', String(disabled));
  auditLog(req.userId!, 'admin_registration_toggled', { disabled }, req.ip, req.get('user-agent'));
  logger.info('Registration toggle changed by admin', { disabled, admin_id: req.userId });
  res.json({ message: `Registration ${disabled ? 'disabled' : 'enabled'}.` });
});

// ─── Automated backup settings ────────────────────────────────────────────────

// GET /api/admin/settings/backup
router.get('/settings/backup', (_req: Request, res: Response) => {
  const config = getBackupConfig();
  const status = getAutoBackupStatus();
  res.json({ ...config, ...status });
});

// PUT /api/admin/settings/backup
router.put('/settings/backup', (req: Request, res: Response) => {
  const result = autoBackupConfigSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.issues[0]?.message ?? 'Validation error' });
    return;
  }
  const { enabled, interval_hours, max_backups } = result.data;
  setSetting('backup.enabled', String(enabled));
  setSetting('backup.interval_hours', String(interval_hours));
  setSetting('backup.max_backups', String(max_backups));
  restartScheduler();
  auditLog(req.userId!, 'admin_auto_backup_updated', { enabled, interval_hours, max_backups }, req.ip, req.get('user-agent'));
  logger.info('Automated backup settings updated', { enabled, interval_hours, max_backups, admin_id: req.userId });
  res.json({ message: `Automated backups ${enabled ? 'enabled' : 'disabled'}.` });
});

export default router;
