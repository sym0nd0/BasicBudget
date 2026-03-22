import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config, isHttpDeployment } from './config.js';
import { sessionMiddleware } from './auth/session.js';
import { doubleCsrfProtection } from './middleware/csrf.js';
import { generalApiLimiter, staticLimiter } from './middleware/rate-limit.js';

import authRouter from './routes/auth.js';
import totpRouter from './routes/totp.js';
import oidcRouter from './routes/oidc.js';
import profileRouter from './routes/profile.js';
import sessionsRouter from './routes/sessions.js';
import householdRouter from './routes/household.js';
import inviteRouter from './routes/invite.js';
import incomesRouter from './routes/incomes.js';
import expensesRouter from './routes/expenses.js';
import debtsRouter from './routes/debts.js';
import savingsGoalsRouter from './routes/savings-goals.js';
import reportsRouter from './routes/reports.js';
import accountsRouter from './routes/accounts.js';
import monthsRouter from './routes/months.js';
import summaryRouter from './routes/summary.js';
import importRouter from './routes/import.js';
import exportRouter from './routes/export.js';
import adminRouter from './routes/admin.js';
import categoriesRouter from './routes/categories.js';
import { checkAndSendDealReminders } from './services/debtNotifications.js';
import { refreshVersionCheck, getVersionInfo } from './services/versionChecker.js';
import versionRouter from './routes/version.js';
import { logger } from './services/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = parseInt(config.PORT, 10);

// Print ASCII banner + version
const BANNER = [
  ' ____            _      ____            _            _      ',
  '| __ )  __ _ ___(_) ___| __ ) _   _  __| | __ _  ___| |_   ',
  '|  _ \\ / _` / __| |/ __|  _ \\| | | |/ _` |/ _` |/ _ \\ __|',
  '| |_) | (_| \\__ \\ | (__| |_) | |_| | (_| | (_| |  __/ |_| ',
  '|____/ \\__,_|___/_|\\___|____/ \\__,_|\\__,_|\\__, |\\___|\\___|',
  '                                             |___/           ',
];
for (const line of BANNER) logger.info(line);
logger.info(`v${getVersionInfo().current}  |  ${config.NODE_ENV}`);

// Warn when APP_URL is HTTPS but COOKIE_SECURE is not explicitly overridden.
// In this state, cookies are marked secure: true — browsers will reject them over
// plain HTTP (e.g. direct LAN access). Set COOKIE_SECURE=false to allow HTTP.
if (
  config.NODE_ENV === 'production' &&
  config.APP_URL.startsWith('https://') &&
  config.COOKIE_SECURE === undefined
) {
  logger.warn(
    'APP_URL is HTTPS but COOKIE_SECURE is not set — direct HTTP access will fail. ' +
    'Set COOKIE_SECURE=false if you access the app over plain HTTP (e.g. a local IP address).',
  );
}

if (config.NODE_ENV === 'production') {
  logger.info(
    isHttpDeployment
      ? 'Cookie security: Secure flag OFF (HTTP mode — cookies will work over plain HTTP)'
      : 'Cookie security: Secure flag ON (HTTPS mode)',
  );
}

// 1. Trust proxy (for rate-limit IP tracking behind reverse proxy)
app.set('trust proxy', 1);

// 2. Helmet security headers
// codeql[js/insecure-helmet-configuration] CSP is intentionally disabled in development for Vite HMR; production uses Helmet defaults
// upgrade-insecure-requests is always omitted: Vite produces root-relative asset paths that
// already inherit the page protocol, so the directive is redundant over HTTPS and actively
// breaks plain-HTTP deployments by upgrading asset fetches to HTTPS (ERR_SSL_PROTOCOL_ERROR).
app.use(helmet({
  contentSecurityPolicy: config.NODE_ENV === 'production'
    ? { directives: { upgradeInsecureRequests: null } }
    : false,
}));

// 3. CORS
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true,
}));

// 4. JSON body parser
app.use(express.json({ limit: '1mb' }));

