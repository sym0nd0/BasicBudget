import type { Request, Response, NextFunction } from 'express';
import type { HouseholdRole, SystemRole } from '../../shared/types.js';

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
    res.status(401).json({ message: 'Authentication required' });
    return;
  }
  if (req.session.totpPending) {
    res.status(401).json({ message: 'Two-factor authentication required', totpPending: true });
    return;
  }
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
