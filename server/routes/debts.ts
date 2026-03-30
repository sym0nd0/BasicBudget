import { Router } from 'express';
import type { Request, Response } from 'express';
import db from '../db.js';
import { randomUUID } from 'node:crypto';
import { isMonthLocked } from './months.js';
import { filterVisible, canModify } from '../utils/visibility.js';
import { filterActiveInMonth, currentYearMonth, mapDebtToRecurringItem } from '../utils/recurring.js';
import { requireAuth } from '../middleware/auth.js';
import type { Debt, DebtDealPeriod } from '../../shared/types.js';
import { logger } from '../services/logger.js';
import { computeRepayments, getMonthlyRateForDate } from '../utils/debtRepayments.js';
import { debtSchema } from '../validation/schemas.js';

const router = Router();
router.use(requireAuth);

function mapDebt(row: Record<string, unknown>): Debt {
  return {
    ...(row as Omit<Debt, 'is_recurring' | 'is_household'>),
    is_recurring: Boolean(row.is_recurring),
    is_household: Boolean(row.is_household),
  };
}

function enrichDebtWithPeriods(debt: Debt): Debt {
  const periods = db.prepare('SELECT * FROM debt_deal_periods WHERE debt_id = ? ORDER BY start_date').all(debt.id) as DebtDealPeriod[];
  return { ...debt, deal_periods: periods };
}

function monthsAgo(current: string, target: string): number {
  const [cy, cm] = current.split('-').map(Number);
  const [ty, tm] = target.split('-').map(Number);
  return (cy - ty) * 12 + (cm - tm);
}

function estimatedBalanceNMonthsAgo(
  debt: Debt,
  monthlyPayment: number,
  n: number,
): number {
  const now = new Date();
  let b = debt.balance_pence;
  for (let i = 0; i < n; i++) {
    // Walk backwards: month i steps before today
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const dayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const monthlyRate = getMonthlyRateForDate(debt, dayStr);
    b = monthlyRate === 0
      ? b + monthlyPayment
      : (b + monthlyPayment) / (1 + monthlyRate);
  }
  return Math.round(b);
}

// GET /api/debts  or  GET /api/debts?month=YYYY-MM
router.get('/', (req: Request, res: Response) => {
  const month = req.query['month'] as string | undefined;

  const rows = db.prepare('SELECT * FROM debts WHERE household_id = ? ORDER BY created_at').all(req.householdId!) as Record<string, unknown>[];
  const visible = filterVisible(rows, req.userId!);
  let debts = visible.map(mapDebt).map(enrichDebtWithPeriods);

  if (month) {
    const recurringItems = visible.map(mapDebtToRecurringItem);
    const activeItems = filterActiveInMonth(recurringItems, month);
    const activeItemMap = new Map(activeItems.map(item => [item.id as string, item]));

    const activeDebts = debts.filter(d => activeItemMap.has(d.id));
    const n = monthsAgo(currentYearMonth(), month);

    debts = n <= 0
      ? activeDebts.map(debt => ({ ...debt, effective_pence: activeItemMap.get(debt.id)!.effective_pence }))
      : activeDebts.map(debt => {
          const activeItem = activeItemMap.get(debt.id)!;
          return {
            ...debt,
            effective_pence: activeItem.effective_pence,
            balance_pence: estimatedBalanceNMonthsAgo(debt, activeItem.effective_pence, n),
          };
        });
  }

  res.json(debts);
});

