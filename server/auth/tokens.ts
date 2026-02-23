import { randomBytes, createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import db from '../db.js';

type TokenType = 'password_reset' | 'email_verify' | 'email_change' | 'invite' | 'totp_reset';

const EXPIRY_MINUTES: Record<TokenType, number> = {
  password_reset: 30,
  email_verify: 60 * 24,        // 24 hours
  email_change: 30,
  invite: 60 * 24 * 7,          // 7 days
  totp_reset: 60 * 24,          // 24 hours
};

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function createToken(
  userId: string,
  type: TokenType,
  expiryMinutes?: number,
  newEmail?: string,
): string {
  const raw = randomBytes(32).toString('hex');
  const hash = hashToken(raw);
  const minutes = expiryMinutes ?? EXPIRY_MINUTES[type];
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO reset_tokens (id, user_id, token_hash, type, new_email, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), userId, hash, type, newEmail ?? null, expiresAt);

  return raw;
}

export function validateAndConsumeToken(
  rawToken: string,
  type: TokenType,
): { userId: string; newEmail?: string | null } | null {
  const hash = hashToken(rawToken);
  const row = db.prepare(`
    SELECT id, user_id, new_email, expires_at, used
    FROM reset_tokens
    WHERE token_hash = ? AND type = ?
  `).get(hash, type) as {
    id: string;
    user_id: string;
    new_email: string | null;
    expires_at: string;
    used: number;
  } | undefined;

  if (!row) return null;
  if (row.used) return null;
  if (new Date(row.expires_at) < new Date()) return null;

  db.prepare('UPDATE reset_tokens SET used = 1 WHERE id = ?').run(row.id);

  return { userId: row.user_id, newEmail: row.new_email };
}

export function pruneExpiredTokens(): void {
  db.prepare("DELETE FROM reset_tokens WHERE expires_at < datetime('now')").run();
}
