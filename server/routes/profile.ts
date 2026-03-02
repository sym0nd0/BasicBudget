import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { sensitiveActionLimiter } from '../middleware/rate-limit.js';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../auth/password.js';
import { createToken, validateAndConsumeToken } from '../auth/tokens.js';
import { sendEmailChangeVerification, sendEmailVerification } from '../services/email.js';
import { auditLog } from '../services/audit.js';
import { verifyTotp, decryptSecret } from '../auth/totp.js';
import { verifyRecoveryCode } from '../auth/recovery-codes.js';
import type { User } from '../../shared/types.js';

const router = Router();
router.use(requireAuth);

function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    email: row.email as string,
    display_name: row.display_name as string,
    email_verified: Boolean(row.email_verified),
    system_role: row.system_role as 'admin' | 'user',
    created_at: row.created_at as string,
    colour_palette: (row.colour_palette as string | undefined) ?? 'default',
    notify_updates: row.notify_updates !== undefined ? Boolean(row.notify_updates) : true,
  };
}

// GET /api/auth/profile
router.get('/', (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId!) as Record<string, unknown> | undefined;
  if (!row) { res.status(404).json({ message: 'User not found' }); return; }
  res.json(mapUser(row));
});

// PUT /api/auth/profile
router.put('/', (req: Request, res: Response) => {
  const schema = z.object({ display_name: z.string().min(1).max(100) });
  const result = schema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ message: result.error.issues[0]?.message ?? 'Validation error' }); return; }

  db.prepare("UPDATE users SET display_name = ?, updated_at = datetime('now') WHERE id = ?").run(result.data.display_name.trim(), req.userId!);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId!) as Record<string, unknown>;
  res.json(mapUser(row));
});

// PUT /api/auth/profile/palette
router.put('/palette', (req: Request, res: Response) => {
  const schema = z.object({ colour_palette: z.enum(['default', 'deuteranopia', 'protanopia', 'tritanopia']) });
  const result = schema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ message: result.error.issues[0]?.message ?? 'Validation error' }); return; }

  db.prepare("UPDATE users SET colour_palette = ?, updated_at = datetime('now') WHERE id = ?").run(result.data.colour_palette, req.userId!);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId!) as Record<string, unknown>;
  res.json(mapUser(row));
});

// PUT /api/auth/profile/notify-updates
router.put('/notify-updates', (req: Request, res: Response) => {
  const schema = z.object({ notify_updates: z.boolean() });
  const result = schema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ message: result.error.issues[0]?.message ?? 'Validation error' }); return; }

  db.prepare("UPDATE users SET notify_updates = ?, updated_at = datetime('now') WHERE id = ?").run(
    result.data.notify_updates ? 1 : 0,
    req.userId!,
  );
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId!) as Record<string, unknown>;
  res.json(mapUser(row));
});

// POST /api/auth/change-password
router.post('/change-password', sensitiveActionLimiter, async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) { res.status(400).json({ message: 'currentPassword and newPassword are required' }); return; }

  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId!) as Record<string, unknown> | undefined;
  if (!userRow?.password_hash) { res.status(400).json({ message: 'No local password set' }); return; }

  if (!await verifyPassword(userRow.password_hash as string, currentPassword)) {
    res.status(401).json({ message: 'Current password is incorrect' });
    return;
  }

  const strength = validatePasswordStrength(newPassword);
  if (!strength.valid) { res.status(400).json({ message: strength.message }); return; }

  const hash = await hashPassword(newPassword);
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, req.userId!);

  // Destroy all other sessions
  db.prepare("DELETE FROM sessions WHERE user_id = ? AND sid != ?").run(req.userId!, req.sessionID);

  auditLog(req.userId!, 'password_changed', {}, req.ip, req.get('user-agent'));
  res.json({ message: 'Password changed successfully.' });
});

