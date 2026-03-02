import { Router } from 'express';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import db from '../db.js';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../auth/password.js';
import { createToken, validateAndConsumeToken } from '../auth/tokens.js';
import { sendEmailVerification, sendPasswordReset } from '../services/email.js';
import { auditLog } from '../services/audit.js';
import { deviceFingerprint, isNewDevice, recordDevice } from '../auth/device.js';
import { sendLoginAlert } from '../services/email.js';
import { requireAuth } from '../middleware/auth.js';
import { loginLimiter, passwordResetLimiter, registrationLimiter } from '../middleware/rate-limit.js';
import { generateCsrfToken } from '../middleware/csrf.js';
import type { User, AuthStatusResponse } from '../../shared/types.js';
import { getSetting } from '../services/settings.js';

// Augment session type to include CSRF flag
declare module 'express-session' {
  interface SessionData {
    _csrfInitialized?: boolean;
  }
}

const router = Router();

// Pre-computed Argon2id hash for timing normalisation (prevents user enumeration)
let dummyHash: string | null = null;
async function getDummyHash(): Promise<string> {
  if (!dummyHash) dummyHash = await hashPassword('dummy_timing_normalisation');
  return dummyHash;
}

const registerSchema = z.object({
  email: z.email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  display_name: z.string().optional(),
  invite_token: z.string().optional(),
});

const loginSchema = z.object({
  email: z.email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const forgotSchema = z.object({
  email: z.email('Invalid email address'),
});

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(1),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

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
    colour_palette: (row.colour_palette as string | undefined) ?? 'default',
    notify_updates: row.notify_updates !== undefined ? Boolean(row.notify_updates) : true,
  };
}

