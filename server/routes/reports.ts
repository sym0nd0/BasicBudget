import { Router } from 'express';
import type { Request, Response } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { logValidationFailure } from '../middleware/validate.js';
import { filterVisible } from '../utils/visibility.js';
import { currentYearMonth, filterActiveInMonth, mapDebtToRecurringItem, type RecurringItem } from '../utils/recurring.js';
import { getRecurringOccurrenceDates, getUpcomingBillStatus } from '../utils/upcomingBills.js';
import { computePayoffStrategy } from '../utils/debtPayoffStrategy.js';
import { calculateDebtTimeline } from '../utils/debtProjection.js';
import type {
  Debt,
  DebtDealPeriod,
  CategoryBreakdown,
  MonthlyReportRow,
  UpcomingBillOccurrence,
  UpcomingBillsReportResponse,
  UpcomingBillsSummary,
} from '../../shared/types.js';
import { monthParam } from '../validation/schemas.js';

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

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getMemberCount(householdId: string): number {
  const row = db.prepare('SELECT COUNT(*) as c FROM household_members WHERE household_id = ?').get(householdId) as { c: number };
  return row.c || 1;
}

function summariseUpcomingBills(occurrences: UpcomingBillOccurrence[]): UpcomingBillsSummary {
  const summary: UpcomingBillsSummary = {
    total_count: occurrences.length,
    total_pence: 0,
    past_due_count: 0,
    past_due_pence: 0,
    due_today_count: 0,
    due_today_pence: 0,
    upcoming_count: 0,
    upcoming_pence: 0,
  };

  for (const occurrence of occurrences) {
    summary.total_pence += occurrence.amount_pence;
    if (occurrence.status === 'past_due_date') {
      summary.past_due_count++;
      summary.past_due_pence += occurrence.amount_pence;
    } else if (occurrence.status === 'due_today') {
      summary.due_today_count++;
      summary.due_today_pence += occurrence.amount_pence;
    } else {
      summary.upcoming_count++;
      summary.upcoming_pence += occurrence.amount_pence;
    }
  }

  return summary;
}

// GET /api/reports/upcoming-bills?month=YYYY-MM
router.get('/upcoming-bills', (req: Request, res: Response) => {
  const rawMonth = (req.query.month as string | undefined) ?? currentYearMonth();
  const monthResult = monthParam.safeParse(rawMonth);
  if (!monthResult.success) {
    logValidationFailure(req, monthResult.error.issues, 'reports.upcoming-bills.month');
    res.status(400).json({ message: 'Invalid month format' });
    return;
  }

  const month = monthResult.data;
  const today = todayDateString();
  const occurrences: UpcomingBillOccurrence[] = [];

  const rawExpenses = db.prepare('SELECT * FROM expenses WHERE household_id = ?').all(req.householdId!) as Record<string, unknown>[];
  const rawDebts = db.prepare('SELECT * FROM debts WHERE household_id = ?').all(req.householdId!) as Record<string, unknown>[];
  const rawSavings = db.prepare('SELECT * FROM savings_goals WHERE household_id = ?').all(req.householdId!) as Record<string, unknown>[];

  const visibleExpenses = filterVisible(rawExpenses, req.userId!) as unknown as RecurringItem[];
  const visibleDebtRows = filterVisible(rawDebts, req.userId!);
  const visibleSavings = filterVisible(rawSavings, req.userId!);
  const memberCount = getMemberCount(req.householdId!);

  for (const expense of visibleExpenses) {
    const dates = getRecurringOccurrenceDates(expense, month);
    for (const dueDate of dates) {
      const fullAmount = expense.amount_pence as number;
      const splitRatio = (expense.split_ratio as number) ?? 1;
      occurrences.push({
        id: `expense-${String(expense.id)}-${dueDate}`,
        source: 'expense',
        source_id: String(expense.id),
        name: String(expense.name),
        due_date: dueDate,
        amount_pence: Math.round(fullAmount * splitRatio),
        is_household: Boolean(expense.is_household),
        category: (expense.category as string | undefined) ?? undefined,
        recurrence_type: expense.recurrence_type,
        notes: (expense.notes as string | null | undefined) ?? null,
        status: getUpcomingBillStatus(dueDate, today),
      });
    }
  }

  for (const debtRow of visibleDebtRows) {
    const debtItem = mapDebtToRecurringItem(debtRow);
    const dates = getRecurringOccurrenceDates(debtItem, month);
    for (const dueDate of dates) {
      const splitRatio = (debtRow.split_ratio as number) ?? 1;
      const payment = ((debtRow.minimum_payment_pence as number) ?? 0) + ((debtRow.overpayment_pence as number) ?? 0);
      occurrences.push({
        id: `debt-${String(debtRow.id)}-${dueDate}`,
        source: 'debt',
        source_id: String(debtRow.id),
        name: String(debtRow.name),
        due_date: dueDate,
        amount_pence: Math.round(payment * splitRatio),
        is_household: Boolean(debtRow.is_household),
        category: 'Debt',
        recurrence_type: debtItem.recurrence_type,
        notes: (debtRow.notes as string | null | undefined) ?? null,
        status: getUpcomingBillStatus(dueDate, today),
      });
    }
  }

  for (const goal of visibleSavings) {
    if (!goal.auto_contribute || ((goal.monthly_contribution_pence as number) ?? 0) <= 0) continue;
    const day = String((goal.contribution_day as number | undefined) ?? 1).padStart(2, '0');
    const dueDate = `${month}-${day}`;
    const monthly = goal.monthly_contribution_pence as number;
    occurrences.push({
      id: `savings-${String(goal.id)}-${dueDate}`,
      source: 'savings',
      source_id: String(goal.id),
      name: String(goal.name),
      due_date: dueDate,
      amount_pence: goal.is_household ? Math.ceil(monthly / memberCount) : monthly,
      is_household: Boolean(goal.is_household),
      category: 'Savings',
      recurrence_type: 'monthly',
      notes: (goal.notes as string | null | undefined) ?? null,
      status: getUpcomingBillStatus(dueDate, today),
    });
  }

  occurrences.sort((a, b) => a.due_date.localeCompare(b.due_date) || a.name.localeCompare(b.name));

  const response: UpcomingBillsReportResponse = {
    month,
    summary: summariseUpcomingBills(occurrences),
    occurrences,
  };

  res.json(response);
});

