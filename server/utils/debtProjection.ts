import type { Debt, DebtProjectionPoint } from '../../shared/types.js';
import { getMonthlyRateForDate } from './debtRepayments.js';
import { currentYearMonth, filterActiveInMonth } from './recurring.js';
import { config } from '../config.js';

const DEBUG = config.DEBUG_DEBT_PROJECTION === 'true';

function addMonthsToYM(yearMonth: string, n: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function compareYearMonths(left: string, right: string): number {
  return left.localeCompare(right);
}

function monthsBetween(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split('-').map(Number);
  const [toYear, toMonth] = to.split('-').map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

function startYearMonth(debt: Debt): string | null {
  return debt.start_date ? debt.start_date.slice(0, 7) : null;
}

function hasStartedByMonth(debt: Debt, yearMonth: string): boolean {
  const startYM = startYearMonth(debt);
  return !startYM || compareYearMonths(startYM, yearMonth) <= 0;
}

function buildPostingDate(yearMonth: string, postingDay: number): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const day = Math.max(1, postingDay || 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  return `${yearMonth}-${String(Math.min(day, daysInMonth)).padStart(2, '0')}`;
}

function paymentMapsForMonth(debts: Debt[], yearMonth: string): Map<string, number> {
  const recurringItems = debts.map(debt => ({
    ...debt,
    is_recurring: debt.is_recurring ? 1 : 0,
    amount_pence: debt.minimum_payment_pence + debt.overpayment_pence,
  }));

  return new Map(
    filterActiveInMonth(recurringItems, yearMonth).map(item => [String(item.id), item.effective_pence]),
  );
}

function estimatePastBalance(
  debt: Debt,
  currentYM: string,
  targetYM: string,
  getScheduledPayment: (month: string) => number,
): number {
  let balance = debt.balance_pence;
  const steps = monthsBetween(targetYM, currentYM);

  for (let i = 0; i < steps; i++) {
    const month = addMonthsToYM(currentYM, -i);
    const dayStr = buildPostingDate(month, debt.posting_day);

    if (debt.end_date && dayStr > debt.end_date) {
      continue;
    }

    const payment = getScheduledPayment(month);
    const monthlyRate = getMonthlyRateForDate(debt, dayStr);
    balance = monthlyRate === 0
      ? balance + payment
      : (balance + payment) / (1 + monthlyRate);
  }

  return Math.round(balance);
}

function projectFutureBalance(
  debt: Debt,
  currentYM: string,
  targetYM: string,
  getScheduledPayment: (month: string) => number,
): { balance_pence: number; effective_pence: number } | null {
  if (!hasStartedByMonth(debt, targetYM)) {
    return null;
  }

  if (compareYearMonths(targetYM, currentYM) === 0) {
    return {
      balance_pence: debt.balance_pence,
      effective_pence: getScheduledPayment(currentYM),
    };
  }

  const startYM = startYearMonth(debt);
  let started = hasStartedByMonth(debt, currentYM);
  let balance = started ? debt.balance_pence : 0;
  let payment = 0;
  const steps = monthsBetween(currentYM, targetYM);

  for (let i = 1; i <= steps; i++) {
    const month = addMonthsToYM(currentYM, i);

    if (!started) {
      if (startYM && compareYearMonths(month, startYM) < 0) {
        continue;
      }
      started = true;
      balance = debt.balance_pence;
    }

    const scheduledPayment = getScheduledPayment(month);
    const interestCharge = Math.round(balance * getMonthlyRateForDate(debt, buildPostingDate(month, debt.posting_day)));
    const balanceWithInterest = balance + interestCharge;
    payment = Math.min(scheduledPayment, balanceWithInterest);
    balance = Math.max(0, balanceWithInterest - payment);
  }

  return started
    ? { balance_pence: balance, effective_pence: payment }
    : null;
}

export function getDebtSnapshotForMonth(
  debts: Debt[],
  targetYM: string,
  currentYM = currentYearMonth(),
): Debt[] {
  const paymentCache = new Map<string, Map<string, number>>();
  const getScheduledPayment = (debtId: string, month: string): number => {
    if (!paymentCache.has(month)) {
      paymentCache.set(month, paymentMapsForMonth(debts, month));
    }
    return paymentCache.get(month)?.get(debtId) ?? 0;
  };

  return debts.flatMap(debt => {
    if (!hasStartedByMonth(debt, targetYM)) {
      return [];
    }

    if (compareYearMonths(targetYM, currentYM) < 0) {
      return [{
        ...debt,
        balance_pence: estimatePastBalance(debt, currentYM, targetYM, month => getScheduledPayment(debt.id, month)),
        effective_pence: getScheduledPayment(debt.id, targetYM),
      }];
    }

    const projected = projectFutureBalance(debt, currentYM, targetYM, month => getScheduledPayment(debt.id, month));
    return projected
      ? [{
          ...debt,
          balance_pence: projected.balance_pence,
          effective_pence: projected.effective_pence,
        }]
      : [];
  });
}
/**
 * Computes the projected monthly debt totals for all debts over numMonths months.
 *
 * - The current month always uses actual DB balances (from the `debts` array).
 * - Past and future months are derived from the shared month snapshot logic.
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
  const result: DebtProjectionPoint[] = [];

  for (let i = 0; i < numMonths; i++) {
    const month = addMonthsToYM(currentYM, i);
    const snapshot = getDebtSnapshotForMonth(debts, month, currentYM);
    const perDebt = snapshot.map(d => ({ id: d.id, name: d.name, balance_pence: d.balance_pence }));
    const total_balance_pence = perDebt.reduce((s, d) => s + d.balance_pence, 0);

    if (DEBUG) {
      console.log(JSON.stringify({
        debug: 'debt_projection_month',
        month,
        total_balance_pence,
        debtCount: perDebt.length,
        perDebt,
      }));
    }

    result.push({
      month,
      total_balance_pence,
      is_actual: i === 0,
      per_debt: perDebt,
    });
  }

  return result;
}
