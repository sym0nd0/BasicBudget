import type { Debt, DebtProjectionPoint } from '../../shared/types.js';
import { computeRepayments } from './debtRepayments.js';
import { config } from '../config.js';

const DEBUG = config.DEBUG_DEBT_PROJECTION === 'true';

function addMonths(yearMonth: string, n: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

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
  const schedules = debts.map(d => computeRepayments(d, currentYM));

  // Track each debt's last known balance for carry-forward when its schedule ends early
  const lastBalance: number[] = debts.map(d => d.balance_pence);

  const result: DebtProjectionPoint[] = [];

  for (let i = 0; i < numMonths; i++) {
    const month = addMonths(currentYM, i);

    const perDebt = debts.map((d, di) => {
      let balance: number;

      if (i === 0) {
        // Current month: always use the actual DB balance
        balance = d.balance_pence;
      } else {
        // Future month i: schedule[i-1] is the closing balance after the i-th payment
        const row = schedules[di].schedule[i - 1];
        if (row !== undefined) {
          balance = row.closing_balance_pence;
          lastBalance[di] = balance;
        } else {
          // Schedule ended (e.g. debt hit end_date with remaining balance) — carry forward
          balance = lastBalance[di];
        }
      }

      return { id: d.id, name: d.name, balance_pence: balance };
    });

    const total_balance_pence = perDebt.reduce((s, d) => s + d.balance_pence, 0);

    if (DEBUG) {
      console.log(JSON.stringify({
        debug: 'debt_projection_month',
        month,
        total_balance_pence,
        perDebt,
      }));
    }

    result.push({
      month,
      total_balance_pence,
      is_actual: month <= currentYM,
      per_debt: perDebt,
    });
  }

  return result;
}