// POST /api/debts
router.post('/', (req: Request, res: Response) => {
  const result = debtSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: 'Validation error' });
    return;
  }
  const body = result.data;
  const isHousehold = Boolean(body.is_household);
  const splitRatio = isHousehold ? 0.5 : 1.0;
  const id = randomUUID();
  const dealPeriods = (body.deal_periods ?? []) as Omit<DebtDealPeriod, 'id' | 'debt_id' | 'created_at'>[];
  const reminderMonths = body.reminder_months ?? 0;
  const nameValue = body.name.trim();
  const recurrenceType = body.recurrence_type ?? 'monthly';

  // Validate deal periods don't extend past debt end date
  if (body.end_date) {
    for (const period of dealPeriods) {
      if (period.start_date > body.end_date) {
        res.status(400).json({ message: `Deal period cannot start after debt end date (${body.end_date})` });
        return;
      }
      if (period.end_date && period.end_date > body.end_date) {
        res.status(400).json({ message: `Deal period cannot end after debt end date (${body.end_date})` });
        return;
      }
    }
  }

  try {
    db.transaction(() => {
      db.prepare(`
        INSERT INTO debts
          (id, household_id, user_id, contributor_user_id, name, balance_pence, interest_rate, minimum_payment_pence,
           overpayment_pence, compounding_frequency, is_recurring, recurrence_type,
           posting_day, start_date, end_date, is_household, split_ratio, notes, reminder_months)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        req.householdId!,
        req.userId!,
        body.contributor_user_id ?? null,
        nameValue,
        body.balance_pence,
        body.interest_rate ?? 0,
        body.minimum_payment_pence ?? 0,
        body.overpayment_pence ?? 0,
        body.compounding_frequency ?? 'monthly',
        body.is_recurring ? 1 : 0,
        recurrenceType,
        body.posting_day ?? 1,
        body.start_date ?? null,
        body.end_date ?? null,
        isHousehold ? 1 : 0,
        splitRatio,
        body.notes ?? null,
        reminderMonths,
      );

      // Insert deal periods with auto-generated labels
      for (let i = 0; i < dealPeriods.length; i++) {
        const period = dealPeriods[i];
        const periodId = randomUUID();
        const label = `Period ${i + 1}`;
        db.prepare(`
          INSERT INTO debt_deal_periods (id, debt_id, label, interest_rate, start_date, end_date)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(periodId, id, label, period.interest_rate, period.start_date, period.end_date ?? null);
      }

      // Record initial balance snapshot (inside transaction so debt + snapshot are atomic)
      const today = new Date().toISOString().slice(0, 10);
      db.prepare('INSERT INTO debt_balance_snapshots (id, debt_id, household_id, balance_pence, recorded_at) VALUES (?, ?, ?, ?, ?)')
        .run(randomUUID(), id, req.householdId!, body.balance_pence, today);
    })();
  } catch (err) {
    logger.error('Failed to save debt', { error: err });
    res.status(500).json({ message: 'Failed to save debt' });
    return;
  }
  const row = db.prepare('SELECT * FROM debts WHERE id = ?').get(id) as Record<string, unknown>;

  logger.info('Debt created', { id, userId: req.userId, name: nameValue });
  res.status(201).json(enrichDebtWithPeriods(mapDebt(row)));
});

