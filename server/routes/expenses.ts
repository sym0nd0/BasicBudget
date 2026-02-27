import { Router } from 'express';
import type { Request, Response } from 'express';
import db from '../db.js';
import { randomUUID } from 'node:crypto';
import { filterActiveInMonth, currentYearMonth, type RecurringItem } from '../utils/recurring.js';
import { isMonthLocked } from './months.js';
import { requireAuth } from '../middleware/auth.js';
import type { Expense } from '../../shared/types.js';

const router = Router();
router.use(requireAuth);

function mapExpense(row: Record<string, unknown>): Expense {
  return {
    ...(row as Omit<Expense, 'is_recurring' | 'is_household'>),
    is_recurring: Boolean(row.is_recurring),
    is_household: Boolean(row.is_household),
  };
}

// GET /api/expenses?month=&category=
router.get('/', (req: Request, res: Response) => {
  const month = (req.query.month as string) ?? currentYearMonth();
  const category = req.query.category as string | undefined;

  const all = category
    ? db.prepare('SELECT * FROM expenses WHERE household_id = ? AND category = ? ORDER BY created_at').all(req.householdId!, category) as RecurringItem[]
    : db.prepare('SELECT * FROM expenses WHERE household_id = ? ORDER BY created_at').all(req.householdId!) as RecurringItem[];
  const active = filterActiveInMonth(all, month);
  res.json(active.map(r => mapExpense(r as Record<string, unknown>)));
});

// POST /api/expenses
router.post('/', (req: Request, res: Response) => {
  const body = req.body as Partial<Expense>;
  if (!body.name?.trim()) {
    res.status(400).json({ message: 'name is required' });
    return;
  }
  if (typeof body.amount_pence !== 'number' || body.amount_pence < 0) {
    res.status(400).json({ message: 'amount_pence must be a non-negative integer' });
    return;
  }
  const expenseType = body.type ?? 'fixed';
  if (!['fixed', 'variable'].includes(expenseType)) {
    res.status(400).json({ message: "type must be 'fixed' or 'variable'" });
    return;
  }
  const recurrenceType = body.recurrence_type ?? 'monthly';
  if (!['monthly', 'weekly', 'yearly', 'fortnightly'].includes(recurrenceType)) {
    res.status(400).json({ message: "recurrence_type must be 'monthly', 'weekly', 'yearly', or 'fortnightly'" });
    return;
  }
  const id = randomUUID();
  const isHousehold = body.is_household ? 1 : 0;
  const splitRatio = body.split_ratio ?? (isHousehold ? 0.5 : 1.0);
  try {
    db.prepare(`
      INSERT INTO expenses
        (id, household_id, user_id, name, amount_pence, posting_day, account_id, type, category,
         is_household, split_ratio, is_recurring, recurrence_type,
         start_date, end_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.householdId!,
      req.userId!,
      body.name.trim(),
      body.amount_pence,
      body.posting_day ?? 1,
      body.account_id ?? null,
      expenseType,
      body.category ?? 'Other',
      isHousehold,
      splitRatio,
      body.is_recurring ? 1 : 0,
      recurrenceType,
      body.start_date ?? null,
      body.end_date ?? null,
      body.notes ?? null,
    );
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }
  const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json(mapExpense(row));
});

// PUT /api/expenses/:id
router.put('/:id', (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const body = req.body as Partial<Expense>;
  const existing = db.prepare('SELECT * FROM expenses WHERE id = ? AND household_id = ?').get(id, req.householdId!) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ message: 'Expense not found' });
    return;
  }
  if (req.householdRole === 'member' && existing.user_id !== req.userId) {
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
  if (body.type !== undefined && !['fixed', 'variable'].includes(body.type)) {
    res.status(400).json({ message: "type must be 'fixed' or 'variable'" });
    return;
  }
  if (body.recurrence_type !== undefined && !['monthly', 'weekly', 'yearly', 'fortnightly'].includes(body.recurrence_type)) {
    res.status(400).json({ message: "recurrence_type must be 'monthly', 'weekly', 'yearly', or 'fortnightly'" });
    return;
  }
  const isHousehold = body.is_household !== undefined
    ? (body.is_household ? 1 : 0)
    : existing.is_household;
  const splitRatio = body.split_ratio !== undefined
    ? body.split_ratio
    : (isHousehold ? 0.5 : (existing.split_ratio as number));
  try {
    db.prepare(`
      UPDATE expenses SET
        name = ?, amount_pence = ?, posting_day = ?, account_id = ?,
        type = ?, category = ?, is_household = ?, split_ratio = ?,
        is_recurring = ?, recurrence_type = ?,
        start_date = ?, end_date = ?, notes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      body.name?.trim() ?? existing.name,
      body.amount_pence ?? existing.amount_pence,
      body.posting_day ?? existing.posting_day,
      body.account_id !== undefined ? body.account_id : existing.account_id,
      body.type ?? existing.type,
      body.category ?? existing.category,
      isHousehold,
      splitRatio,
      body.is_recurring !== undefined ? (body.is_recurring ? 1 : 0) : existing.is_recurring,
      body.recurrence_type ?? existing.recurrence_type,
      body.start_date !== undefined ? body.start_date : existing.start_date,
      body.end_date !== undefined ? body.end_date : existing.end_date,
      body.notes !== undefined ? body.notes : existing.notes,
      id,
    );
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }
  const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as Record<string, unknown>;
  res.json(mapExpense(row));
});

// DELETE /api/expenses/:id
router.delete('/:id', (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const existing = db.prepare('SELECT * FROM expenses WHERE id = ? AND household_id = ?').get(id, req.householdId!) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ message: 'Expense not found' });
    return;
  }
  if (req.householdRole === 'member' && existing.user_id !== req.userId) {
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
    db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }
  res.status(204).send();
});

export default router;
