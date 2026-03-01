import session from 'express-session';
import { SqliteSessionStore } from './session-store.js';
import { config } from '../config.js';
import type { HouseholdRole, SystemRole } from '../../shared/types.js';

// Augment express-session SessionData with app-specific fields
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    householdId?: string;
    householdRole?: HouseholdRole;
    systemRole?: SystemRole;
    totpPending?: boolean;
    lastActivity?: number;
    createdAt?: number;
    // Stored for session-store metadata
    userAgent?: string;
    ipAddress?: string;
    // OIDC PKCE state
    oidcState?: string;
    oidcCodeVerifier?: string;
  }
}

const store = new SqliteSessionStore();

export const sessionMiddleware = session({
  name: 'bb.sid',
  secret: config.SESSION_SECRET,
  store,
  resave: false,
  saveUninitialized: true,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
});
