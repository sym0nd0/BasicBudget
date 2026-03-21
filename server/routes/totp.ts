import { Router } from 'express';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { otpLimiter, totpResetLimiter, sensitiveActionLimiter } from '../middleware/rate-limit.js';
import {
  generateTotpSecret,
  encryptSecret,
  decryptSecret,
  verifyTotp,
  generateQrDataUrl,
  isTotpTokenUsed,
  markTotpTokenUsed,
  cleanUpUsedTokens,
} from '../auth/totp.js';
import { generateRecoveryCodes, hashRecoveryCode, verifyRecoveryCode } from '../auth/recovery-codes.js';
import { createToken, validateAndConsumeToken } from '../auth/tokens.js';
import { sendTotpResetNotification } from '../services/email.js';
import { verifyPassword } from '../auth/password.js';
import { auditLog } from '../services/audit.js';
import { deviceFingerprint, isNewDevice, recordDevice } from '../auth/device.js';
import { sendLoginAlert } from '../services/email.js';
import type { TotpSetupResponse, User } from '../../shared/types.js';

const router = Router();

const otpSchema = z.object({ token: z.string().length(6) });
const recoverySchema = z.object({ code: z.string().min(6) });

function mapUser(row: Record<string, unknown>): User {
  const totpRow = db.prepare('SELECT verified FROM totp_secrets WHERE user_id = ? AND verified = 1').get(row.id as string) as { verified: number } | undefined;
  return {
    id: row.id as string,
    email: row.email as string,
    display_name: row.display_name as string,
    email_verified: Boolean(row.email_verified),
    system_role: row.system_role as 'admin' | 'user',
    created_at: row.created_at as string,
    has_totp: Boolean(totpRow),
  };
}

// POST /api/auth/totp/setup  (requireAuth)
router.post('/setup', requireAuth, async (req: Request, res: Response) => {
  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId!) as Record<string, unknown> | undefined;
  if (!userRow) { res.status(404).json({ message: 'User not found' }); return; }
  if (!userRow.password_hash) { res.status(400).json({ message: 'TOTP requires a local account with a password' }); return; }
  if (!userRow.email_verified) { res.status(400).json({ message: 'Email must be verified before enabling 2FA' }); return; }

  const { totp, base32 } = generateTotpSecret(userRow.email as string);
  const { encrypted_secret, iv, auth_tag } = encryptSecret(base32);

  // Upsert unverified TOTP secret
  db.prepare(`
    INSERT INTO totp_secrets (user_id, encrypted_secret, iv, auth_tag, verified)
    VALUES (?, ?, ?, ?, 0)
    ON CONFLICT(user_id) DO UPDATE SET
      encrypted_secret = excluded.encrypted_secret,
      iv = excluded.iv,
      auth_tag = excluded.auth_tag,
      verified = 0
  `).run(req.userId!, encrypted_secret, iv, auth_tag);

  const qrDataUrl = await generateQrDataUrl(totp.toString());
  const resp: TotpSetupResponse = { otpauthUrl: totp.toString(), qrDataUrl, base32Secret: base32 };
  res.json(resp);
});

// POST /api/auth/totp/verify-setup  (requireAuth)
router.post('/verify-setup', requireAuth, otpLimiter, async (req: Request, res: Response) => {
  const result = otpSchema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ message: 'A 6-digit token is required' }); return; }

  const secretRow = db.prepare('SELECT * FROM totp_secrets WHERE user_id = ?').get(req.userId!) as {
    encrypted_secret: string; iv: string; auth_tag: string; verified: number
  } | undefined;
  if (!secretRow) { res.status(400).json({ message: 'TOTP setup not initiated' }); return; }

  const base32 = decryptSecret(secretRow.encrypted_secret, secretRow.iv, secretRow.auth_tag);
  if (!verifyTotp(base32, result.data.token)) {
    res.status(400).json({ message: 'Invalid OTP code' });
    return;
  }

  // Check for replay attack
  const period = Math.floor(Date.now() / 1000 / 30);
  if (isTotpTokenUsed(req.userId!, result.data.token, period)) {
    res.status(401).json({ message: 'Invalid or expired code' });
    return;
  }

  // Mark token as used
  markTotpTokenUsed(req.userId!, result.data.token, period);
  cleanUpUsedTokens();

  // Mark verified and generate recovery codes
  db.prepare('UPDATE totp_secrets SET verified = 1 WHERE user_id = ?').run(req.userId!);
  db.prepare('DELETE FROM recovery_codes WHERE user_id = ?').run(req.userId!);

  const plainCodes = generateRecoveryCodes();
  for (const code of plainCodes) {
    const codeHash = await hashRecoveryCode(code);
    db.prepare('INSERT INTO recovery_codes (id, user_id, code_hash) VALUES (?, ?, ?)').run(randomUUID(), req.userId!, codeHash);
  }

  auditLog(req.userId!, '2fa_enabled', {}, req.ip, req.get('user-agent'));
  res.json({ recoveryCodes: plainCodes, message: 'Two-factor authentication enabled. Save these recovery codes in a safe place — they will not be shown again.' });
});

