import { Router } from 'express';
import type { Request, Response } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/export/json
router.get('/json', (_req: Request, res: Response) => {
  const accounts = db.prepare('SELECT * FROM accounts ORDER BY sort_order, name').all();
  const incomes = db.prepare('SELECT * FROM incomes ORDER BY created_at').all();
  const expenses = db.prepare('SELECT * FROM expenses ORDER BY created_at').all();
  const debts = db.prepare('SELECT * FROM debts ORDER BY created_at').all();
  const savings_goals = db.prepare('SELECT * FROM savings_goals ORDER BY created_at').all();
  const month_locks = db.prepare('SELECT * FROM month_locks ORDER BY year_month').all();

  const exportData = {
    schema_version: 2,
    exported_at: new Date().toISOString(),
    accounts,
    incomes,
    expenses,
    debts,
    savings_goals,
    month_locks,
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="basicbudget-export-${new Date().toISOString().slice(0, 10)}.json"`,
  );
  res.json(exportData);
});

export default router;
