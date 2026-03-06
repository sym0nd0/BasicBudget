import type { Request, Response, NextFunction } from 'express';
import type { HouseholdRole, SystemRole } from '../../shared/types.js';
import { logger } from '../services/logger.js';

// Augment Express.Request with auth fields populated by session
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      householdId?: string;
      householdRole?: HouseholdRole;
      systemRole?: SystemRole;
    }
  }
}

// Populate req fields from session, then require authentication
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    logger.debug('Auth required — no session', { path: req.path });
    res.status(401).json({ message: 'Authentication required' });
    return;
  }
  if (req.session.totpPending) {
    logger.debug('Auth blocked — TOTP pending', { userId: req.session.userId });
    res.status(401).json({ message: 'Two-factor authentication required', totpPending: true });
    return;
  }

  // Absolute session lifetime — 72 hours
  const SESSION_MAX_AGE_MS = 72 * 60 * 60 * 1000;
  if (req.session.createdAt && Date.now() - req.session.createdAt > SESSION_MAX_AGE_MS) {
    logger.info('Session expired (max age)', { userId: req.session.userId });
    req.session.destroy(() => {});
    res.status(401).json({ message: 'Session expired. Please log in again.' });
    return;
  }

  // Inactivity timeout — 2 hours
  const SESSION_IDLE_MS = 2 * 60 * 60 * 1000;
  if (req.session.lastActivity && Date.now() - req.session.lastActivity > SESSION_IDLE_MS) {
    logger.info('Session expired (inactivity)', { userId: req.session.userId });
    req.session.destroy(() => {});
    res.status(401).json({ message: 'Session expired due to inactivity. Please log in again.' });
    return;
  }
  req.session.lastActivity = Date.now();

  req.userId = req.session.userId;
  req.householdId = req.session.householdId;
  req.householdRole = req.session.householdRole;
  req.systemRole = req.session.systemRole;
  next();
}

export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  if (req.householdRole !== 'owner') {
    res.status(403).json({ message: 'Household owner role required' });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.systemRole !== 'admin') {
    res.status(403).json({ message: 'Admin role required' });
    return;
  }
  next();
}