// POST /api/auth/totp/verify  (login flow — totpPending=true)
router.post('/verify', otpLimiter, async (req: Request, res: Response) => {
  if (!req.session.userId || !req.session.totpPending) {
    res.status(401).json({ message: 'No pending 2FA session' });
    return;
  }
  const result = otpSchema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ message: 'A 6-digit token is required' }); return; }

  const secretRow = db.prepare('SELECT * FROM totp_secrets WHERE user_id = ? AND verified = 1').get(req.session.userId) as {
    encrypted_secret: string; iv: string; auth_tag: string;
  } | undefined;
  if (!secretRow) { res.status(400).json({ message: 'TOTP not set up' }); return; }

  const base32 = decryptSecret(secretRow.encrypted_secret, secretRow.iv, secretRow.auth_tag);
  if (!verifyTotp(base32, result.data.token)) {
    res.status(401).json({ message: 'Invalid OTP code' });
    return;
  }

  // Check for replay attack
  const period = Math.floor(Date.now() / 1000 / 30);
  if (isTotpTokenUsed(req.session.userId, result.data.token, period)) {
    res.status(401).json({ message: 'Invalid or expired code' });
    return;
  }

  // Mark token as used
  markTotpTokenUsed(req.session.userId, result.data.token, period);
  cleanUpUsedTokens();

  req.session.totpPending = false;
  req.session.lastActivity = Date.now();
  req.session.createdAt = req.session.createdAt ?? Date.now();

  const fp = deviceFingerprint(req.get('user-agent'), req.ip);
  if (isNewDevice(req.session.userId, fp)) {
    recordDevice(req.session.userId, fp, req.ip, req.get('user-agent'));
    const userRow = db.prepare('SELECT email FROM users WHERE id = ?').get(req.session.userId) as { email: string } | undefined;
    if (userRow) sendLoginAlert(userRow.email, req.ip, req.get('user-agent')).catch(() => {});
  }

  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId) as Record<string, unknown>;
  const memberRow = db.prepare('SELECT household_id FROM household_members WHERE user_id = ? LIMIT 1').get(req.session.userId) as { household_id: string } | undefined;

  auditLog(req.session.userId, 'login_totp_success', {}, req.ip, req.get('user-agent'));
  res.json({ user: mapUser(userRow), household: memberRow ? { id: memberRow.household_id } : null });
});

// POST /api/auth/totp/verify-recovery  (login flow via recovery code)
router.post('/verify-recovery', otpLimiter, async (req: Request, res: Response) => {
  if (!req.session.userId || !req.session.totpPending) {
    res.status(401).json({ message: 'No pending 2FA session' });
    return;
  }
  const result = recoverySchema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ message: 'Recovery code is required' }); return; }

  const codes = db.prepare('SELECT * FROM recovery_codes WHERE user_id = ? AND used = 0').all(req.session.userId) as {
    id: string; code_hash: string;
  }[];

  let matchedId: string | null = null;
  for (const c of codes) {
    if (await verifyRecoveryCode(result.data.code, c.code_hash)) {
      matchedId = c.id;
      break;
    }
  }

  if (!matchedId) {
    res.status(401).json({ message: 'Invalid or already-used recovery code' });
    return;
  }

  db.prepare('UPDATE recovery_codes SET used = 1 WHERE id = ?').run(matchedId);
  req.session.totpPending = false;
  req.session.lastActivity = Date.now();

  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId) as Record<string, unknown>;
  const memberRow = db.prepare('SELECT household_id FROM household_members WHERE user_id = ? LIMIT 1').get(req.session.userId) as { household_id: string } | undefined;

  auditLog(req.session.userId, 'recovery_code_used', {}, req.ip, req.get('user-agent'));
  res.json({ user: mapUser(userRow), household: memberRow ? { id: memberRow.household_id } : null });
});