// POST /api/auth/register
router.post('/register', registrationLimiter, async (req: Request, res: Response) => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.issues[0]?.message ?? 'Validation error' });
    return;
  }
  const { email, password, display_name, invite_token } = result.data;

  const strength = validatePasswordStrength(password);
  if (!strength.valid) {
    res.status(400).json({ message: strength.message });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ message: 'An account with this email already exists' });
    return;
  }

  // First registered user becomes admin; also used to bypass registration guard
  const countRow = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  const isFirstUser = countRow.count === 0;

  if (!isFirstUser && !invite_token && getSetting('registration.disabled') === 'true') {
    res.status(403).json({ message: 'Registration is currently disabled.' });
    return;
  }

  const userId = randomUUID();
  const householdId = randomUUID();
  const hash = await hashPassword(password);
  const name = display_name?.trim() || email.split('@')[0];

  // If valid invite_token is provided, join that household instead of creating new one
  let targetHouseholdId: string | null = null;
  if (invite_token) {
    const consumed = validateAndConsumeToken(invite_token, 'invite');
    if (consumed?.newEmail) {
      targetHouseholdId = consumed.newEmail; // newEmail field stores householdId for invites
    }
  }

  db.transaction(() => {
    db.prepare(`
      INSERT INTO users (id, email, display_name, password_hash, system_role)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, email.toLowerCase().trim(), name, hash, isFirstUser ? 'admin' : 'user');

    if (targetHouseholdId) {
      // Join the invited household as member
      db.prepare(`
        INSERT INTO household_members (household_id, user_id, role)
        VALUES (?, ?, 'member')
      `).run(targetHouseholdId, userId);
    } else {
      // Create new household
      db.prepare('INSERT INTO households (id, name) VALUES (?, ?)').run(householdId, `${name}'s Household`);
      db.prepare(`
        INSERT INTO household_members (household_id, user_id, role)
        VALUES (?, ?, 'owner')
      `).run(householdId, userId);
    }
  })();

  // Send verification email (don't fail registration if email fails)
  try {
    const token = createToken(userId, 'email_verify');
    await sendEmailVerification(email, token);
  } catch { /* ignore */ }

  auditLog(userId, 'register', { email }, req.ip, req.get('user-agent'));
  res.status(201).json({ message: 'Registration successful. Please check your email to verify your account.' });
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.issues[0]?.message ?? 'Validation error' });
    return;
  }
  const { email, password } = result.data;

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim()) as Record<string, unknown> | undefined;
  if (!row || !row.password_hash) {
    // Perform timing-normalisation verification to prevent user enumeration
    await verifyPassword(await getDummyHash(), password);
    res.status(401).json({ message: 'Invalid email or password' });
    return;
  }

  // Check lockout
  if (row.locked_until && new Date(row.locked_until as string) > new Date()) {
    res.status(423).json({ message: 'Account is temporarily locked due to too many failed login attempts. Try again later.' });
    return;
  }

  const valid = await verifyPassword(row.password_hash as string, password);
  if (!valid) {
    const failCount = (row.failed_login_count as number) + 1;
    const locked_until = failCount >= 5
      ? new Date(Date.now() + 30 * 60 * 1000).toISOString()
      : null;
    db.prepare(`
      UPDATE users SET failed_login_count = ?, locked_until = ?, updated_at = datetime('now') WHERE id = ?
    `).run(failCount, locked_until, row.id);
    auditLog(row.id as string, 'login_failed', { email }, req.ip, req.get('user-agent'));
    res.status(401).json({ message: 'Invalid email or password' });
    return;
  }

  // Reset lockout
  db.prepare(`
    UPDATE users SET failed_login_count = 0, locked_until = NULL, updated_at = datetime('now') WHERE id = ?
  `).run(row.id);

  // Check TOTP
  const totpRow = db.prepare('SELECT verified FROM totp_secrets WHERE user_id = ?').get(row.id) as { verified: number } | undefined;
  const hasTotpEnabled = totpRow && Boolean(totpRow.verified);

  // Get household
  const memberRow = db.prepare(`
    SELECT household_id, role FROM household_members WHERE user_id = ? LIMIT 1
  `).get(row.id) as { household_id: string; role: string } | undefined;

  // Regenerate session
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });

  req.session.userAgent = req.get('user-agent');
  req.session.ipAddress = req.ip;

  if (hasTotpEnabled) {
    req.session.userId = row.id as string;
    req.session.householdId = memberRow?.household_id;
    req.session.householdRole = memberRow?.role as 'owner' | 'member' | undefined;
    req.session.systemRole = row.system_role as 'admin' | 'user';
    req.session.totpPending = true;
    auditLog(row.id as string, 'login_totp_required', {}, req.ip, req.get('user-agent'));
    res.json({ totp_required: true });
    return;
  }

  req.session.userId = row.id as string;
  req.session.householdId = memberRow?.household_id;
  req.session.householdRole = memberRow?.role as 'owner' | 'member' | undefined;
  req.session.systemRole = row.system_role as 'admin' | 'user';
  req.session.totpPending = false;
  req.session.lastActivity = Date.now();
  req.session.createdAt = Date.now();

  // Device detection
  const fp = deviceFingerprint(req.get('user-agent'), req.ip);
  if (isNewDevice(row.id as string, fp)) {
    recordDevice(row.id as string, fp, req.ip, req.get('user-agent'));
    sendLoginAlert(row.email as string, req.ip, req.get('user-agent')).catch(() => {});
    auditLog(row.id as string, 'login_new_device', { ip: req.ip }, req.ip, req.get('user-agent'));
  }

  auditLog(row.id as string, 'login_success', {}, req.ip, req.get('user-agent'));
  res.json({ user: mapUser(row), household: memberRow ? { id: memberRow.household_id } : null });
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  const userId = req.session.userId;
  req.session.destroy(() => {
    res.clearCookie('bb.sid');
    if (userId) auditLog(userId, 'logout', {}, req.ip, req.get('user-agent'));
    res.status(204).send();
  });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', passwordResetLimiter, async (req: Request, res: Response) => {
  const result = forgotSchema.safeParse(req.body);
  if (!result.success) {
    res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
    return;
  }
  const { email } = result.data;

  const row = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim()) as { id: string } | undefined;
  if (row) {
    try {
      const token = createToken(row.id, 'password_reset');
      await sendPasswordReset(email, token);
      auditLog(row.id, 'password_reset_requested', {}, req.ip, req.get('user-agent'));
    } catch { /* ignore */ }
  }

  res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  const result = resetSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.issues[0]?.message ?? 'Validation error' });
    return;
  }
  const { token, password } = result.data;

  const strength = validatePasswordStrength(password);
  if (!strength.valid) {
    res.status(400).json({ message: strength.message });
    return;
  }

  const consumed = validateAndConsumeToken(token, 'password_reset');
  if (!consumed) {
    res.status(400).json({ message: 'Invalid or expired reset token' });
    return;
  }

  const hash = await hashPassword(password);
  db.prepare(`
    UPDATE users SET password_hash = ?, failed_login_count = 0, locked_until = NULL, updated_at = datetime('now')
    WHERE id = ?
  `).run(hash, consumed.userId);

  // Destroy all other sessions for this user
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(consumed.userId);

  auditLog(consumed.userId, 'password_reset_completed', {}, req.ip, req.get('user-agent'));
  res.json({ message: 'Password reset successful. Please log in.' });
});

