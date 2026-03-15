import { Router } from 'express';
import type { Request, Response } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { filterVisible } from '../utils/visibility.js';
import { filterActiveInMonth, mapDebtToRecurringItem, type RecurringItem } from '../utils/recurring.js';
import { computeRepayments } from './debts.js';
import { computePayoffStrategy } from '../utils/debtPayoffStrategy.js';
import type { Debt, DebtDealPeriod, CategoryBreakdown, MonthlyReportRow, DebtProjectionPoint } from '../../shared/types.js';

const router = Router();
router.use(requireAuth);

function getEnrichedDebts(householdId: string, userId: string, householdOnly: boolean): Debt[] {
  const rawDebts = db.prepare('SELECT * FROM debts WHERE household_id = ?').all(householdId) as Record<string, unknown>[];
  return filterVisible(rawDebts, userId)
    .filter(row => !householdOnly || Boolean(row.is_household))
    .map(row => {
      const debt = row as Omit<Debt, 'is_recurring' | 'is_household'>;
      const periods = db.prepare('SELECT * FROM debt_deal_periods WHERE debt_id = ? ORDER BY start_date').all(debt.id) as DebtDealPeriod[];
      return {
        ...debt,
        is_recurring: Boolean(row.is_recurring),
        is_household: Boolean(row.is_household),
        deal_periods: periods,
      } as Debt;
    });
}

/** Generate YYYY-MM strings between from and to (inclusive) */
function monthRange(from: string, to: string): string[] {
  const months: string[] = [];
  let [y, m] = from.split('-').map(Number);
  const [ey, em] = to.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

// GET /api/reports/overview?from=YYYY-MM&to=YYYY-MM
router.get('/overview', (req: Request, res: Response) => {
  const from = (req.query.from as string) ?? '';
  const to = (req.query.to as string) ?? '';
  if (!from || !to) {
    res.status(400).json({ message: 'from and to are required' });
    return;
  }

  const months = monthRange(from, to);
  if (months.length > 120) {
    res.status(400).json({ message: 'Range too large (max 120 months)' });
    return;
  }

  const rawIncomes = db.prepare('SELECT * FROM incomes WHERE household_id = ?').all(req.householdId!) as Record<string, unknown>[];
  const rawExpenses = db.prepare('SELECT * FROM expenses WHERE household_id = ?').all(req.householdId!) as Record<string, unknown>[];
  const rawDebts = db.prepare('SELECT * FROM debts WHERE household_id = ?').all(req.householdId!) as Record<string, unknown>[];
  const rawSavings = db.prepare('SELECT * FROM savings_goals WHERE household_id = ?').all(req.householdId!) as Record<string, unknown>[];

  const allIncomes = filterVisible(rawIncomes, req.userId!) as unknown as RecurringItem[];
  const allExpenses = filterVisible(rawExpenses, req.userId!) as unknown as RecurringItem[];
  const allDebtRows = filterVisible(rawDebts, req.userId!);
  const allSavings = filterVisible(rawSavings, req.userId!);

  const memberCount = (db.prepare('SELECT COUNT(*) as c FROM household_members WHERE household_id = ?').get(req.householdId!) as { c: number }).c || 1;
  const debtItems = allDebtRows.map(mapDebtToRecurringItem);

  const householdOnly = req.query.household_only === 'true';

  const rows: MonthlyReportRow[] = months.map(month => {
    const activeIncomes = filterActiveInMonth(allIncomes, month);
    const activeExpenses = filterActiveInMonth(allExpenses, month);
    const activeDebts = filterActiveInMonth(debtItems, month);

    const income_pence = activeIncomes.reduce((s, i) => s + (i.effective_pence ?? 0), 0);
    const expenses_pence = householdOnly
      ? activeExpenses.filter(e => Boolean(e.is_household)).reduce((s, e) => s + (e.effective_pence ?? 0), 0)
      : activeExpenses.reduce((s, e) => s + Math.round((e.effective_pence ?? 0) * ((e.split_ratio as number) ?? 1)), 0);
    const debt_payments_pence = householdOnly
      ? activeDebts.filter(d => Boolean(d.is_household)).reduce((s, d) => s + (d.effective_pence ?? 0), 0)
      : activeDebts.reduce((s, d) => s + Math.round((d.effective_pence ?? 0) * ((d.split_ratio as number) ?? 1)), 0);

    let savings_pence = 0;
    for (const s of allSavings) {
      const c = (s.monthly_contribution_pence as number) ?? 0;
      savings_pence += Boolean(s.is_household) ? Math.ceil(c / memberCount) : c;
    }

    const categoryMap = new Map<string, number>();
    for (const e of activeExpenses) {
      if (householdOnly && !Boolean(e.is_household)) continue;
      const cat = (e.category as string) ?? 'Other';
      const share = householdOnly
        ? (e.effective_pence ?? 0)
        : Math.round((e.effective_pence ?? 0) * ((e.split_ratio as number) ?? 1));
      categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + share);
    }

    const category_breakdown: CategoryBreakdown[] = Array.from(categoryMap.entries())
      .map(([category, total_pence]) => ({ category, total_pence, percentage: expenses_pence > 0 ? (total_pence / expenses_pence) * 100 : 0 }))
      .sort((a, b) => b.total_pence - a.total_pence);

    return {
      month,
      income_pence,
      expenses_pence,
      debt_payments_pence,
      savings_pence,
      disposable_pence: income_pence - expenses_pence - debt_payments_pence - savings_pence,
      category_breakdown,
    };
  });

  res.json(rows);
});

