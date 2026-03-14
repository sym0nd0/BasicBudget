import { Router } from 'express';
import type { Request, Response } from 'express';
import db from '../db.js';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { filterVisible, canModify } from '../utils/visibility.js';
import { logger } from '../services/logger.js';
import type { SavingsGoal, SavingsTransaction } from '../../shared/types.js';
import { savingsGoalSchema, savingsTransactionSchema } from '../validation/schemas.js';

const router = Router();
router.use(requireAuth);

function mapGoal(row: Record<string, unknown>): SavingsGoal {
  return {
    ...(row as unknown as SavingsGoal),
    auto_contribute: Boolean(row.auto_contribute),
  };
}

function mapTransaction(row: Record<string, unknown>): SavingsTransaction {
  return row as unknown as SavingsTransaction;
}

/**
 * Process automatic monthly contributions for goals with auto_contribute enabled.
 * Creates contribution transactions for any months that have passed since the last contribution
 * where the contribution_day has already occurred.
 */
function processAutoContributions(householdId: string, userId: string): void {
  const goals = db.prepare(
    'SELECT * FROM savings_goals WHERE household_id = ? AND auto_contribute = 1 AND monthly_contribution_pence > 0',
  ).all(householdId) as Record<string, unknown>[];

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  for (const goal of goals) {
    const goalId = goal.id as string;
    const contributionDay = (goal.contribution_day as number) ?? 1;
    const contributionPence = goal.monthly_contribution_pence as number;
    let currentBalance = goal.current_amount_pence as number;

    // Find the latest contribution transaction
    const lastTx = db.prepare(
      `SELECT created_at FROM savings_transactions WHERE savings_goal_id = ? AND type = 'contribution' ORDER BY created_at DESC LIMIT 1`,
    ).get(goalId) as Record<string, unknown> | undefined;

    let fromYear: number;
    let fromMonth: number;

    if (lastTx) {
      const lastDate = new Date(lastTx.created_at as string);
      fromYear = lastDate.getFullYear();
      fromMonth = lastDate.getMonth() + 1;
      // Start from the month after the last contribution
      fromMonth += 1;
      if (fromMonth > 12) { fromMonth = 1; fromYear++; }
    } else {
      // Use created_at of the goal
      const goalDate = new Date(goal.created_at as string);
      fromYear = goalDate.getFullYear();
      fromMonth = goalDate.getMonth() + 1;
    }

    // Generate contributions for each month up to current
    const insertTx = db.prepare(`
      INSERT INTO savings_transactions (id, savings_goal_id, household_id, user_id, type, amount_pence, balance_after_pence, notes, created_at)
      VALUES (?, ?, ?, ?, 'contribution', ?, ?, NULL, ?)
    `);
    const updateBalance = db.prepare(
      `UPDATE savings_goals SET current_amount_pence = ?, updated_at = datetime('now') WHERE id = ?`,
    );

    const runMigration = db.transaction(() => {
      let y = fromYear;
      let m = fromMonth;

      while (y < currentYear || (y === currentYear && m <= currentMonth)) {
        // Only contribute if the contribution_day has passed in this month
        const isCurrentMonth = y === currentYear && m === currentMonth;
        if (isCurrentMonth && currentDay < contributionDay) break;

        const createdAt = `${y}-${String(m).padStart(2, '0')}-${String(contributionDay).padStart(2, '0')} 00:00:00`;
        currentBalance += contributionPence;
        insertTx.run(randomUUID(), goalId, householdId, userId, contributionPence, currentBalance, createdAt);
        updateBalance.run(currentBalance, goalId);

        m++;
        if (m > 12) { m = 1; y++; }
      }
    });

    try {
      runMigration();
    } catch {
      // If contribution processing fails for one goal, continue with others
    }
  }
}

