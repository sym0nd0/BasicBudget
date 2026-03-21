import { Router } from 'express';
import type { Request, Response } from 'express';
import db from '../db.js';
import { filterActiveInMonth, currentYearMonth, mapDebtToRecurringItem, type RecurringItem } from '../utils/recurring.js';
import { filterVisible } from '../utils/visibility.js';
import { requireAuth } from '../middleware/auth.js';
import type { BudgetSummary, CategoryBreakdown } from '../../shared/types.js';

const router = Router();
router.use(requireAuth);

// GET /api/summary?month=YYYY-MM
router.get('/', (req: Request, res: Response) => {
  const month = (req.query.month as string) ?? currentYearMonth();

  const rawIncomes = db.prepare('SELECT * FROM incomes WHERE household_id = ?').all(req.householdId!) as Record<string, unknown>[];
  const rawExpenses = db.prepare('SELECT * FROM expenses WHERE household_id = ?').all(req.householdId!) as Record<string, unknown>[];
  const rawDebts = db.prepare('SELECT * FROM debts WHERE household_id = ?').all(req.householdId!) as Record<string, unknown>[];

  const allIncomes = filterVisible(rawIncomes, req.userId!) as unknown as RecurringItem[];
  const allExpenses = filterVisible(rawExpenses, req.userId!) as unknown as RecurringItem[];
  const allDebtRows = filterVisible(rawDebts, req.userId!);

  const activeIncomes = filterActiveInMonth(allIncomes, month);
  const activeExpenses = filterActiveInMonth(allExpenses, month);

  const totalIncomePence = activeIncomes.reduce((s, i) => s + (i.effective_pence ?? 0), 0);

  const totalExpensesPence = activeExpenses.reduce(
    (s, e) => s + Math.round((e.effective_pence ?? 0) * ((e.split_ratio as number) ?? 1)),
    0,
  );

  const debtItems = allDebtRows.map(mapDebtToRecurringItem);
  const activeDebts = filterActiveInMonth(debtItems, month);
  const totalDebtPaymentsPence = activeDebts.reduce(
    (s, d) => s + Math.round((d.effective_pence ?? 0) * ((d.split_ratio as number) ?? 1)),
    0,
  );

  // Get visible savings goals and count household members
  const rawSavings = db.prepare('SELECT * FROM savings_goals WHERE household_id = ?').all(req.householdId!) as Record<string, unknown>[];
  const allSavings = filterVisible(rawSavings, req.userId!);
  const householdMembers = db.prepare('SELECT COUNT(*) as count FROM household_members WHERE household_id = ?').get(req.householdId!) as { count: number };
  const memberCount = householdMembers.count || 1;

  // Calculate savings contributions (split joint savings equally among all members)
  let totalSavingsPence = 0;
  for (const savings of allSavings) {
    const contribution = (savings.monthly_contribution_pence as number) ?? 0;
    if (savings.is_household) {
      totalSavingsPence += Math.ceil(contribution / memberCount);
    } else {
      totalSavingsPence += contribution;
    }
  }

  const disposableIncomePence = totalIncomePence - totalExpensesPence - totalDebtPaymentsPence - totalSavingsPence;

  const categoryMap = new Map<string, number>();
  for (const e of activeExpenses) {
    const cat = (e.category as string) ?? 'Other';
    const share = Math.round((e.effective_pence ?? 0) * ((e.split_ratio as number) ?? 1));
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + share);
  }

  const categoryBreakdown: CategoryBreakdown[] = Array.from(categoryMap.entries())
    .map(([category, total_pence]) => ({
      category,
      total_pence,
      percentage: totalExpensesPence > 0 ? (total_pence / totalExpensesPence) * 100 : 0,
    }))
    .sort((a, b) => b.total_pence - a.total_pence);

  const summary: BudgetSummary = {
    total_income_pence: totalIncomePence,
    total_expenses_pence: totalExpensesPence,
    total_debt_payments_pence: totalDebtPaymentsPence,
    total_savings_pence: totalSavingsPence,
    disposable_income_pence: disposableIncomePence,
    category_breakdown: categoryBreakdown,
  };

  res.json(summary);
});

export default router;
