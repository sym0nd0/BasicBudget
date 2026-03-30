import type { Debt, DebtProjectionPoint } from '../../shared/types.js';
import { computeRepayments } from './debtRepayments.js';

const DEBUG = process.env.DEBUG_DEBT_PROJECTION === 'true';

/**
 * Computes the projected monthly debt totals for all debts over numMonths months.
 *
 * - The current month always uses actual DB balances (from the `debts` array).
 * - Future months are derived from per-debt repayment schedules.
 * - total_balance_pence is derived from sum(per_debt) to guarantee consistency.
 *
 * @param debts      Debts enriched with deal_periods; balances in pence.
 * @param currentYM  The "now" month as YYYY-MM (provided by caller for testability).
 * @param numMonths  Maximum number of months to return.
 */
export function calculateDebtTimeline(
  debts: Debt[],
  currentYM: string,
  numMonths: number,
): DebtProjectionPoint[] {
  const schedules = debts.map(d => computeRepayments(d));

  // Collect all months that appear in any schedule (plus current month)
  const allMonths = new Set<string>([currentYM]);
  for (const summary of schedules) {
    for (const row of summary.schedule) {
      if (row.date > currentYM) {
        allMonths.add(row.date);
      }
    }
  }

  // Sort and slice to requested range
  const sortedMonths = Array.from(allMonths).sort().slice(0, numMonths);

  // Build a per-debt balance lookup: debtIndex → month → closingBalance
  const debtBalanceByMonth: Map<string, number>[] = debts.map((d, i) => {
    const m = new Map<string, number>();
    m.set(currentYM, d.balance_pence);
    for (const row of schedules[i].schedule) {
      if (row.date > currentYM) {
        m.set(row.date, row.closing_balance_pence);

        if (DEBUG) {
          console.log(JSON.stringify({
            debug: 'debt_projection_row',
            month: row.date,
            debtId: schedules[i].debtId,
            debtName: schedules[i].debtName,
            openingBalance: row.opening_balance_pence,
            interestCharge: row.interest_charge_pence,
            payment: row.payment_pence,
            closingBalance: row.closing_balance_pence,
          }));
        }
      }
    }
    return m;
  });

  return sortedMonths.map(month => {
    const perDebt = debts.map((d, i) => ({
      id: d.id,
      name: d.name,
      balance_pence: debtBalanceByMonth[i].get(month) ?? 0,
    }));

    // Derive total from per-debt sum — guarantees total === sum(per_debt) always
    const total_balance_pence = perDebt.reduce((s, d) => s + d.balance_pence, 0);

    if (DEBUG) {
      console.log(JSON.stringify({
        debug: 'debt_projection_month',
        month,
        total_balance_pence,
        perDebt,
      }));
    }

    return {
      month,
      total_balance_pence,
      is_actual: month <= currentYM,
      per_debt: perDebt,
    };
  });
}
