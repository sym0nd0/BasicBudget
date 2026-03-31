import { describe, it, expect } from 'vitest';
import { calculateDebtTimeline } from '../../server/utils/debtProjection.js';
import type { Debt } from '../../shared/types.js';

function makeDebt(id: string, overrides: Partial<Debt> = {}): Debt {
  return {
    id,
    household_id: 'hh',
    user_id: 'u',
    name: `Debt ${id}`,
    balance_pence: 100000,
    interest_rate: 0,
    minimum_payment_pence: 10000,
    overpayment_pence: 0,
    compounding_frequency: 'monthly',
    is_recurring: true,
    recurrence_type: 'monthly',
    posting_day: 1,
    start_date: '2020-01-01',
    end_date: null,
    is_household: false,
    split_ratio: 1.0,
    deal_periods: [],
    ...overrides,
  };
}

const currentYM = '2026-03';

describe('calculateDebtTimeline', () => {
  it('first point is the current month with actual balance', () => {
    const debts = [makeDebt('a', { balance_pence: 60000 }), makeDebt('b', { balance_pence: 40000 })];
    const result = calculateDebtTimeline(debts, currentYM, 3);
    const current = result.find(r => r.month === currentYM)!;
    expect(current).toBeDefined();
    expect(current.total_balance_pence).toBe(100000);
    expect(current.is_actual).toBe(true);
  });

  it('total_balance_pence always equals sum of per_debt balances', () => {
    const debts = [
      makeDebt('a', { balance_pence: 80000, minimum_payment_pence: 8000 }),
      makeDebt('b', { balance_pence: 50000, minimum_payment_pence: 5000 }),
    ];
    const result = calculateDebtTimeline(debts, currentYM, 12);
    for (const point of result) {
      const sum = point.per_debt.reduce((s, d) => s + d.balance_pence, 0);
      expect(point.total_balance_pence).toBe(sum);
    }
  });

  it('single zero-interest debt decreases monotonically', () => {
    const debts = [makeDebt('a', { balance_pence: 50000, minimum_payment_pence: 10000, interest_rate: 0 })];
    const result = calculateDebtTimeline(debts, currentYM, 6);
    const future = result.filter(r => r.month > currentYM);
    for (let i = 1; i < future.length; i++) {
      expect(future[i].total_balance_pence).toBeLessThanOrEqual(future[i - 1].total_balance_pence);
    }
    // Should reach zero within 5 future months
    const payoffPoint = result.find(r => r.total_balance_pence === 0);
    expect(payoffPoint).toBeDefined();
  });

  it('total does not increase when payment exceeds interest — regression: March 2026 < March 2027 bug', () => {
    // Rate 12% annual = 1%/month; payment 15000p > interest ~1000p → balance decreases
    const debts = [
      makeDebt('a', { balance_pence: 100000, minimum_payment_pence: 15000, interest_rate: 12 }),
      makeDebt('b', { balance_pence: 80000, minimum_payment_pence: 12000, interest_rate: 12 }),
    ];
    const result = calculateDebtTimeline(debts, '2026-03', 24);
    const mar2026 = result.find(r => r.month === '2026-03')!.total_balance_pence;
    const mar2027 = result.find(r => r.month === '2027-03');
    if (mar2027) {
      // If debt is still outstanding in March 2027, it MUST be lower than March 2026
      expect(mar2027.total_balance_pence).toBeLessThan(mar2026);
    }
    // All future non-zero points must strictly decrease
    const future = result.filter(r => r.month > '2026-03' && r.total_balance_pence > 0);
    for (let i = 1; i < future.length; i++) {
      expect(future[i].total_balance_pence).toBeLessThan(future[i - 1].total_balance_pence);
    }
  });

  it('multiple debts with different interest rates all have non-negative balances', () => {
    const debts = [
      makeDebt('a', { balance_pence: 120000, interest_rate: 20, minimum_payment_pence: 15000 }),
      makeDebt('b', { balance_pence: 60000, interest_rate: 5, minimum_payment_pence: 8000 }),
      makeDebt('c', { balance_pence: 30000, interest_rate: 0, minimum_payment_pence: 5000 }),
    ];
    const result = calculateDebtTimeline(debts, currentYM, 12);
    for (const point of result) {
      for (const d of point.per_debt) {
        expect(d.balance_pence).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('no frozen totals when an ongoing debt is decreasing — regression: June 2026 freeze bug', () => {
    // Short debt pays off in 3 months, long debt continues for 20 months.
    // After short debt pays off, long debt must keep decreasing — no frozen total.
    const debts = [
      makeDebt('short', { balance_pence: 30000, minimum_payment_pence: 10000, interest_rate: 0 }),
      makeDebt('long', { balance_pence: 100000, minimum_payment_pence: 5000, interest_rate: 0 }),
    ];
    const result = calculateDebtTimeline(debts, currentYM, 12);
    const future = result.filter(r => r.month > currentYM);
    for (let i = 1; i < future.length; i++) {
      const prev = future[i - 1].total_balance_pence;
      const curr = future[i].total_balance_pence;
      if (prev > 0) {
        // Every future month with remaining balance must strictly decrease
        expect(curr).toBeLessThan(prev);
      }
    }
  });

  it('paid-off debt shows 0 after payoff month', () => {
    const debts = [
      makeDebt('fast', { balance_pence: 20000, minimum_payment_pence: 10000, interest_rate: 0 }),
      makeDebt('slow', { balance_pence: 100000, minimum_payment_pence: 5000, interest_rate: 0 }),
    ];
    const result = calculateDebtTimeline(debts, currentYM, 10);
    // 'fast' pays off after 2 future months (20000 / 10000)
    const afterPayoff = result.filter(r => r.month > currentYM).slice(2);
    for (const point of afterPayoff) {
      const fastDebt = point.per_debt.find(d => d.id === 'fast')!;
      expect(fastDebt.balance_pence).toBe(0);
    }
  });

  it('returns at most numMonths entries', () => {
    const debts = [makeDebt('a', { balance_pence: 200000, minimum_payment_pence: 10000 })];
    const result = calculateDebtTimeline(debts, currentYM, 6);
    expect(result.length).toBeLessThanOrEqual(6);
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles empty debts array', () => {
    const result = calculateDebtTimeline([], currentYM, 12);
    expect(result).toHaveLength(1);
    expect(result[0].total_balance_pence).toBe(0);
    expect(result[0].month).toBe(currentYM);
  });

  it('schedule is anchored to currentYM, not new Date()', () => {
    // Pass a currentYM well in the past. Without the fix, computeRepayments
    // uses new Date() (2026), so schedule rows land in 2026 — but
    // calculateDebtTimeline includes all rows > '2020-01', causing the output
    // to jump from '2020-01' straight to April 2026 instead of staying in 2020.
    const debts = [
      makeDebt('a', { balance_pence: 30000, minimum_payment_pence: 10000, interest_rate: 0, posting_day: 1 }),
    ];
    const result = calculateDebtTimeline(debts, '2020-01', 6);
    for (const point of result) {
      expect(point.month.startsWith('2020-')).toBe(true);
    }
  });
});