// GET /api/reports/overview?from=YYYY-MM&to=YYYY-MM
router.get('/overview', (req: Request, res: Response) => {
  const from = (req.query.from as string) ?? '';
  const to = (req.query.to as string) ?? '';
  if (!from || !to) {
    res.status(400).json({ message: 'from and to are required' });
    return;
  }
  const fromResult = monthParam.safeParse(from);
  const toResult = monthParam.safeParse(to);
  if (!fromResult.success || !toResult.success) {
    if (!fromResult.success) logValidationFailure(req, fromResult.error.issues, 'reports.overview.from');
    if (!toResult.success) logValidationFailure(req, toResult.error.issues, 'reports.overview.to');
    res.status(400).json({
      message: !fromResult.success
        ? 'from must be in YYYY-MM format'
        : 'to must be in YYYY-MM format',
    });
    return;
  }
  if (fromResult.data > toResult.data) {
    res.status(400).json({ message: 'from must be before or equal to to' });
    return;
  }

  const months = monthRange(fromResult.data, toResult.data);
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

    const incomeRows = householdOnly
      ? activeIncomes.filter(i => Boolean(i.is_household))
      : activeIncomes;
    const income_pence = incomeRows.reduce((s, i) => s + (i.effective_pence ?? 0), 0);
    const expenses_pence = householdOnly
      ? activeExpenses.filter(e => Boolean(e.is_household)).reduce((s, e) => s + (e.effective_pence ?? 0), 0)
      : activeExpenses.reduce((s, e) => s + Math.round((e.effective_pence ?? 0) * ((e.split_ratio as number) ?? 1)), 0);
    const debt_payments_pence = householdOnly
      ? activeDebts.filter(d => Boolean(d.is_household)).reduce((s, d) => s + (d.effective_pence ?? 0), 0)
      : activeDebts.reduce((s, d) => s + Math.round((d.effective_pence ?? 0) * ((d.split_ratio as number) ?? 1)), 0);

    let savings_pence = 0;
    for (const s of allSavings) {
      if (householdOnly && !s.is_household) continue;
      const c = (s.monthly_contribution_pence as number) ?? 0;
      savings_pence += s.is_household ? Math.ceil(c / memberCount) : c;
    }

    const categoryMap = new Map<string, number>();
    for (const e of activeExpenses) {
      if (householdOnly && !e.is_household) continue;
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
  const rawMonths = req.query.months as string | undefined;
  let numMonths: number;
  if (rawMonths === undefined) {
    numMonths = 12;
  } else {
    const parsed = Number(rawMonths);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 600) {
      res.status(400).json({ error: 'Invalid months parameter' });
      return;
    }
    numMonths = parsed;
  }
  const householdOnly = req.query.household_only === 'true';

  const visibleDebts = getEnrichedDebts(req.householdId!, req.userId!, householdOnly);

  res.json(calculateDebtTimeline(visibleDebts, currentYearMonth(), numMonths));
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
