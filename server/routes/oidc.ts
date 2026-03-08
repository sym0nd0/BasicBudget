import { Router } from 'express';
import type { Request, Response } from 'express';
import { randomUUID, randomBytes } from 'node:crypto';
import db from '../db.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { auditLog } from '../services/audit.js';
import { getOidcConfig } from '../services/settings.js';

const router = Router();

// Lazy OIDC client — only created when settings are configured
// undefined = not yet built; null = built but not configured / failed
let oidcClient: Awaited<ReturnType<typeof buildOidcClient>> | null | undefined = undefined;

async function buildOidcClient() {
  const oidcConfig = getOidcConfig();
  if (!oidcConfig) return null;
  try {
    const { discovery } = await import('openid-client');
    const issuerUrl = new URL(oidcConfig.issuer_url);
    const clientConfig = await discovery(issuerUrl, oidcConfig.client_id, oidcConfig.client_secret || undefined);
    return clientConfig;
  } catch {
    return null;
  }
}

async function getClient() {
  if (oidcClient === undefined) {
    oidcClient = await buildOidcClient();
  }
  return oidcClient;
}

export function resetOidcClient(): void {
  oidcClient = undefined;
}

// GET /api/auth/oidc/enabled — public endpoint to check if OIDC is configured
router.get('/enabled', (_req: Request, res: Response) => {
  const oidcConfig = getOidcConfig();
  res.json({ enabled: !!oidcConfig });
});

// GET /api/auth/oidc/login
router.get('/login', async (req: Request, res: Response) => {
  const client = await getClient();
  if (!client) { res.status(404).json({ message: 'OIDC is not configured' }); return; }

  try {
    const { buildAuthorizationUrl, calculatePKCECodeChallenge } = await import('openid-client');
    const state = randomBytes(16).toString('hex');
    const codeVerifier = randomBytes(32).toString('hex');
    const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);

    req.session.oidcState = state;
    req.session.oidcCodeVerifier = codeVerifier;

    const redirectUri = `${config.APP_URL}/api/auth/oidc/callback`;
    const authUrl = buildAuthorizationUrl(client, {
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    await new Promise<void>((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
    res.redirect(authUrl.toString());
  } catch (err) {
    res.status(500).json({ message: 'OIDC error' });
  }
});

// GET /api/auth/oidc/callback
router.get('/callback', async (req: Request, res: Response) => {
  const client = await getClient();
  if (!client) { res.redirect(`${config.APP_URL}/login?error=oidc_not_configured`); return; }

  try {
    const { authorizationCodeGrant } = await import('openid-client');
    const state = req.session.oidcState;
    const codeVerifier = req.session.oidcCodeVerifier;

    if (!state || !codeVerifier) {
      res.redirect(`${config.APP_URL}/login?error=invalid_state`);
      return;
    }

    const redirectUri = `${config.APP_URL}/api/auth/oidc/callback`;
    const tokens = await authorizationCodeGrant(client, new URL(req.url, config.APP_URL), {
      pkceCodeVerifier: codeVerifier,
      expectedState: state,
      expectedNonce: undefined,
    });

    const claims = tokens.claims();
    if (!claims) { res.redirect(`${config.APP_URL}/login?error=no_claims`); return; }

    const sub = claims.sub;
    const email = claims.email as string | undefined;
    const issuer = claims.iss ?? getOidcConfig()?.issuer_url ?? '';

    // Clear OIDC session state
    delete req.session.oidcState;
    delete req.session.oidcCodeVerifier;

    // Check for existing OIDC link
    let userRow = db.prepare(`
      SELECT u.* FROM users u
      JOIN oidc_accounts o ON o.user_id = u.id
      WHERE o.issuer = ? AND o.subject = ?
    `).get(issuer, sub) as Record<string, unknown> | undefined;

    if (!userRow && email && claims.email_verified === true) {
      // Try to link to existing user by email (only if email is verified by OIDC provider)
      userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim()) as Record<string, unknown> | undefined;
      if (userRow) {
        db.prepare('INSERT OR IGNORE INTO oidc_accounts (user_id, issuer, subject) VALUES (?, ?, ?)').run(userRow.id, issuer, sub);
      }
    }

    if (!userRow) {
      // Create new user + household
      if (!email) { res.redirect(`${config.APP_URL}/login?error=no_email`); return; }
      const userId = randomUUID();
      const householdId = randomUUID();
      const displayName = (claims.name as string | undefined) ?? email.split('@')[0];

      db.transaction(() => {
        db.prepare(`INSERT INTO users (id, email, display_name, email_verified) VALUES (?, ?, ?, 1)`).run(userId, email.toLowerCase().trim(), displayName);
        db.prepare('INSERT INTO oidc_accounts (user_id, issuer, subject) VALUES (?, ?, ?)').run(userId, issuer, sub);
        db.prepare('INSERT INTO households (id, name) VALUES (?, ?)').run(householdId, `${displayName}'s Household`);
        db.prepare(`INSERT INTO household_members (household_id, user_id, role) VALUES (?, ?, 'owner')`).run(householdId, userId);
      })();

      userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<string, unknown>;
      auditLog(userId, 'oidc_register', { issuer, email }, req.ip, req.get('user-agent'));
    } else if (!Boolean(userRow.email_verified)) {
      db.prepare("UPDATE users SET email_verified = 1, updated_at = datetime('now') WHERE id = ?").run(userRow.id);
    }

    // Get household
    const memberRow = db.prepare(`SELECT household_id, role FROM household_members WHERE user_id = ? LIMIT 1`).get(userRow.id) as { household_id: string; role: string } | undefined;

    await new Promise<void>((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
    req.session.userId = userRow.id as string;
    req.session.householdId = memberRow?.household_id;
    req.session.householdRole = memberRow?.role as 'owner' | 'member' | undefined;
    req.session.systemRole = userRow.system_role as 'admin' | 'user';
    req.session.totpPending = false;
    req.session.lastActivity = Date.now();
    req.session.createdAt = Date.now();

    auditLog(userRow.id as string, 'oidc_login', { issuer }, req.ip, req.get('user-agent'));
    await new Promise<void>((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
    res.redirect(config.APP_URL);
  } catch {
    res.redirect(`${config.APP_URL}/login?error=oidc_failed`);
  }
});

// POST /api/auth/oidc/link  (requireAuth)
router.post('/link', requireAuth, async (req: Request, res: Response) => {
  // This would initiate an OIDC flow to link — simplified for now
  res.status(501).json({ message: 'OIDC linking requires browser redirect — use GET /api/auth/oidc/login' });
});

// DELETE /api/auth/oidc/unlink  (requireAuth)
router.delete('/unlink', requireAuth, (req: Request, res: Response) => {
  const userRow = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.userId!) as { password_hash: string | null } | undefined;
  if (!userRow?.password_hash) {
    res.status(400).json({ message: 'Cannot unlink OIDC — you must set a local password first' });
    return;
  }
  const { issuer } = req.body as { issuer?: string };
  if (!issuer) { res.status(400).json({ message: 'issuer is required' }); return; }
  db.prepare('DELETE FROM oidc_accounts WHERE user_id = ? AND issuer = ?').run(req.userId!, issuer);
  auditLog(req.userId!, 'oidc_unlink', { issuer }, req.ip, req.get('user-agent'));
  res.status(204).send();
});

export default router;
