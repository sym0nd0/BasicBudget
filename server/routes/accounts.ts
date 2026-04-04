import { Router } from 'express';
import type { Request, Response } from 'express';
import db from '../db.js';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { logValidationFailure } from '../middleware/validate.js';
import { canModify } from '../utils/visibility.js';
import { logger } from '../services/logger.js';
import type { Account } from '../../shared/types.js';
import { accountSchema } from '../validation/schemas.js';

const router = Router();
router.use(requireAuth);

function mapAccount(row: Record<string, unknown>): Account {
  return { ...(row as unknown as Account), is_joint: Boolean(row.is_joint) };
}

// GET /api/accounts
router.get('/', (req: Request, res: Response) => {
  // Return accounts owned by the user OR joint accounts in the household
  const rows = db.prepare(
    'SELECT * FROM accounts WHERE household_id = ? AND (user_id = ? OR is_joint = 1) ORDER BY sort_order, name'
  ).all(req.householdId!, req.userId!) as Record<string, unknown>[];
  res.json(rows.map(mapAccount));
});

// POST /api/accounts
router.post('/', (req: Request, res: Response) => {
  const parseResult = accountSchema.safeParse(req.body);
  if (!parseResult.success) {
    logValidationFailure(req, parseResult.error.issues, 'account.create');
    res.status(400).json({ message: 'Validation error' });
    return;
  }
  const { name, sort_order = 0, is_joint = false } = parseResult.data;
  const duplicate = db.prepare('SELECT id FROM accounts WHERE name = ? AND household_id = ?').get(name.trim(), req.householdId!);
  if (duplicate) {
    res.status(409).json({ message: `Account named '${name.trim()}' already exists` });
    return;
  }
  const id = randomUUID();
  try {
    db.prepare(
      'INSERT INTO accounts (id, household_id, user_id, name, sort_order, is_joint) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(id, req.householdId!, req.userId!, name.trim(), sort_order, is_joint ? 1 : 0);
  } catch (err) {
    logger.error('Failed to save account', { request_id: req.requestId, id, userId: req.userId, error: err });
    res.status(500).json({ message: 'Internal server error' });
    return;
  }
  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Record<string, unknown>;
  logger.info('Account created', { request_id: req.requestId, id, userId: req.userId });
  res.status(201).json(mapAccount(row));
});

// PUT /api/accounts/:id
router.put('/:id', (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const parseResult = accountSchema.partial().safeParse(req.body);
  if (!parseResult.success) {
    logValidationFailure(req, parseResult.error.issues, 'account.update');
    res.status(400).json({ message: 'Validation error' });
    return;
  }
  const { name, sort_order, is_joint } = parseResult.data;
  const existing = db.prepare('SELECT * FROM accounts WHERE id = ? AND household_id = ?').get(id, req.householdId!) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ message: 'Account not found' });
    return;
  }
  if (!canModify(existing, req.userId!)) {
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
    if (is_joint !== undefined) {
      db.prepare('UPDATE accounts SET is_joint = ? WHERE id = ?').run(is_joint ? 1 : 0, id);
    }
  } catch (err) {
    logger.error('Failed to update account', { request_id: req.requestId, id, userId: req.userId, error: err });
    res.status(500).json({ message: 'Internal server error' });
    return;
  }
  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Record<string, unknown>;
  logger.info('Account updated', { request_id: req.requestId, id, userId: req.userId });
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
    logger.error('Failed to delete account', { request_id: req.requestId, id, userId: req.userId, error: err });
    res.status(500).json({ message: 'Internal server error' });
    return;
  }
  logger.info('Account deleted', { request_id: req.requestId, id, userId: req.userId });
  res.status(204).send();
});

export default router;