// GET /api/reports/debt-projection?months=N (default 12, max 600)&household_only=true
router.get('/debt-projection', (req: Request, res: Response) => {
  const numMonths = Math.min(parseInt(req.query.months as string ?? '12', 10), 600);
  const householdOnly = req.query.household_only === 'true';

  const visibleDebts = getEnrichedDebts(req.householdId!, req.userId!, householdOnly);

  // Today's balance as starting point
  const today = new Date();
  const cy = today.getFullYear();
  const cm = today.getMonth() + 1;
  const currentYM = `${cy}-${String(cm).padStart(2, '0')}`;

  // Compute repayment schedules for all visible debts
  const schedules = visibleDebts.map(debt => computeRepayments(debt));

  // Build a map: month → total balance
  const monthMap = new Map<string, number>();
  monthMap.set(currentYM, visibleDebts.reduce((s, d) => s + d.balance_pence, 0));

  for (const summary of schedules) {
    for (const row of summary.schedule) {
      const current = monthMap.get(row.date) ?? 0;
      monthMap.set(row.date, current + row.closing_balance_pence);
    }
  }

  // Sort and slice to requested range
  const sorted = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, numMonths);

  // Build per-debt breakdown
  const debtLines = schedules.map(summary => {
    const debt = visibleDebts.find(d => d.id === summary.debtId)!;
    const debtMonths = new Map<string, number>();
    debtMonths.set(currentYM, debt.balance_pence);
    for (const row of summary.schedule) {
      debtMonths.set(row.date, row.closing_balance_pence);
    }
    return { id: summary.debtId, name: summary.debtName, months: debtMonths };
  });

  const rows: DebtProjectionPoint[] = sorted.map(([month, total_balance_pence]) => ({
    month,
    total_balance_pence,
    is_actual: month <= currentYM,
    per_debt: debtLines.map(dl => ({ id: dl.id, name: dl.name, balance_pence: dl.months.get(month) ?? 0 })),
  }));

  res.json(rows);
});

// GET /api/reports/debt-payoff-timeline?strategy=snowball|avalanche&household_only=true
router.get('/debt-payoff-timeline', (req: Request, res: Response) => {
  const strategyParam = req.query.strategy as string;
  const strategy: 'snowball' | 'avalanche' =
    strategyParam === 'snowball' ? 'snowball' : 'avalanche';
  const householdOnly = req.query.household_only === 'true';

  const visibleDebts = getEnrichedDebts(req.householdId!, req.userId!, householdOnly);

  const result = computePayoffStrategy(visibleDebts, strategy);
  res.json(result);
});

export default router;