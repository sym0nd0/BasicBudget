import type { Request, Response, NextFunction } from 'express';
import type { HouseholdRole, SystemRole } from '../../shared/types.js';
import db from '../db.js';
import { logger } from '../services/logger.js';

// Augment Express.Request with auth fields populated by session
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      householdId?: string;
      householdRole?: HouseholdRole;
      systemRole?: SystemRole;
      requestId?: string;
    }
  }
}

function authLogMeta(req: Request): Record<string, unknown> {
  return {
    request_id: req.requestId,
    method: req.method,
    path: req.path,
    userId: req.session?.userId ?? req.userId,
    householdId: req.householdId,
    householdRole: req.householdRole,
    systemRole: req.systemRole,
  };
}

// Populate req fields from session, then require authentication
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    logger.debug('Auth required: no authenticated session', authLogMeta(req));
    res.status(401).json({ message: 'Authentication required' });
    return;
  }
  if (req.session.totpPending) {
    logger.debug('Auth blocked: TOTP verification pending', authLogMeta(req));
    res.status(401).json({ message: 'Two-factor authentication required', totpPending: true });
    return;
  }

  // Absolute session lifetime — 72 hours
  const SESSION_MAX_AGE_MS = 72 * 60 * 60 * 1000;
  if (req.session.createdAt && Date.now() - req.session.createdAt > SESSION_MAX_AGE_MS) {
    logger.info('Session expired: maximum session age exceeded', authLogMeta(req));
    req.session.destroy((err) => {
      if (err) {
        logger.error('Failed to destroy expired session', { ...authLogMeta(req), error: err });
      }
    });
    res.status(401).json({ message: 'Session expired. Please log in again.' });
    return;
  }

  // Inactivity timeout — 2 hours
  const SESSION_IDLE_MS = 2 * 60 * 60 * 1000;
  if (req.session.lastActivity && Date.now() - req.session.lastActivity > SESSION_IDLE_MS) {
    logger.info('Session expired: idle timeout exceeded', authLogMeta(req));
    req.session.destroy((err) => {
      if (err) {
        logger.error('Failed to destroy idle session', { ...authLogMeta(req), error: err });
      }
    });
    res.status(401).json({ message: 'Session expired due to inactivity. Please log in again.' });
    return;
  }
  req.session.lastActivity = Date.now();

  const userRow = db.prepare('SELECT system_role FROM users WHERE id = ?').get(req.session.userId) as { system_role: SystemRole } | undefined;
  const memberRow = db.prepare(`
    SELECT household_id, role
    FROM household_members
    WHERE user_id = ?
    ORDER BY joined_at DESC
    LIMIT 1
  `).get(req.session.userId) as { household_id: string; role: HouseholdRole } | undefined;

  if (!userRow || !memberRow) {
    logger.warn('Auth blocked: session user no longer has an active account or household membership', authLogMeta(req));
    req.session.destroy((err) => {
      if (err) {
        logger.error('Failed to destroy stale authorisation session', { ...authLogMeta(req), error: err });
      }
    });
    res.status(401).json({ message: 'Session expired. Please log in again.' });
    return;
  }

  req.session.householdId = memberRow.household_id;
  req.session.householdRole = memberRow.role;
  req.session.systemRole = userRow.system_role;

  req.userId = req.session.userId;
  req.householdId = req.session.householdId;
  req.householdRole = req.session.householdRole;
  req.systemRole = req.session.systemRole;
  next();
}

export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  if (req.householdRole !== 'owner') {
    logger.warn('Authorisation denied: household owner role required', authLogMeta(req));
    res.status(403).json({ message: 'Household owner role required' });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.systemRole !== 'admin') {
    logger.warn('Authorisation denied: admin role required', authLogMeta(req));
    res.status(403).json({ message: 'Admin role required' });
    return;
  }
  next();
}