// POST /api/auth/totp/disable  (requireAuth)
router.post('/disable', requireAuth, sensitiveActionLimiter, async (req: Request, res: Response) => {
  const { password, token, code } = req.body as { password?: string; token?: string; code?: string };
  if (!password) { res.status(400).json({ message: 'Password is required' }); return; }

  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId!) as Record<string, unknown> | undefined;
  if (!userRow?.password_hash) { res.status(400).json({ message: 'No local password set' }); return; }

  if (!await verifyPassword(userRow.password_hash as string, password)) {
    res.status(401).json({ message: 'Invalid password' });
    return;
  }

  const secretRow = db.prepare('SELECT * FROM totp_secrets WHERE user_id = ? AND verified = 1').get(req.userId!) as {
    encrypted_secret: string; iv: string; auth_tag: string;
  } | undefined;
  if (!secretRow) { res.status(400).json({ message: 'TOTP is not enabled' }); return; }

  // Verify OTP or recovery code
  if (token) {
    const base32 = decryptSecret(secretRow.encrypted_secret, secretRow.iv, secretRow.auth_tag);
    if (!verifyTotp(base32, token)) { res.status(401).json({ message: 'Invalid OTP code' }); return; }
  } else if (code) {
    const codes = db.prepare('SELECT * FROM recovery_codes WHERE user_id = ? AND used = 0').all(req.userId!) as { id: string; code_hash: string }[];
    let matched = false;
    for (const c of codes) {
      if (await verifyRecoveryCode(code, c.code_hash)) { db.prepare('UPDATE recovery_codes SET used = 1 WHERE id = ?').run(c.id); matched = true; break; }
    }
    if (!matched) { res.status(401).json({ message: 'Invalid recovery code' }); return; }
  } else {
    res.status(400).json({ message: 'OTP token or recovery code required' });
    return;
  }

  db.transaction(() => {
    db.prepare('DELETE FROM totp_secrets WHERE user_id = ?').run(req.userId!);
    db.prepare('DELETE FROM recovery_codes WHERE user_id = ?').run(req.userId!);
  })();

  auditLog(req.userId!, '2fa_disabled', {}, req.ip, req.get('user-agent'));
  res.json({ message: 'Two-factor authentication disabled.' });
});

// POST /api/auth/totp/request-reset  (requireAuth)
router.post('/request-reset', requireAuth, totpResetLimiter, async (req: Request, res: Response) => {
  const userRow = db.prepare('SELECT email FROM users WHERE id = ?').get(req.userId!) as { email: string } | undefined;
  if (!userRow) { res.status(404).json({ message: 'User not found' }); return; }

  createToken(req.userId!, 'totp_reset');
  try {
    await sendTotpResetNotification(userRow.email);
  } catch { /* ignore */ }

  auditLog(req.userId!, '2fa_reset_requested', {}, req.ip, req.get('user-agent'));
  res.json({ message: 'A 2FA reset has been requested. You will receive an email notification. The reset will be available after 24 hours.' });
});

// POST /api/auth/totp/confirm-reset
router.post('/confirm-reset', sensitiveActionLimiter, async (req: Request, res: Response) => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || !password) { res.status(400).json({ message: 'Token and password are required' }); return; }

  const consumed = validateAndConsumeToken(token, 'totp_reset');
  if (!consumed) { res.status(400).json({ message: 'Invalid or expired reset token' }); return; }

  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(consumed.userId) as Record<string, unknown> | undefined;
  if (!userRow?.password_hash) { res.status(400).json({ message: 'No local password set' }); return; }
  if (!await verifyPassword(userRow.password_hash as string, password)) {
    res.status(401).json({ message: 'Invalid password' }); return;
  }

  db.transaction(() => {
    db.prepare('DELETE FROM totp_secrets WHERE user_id = ?').run(consumed.userId);
    db.prepare('DELETE FROM recovery_codes WHERE user_id = ?').run(consumed.userId);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(consumed.userId);
  })();

  auditLog(consumed.userId, '2fa_reset', {}, req.ip, req.get('user-agent'));
  res.json({ message: 'Two-factor authentication has been reset. Please log in again.' });
});

export default router;
