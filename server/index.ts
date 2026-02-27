import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { sessionMiddleware } from './auth/session.js';
import { doubleCsrfProtection } from './middleware/csrf.js';
import { generalApiLimiter } from './middleware/rate-limit.js';

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
import accountsRouter from './routes/accounts.js';
import monthsRouter from './routes/months.js';
import summaryRouter from './routes/summary.js';
import importRouter from './routes/import.js';
import exportRouter from './routes/export.js';
import adminRouter from './routes/admin.js';
import categoriesRouter from './routes/categories.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = parseInt(config.PORT, 10);

// 1. Trust proxy (for rate-limit IP tracking behind reverse proxy)
app.set('trust proxy', 1);

// 2. Helmet security headers
app.use(helmet({
  contentSecurityPolicy: config.NODE_ENV === 'production' ? undefined : false,
}));

// 3. CORS
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true,
}));

// 4. JSON body parser
app.use(express.json({ limit: '1mb' }));

// 4b. Cookie parser (required by csrf-csrf to read the CSRF cookie)
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
app.use('/api/months', monthsRouter);
app.use('/api/summary', summaryRouter);
app.use('/api/import', importRouter);
app.use('/api/export', exportRouter);
app.use('/api/admin', adminRouter);
app.use('/api/categories', categoriesRouter);

// 10. Static + SPA fallback (production)
if (config.NODE_ENV === 'production') {
  const publicDir = path.join(__dirname, '..', '..', 'public');
  app.use(express.static(publicDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// 11. Global error handler
app.use((err: Error & { status?: number; code?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (config.NODE_ENV !== 'production') {
    console.error(err);
  }
  // Handle CSRF errors
  if (err.code === 'EBADCSRFTOKEN' || (err as { statusCode?: number }).statusCode === 403) {
    res.status(403).json({ message: 'Invalid CSRF token' });
    return;
  }
  const status = err.status ?? 500;
  const message = config.NODE_ENV === 'production' && status === 500
    ? 'Internal server error'
    : (err.message || 'Internal server error');
  res.status(status).json({ message });
});

if (config.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`BasicBudget server listening on port ${PORT}`);
  });
}

export default app;
