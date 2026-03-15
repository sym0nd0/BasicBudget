import type { Debt, DebtDealPeriod, DebtPayoffStrategyResult, DebtPayoffTimelinePoint } from '../../shared/types.js';

const MAX_MONTHS = 600;

function getMonthlyRateForDate(debt: Debt, dateStr: string): number {
  if (debt.end_date && dateStr > debt.end_date) {
    return 0;
  }

  const periods: DebtDealPeriod[] = debt.deal_periods ?? [];
  const activePeriod = periods.find(p =>
    p.start_date <= dateStr && (!p.end_date || p.end_date >= dateStr)
  );

  const rate = activePeriod ? activePeriod.interest_rate : debt.interest_rate;
  return rate / 100 / 12;
}

function addMonths(yearMonth: string, n: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const date = new Date(y, m - 1 + n, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function computePayoffStrategy(
  debts: Debt[],
  strategy: 'snowball' | 'avalanche',
  maxMonths: number = MAX_MONTHS,
): DebtPayoffStrategyResult {
  if (debts.length === 0) {
    return { months: [], payoff_dates: {}, total_payoff_date: null };
  }

  // Total monthly budget: sum of all minimums + overpayments
  const totalBudget = debts.reduce((s, d) => s + d.minimum_payment_pence + d.overpayment_pence, 0);

  // Sort by strategy to determine target order (snapshot at start — order is fixed)
  const sorted = [...debts].sort((a, b) => {
    if (strategy === 'snowball') {
      return a.balance_pence - b.balance_pence;
    }
    return b.interest_rate - a.interest_rate;
  });

  // Working balances
  const balances = new Map<string, number>(debts.map(d => [d.id, d.balance_pence]));
  const payoffDates: Record<string, string> = {};
  const months: DebtPayoffTimelinePoint[] = [];

  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  for (let i = 0; i < maxMonths; i++) {
    const monthStr = addMonths(currentYM, i + 1);

    // Accrue interest and apply minimums
    let minimumTotal = 0;
    for (const debt of sorted) {
      const balance = balances.get(debt.id)!;
      if (balance <= 0) continue;

      const rate = getMonthlyRateForDate(debt, `${monthStr}-01`);
      const interest = Math.round(balance * rate);
      const balanceWithInterest = balance + interest;
      const minPayment = Math.min(debt.minimum_payment_pence, balanceWithInterest);
      const afterMin = Math.max(0, balanceWithInterest - minPayment);
      balances.set(debt.id, afterMin);
      minimumTotal += minPayment;
    }

    // Surplus = total budget minus what we already paid as minimums
    let surplus = totalBudget - minimumTotal;

    // Apply surplus to target debts (first non-zero in sorted order)
    for (const debt of sorted) {
      if (surplus <= 0) break;
      const balance = balances.get(debt.id)!;
      if (balance <= 0) continue;

      const applied = Math.min(surplus, balance);
      balances.set(debt.id, balance - applied);
      surplus -= applied;
    }

    // Record payoff dates
    for (const debt of sorted) {
      if (!(debt.id in payoffDates) && balances.get(debt.id)! <= 0) {
        payoffDates[debt.id] = monthStr;
      }
    }

    // Build per-debt snapshot
    const perDebt = sorted.map(d => ({
      id: d.id,
      name: d.name,
      balance_pence: Math.max(0, balances.get(d.id)!),
    }));

    const totalBalance = perDebt.reduce((s, p) => s + p.balance_pence, 0);

    months.push({
      month: monthStr,
      total_balance_pence: totalBalance,
      is_actual: false,
      per_debt: perDebt,
    });

    if (totalBalance === 0) break;
  }

  const total_payoff_date = months.length > 0 && months[months.length - 1].total_balance_pence === 0
    ? months[months.length - 1].month
    : null;

  return { months, payoff_dates: payoffDates, total_payoff_date };
}
