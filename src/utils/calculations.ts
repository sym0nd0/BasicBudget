import type {
  Income,
  Expense,
  Debt,
  BudgetSummary,
  CategoryBreakdown,
  ExpenseCategory,
  AmortizationRow,
  DebtPayoffSummary,
} from '../types';

// ─── Budget Summary ────────────────────────────────────────────────────────────

export function calculateBudgetSummary(
  incomes: Income[],
  expenses: Expense[],
  debts: Debt[],
): BudgetSummary {
  const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);

  // Each expense is multiplied by its splitRatio (0.5 for household, 1.0 for personal)
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount * e.splitRatio, 0);

  const totalDebtPayments = debts.reduce((sum, d) => sum + d.currentPayment, 0);

  const disposableIncome = totalIncome - totalExpenses - totalDebtPayments;

  // Category breakdown (excluding debt payments category since we track those separately)
  const categoryMap = new Map<ExpenseCategory, number>();
  for (const e of expenses) {
    const existing = categoryMap.get(e.category) ?? 0;
    categoryMap.set(e.category, existing + e.amount * e.splitRatio);
  }

  const categoryBreakdown: CategoryBreakdown[] = Array.from(categoryMap.entries())
    .map(([category, total]) => ({
      category,
      total,
      percentage: totalExpenses > 0 ? (total / totalExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    totalIncome,
    totalExpenses,
    totalDebtPayments,
    disposableIncome,
    categoryBreakdown,
  };
}

// ─── Debt Amortization ─────────────────────────────────────────────────────────

const MAX_MONTHS = 600;

export function amortizeDebt(debt: Debt): DebtPayoffSummary {
  const { id, name, balance, apr, currentPayment } = debt;
  const monthlyRate = apr / 100 / 12;
  const schedule: AmortizationRow[] = [];

  let currentBalance = balance;
  let totalInterestPaid = 0;
  let totalPaid = 0;
  let month = 0;

  const now = new Date();
  const startYear = now.getFullYear();
  const startMonth = now.getMonth(); // 0-indexed

  while (currentBalance > 0 && month < MAX_MONTHS) {
    month++;
    const openingBalance = currentBalance;
    const interestCharge = openingBalance * monthlyRate;

    // Final payment may be less than full payment
    const payment = Math.min(currentPayment, openingBalance + interestCharge);
    const principalPaid = payment - interestCharge;
    const closingBalance = Math.max(0, openingBalance - principalPaid);

    totalInterestPaid += interestCharge;
    totalPaid += payment;

    const paymentDate = new Date(startYear, startMonth + month, 1);
    const dateStr = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;

    schedule.push({
      month,
      date: dateStr,
      openingBalance,
      interestCharge,
      payment,
      principalPaid,
      closingBalance,
    });

    currentBalance = closingBalance;
  }

  const payoffDate = schedule.length > 0 ? schedule[schedule.length - 1].date : '';

  return {
    debtId: id,
    debtName: name,
    monthsToPayoff: month,
    totalInterestPaid,
    totalPaid,
    payoffDate,
    schedule,
  };
}

export function amortizeAllDebts(debts: Debt[]): DebtPayoffSummary[] {
  return debts.map(amortizeDebt);
}

/** Build chart-friendly data: cumulative balance per debt over time */
export interface DebtChartPoint {
  month: number;
  date: string;
  [debtName: string]: number | string;
}

export function buildDebtPayoffChartData(summaries: DebtPayoffSummary[]): DebtChartPoint[] {
  if (summaries.length === 0) return [];

  const maxMonths = Math.max(...summaries.map(s => s.monthsToPayoff));
  const points: DebtChartPoint[] = [];

  for (let m = 0; m <= maxMonths; m++) {
    const point: DebtChartPoint = { month: m, date: '' };
    for (const summary of summaries) {
      if (m === 0) {
        // Starting balance
        const debt = summary.schedule[0];
        point.date = '';
        point[summary.debtName] = debt ? debt.openingBalance : 0;
      } else {
        const row = summary.schedule[m - 1];
        point[summary.debtName] = row ? row.closingBalance : 0;
        if (!point.date && row) point.date = row.date;
      }
    }
    points.push(point);
  }

  return points;
}
