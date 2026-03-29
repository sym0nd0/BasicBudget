import type { HouseholdOverview, MonthlyReportRow } from '../types';

/**
 * Aggregates an array of MonthlyReportRow (from /api/reports/overview) into a
 * HouseholdOverview suitable for display on the Household page when a date range
 * is active. Mirrors the single-month server formula:
 *   disposable = income - expenses - debt - savings
 */
export function aggregateRangeOverview(
  rows: MonthlyReportRow[],
  totalDebtBalancePence: number,
): HouseholdOverview {
  const categoryMap = new Map<string, number>();
  for (const row of rows) {
    for (const cat of row.category_breakdown) {
      categoryMap.set(cat.category, (categoryMap.get(cat.category) ?? 0) + cat.total_pence);
    }
  }

  const total_income_pence = rows.reduce((s, r) => s + r.income_pence, 0);
  const shared_expenses_pence = rows.reduce((s, r) => s + r.expenses_pence, 0);
  const debt_payments_pence = rows.reduce((s, r) => s + r.debt_payments_pence, 0);
  const household_savings_pence = rows.reduce((s, r) => s + r.savings_pence, 0);

  const category_breakdown = Array.from(categoryMap.entries())
    .map(([category, total_pence]) => ({
      category,
      total_pence,
      percentage: shared_expenses_pence > 0 ? (total_pence / shared_expenses_pence) * 100 : 0,
    }))
    .sort((a, b) => b.total_pence - a.total_pence);

  return {
    total_income_pence,
    shared_expenses_pence,
    total_expenses_pence: shared_expenses_pence,
    sole_expenses_pence: 0,
    debt_payments_pence,
    household_savings_pence,
    disposable_income_pence: total_income_pence - shared_expenses_pence - debt_payments_pence - household_savings_pence,
    debt_to_income_ratio: total_income_pence > 0 ? Math.round((debt_payments_pence / total_income_pence) * 1000) / 10 : 0,
    total_debt_balance_pence: totalDebtBalancePence,
    category_breakdown,
  };
}