// POST /api/auth/verify-email
router.post('/verify-email', (req: Request, res: Response) => {
  const result = verifyEmailSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: 'Token is required' });
    return;
  }

  const consumed = validateAndConsumeToken(result.data.token, 'email_verify');
  if (!consumed) {
    res.status(400).json({ message: 'Invalid or expired verification token' });
    return;
  }

  db.prepare("UPDATE users SET email_verified = 1, updated_at = datetime('now') WHERE id = ?").run(consumed.userId);
  auditLog(consumed.userId, 'email_verified', {}, req.ip, req.get('user-agent'));
  res.json({ message: 'Email verified successfully.' });
});

// GET /api/auth/status
router.get('/status', (req: Request, res: Response) => {
  if (!req.session.userId) {
    const resp: AuthStatusResponse = { authenticated: false, totpPending: false };
    res.json(resp);
    return;
  }

  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId) as Record<string, unknown> | undefined;
  if (!userRow) {
    req.session.destroy(() => {});
    const resp: AuthStatusResponse = { authenticated: false, totpPending: false };
    res.json(resp);
    return;
  }

  const householdId = req.session.householdId;
  let household = undefined;
  if (householdId) {
    const hRow = db.prepare('SELECT * FROM households WHERE id = ?').get(householdId) as Record<string, unknown> | undefined;
    if (hRow) household = { id: hRow.id as string, name: hRow.name as string };
  }

  const resp: AuthStatusResponse = {
    authenticated: !req.session.totpPending,
    totpPending: Boolean(req.session.totpPending),
    user: mapUser(userRow),
    household,
    householdRole: req.session.householdRole,
  };
  res.json(resp);
});

// GET /api/auth/registration-status — public
router.get('/registration-status', (_req: Request, res: Response) => {
  const count = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  const disabled = count > 0 && getSetting('registration.disabled') === 'true';
  res.json({ disabled });
});

// GET /api/auth/csrf-token — public (needed before login/register)
router.get('/csrf-token', (req: Request, res: Response) => {
  // With saveUninitialized: false, we must modify the session to ensure it's persisted
  // This is required for CSRF tokens to bind to a persistent sessionID
  const hasExistingData = Object.keys(req.session).some(k => k !== 'cookie');
  if (!hasExistingData) {
    // Mark as CSRF-initialized to trigger session save
    req.session._csrfInitialized = true;
  }
  const token = generateCsrfToken(req, res);
  res.json({ token });
});

export default router;
