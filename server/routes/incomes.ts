import { Router } from 'express';
import type { Request, Response } from 'express';
import db from '../db.js';
import { randomUUID } from 'node:crypto';
import { filterActiveInMonth, currentYearMonth, type RecurringItem } from '../utils/recurring.js';
import { filterVisible, canModify } from '../utils/visibility.js';
import { isMonthLocked } from './months.js';
import { requireAuth } from '../middleware/auth.js';
import type { Income } from '../../shared/types.js';
import { logger } from '../services/logger.js';
import { incomeSchema, monthParam } from '../validation/schemas.js';

const router = Router();
router.use(requireAuth);

function mapIncome(row: Record<string, unknown>): Income {
  return {
    ...(row as Omit<Income, 'is_recurring' | 'is_household'>),
    is_recurring: Boolean(row.is_recurring),
    is_household: Boolean(row.is_household),
  };
}

// GET /api/incomes?month=YYYY-MM
router.get('/', (req: Request, res: Response) => {
  const month = (req.query.month as string) ?? currentYearMonth();
  const monthResult = monthParam.safeParse(month);
  if (!monthResult.success) {
    res.status(400).json({ message: 'Invalid month format' });
    return;
  }
  const all = db.prepare('SELECT * FROM incomes WHERE household_id = ? ORDER BY created_at').all(req.householdId!) as RecurringItem[];
  const active = filterActiveInMonth(all, month);
  const visible = filterVisible(active as Record<string, unknown>[], req.userId!);
  res.json(visible.map(r => mapIncome(r)));
});

// POST /api/incomes
router.post('/', (req: Request, res: Response) => {
  const result = incomeSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: 'Validation error' });
    return;
  }
  const body = result.data;
  const id = randomUUID();
  const grossOrNet = body.gross_or_net ?? 'net';
  const recurrenceType = body.recurrence_type ?? 'monthly';
  const isHousehold = body.is_household ? 1 : 0;
  try {
    db.prepare(`
      INSERT INTO incomes
        (id, household_id, user_id, name, amount_pence, posting_day, contributor_user_id, is_household, gross_or_net,
         is_recurring, recurrence_type, start_date, end_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.householdId!,
      req.userId!,
      body.name.trim(),
      body.amount_pence,
      body.posting_day ?? 28,
      body.contributor_user_id ?? null,
      isHousehold,
      grossOrNet,
      body.is_recurring ? 1 : 0,
      recurrenceType,
      body.start_date ?? null,
      body.end_date ?? null,
      body.notes ?? null,
    );
  } catch (err) {
    logger.error('Failed to save income', { error: (err as Error).message });
    res.status(500).json({ message: 'Failed to save income' });
    return;
  }
  const row = db.prepare('SELECT * FROM incomes WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json(mapIncome(row));
});

// PUT /api/incomes/:id
router.put('/:id', (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const result = incomeSchema.partial().safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: 'Validation error' });
    return;
  }
  const body = result.data;
  const existing = db.prepare('SELECT * FROM incomes WHERE id = ? AND household_id = ?').get(id, req.householdId!) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ message: 'Income not found' });
    return;
  }
  if (!canModify(existing, req.userId!)) {
    res.status(403).json({ message: 'You can only edit your own entries' });
    return;
  }
  const startDate = (body.start_date ?? existing.start_date) as string | null;
  if (startDate) {
    const ym = startDate.slice(0, 7);
    if (isMonthLocked(ym, req.householdId!)) {
      res.status(409).json({ message: `Month ${ym} is locked` });
      return;
    }
  }
  const isHousehold = body.is_household !== undefined
    ? (body.is_household ? 1 : 0)
    : existing.is_household;
  try {
    db.prepare(`
      UPDATE incomes SET
        name = ?, amount_pence = ?, posting_day = ?, contributor_user_id = ?, is_household = ?,
        gross_or_net = ?, is_recurring = ?, recurrence_type = ?,
        start_date = ?, end_date = ?, notes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      body.name?.trim() ?? existing.name,
      body.amount_pence ?? existing.amount_pence,
      body.posting_day ?? existing.posting_day,
      body.contributor_user_id !== undefined ? body.contributor_user_id : existing.contributor_user_id,
      isHousehold,
      body.gross_or_net ?? existing.gross_or_net,
      body.is_recurring !== undefined ? (body.is_recurring ? 1 : 0) : existing.is_recurring,
      body.recurrence_type ?? existing.recurrence_type,
      body.start_date !== undefined ? body.start_date : existing.start_date,
      body.end_date !== undefined ? body.end_date : existing.end_date,
      body.notes !== undefined ? body.notes : existing.notes,
      id,
    );
  } catch (err) {
    logger.error('Failed to save income', { error: (err as Error).message });
    res.status(500).json({ message: 'Failed to save income' });
    return;
  }
  const row = db.prepare('SELECT * FROM incomes WHERE id = ?').get(id) as Record<string, unknown>;
  res.json(mapIncome(row));
});

// DELETE /api/incomes/:id
router.delete('/:id', (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const existing = db.prepare('SELECT * FROM incomes WHERE id = ? AND household_id = ?').get(id, req.householdId!) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ message: 'Income not found' });
    return;
  }
  if (!canModify(existing, req.userId!)) {
    res.status(403).json({ message: 'You can only delete your own entries' });
    return;
  }
  const startDate = existing.start_date as string | null;
  if (startDate) {
    const ym = startDate.slice(0, 7);
    if (isMonthLocked(ym, req.householdId!)) {
      res.status(409).json({ message: `Month ${ym} is locked` });
      return;
    }
  }
  try {
    db.prepare('DELETE FROM incomes WHERE id = ?').run(id);
  } catch (err) {
    logger.error('Failed to delete income', { error: (err as Error).message });
    res.status(500).json({ message: 'Failed to delete income' });
    return;
  }
  res.status(204).send();
});

export default router;
