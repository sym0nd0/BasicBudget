import { Router } from 'express';
import type { Request, Response } from 'express';
import db from '../db.js';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { filterVisible, canModify } from '../utils/visibility.js';
import { logger } from '../services/logger.js';
import type { SavingsGoal } from '../../shared/types.js';
import { savingsGoalSchema, savingsTransactionSchema } from '../validation/schemas.js';

const router = Router();
router.use(requireAuth);

function mapGoal(row: Record<string, unknown>): SavingsGoal {
  return row as unknown as SavingsGoal;
}

function processAutoContributions(householdId: string, userId: string): void {
  const now = new Date();
  const todayDay = now.getDate();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const goals = db.prepare(
    "SELECT * FROM savings_goals WHERE household_id = ? AND auto_contribute = 1 AND monthly_contribution_pence > 0"
  ).all(householdId) as Record<string, unknown>[];

  const insertTx = db.prepare(`
    INSERT OR IGNORE INTO savings_transactions (id, savings_goal_id, household_id, user_id, type, amount_pence, balance_after_pence, notes, created_at)
    VALUES (?, ?, ?, ?, 'contribution', ?, ?, 'Auto-contribution', ?)
  `);
  const updateGoal = db.prepare("UPDATE savings_goals SET current_amount_pence = ?, updated_at = datetime('now') WHERE id = ?");

  const doProcess = db.transaction(() => {
    for (const goal of goals) {
      const goalId = goal.id as string;
      const contribDay = (goal.contribution_day as number) ?? 1;
      const monthly = goal.monthly_contribution_pence as number;

      const latest = db.prepare(
        "SELECT created_at FROM savings_transactions WHERE savings_goal_id = ? AND type = 'contribution' ORDER BY created_at DESC LIMIT 1"
      ).get(goalId) as { created_at: string } | undefined;

      const lastDate = latest ? new Date(latest.created_at) : new Date(goal.created_at as string);
      const lastYM = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}`;

      let [y, m] = lastYM.split('-').map(Number);
      let balance = goal.current_amount_pence as number;

      m++;
      if (m > 12) { m = 1; y++; }

      while (true) {
        const ym = `${y}-${String(m).padStart(2, '0')}`;
        if (ym > currentYM) break;
        if (ym === currentYM && todayDay < contribDay) break;

        balance += monthly;
        const txId = randomUUID();
        const createdAt = `${ym}-${String(contribDay).padStart(2, '0')} 00:00:00`;
        const result = insertTx.run(txId, goalId, householdId, userId, monthly, balance, createdAt);
        if (result.changes === 0) {
          // Duplicate skipped — re-sync balance from the existing row for this month
          const existing = db.prepare(
            "SELECT balance_after_pence FROM savings_transactions WHERE savings_goal_id = ? AND substr(created_at, 1, 7) = ? AND type = 'contribution'"
          ).get(goalId, ym) as { balance_after_pence: number } | undefined;
          if (existing) balance = existing.balance_after_pence;
        } else {
          updateGoal.run(balance, goalId);
        }

        m++;
        if (m > 12) { m = 1; y++; }
      }
    }
  });

  doProcess();
}

// GET /api/savings-goals/transactions — must be before /:id routes
router.get('/transactions', (req: Request, res: Response) => {
  processAutoContributions(req.householdId!, req.userId!);
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  let sql = `
    SELECT t.*, g.name as goal_name
    FROM savings_transactions t
    JOIN savings_goals g ON g.id = t.savings_goal_id
    WHERE t.household_id = ?
  `;
  const params: unknown[] = [req.householdId!];

  if (from) { sql += ' AND substr(t.created_at, 1, 7) >= ?'; params.push(from); }
  if (to)   { sql += ' AND substr(t.created_at, 1, 7) <= ?'; params.push(to); }
  sql += ' ORDER BY t.created_at DESC';

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  res.json(rows);
});

// GET /api/savings-goals
router.get('/', (req: Request, res: Response) => {
  processAutoContributions(req.householdId!, req.userId!);
  const rows = db.prepare('SELECT * FROM savings_goals WHERE household_id = ? ORDER BY created_at').all(req.householdId!) as Record<string, unknown>[];
  const visible = filterVisible(rows, req.userId!);
  let goals = visible.map(mapGoal);

  const month = req.query['month'] as string | undefined;
  if (month) {
    const stmt = db.prepare(`
      SELECT balance_after_pence
      FROM savings_transactions
      WHERE savings_goal_id = ? AND strftime('%Y-%m', created_at) <= ?
      ORDER BY created_at DESC
      LIMIT 1
    `);

    goals = goals.map(goal => {
      const tx = stmt.get(goal.id, month) as { balance_after_pence: number } | undefined;
      return { ...goal, current_amount_pence: tx?.balance_after_pence ?? goal.current_amount_pence };
    });
  }

  res.json(goals);
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
  const openingBalance = rawBody.current_amount_pence ?? 0;
  try {
    db.transaction(() => {
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
        openingBalance,
        rawBody.monthly_contribution_pence ?? 0,
        rawBody.is_household ? 1 : 0,
        rawBody.target_date ?? null,
        body.notes ?? null,
        body.auto_contribute ? 1 : 0,
        body.contribution_day ?? 1,
      );
      // Insert opening snapshot so month-scoped queries can resolve the initial balance
      db.prepare(`
        INSERT INTO savings_transactions (id, savings_goal_id, household_id, user_id, type, amount_pence, balance_after_pence, notes)
        VALUES (?, ?, ?, ?, 'deposit', ?, ?, 'Opening balance')
      `).run(randomUUID(), id, req.householdId!, req.userId!, openingBalance, openingBalance);
    })();
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }
  const row = db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(id) as Record<string, unknown>;
  logger.info('Savings goal created', { id, userId: req.userId, name: body.name.trim() });
  res.status(201).json(mapGoal(row));
});

// GET /api/savings-goals/:id/transactions
router.get('/:id/transactions', (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const goal = db.prepare('SELECT * FROM savings_goals WHERE id = ? AND household_id = ?').get(id, req.householdId!) as Record<string, unknown> | undefined;
  if (!goal) { res.status(404).json({ message: 'Savings goal not found' }); return; }

  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  let sql = 'SELECT * FROM savings_transactions WHERE savings_goal_id = ?';
  const params: unknown[] = [id];
  if (from) { sql += ' AND substr(created_at, 1, 7) >= ?'; params.push(from); }
  if (to)   { sql += ' AND substr(created_at, 1, 7) <= ?'; params.push(to); }
  sql += ' ORDER BY created_at DESC';

  res.json(db.prepare(sql).all(...params));
});

// POST /api/savings-goals/:id/transactions
router.post('/:id/transactions', (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const result = savingsTransactionSchema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ message: 'Validation error' }); return; }

  const existing = db.prepare('SELECT * FROM savings_goals WHERE id = ? AND household_id = ?').get(id, req.householdId!) as Record<string, unknown> | undefined;
  if (!existing) { res.status(404).json({ message: 'Savings goal not found' }); return; }
  if (!canModify(existing, req.userId!)) { res.status(403).json({ message: 'You can only modify your own entries' }); return; }

  const { type, amount_pence, notes } = result.data;
  const currentBalance = existing.current_amount_pence as number;
  let newBalance: number;

  if (type === 'withdrawal') {
    if (amount_pence > currentBalance) { res.status(400).json({ message: 'Withdrawal amount exceeds current balance' }); return; }
    newBalance = currentBalance - amount_pence;
  } else {
    newBalance = currentBalance + amount_pence;
  }

  const txId = randomUUID();
  const doInsert = db.transaction(() => {
    db.prepare(`
      INSERT INTO savings_transactions (id, savings_goal_id, household_id, user_id, type, amount_pence, balance_after_pence, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(txId, id, req.householdId!, req.userId!, type, amount_pence, newBalance, notes ?? null);
    db.prepare("UPDATE savings_goals SET current_amount_pence = ?, updated_at = datetime('now') WHERE id = ?").run(newBalance, id);
  });
  doInsert();

  const tx = db.prepare('SELECT * FROM savings_transactions WHERE id = ?').get(txId);
  logger.info('Savings transaction created', { id: txId, goalId: id, type, userId: req.userId });
  res.status(201).json(tx);
});

