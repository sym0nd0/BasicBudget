import { Router } from 'express';
import type { Request, Response } from 'express';
import db from '../db.js';
import { randomUUID } from 'node:crypto';
import type { SavingsGoal } from '../../shared/types.js';

const router = Router();

function mapGoal(row: Record<string, unknown>): SavingsGoal {
  return row as SavingsGoal;
}

// GET /api/savings-goals
router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM savings_goals ORDER BY created_at').all() as Record<string, unknown>[];
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
        (id, name, target_amount_pence, current_amount_pence, monthly_contribution_pence, target_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
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
  const { id } = req.params;
  const body = req.body as Partial<SavingsGoal>;
  const existing = db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ message: 'Savings goal not found' });
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
  const { id } = req.params;
  const existing = db.prepare('SELECT id FROM savings_goals WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ message: 'Savings goal not found' });
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
