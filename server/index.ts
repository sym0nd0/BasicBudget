import express from 'express';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { readFileSync } from 'node:fs';
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
import backupRouter from './routes/backup.js';
import categoriesRouter from './routes/categories.js';
import { checkAndSendDealReminders } from './services/debtNotifications.js';
import { refreshVersionCheck, getVersionInfo } from './services/versionChecker.js';
import { initAutoBackup, stopAutoBackup } from './services/autoBackup.js';
import versionRouter from './routes/version.js';
import { getCurrentLogLevel, logger } from './services/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = parseInt(config.PORT, 10);

function routeLabel(req: express.Request): string {
  if (req.route?.path) {
    const routePath = Array.isArray(req.route.path) ? req.route.path.join('|') : req.route.path;
    return `${req.baseUrl}${routePath}`;
  }
  return req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;
}

function requestMeta(req: express.Request): Record<string, unknown> {
  return {
    request_id: req.requestId,
    method: req.method,
    path: req.path,
    route: routeLabel(req),
    userId: req.userId ?? req.session?.userId,
    householdId: req.householdId ?? req.session?.householdId,
  };
}

function logApiRequest(req: express.Request, res: express.Response, next: express.NextFunction): void {
  req.requestId = randomUUID();
  const startedAt = process.hrtime.bigint();

  logger.debug('HTTP request started', {
    ...requestMeta(req),
    query_keys: Object.keys(req.query),
  });

  res.on('finish', () => {
    const durationMs = Number((process.hrtime.bigint() - startedAt) / 1_000_000n);
    const completionMeta = {
      ...requestMeta(req),
      status: res.statusCode,
      duration_ms: durationMs,
    };

    if (res.statusCode >= 500) {
      logger.error('HTTP request completed', completionMeta);
      return;
    }
    if (res.statusCode >= 400) {
      logger.warn('HTTP request completed', completionMeta);
      return;
    }
    logger.info('HTTP request completed', completionMeta);
  });

  next();
}

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
logger.info('Runtime configuration loaded', {
  node_env: config.NODE_ENV,
  port: PORT,
  cors_origin: config.CORS_ORIGIN,
  app_url: config.APP_URL,
  db_path_set: Boolean(config.DB_PATH),
  secure_cookies: config.COOKIE_SECURE ?? 'auto',
  log_level: getCurrentLogLevel(),
  env_log_level: config.LOG_LEVEL,
});

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
// upgrade-insecure-requests is always omitted: Vite produces root-relative asset paths that
// already inherit the page protocol, so the directive is redundant over HTTPS and actively
// breaks plain-HTTP deployments by upgrading asset fetches to HTTPS (ERR_SSL_PROTOCOL_ERROR).
// codeql[js/insecure-helmet-configuration] CSP is intentionally disabled in development for Vite HMR; production uses Helmet defaults
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
app.use('/api', logApiRequest);
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
app.use('/api/admin/backup', backupRouter);
app.use('/api/admin', adminRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/version', versionRouter);

// 10. API 404 handler
app.use('/api', (_req, res) => {
  logger.warn('API route not found', {
    request_id: _req.requestId,
    method: _req.method,
    path: _req.path,
    route: routeLabel(_req),
  });
  res.status(404).json({ message: 'Not found' });
});

// 11. Static + SPA fallback (production)
if (config.NODE_ENV === 'production') {
  const publicDir = path.join(__dirname, '..', '..', 'public');
  const indexHtml = readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  app.use(express.static(publicDir));
  app.get('/{*path}', staticLimiter, (_req, res) => {
    res.type('html').send(indexHtml);
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
      ...requestMeta(req),
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
  logger.error('Unhandled request error', {
    ...requestMeta(req),
    status: err.status ?? 500,
    error: err instanceof Error ? err : String(err),
  });
  const status = err.status ?? 500;
  const message = config.NODE_ENV === 'production' && status === 500
    ? 'Internal server error'
    : (err.message || 'Internal server error');
  res.status(status).json({ message });
});

if (config.NODE_ENV !== 'test') {
  let versionCheckInterval: ReturnType<typeof setInterval> | null = null;
  let dealReminderDelay: ReturnType<typeof setTimeout> | null = null;
  let dealReminderInterval: ReturnType<typeof setInterval> | null = null;

  function stopBackgroundJobs(): void {
    if (versionCheckInterval) {
      clearInterval(versionCheckInterval);
      versionCheckInterval = null;
    }
    if (dealReminderDelay) {
      clearTimeout(dealReminderDelay);
      dealReminderDelay = null;
    }
    if (dealReminderInterval) {
      clearInterval(dealReminderInterval);
      dealReminderInterval = null;
    }
    stopAutoBackup();
  }

  // Version check — run immediately at startup, then every hour
  refreshVersionCheck().catch(err => logger.error('Version check failed', { error: String(err) }));
  versionCheckInterval = setInterval(() => {
    refreshVersionCheck().catch(err => logger.error('Version check failed', { error: String(err) }));
  }, 30 * 60 * 1000);

  // Deal reminders — 10s delay then every 24h
  dealReminderDelay = setTimeout(() => {
    dealReminderDelay = null;
    checkAndSendDealReminders().catch(err => logger.error('Deal reminder check failed', { error: String(err) }));
    dealReminderInterval = setInterval(() => {
      checkAndSendDealReminders().catch(err => logger.error('Deal reminder check failed', { error: String(err) }));
    }, 24 * 60 * 60 * 1000);
  }, 10_000);

  // Automated backups — reads config from system_settings, starts scheduler if enabled
  initAutoBackup();

  const server: Server = app.listen(PORT, () => {
    logger.info('Server listening', { port: PORT });
  });

  const logShutdownSignal = async (signal: NodeJS.Signals): Promise<void> => {
    logger.info('Shutdown signal received', { signal, port: PORT });

    stopBackgroundJobs();

    const shutdownTimeout = setTimeout(() => {
      logger.error('Forced shutdown after timeout', { signal, port: PORT });
      process.exit(1);
    }, 10_000);
    shutdownTimeout.unref();

    try {
      await new Promise<void>((resolve, reject) => {
        server.close((err?: Error) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
      clearTimeout(shutdownTimeout);
      logger.info('HTTP server closed cleanly', { signal, port: PORT });
      process.exit(0);
    } catch (err) {
      clearTimeout(shutdownTimeout);
      logger.error('HTTP server shutdown failed', {
        signal,
        port: PORT,
        error: err,
      });
      process.exit(1);
    }
  };

  process.once('SIGINT', logShutdownSignal);
  process.once('SIGTERM', logShutdownSignal);
}

export default app;
