import { Router } from 'express';
import type { Request, Response } from 'express';
import db from '../db.js';
import type { MonthLock } from '../../shared/types.js';

const router = Router();

// GET /api/months — list locked months
router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM month_locks ORDER BY year_month DESC').all() as MonthLock[];
  res.json(rows);
});

// POST /api/months/:ym/lock
router.post('/:ym/lock', (req: Request, res: Response) => {
  const { ym } = req.params;
  if (!/^\d{4}-\d{2}$/.test(ym)) {
    res.status(400).json({ message: 'year_month must be YYYY-MM' });
    return;
  }
  try {
    db.prepare(
      'INSERT OR IGNORE INTO month_locks (year_month) VALUES (?)',
    ).run(ym);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }
  const row = db.prepare('SELECT * FROM month_locks WHERE year_month = ?').get(ym) as MonthLock;
  res.status(201).json(row);
});

// DELETE /api/months/:ym/lock
router.delete('/:ym/lock', (req: Request, res: Response) => {
  const { ym } = req.params;
  try {
    db.prepare('DELETE FROM month_locks WHERE year_month = ?').run(ym);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }
  res.status(204).send();
});

/**
 * Check if a given year_month is locked.
 * Used by other routes to enforce the 409 rule.
 */
export function isMonthLocked(yearMonth: string): boolean {
  const row = db.prepare('SELECT 1 FROM month_locks WHERE year_month = ?').get(yearMonth);
  return !!row;
}

export default router;
