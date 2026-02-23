import { Router } from 'express';
import type { Request, Response } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/export/json
router.get('/json', (req: Request, res: Response) => {
  const accounts = db.prepare('SELECT * FROM accounts WHERE household_id = ? ORDER BY sort_order, name').all(req.householdId!);
  const incomes = db.prepare('SELECT * FROM incomes WHERE household_id = ? ORDER BY created_at').all(req.householdId!);
  const expenses = db.prepare('SELECT * FROM expenses WHERE household_id = ? ORDER BY created_at').all(req.householdId!);
  const debts = db.prepare('SELECT * FROM debts WHERE household_id = ? ORDER BY created_at').all(req.householdId!);
  const savings_goals = db.prepare('SELECT * FROM savings_goals WHERE household_id = ? ORDER BY created_at').all(req.householdId!);
  const month_locks = db.prepare('SELECT * FROM month_locks WHERE household_id = ? ORDER BY year_month').all(req.householdId!);

  const exportData = {
    schema_version: 3,
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
