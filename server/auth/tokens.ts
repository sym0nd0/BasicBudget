import { randomBytes, createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import db from '../db.js';

type TokenType = 'password_reset' | 'email_verify' | 'email_change' | 'invite' | 'totp_reset';

export interface ResetTokenRow {
  readonly id: string;
  readonly userId: string;
  readonly newEmail: string | null;
  readonly inviteeEmail: string | null;
  readonly expiresAt: string;
  readonly availableAt: string | null;
}

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
  availableAt?: string | null,
): string {
  const raw = randomBytes(32).toString('hex');
  const hash = hashToken(raw);
  const minutes = expiryMinutes ?? EXPIRY_MINUTES[type];
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO reset_tokens (id, user_id, token_hash, type, new_email, expires_at, available_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), userId, hash, type, newEmail ?? null, expiresAt, availableAt ?? null);

  return raw;
}

export function validateToken(
  rawToken: string,
  type: TokenType,
): ResetTokenRow | null {
  const hash = hashToken(rawToken);
  const row = db.prepare(`
    SELECT id, user_id, new_email, invitee_email, expires_at, available_at, used
    FROM reset_tokens
    WHERE token_hash = ? AND type = ?
  `).get(hash, type) as {
    id: string;
    user_id: string;
    new_email: string | null;
    invitee_email: string | null;
    expires_at: string;
    available_at: string | null;
    used: number;
  } | undefined;

  if (!row) return null;
  if (row.used) return null;
  if (new Date(row.expires_at) < new Date()) return null;
  if (row.available_at && new Date(row.available_at) > new Date()) return null;

  return {
    id: row.id,
    userId: row.user_id,
    newEmail: row.new_email,
    inviteeEmail: row.invitee_email,
    expiresAt: row.expires_at,
    availableAt: row.available_at,
  };
}

export function consumeTokenById(id: string): void {
  db.prepare('UPDATE reset_tokens SET used = 1 WHERE id = ? AND used = 0').run(id);
}

export function validateAndConsumeToken(
  rawToken: string,
  type: TokenType,
): { userId: string; newEmail?: string | null; inviteeEmail?: string | null } | null {
  const row = validateToken(rawToken, type);
  if (!row) return null;
  consumeTokenById(row.id);
  return { userId: row.userId, newEmail: row.newEmail, inviteeEmail: row.inviteeEmail };
}

export function pruneExpiredTokens(): void {
  db.prepare("DELETE FROM reset_tokens WHERE expires_at < datetime('now')").run();
}
