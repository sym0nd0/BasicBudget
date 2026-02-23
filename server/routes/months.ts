import { Router } from 'express';
import type { Request, Response } from 'express';
import db from '../db.js';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import type { MonthLock } from '../../shared/types.js';

const router = Router();
router.use(requireAuth);

// GET /api/months — list locked months for this household
router.get('/', (req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM month_locks WHERE household_id = ? ORDER BY year_month DESC').all(req.householdId!) as MonthLock[];
  res.json(rows);
});

// POST /api/months/:ym/lock
router.post('/:ym/lock', requireOwner, (req: Request, res: Response) => {
  const ym = req.params['ym'] as string;
  if (!/^\d{4}-\d{2}$/.test(ym)) {
    res.status(400).json({ message: 'year_month must be YYYY-MM' });
    return;
  }
  try {
    db.prepare(
      'INSERT OR IGNORE INTO month_locks (year_month, household_id) VALUES (?, ?)',
    ).run(ym, req.householdId!);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }
  const row = db.prepare('SELECT * FROM month_locks WHERE year_month = ? AND household_id = ?').get(ym, req.householdId!) as MonthLock;
  res.status(201).json(row);
});

// DELETE /api/months/:ym/lock
router.delete('/:ym/lock', requireOwner, (req: Request, res: Response) => {
  const ym = req.params['ym'] as string;
  try {
    db.prepare('DELETE FROM month_locks WHERE year_month = ? AND household_id = ?').run(ym, req.householdId!);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }
  res.status(204).send();
});

/**
 * Check if a given year_month is locked for the given household.
 * Used by other routes to enforce the 409 rule.
 */
export function isMonthLocked(yearMonth: string, householdId: string): boolean {
  const row = db.prepare('SELECT 1 FROM month_locks WHERE year_month = ? AND household_id = ?').get(yearMonth, householdId);
  return !!row;
}

export default router;
