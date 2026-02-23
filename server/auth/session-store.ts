import type { SessionData } from 'express-session';
import session from 'express-session';
import db from '../db.js';

const { Store } = session;

interface SessionRow {
  sid: string;
  sess: string;
  expired: number;
  user_id: string | null;
  user_agent: string | null;
  ip_address: string | null;
}

export class SqliteSessionStore extends Store {
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    super();
    // Clean expired sessions every 15 minutes
    this.cleanupInterval = setInterval(() => this.cleanExpired(), 15 * 60 * 1000);
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  private cleanExpired(): void {
    try {
      db.prepare('DELETE FROM sessions WHERE expired < ?').run(Date.now());
    } catch { /* ignore */ }
  }

  get(sid: string, callback: (err: Error | null, session?: SessionData | null) => void): void {
    try {
      const row = db.prepare('SELECT * FROM sessions WHERE sid = ?').get(sid) as SessionRow | undefined;
      if (!row || row.expired < Date.now()) {
        callback(null, null);
        return;
      }
      callback(null, JSON.parse(row.sess) as SessionData);
    } catch (err) {
      callback(err as Error);
    }
  }

  set(sid: string, session: SessionData, callback?: (err?: Error | null) => void): void {
    try {
      const expires = session.cookie.expires
        ? new Date(session.cookie.expires).getTime()
        : Date.now() + (session.cookie.maxAge ?? 86400000);
      const sess = JSON.parse(JSON.stringify(session)) as Record<string, unknown>;
      const userId = (sess.userId as string | undefined) ?? null;
      const userAgent = (sess.userAgent as string | undefined) ?? null;
      const ipAddress = (sess.ipAddress as string | undefined) ?? null;

      db.prepare(`
        INSERT INTO sessions (sid, sess, expired, user_id, user_agent, ip_address)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET
          sess = excluded.sess,
          expired = excluded.expired,
          user_id = excluded.user_id,
          user_agent = excluded.user_agent,
          ip_address = excluded.ip_address
      `).run(sid, JSON.stringify(session), expires, userId, userAgent, ipAddress);
      callback?.(null);
    } catch (err) {
      callback?.(err as Error);
    }
  }

  destroy(sid: string, callback?: (err?: Error | null) => void): void {
    try {
      db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      callback?.(null);
    } catch (err) {
      callback?.(err as Error);
    }
  }

  touch(sid: string, session: SessionData, callback?: (err?: Error | null) => void): void {
    try {
      const expires = session.cookie.expires
        ? new Date(session.cookie.expires).getTime()
        : Date.now() + (session.cookie.maxAge ?? 86400000);
      db.prepare('UPDATE sessions SET expired = ? WHERE sid = ?').run(expires, sid);
      callback?.(null);
    } catch (err) {
      callback?.(err as Error);
    }
  }

  clear(callback?: (err?: Error | null) => void): void {
    try {
      db.prepare('DELETE FROM sessions').run();
      callback?.(null);
    } catch (err) {
      callback?.(err as Error);
    }
  }

  length(callback: (err: Error | null, length?: number) => void): void {
    try {
      const row = db.prepare('SELECT COUNT(*) as count FROM sessions WHERE expired > ?').get(Date.now()) as { count: number };
      callback(null, row.count);
    } catch (err) {
      callback(err as Error);
    }
  }
}
