// server/utils/debtRepayments.ts
import type { Debt, DebtPayoffSummary, RepaymentRow } from '../../shared/types.js';

const MAX_MONTHS = 600;

function addMonths(yearMonth: string, n: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split('-').map(Number);
  // new Date(y, m, 0) is the last calendar day of month m in year y
  return new Date(y, m, 0).getDate();
}

export function getMonthlyRateForDate(debt: Debt, dayStr: string): number {
  if (debt.end_date && dayStr > debt.end_date) {
    return 0;
  }
  const periods = debt.deal_periods ?? [];
  const activePeriod = periods.find(
    p => p.start_date <= dayStr && (!p.end_date || p.end_date >= dayStr),
  );
  const rate = activePeriod ? activePeriod.interest_rate : debt.interest_rate;
  return rate / 100 / 12;
}

export function computeRepayments(debt: Debt, anchorYM?: string): DebtPayoffSummary {
  const paymentPence = debt.minimum_payment_pence + debt.overpayment_pence;
  const schedule: RepaymentRow[] = [];

  let currentBalance = debt.balance_pence;
  let totalInterestPaid = 0;
  let totalPaid = 0;
  let month = 0;

  const now = new Date();
  const currentYM = anchorYM ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  // When an anchor is provided (e.g. from calculateDebtTimeline or tests), the
  // "has the payment already occurred this month?" heuristic is not meaningful —
  // start the schedule from the anchor month directly.
  const postingDay = Math.max(1, debt.posting_day ?? 1);
  const monthOffset = anchorYM !== undefined
    ? 0
    : now.getDate() <= postingDay ? 0 : 1;

  while (currentBalance > 0 && month < MAX_MONTHS) {
    month++;
    const monthStr = addMonths(currentYM, monthOffset + month - 1);
    const dayStr = `${monthStr}-${String(Math.min(postingDay, daysInMonth(monthStr))).padStart(2, '0')}`;

    if (debt.end_date && dayStr > debt.end_date) {
      break;
    }

    const monthlyRate = getMonthlyRateForDate(debt, dayStr);

    const openingBalance = currentBalance;
    const interestCharge = Math.round(openingBalance * monthlyRate);
    const balanceWithInterest = openingBalance + interestCharge;
    const payment = Math.min(paymentPence, balanceWithInterest);
    const principalPaid = payment - interestCharge;
    const closingBalance = Math.max(0, balanceWithInterest - payment);

    totalInterestPaid += interestCharge;
    totalPaid += payment;

    schedule.push({
      month,
      date: monthStr,
      opening_balance_pence: openingBalance,
      interest_charge_pence: interestCharge,
      payment_pence: payment,
      principal_paid_pence: principalPaid,
      closing_balance_pence: closingBalance,
    });

    currentBalance = closingBalance;
  }

  return {
    debtId: debt.id,
    debtName: debt.name,
    monthsToPayoff: month,
    totalInterestPaidPence: totalInterestPaid,
    totalPaidPence: totalPaid,
    payoffDate: schedule.length > 0 ? schedule[schedule.length - 1].date : '',
    schedule,
  };
}
