import { Router } from 'express';
import type { Request, Response } from 'express';
import db from '../db.js';
import { filterActiveInMonth, currentYearMonth, type RecurringItem } from '../utils/recurring.js';
import type { HouseholdOverview } from '../../shared/types.js';

const router = Router();

// GET /api/household?month=YYYY-MM
router.get('/', (req: Request, res: Response) => {
  const month = (req.query.month as string) ?? currentYearMonth();

  const allIncomes = db.prepare('SELECT * FROM incomes').all() as RecurringItem[];
  const allExpenses = db.prepare('SELECT * FROM expenses').all() as RecurringItem[];
  const allDebts = db.prepare('SELECT * FROM debts').all() as Record<string, unknown>[];

  const activeIncomes = filterActiveInMonth(allIncomes, month);
  const activeExpenses = filterActiveInMonth(allExpenses, month);

  const totalIncomePence = activeIncomes.reduce((s, i) => s + (i.effective_pence ?? 0), 0);

  // All expenses at full amount (no split)
  const totalExpensesPence = activeExpenses.reduce((s, e) => s + (e.effective_pence ?? 0), 0);

  // Shared (household) expenses full amount
  const sharedExpensesPence = activeExpenses
    .filter(e => Boolean(e.is_household))
    .reduce((s, e) => s + (e.effective_pence ?? 0), 0);

  // Sole (non-household) expenses
  const soleExpensesPence = activeExpenses
    .filter(e => !e.is_household)
    .reduce((s, e) => s + (e.effective_pence ?? 0), 0);

  const debtPaymentsPence = allDebts.reduce(
    (s, d) => s + Math.round(((d.minimum_payment_pence as number) + (d.overpayment_pence as number)) * ((d.split_ratio as number) ?? 1)),
    0,
  );

  const disposableIncomePence = totalIncomePence - totalExpensesPence - debtPaymentsPence;

  const debtToIncomeRatio = totalIncomePence > 0
    ? debtPaymentsPence / totalIncomePence
    : 0;

  const overview: HouseholdOverview = {
    total_income_pence: totalIncomePence,
    total_expenses_pence: totalExpensesPence,
    shared_expenses_pence: sharedExpensesPence,
    sole_expenses_pence: soleExpensesPence,
    debt_payments_pence: debtPaymentsPence,
    disposable_income_pence: disposableIncomePence,
    debt_to_income_ratio: Math.round(debtToIncomeRatio * 1000) / 10, // as percentage, 1dp
  };

  res.json(overview);
});

export default router;
