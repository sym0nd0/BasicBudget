import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import incomesRouter from './routes/incomes.js';
import expensesRouter from './routes/expenses.js';
import debtsRouter from './routes/debts.js';
import savingsGoalsRouter from './routes/savings-goals.js';
import accountsRouter from './routes/accounts.js';
import monthsRouter from './routes/months.js';
import summaryRouter from './routes/summary.js';
import householdRouter from './routes/household.js';
import importRouter from './routes/import.js';
import exportRouter from './routes/export.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// Parse JSON bodies
app.use(express.json());

// API routes
app.use('/api/incomes', incomesRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/debts', debtsRouter);
app.use('/api/savings-goals', savingsGoalsRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/months', monthsRouter);
app.use('/api/summary', summaryRouter);
app.use('/api/household', householdRouter);
app.use('/api/import', importRouter);
app.use('/api/export', exportRouter);

// In production: serve the built frontend
if (process.env.NODE_ENV === 'production') {
  const publicDir = path.join(__dirname, '..', '..', 'public');
  app.use(express.static(publicDir));
  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// Global error handler — must be registered after all routes
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`BasicBudget server listening on port ${PORT}`);
});

export default app;