// PUT /api/savings-goals/:id
router.put('/:id', (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const parseResult = savingsGoalSchema.partial().safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ message: 'Validation error' });
    return;
  }
  const body = parseResult.data;
  const existing = db.prepare('SELECT * FROM savings_goals WHERE id = ? AND household_id = ?').get(id, req.householdId!) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ message: 'Savings goal not found' });
    return;
  }
  if (!canModify(existing, req.userId!)) {
    res.status(403).json({ message: 'You can only edit your own entries' });
    return;
  }
  const newBalance = body.current_amount_pence !== undefined
    ? body.current_amount_pence
    : (existing.current_amount_pence as number);
  const balanceChanged = body.current_amount_pence !== undefined && body.current_amount_pence !== existing.current_amount_pence;
  try {
    db.transaction(() => {
      db.prepare(`
        UPDATE savings_goals SET
          name = ?, contributor_user_id = ?, target_amount_pence = ?, current_amount_pence = ?,
          monthly_contribution_pence = ?, is_household = ?, target_date = ?, notes = ?,
          auto_contribute = ?, contribution_day = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(
        body.name?.trim() ?? existing.name,
        body.contributor_user_id !== undefined ? body.contributor_user_id : existing.contributor_user_id,
        body.target_amount_pence ?? existing.target_amount_pence,
        newBalance,
        body.monthly_contribution_pence ?? existing.monthly_contribution_pence,
        body.is_household ?? existing.is_household,
        body.target_date !== undefined ? body.target_date : existing.target_date,
        body.notes !== undefined ? body.notes : existing.notes,
        body.auto_contribute ?? existing.auto_contribute,
        body.contribution_day ?? existing.contribution_day,
        id,
      );
      if (balanceChanged) {
        // Insert snapshot so month-scoped queries reflect the updated balance
        db.prepare(`
          INSERT INTO savings_transactions (id, savings_goal_id, household_id, user_id, type, amount_pence, balance_after_pence, notes)
          VALUES (?, ?, ?, ?, 'deposit', ?, ?, 'Balance updated')
        `).run(randomUUID(), id, req.householdId!, req.userId!, newBalance, newBalance);
      }
    })();
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