// POST /api/auth/change-email
router.post('/change-email', sensitiveActionLimiter, async (req: Request, res: Response) => {
  const { email, password, token: totpToken, code: recoveryCode } = req.body as {
    email?: string; password?: string; token?: string; code?: string;
  };
  if (!email || !password) { res.status(400).json({ message: 'email and password are required' }); return; }

  const emailResult = z.email().safeParse(email);
  if (!emailResult.success) { res.status(400).json({ message: 'Invalid email address' }); return; }

  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId!) as Record<string, unknown> | undefined;
  if (!userRow?.password_hash) { res.status(400).json({ message: 'No local password set' }); return; }
  if (!await verifyPassword(userRow.password_hash as string, password)) { res.status(401).json({ message: 'Invalid password' }); return; }

  // Check 2FA if enabled
  const secretRow = db.prepare('SELECT * FROM totp_secrets WHERE user_id = ? AND verified = 1').get(req.userId!) as {
    encrypted_secret: string; iv: string; auth_tag: string;
  } | undefined;
  if (secretRow) {
    if (totpToken) {
      const base32 = decryptSecret(secretRow.encrypted_secret, secretRow.iv, secretRow.auth_tag);
      if (!verifyTotp(base32, totpToken)) { res.status(401).json({ message: 'Invalid OTP code' }); return; }
    } else if (recoveryCode) {
      const codes = db.prepare('SELECT * FROM recovery_codes WHERE user_id = ? AND used = 0').all(req.userId!) as { id: string; code_hash: string }[];
      let matched = false;
      for (const c of codes) {
        if (await verifyRecoveryCode(recoveryCode, c.code_hash)) { db.prepare('UPDATE recovery_codes SET used = 1 WHERE id = ?').run(c.id); matched = true; break; }
      }
      if (!matched) { res.status(401).json({ message: 'Invalid recovery code' }); return; }
    } else {
      res.status(400).json({ message: 'Two-factor authentication is required to change your email' });
      return;
    }
  }

  const newEmail = email.toLowerCase().trim();
  const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(newEmail, req.userId!);
  if (existing) { res.status(409).json({ message: 'An account with this email already exists' }); return; }

  const changeToken = createToken(req.userId!, 'email_change', 30, newEmail);
  try { await sendEmailChangeVerification(newEmail, changeToken); } catch { /* ignore */ }

  auditLog(req.userId!, 'email_change_requested', { newEmail }, req.ip, req.get('user-agent'));
  res.json({ message: 'A confirmation link has been sent to your new email address.' });
});

// POST /api/auth/confirm-email-change
router.post('/confirm-email-change', (req: Request, res: Response) => {
  const { token } = req.body as { token?: string };
  if (!token) { res.status(400).json({ message: 'Token is required' }); return; }

  const consumed = validateAndConsumeToken(token, 'email_change');
  if (!consumed || !consumed.newEmail) { res.status(400).json({ message: 'Invalid or expired token' }); return; }

  db.prepare("UPDATE users SET email = ?, email_verified = 1, updated_at = datetime('now') WHERE id = ?").run(consumed.newEmail, consumed.userId);
  auditLog(consumed.userId, 'email_changed', { newEmail: consumed.newEmail }, req.ip, req.get('user-agent'));
  res.json({ message: 'Email address updated.' });
});

// POST /api/auth/resend-verification
router.post('/resend-verification', async (req: Request, res: Response) => {
  const userRow = db.prepare('SELECT email, email_verified FROM users WHERE id = ?').get(req.userId!) as { email: string; email_verified: number } | undefined;
  if (!userRow) { res.status(404).json({ message: 'User not found' }); return; }
  if (Boolean(userRow.email_verified)) { res.status(400).json({ message: 'Email is already verified' }); return; }

  const verifyToken = createToken(req.userId!, 'email_verify');
  try { await sendEmailVerification(userRow.email, verifyToken); } catch { /* ignore */ }

  res.json({ message: 'Verification email sent.' });
});

export default router;