// GET /api/savings-goals
router.get('/', (req: Request, res: Response) => {
  processAutoContributions(req.householdId!, req.userId!);
  const rows = db.prepare('SELECT * FROM savings_goals WHERE household_id = ? ORDER BY created_at').all(req.householdId!) as Record<string, unknown>[];
  const visible = filterVisible(rows, req.userId!);
  res.json(visible.map(mapGoal));
});

// GET /api/savings-goals/transactions?from=YYYY-MM&to=YYYY-MM
// IMPORTANT: Must be registered BEFORE /:id routes to avoid ambiguity
router.get('/transactions', (req: Request, res: Response) => {
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  let query = `
    SELECT t.*, g.name as goal_name
    FROM savings_transactions t
    JOIN savings_goals g ON g.id = t.savings_goal_id
    WHERE t.household_id = ?
  `;
  const params: unknown[] = [req.householdId!];

  if (from) {
    query += ` AND t.created_at >= ?`;
    params.push(`${from}-01`);
  }
  if (to) {
    query += ` AND t.created_at < ?`;
    // Add one month to get the end of the 'to' month
    const [ty, tm] = to.split('-').map(Number);
    const nextMonth = tm === 12 ? `${ty + 1}-01` : `${ty}-${String(tm + 1).padStart(2, '0')}`;
    params.push(`${nextMonth}-01`);
  }

  query += ` ORDER BY t.created_at DESC`;

  const rows = db.prepare(query).all(...params) as Record<string, unknown>[];
  res.json(rows.map(mapTransaction));
});

