import { randomUUID } from 'node:crypto';
import db from '../db.js';

export function auditLog(
  userId: string | null,
  action: string,
  detail?: Record<string, unknown>,
  ip?: string,
  userAgent?: string,
): void {
  try {
    db.prepare(`
      INSERT INTO audit_log (id, user_id, action, detail, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      userId ?? null,
      action,
      detail ? JSON.stringify(detail) : null,
      ip ?? null,
      userAgent ?? null,
    );
  } catch {
    // Audit failures must never break the main flow
  }
}
