import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import db from '../db.js';

export function deviceFingerprint(userAgent: string | undefined, ip: string | undefined): string {
  const input = `${userAgent ?? ''}|${ip ?? ''}`;
  return createHash('sha256').update(input).digest('hex');
}

export function isNewDevice(userId: string, fingerprint: string): boolean {
  const row = db.prepare(
    'SELECT 1 FROM login_alerts WHERE user_id = ? AND fingerprint = ?',
  ).get(userId, fingerprint);
  return !row;
}

export function recordDevice(
  userId: string,
  fingerprint: string,
  ip?: string,
  userAgent?: string,
): void {
  db.prepare(`
    INSERT OR IGNORE INTO login_alerts (id, user_id, ip_address, user_agent, fingerprint, notified)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(randomUUID(), userId, ip ?? null, userAgent ?? null, fingerprint);
}
