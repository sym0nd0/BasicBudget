import { Router } from 'express';
import type { Request, Response } from 'express';
import db from '../db.js';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import type { SavingsGoal } from '../../shared/types.js';

const router = Router();
router.use(requireAuth);

function mapGoal(row: Record<string, unknown>): SavingsGoal {
  return row as unknown as SavingsGoal;
}

// GET /api/savings-goals
router.get('/', (req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM savings_goals WHERE household_id = ? ORDER BY created_at').all(req.householdId!) as Record<string, unknown>[];
  res.json(rows.map(mapGoal));
});

// POST /api/savings-goals
router.post('/', (req: Request, res: Response) => {
  const body = req.body as Partial<SavingsGoal>;
  if (!body.name?.trim()) {
    res.status(400).json({ message: 'name is required' });
    return;
  }
  if (typeof body.target_amount_pence !== 'number' || body.target_amount_pence <= 0) {
    res.status(400).json({ message: 'target_amount_pence must be a positive integer' });
    return;
  }
  const id = randomUUID();
  try {
    db.prepare(`
      INSERT INTO savings_goals
        (id, household_id, user_id, name, target_amount_pence, current_amount_pence, monthly_contribution_pence, target_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.householdId!,
      req.userId!,
      body.name.trim(),
      body.target_amount_pence,
      body.current_amount_pence ?? 0,
      body.monthly_contribution_pence ?? 0,
      body.target_date ?? null,
      body.notes ?? null,
    );
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }
  const row = db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json(mapGoal(row));
});

// PUT /api/savings-goals/:id
router.put('/:id', (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const body = req.body as Partial<SavingsGoal>;
  const existing = db.prepare('SELECT * FROM savings_goals WHERE id = ? AND household_id = ?').get(id, req.householdId!) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ message: 'Savings goal not found' });
    return;
  }
  if (req.householdRole === 'member' && existing.user_id !== req.userId) {
    res.status(403).json({ message: 'You can only edit your own entries' });
    return;
  }
  try {
    db.prepare(`
      UPDATE savings_goals SET
        name = ?, target_amount_pence = ?, current_amount_pence = ?,
        monthly_contribution_pence = ?, target_date = ?, notes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      body.name?.trim() ?? existing.name,
      body.target_amount_pence ?? existing.target_amount_pence,
      body.current_amount_pence ?? existing.current_amount_pence,
      body.monthly_contribution_pence ?? existing.monthly_contribution_pence,
      body.target_date !== undefined ? body.target_date : existing.target_date,
      body.notes !== undefined ? body.notes : existing.notes,
      id,
    );
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }
  const row = db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(id) as Record<string, unknown>;
  res.json(mapGoal(row));
});

// DELETE /api/savings-goals/:id
router.delete('/:id', (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const existing = db.prepare('SELECT * FROM savings_goals WHERE id = ? AND household_id = ?').get(id, req.householdId!);
  if (!existing) {
    res.status(404).json({ message: 'Savings goal not found' });
    return;
  }
  const existingRow = existing as Record<string, unknown>;
  if (req.householdRole === 'member' && existingRow.user_id !== req.userId) {
    res.status(403).json({ message: 'You can only delete your own entries' });
    return;
  }
  try {
    db.prepare('DELETE FROM savings_goals WHERE id = ?').run(id);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }
  res.status(204).send();
});

export default router;
