import { Router } from 'express';
import type { Request, Response } from 'express';
import db from '../db.js';
import { randomUUID } from 'node:crypto';
import { filterActiveInMonth, currentYearMonth, type RecurringItem } from '../utils/recurring.js';
import { isMonthLocked } from './months.js';
import { requireAuth } from '../middleware/auth.js';
import type { Income } from '../../shared/types.js';

const router = Router();
router.use(requireAuth);

function mapIncome(row: Record<string, unknown>): Income {
  return {
    ...(row as Omit<Income, 'is_recurring'>),
    is_recurring: Boolean(row.is_recurring),
  };
}

// GET /api/incomes?month=YYYY-MM
router.get('/', (req: Request, res: Response) => {
  const month = (req.query.month as string) ?? currentYearMonth();
  const all = db.prepare('SELECT * FROM incomes WHERE household_id = ? ORDER BY created_at').all(req.householdId!) as RecurringItem[];
  const active = filterActiveInMonth(all, month);
  res.json(active.map(r => mapIncome(r as Record<string, unknown>)));
});

// POST /api/incomes
router.post('/', (req: Request, res: Response) => {
  const body = req.body as Partial<Income>;
  if (!body.name?.trim()) {
    res.status(400).json({ message: 'name is required' });
    return;
  }
  if (typeof body.amount_pence !== 'number' || body.amount_pence < 0) {
    res.status(400).json({ message: 'amount_pence must be a non-negative integer' });
    return;
  }
  const grossOrNet = body.gross_or_net ?? 'net';
  if (grossOrNet !== 'gross' && grossOrNet !== 'net') {
    res.status(400).json({ message: "gross_or_net must be 'gross' or 'net'" });
    return;
  }
  const recurrenceType = body.recurrence_type ?? 'monthly';
  if (!['monthly', 'weekly', 'yearly', 'fortnightly'].includes(recurrenceType)) {
    res.status(400).json({ message: "recurrence_type must be 'monthly', 'weekly', 'yearly', or 'fortnightly'" });
    return;
  }
  const id = randomUUID();
  try {
    db.prepare(`
      INSERT INTO incomes
        (id, household_id, user_id, name, amount_pence, posting_day, contributor_name, gross_or_net,
         is_recurring, recurrence_type, start_date, end_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.householdId!,
      req.userId!,
      body.name.trim(),
      body.amount_pence,
      body.posting_day ?? 28,
      body.contributor_name ?? null,
      grossOrNet,
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
  const row = db.prepare('SELECT * FROM incomes WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json(mapIncome(row));
});

// PUT /api/incomes/:id
router.put('/:id', (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const body = req.body as Partial<Income>;
  const existing = db.prepare('SELECT * FROM incomes WHERE id = ? AND household_id = ?').get(id, req.householdId!) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ message: 'Income not found' });
    return;
  }
  // Ownership check for members
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
  if (body.gross_or_net !== undefined && body.gross_or_net !== 'gross' && body.gross_or_net !== 'net') {
    res.status(400).json({ message: "gross_or_net must be 'gross' or 'net'" });
    return;
  }
  if (body.recurrence_type !== undefined && !['monthly', 'weekly', 'yearly', 'fortnightly'].includes(body.recurrence_type)) {
    res.status(400).json({ message: "recurrence_type must be 'monthly', 'weekly', 'yearly', or 'fortnightly'" });
    return;
  }
  try {
    db.prepare(`
      UPDATE incomes SET
        name = ?, amount_pence = ?, posting_day = ?, contributor_name = ?,
        gross_or_net = ?, is_recurring = ?, recurrence_type = ?,
        start_date = ?, end_date = ?, notes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      body.name?.trim() ?? existing.name,
      body.amount_pence ?? existing.amount_pence,
      body.posting_day ?? existing.posting_day,
      body.contributor_name !== undefined ? body.contributor_name : existing.contributor_name,
      body.gross_or_net ?? existing.gross_or_net,
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
    db.prepare('DELETE FROM incomes WHERE id = ?').run(id);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }
  res.status(204).send();
});

export default router;