// POST /api/savings-goals
router.post('/', (req: Request, res: Response) => {
  const result = savingsGoalSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: 'Validation error' });
    return;
  }
  const body = result.data;
  if (!body.name?.trim()) {
    res.status(400).json({ message: 'name is required' });
    return;
  }
  if (body.target_amount_pence !== undefined && (typeof body.target_amount_pence !== 'number' || body.target_amount_pence < 0)) {
    res.status(400).json({ message: 'target_amount_pence must be a non-negative integer' });
    return;
  }
  const rawBody = req.body as Partial<SavingsGoal>;
  const id = randomUUID();
  try {
    db.prepare(`
      INSERT INTO savings_goals
        (id, household_id, user_id, contributor_user_id, name, target_amount_pence, current_amount_pence, monthly_contribution_pence, is_household, target_date, notes, auto_contribute, contribution_day)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.householdId!,
      req.userId!,
      body.contributor_user_id ?? null,
      body.name.trim(),
      body.target_amount_pence ?? 0,
      rawBody.current_amount_pence ?? 0,
      rawBody.monthly_contribution_pence ?? 0,
      rawBody.is_household ? 1 : 0,
      rawBody.target_date ?? null,
      body.notes ?? null,
      body.auto_contribute ? 1 : 0,
      body.contribution_day ?? 1,
    );
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }
  const row = db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(id) as Record<string, unknown>;
  logger.info('Savings goal created', { id, userId: req.userId, name: body.name.trim() });
  res.status(201).json(mapGoal(row));
});

// GET /api/savings-goals/:id/transactions?from=YYYY-MM&to=YYYY-MM
router.get('/:id/transactions', (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  const goal = db.prepare('SELECT * FROM savings_goals WHERE id = ? AND household_id = ?').get(id, req.householdId!) as Record<string, unknown> | undefined;
  if (!goal) {
    res.status(404).json({ message: 'Savings goal not found' });
    return;
  }

  let query = `SELECT * FROM savings_transactions WHERE savings_goal_id = ? AND household_id = ?`;
  const params: unknown[] = [id, req.householdId!];

  if (from) {
    query += ` AND created_at >= ?`;
    params.push(`${from}-01`);
  }
  if (to) {
    const [ty, tm] = to.split('-').map(Number);
    const nextMonth = tm === 12 ? `${ty + 1}-01` : `${ty}-${String(tm + 1).padStart(2, '0')}`;
    query += ` AND created_at < ?`;
    params.push(`${nextMonth}-01`);
  }

  query += ` ORDER BY created_at DESC`;

  const rows = db.prepare(query).all(...params) as Record<string, unknown>[];
  res.json(rows.map(mapTransaction));
});

// POST /api/savings-goals/:id/transactions
router.post('/:id/transactions', (req: Request, res: Response) => {
  const id = req.params['id'] as string;

  const result = savingsTransactionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: 'Validation error', errors: result.error.issues });
    return;
  }
  const body = result.data;

  const goal = db.prepare('SELECT * FROM savings_goals WHERE id = ? AND household_id = ?').get(id, req.householdId!) as Record<string, unknown> | undefined;
  if (!goal) {
    res.status(404).json({ message: 'Savings goal not found' });
    return;
  }

  const currentBalance = goal.current_amount_pence as number;
  let newBalance: number;

  if (body.type === 'withdrawal') {
    if (body.amount_pence > currentBalance) {
      res.status(400).json({ message: 'Withdrawal amount exceeds current savings balance' });
      return;
    }
    newBalance = currentBalance - body.amount_pence;
  } else {
    // contribution or deposit
    newBalance = currentBalance + body.amount_pence;
  }

  const txId = randomUUID();

  try {
    db.transaction(() => {
      db.prepare(`
        INSERT INTO savings_transactions (id, savings_goal_id, household_id, user_id, type, amount_pence, balance_after_pence, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(txId, id, req.householdId!, req.userId!, body.type, body.amount_pence, newBalance, body.notes ?? null);

      db.prepare(`UPDATE savings_goals SET current_amount_pence = ?, updated_at = datetime('now') WHERE id = ?`).run(newBalance, id);
    })();
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }

  const row = db.prepare('SELECT * FROM savings_transactions WHERE id = ?').get(txId) as Record<string, unknown>;
  logger.info('Savings transaction created', { id: txId, goalId: id, type: body.type, userId: req.userId });
  res.status(201).json(mapTransaction(row));
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
  if (!canModify(existing, req.userId!)) {
    res.status(403).json({ message: 'You can only edit your own entries' });
    return;
  }
  try {
    db.prepare(`
      UPDATE savings_goals SET
        name = ?, contributor_user_id = ?, target_amount_pence = ?, current_amount_pence = ?,
        monthly_contribution_pence = ?, is_household = ?, target_date = ?, notes = ?,
        auto_contribute = ?, contribution_day = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      body.name?.trim() ?? existing.name,
      body.contributor_user_id !== undefined ? body.contributor_user_id : existing.contributor_user_id,
      body.target_amount_pence ?? existing.target_amount_pence,
      body.current_amount_pence ?? existing.current_amount_pence,
      body.monthly_contribution_pence ?? existing.monthly_contribution_pence,
      body.is_household !== undefined ? (body.is_household ? 1 : 0) : existing.is_household,
      body.target_date !== undefined ? body.target_date : existing.target_date,
      body.notes !== undefined ? body.notes : existing.notes,
      body.auto_contribute !== undefined ? (body.auto_contribute ? 1 : 0) : existing.auto_contribute,
      body.contribution_day !== undefined ? body.contribution_day : existing.contribution_day,
      id,
    );
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }
  const row = db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(id) as Record<string, unknown>;
  logger.info('Savings goal updated', { id, userId: req.userId });
  res.json(mapGoal(row));
});

// DELETE /api/savings-goals/:id
router.delete('/:id', (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const existing = db.prepare('SELECT * FROM savings_goals WHERE id = ? AND household_id = ?').get(id, req.householdId!) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ message: 'Savings goal not found' });
    return;
  }
  if (!canModify(existing, req.userId!)) {
    res.status(403).json({ message: 'You can only delete your own entries' });
    return;
  }
  try {
    db.prepare('DELETE FROM savings_goals WHERE id = ?').run(id);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }
  logger.info('Savings goal deleted', { id, userId: req.userId });
  res.status(204).send();
});

export default router;
