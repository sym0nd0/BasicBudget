import { Router } from 'express';
import type { Request, Response } from 'express';
import db from '../db.js';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import type { Account } from '../../shared/types.js';

const router = Router();
router.use(requireAuth);

function mapAccount(row: Record<string, unknown>): Account {
  return row as unknown as Account;
}

// GET /api/accounts
router.get('/', (req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM accounts WHERE household_id = ? ORDER BY sort_order, name').all(req.householdId!) as Record<string, unknown>[];
  res.json(rows.map(mapAccount));
});

// POST /api/accounts
router.post('/', (req: Request, res: Response) => {
  const { name, sort_order = 0 } = req.body as { name: string; sort_order?: number };
  if (!name?.trim()) {
    res.status(400).json({ message: 'name is required' });
    return;
  }
  const duplicate = db.prepare('SELECT id FROM accounts WHERE name = ? AND household_id = ?').get(name.trim(), req.householdId!);
  if (duplicate) {
    res.status(409).json({ message: `Account named '${name.trim()}' already exists` });
    return;
  }
  const id = randomUUID();
  try {
    db.prepare(
      'INSERT INTO accounts (id, household_id, user_id, name, sort_order) VALUES (?, ?, ?, ?, ?)',
    ).run(id, req.householdId!, req.userId!, name.trim(), sort_order);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }
  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json(mapAccount(row));
});

// PUT /api/accounts/:id
router.put('/:id', (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const { name, sort_order } = req.body as { name?: string; sort_order?: number };
  const existing = db.prepare('SELECT * FROM accounts WHERE id = ? AND household_id = ?').get(id, req.householdId!) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ message: 'Account not found' });
    return;
  }
  if (req.householdRole === 'member' && existing.user_id !== req.userId) {
    res.status(403).json({ message: 'You can only edit your own entries' });
    return;
  }
  if (name !== undefined) {
    const dup = db.prepare('SELECT id FROM accounts WHERE name = ? AND household_id = ? AND id != ?').get(name.trim(), req.householdId!, id);
    if (dup) {
      res.status(409).json({ message: `Account named '${name.trim()}' already exists` });
      return;
    }
  }
  try {
    if (name !== undefined) {
      db.prepare('UPDATE accounts SET name = ? WHERE id = ?').run(name.trim(), id);
    }
    if (sort_order !== undefined) {
      db.prepare('UPDATE accounts SET sort_order = ? WHERE id = ?').run(sort_order, id);
    }
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }
  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Record<string, unknown>;
  res.json(mapAccount(row));
});

// DELETE /api/accounts/:id
router.delete('/:id', (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const existing = db.prepare('SELECT * FROM accounts WHERE id = ? AND household_id = ?').get(id, req.householdId!) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ message: 'Account not found' });
    return;
  }
  if (req.householdRole === 'member' && existing.user_id !== req.userId) {
    res.status(403).json({ message: 'You can only delete your own entries' });
    return;
  }
  try {
    db.prepare('UPDATE expenses SET account_id = NULL WHERE account_id = ?').run(id);
    db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }
  res.status(204).send();
});

export default router;