// 4b. Cookie parser (required by csrf-csrf to read the CSRF cookie)
// codeql[js/missing-token-validation] CSRF protection is applied via csrf-csrf doubleCsrfProtection at lines 76-79
app.use(cookieParser());

// 5. Session middleware
app.use(sessionMiddleware);

// 6. CSRF protection (skip OIDC callback which uses browser redirects)
app.use((req, res, next) => {
  if (req.path === '/api/auth/oidc/callback') return next();
  doubleCsrfProtection(req, res, next);
});

// 7. General API rate limiter
app.use('/api', generalApiLimiter);

// 8. Auth routes
app.use('/api/auth', authRouter);
app.use('/api/auth/totp', totpRouter);
app.use('/api/auth/oidc', oidcRouter);
app.use('/api/auth/profile', profileRouter);
app.use('/api/auth/sessions', sessionsRouter);

// 8b. Public invite endpoint (no auth required)
app.use('/api/invite', inviteRouter);

// 9. Data routes (all have requireAuth internally)
app.use('/api/household', householdRouter);
app.use('/api/incomes', incomesRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/debts', debtsRouter);
app.use('/api/savings-goals', savingsGoalsRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/months', monthsRouter);
app.use('/api/summary', summaryRouter);
app.use('/api/import', importRouter);
app.use('/api/export', exportRouter);
app.use('/api/admin', adminRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/version', versionRouter);

// 10. API 404 handler
app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// 11. Static + SPA fallback (production)
if (config.NODE_ENV === 'production') {
  const publicDir = path.join(__dirname, '..', '..', 'public');
  app.use(express.static(publicDir));
  app.get(/^(?!\/api).*$/, staticLimiter, (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// 12. Global error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error & { status?: number; code?: string }, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Handle CSRF errors — always log at warn level regardless of environment
  if (err.code === 'EBADCSRFTOKEN') {
    const hasCsrfCookie = Boolean(req.cookies?.['bb.csrf']);
    const csrfHeader = req.headers['x-csrf-token'] as string | undefined;
    const hasCsrfHeader = Boolean(csrfHeader);
    const cookieHeaderMatch =
      hasCsrfCookie && hasCsrfHeader
        ? req.cookies['bb.csrf'] === csrfHeader
        : false;
    logger.warn('CSRF token validation failed', {
      error: err instanceof Error ? err.message : String(err),
      hasCsrfCookie,
      hasCsrfHeader,
      cookieHeaderMatch,
    });
    // Actionable hint when the cause is almost certainly Secure cookies over HTTP
    if (!hasCsrfCookie && !isHttpDeployment) {
      logger.warn(
        'Hint: cookies use Secure flag (HTTPS mode) but the browser did not send the CSRF cookie. ' +
        'If you access this app over plain HTTP (e.g. http://192.168.x.x), ensure ' +
        'COOKIE_SECURE=false is set in your container environment (docker-compose.yml).',
      );
    }
    res.status(403).json({ message: 'Invalid CSRF token' });
    return;
  }
  logger.error('Unhandled request error', { error: err instanceof Error ? err : String(err) });
  const status = err.status ?? 500;
  const message = config.NODE_ENV === 'production' && status === 500
    ? 'Internal server error'
    : (err.message || 'Internal server error');
  res.status(status).json({ message });
});

if (config.NODE_ENV !== 'test') {
  // Version check — run immediately at startup, then every hour
  refreshVersionCheck().catch(err => logger.error('Version check failed', { error: String(err) }));
  setInterval(() => {
    refreshVersionCheck().catch(err => logger.error('Version check failed', { error: String(err) }));
  }, 30 * 60 * 1000);

  // Deal reminders — 10s delay then every 24h
  setTimeout(() => {
    checkAndSendDealReminders().catch(err => logger.error('Deal reminder check failed', { error: String(err) }));
    setInterval(() => {
      checkAndSendDealReminders().catch(err => logger.error('Deal reminder check failed', { error: String(err) }));
    }, 24 * 60 * 60 * 1000);
  }, 10_000);

  app.listen(PORT, () => {
    logger.info('Server listening', { port: PORT });
  });
}

export default app;