// PUT /api/debts/:id
router.put('/:id', (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const result = debtSchema.partial().safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: 'Validation error' });
    return;
  }
  const body = result.data;
  const existing = db.prepare('SELECT * FROM debts WHERE id = ? AND household_id = ?').get(id, req.householdId!) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ message: 'Debt not found' });
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
  const updIsHousehold = body.is_household !== undefined ? Boolean(body.is_household) : Boolean(existing.is_household);
  const updSplitRatio = updIsHousehold ? 0.5 : 1.0;
  const dealPeriods = (body.deal_periods ?? []) as Omit<DebtDealPeriod, 'id' | 'debt_id' | 'created_at'>[];
  const reminderMonths = body.reminder_months !== undefined ? body.reminder_months : existing.reminder_months;
  const endDate = body.end_date !== undefined ? body.end_date : (existing.end_date as string | null);

  // Validate deal periods don't extend past debt end date
  if (endDate) {
    for (const period of dealPeriods) {
      if (period.start_date > endDate) {
        res.status(400).json({ message: `Deal period cannot start after debt end date (${endDate})` });
        return;
      }
      if (period.end_date && period.end_date > endDate) {
        res.status(400).json({ message: `Deal period cannot end after debt end date (${endDate})` });
        return;
      }
    }
  }

  const balanceChanged = body.balance_pence !== undefined && body.balance_pence !== existing.balance_pence;

  try {
    db.transaction(() => {
      db.prepare(`
        UPDATE debts SET
          name = ?, contributor_user_id = ?, balance_pence = ?, interest_rate = ?,
          minimum_payment_pence = ?, overpayment_pence = ?,
          compounding_frequency = ?, is_recurring = ?, recurrence_type = ?,
          posting_day = ?, start_date = ?, end_date = ?,
          is_household = ?, split_ratio = ?, notes = ?, reminder_months = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        body.name?.trim() ?? existing.name,
        body.contributor_user_id !== undefined ? body.contributor_user_id : existing.contributor_user_id,
        body.balance_pence ?? existing.balance_pence,
        body.interest_rate ?? existing.interest_rate,
        body.minimum_payment_pence ?? existing.minimum_payment_pence,
        body.overpayment_pence ?? existing.overpayment_pence,
        body.compounding_frequency ?? existing.compounding_frequency,
        body.is_recurring !== undefined ? (body.is_recurring ? 1 : 0) : existing.is_recurring,
        body.recurrence_type ?? existing.recurrence_type,
        body.posting_day ?? existing.posting_day,
        body.start_date !== undefined ? body.start_date : existing.start_date,
        body.end_date !== undefined ? body.end_date : existing.end_date,
        updIsHousehold ? 1 : 0,
        updSplitRatio,
        body.notes !== undefined ? body.notes : existing.notes,
        reminderMonths,
        id,
      );

      // Record snapshot if balance changed
      if (balanceChanged) {
        const today = new Date().toISOString().slice(0, 10);
        db.prepare('INSERT INTO debt_balance_snapshots (id, debt_id, household_id, balance_pence, recorded_at) VALUES (?, ?, ?, ?, ?)')
          .run(randomUUID(), id, req.householdId!, body.balance_pence, today);
      }

      // Replace all deal periods with new ones (auto-generate labels based on index)
      db.prepare('DELETE FROM debt_deal_periods WHERE debt_id = ?').run(id);
      for (let i = 0; i < dealPeriods.length; i++) {
        const period = dealPeriods[i];
        const periodId = randomUUID();
        const label = `Period ${i + 1}`;
        db.prepare(`
          INSERT INTO debt_deal_periods (id, debt_id, label, interest_rate, start_date, end_date)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(periodId, id, label, period.interest_rate, period.start_date, period.end_date ?? null);
      }
    })();
  } catch (err) {
    logger.error('Failed to save debt', { error: err });
    res.status(500).json({ message: 'Failed to save debt' });
    return;
  }
  const row = db.prepare('SELECT * FROM debts WHERE id = ?').get(id) as Record<string, unknown>;
  logger.info('Debt updated', { id, userId: req.userId });
  res.json(enrichDebtWithPeriods(mapDebt(row)));
});

// DELETE /api/debts/:id
router.delete('/:id', (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const existing = db.prepare('SELECT * FROM debts WHERE id = ? AND household_id = ?').get(id, req.householdId!) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ message: 'Debt not found' });
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
    db.prepare('DELETE FROM debts WHERE id = ?').run(id);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }
  logger.info('Debt deleted', { id, userId: req.userId });
  res.status(204).send();
});

// GET /api/debts/:id/repayments
router.get('/:id/repayments', (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const row = db.prepare('SELECT * FROM debts WHERE id = ? AND household_id = ?').get(id, req.householdId!) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ message: 'Debt not found' });
    return;
  }
  const debt = enrichDebtWithPeriods(mapDebt(row));
  const summary = computeRepayments(debt);
  res.json(summary);
});

export default router;
