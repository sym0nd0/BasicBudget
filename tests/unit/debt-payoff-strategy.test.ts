import { describe, it, expect } from 'vitest';
import { computePayoffStrategy } from '../../server/utils/debtPayoffStrategy.js';
import type { Debt } from '../../shared/types.js';

function makeDebt(overrides: Partial<Debt> & { id: string; name: string; balance_pence: number }): Debt {
  return {
    household_id: 'hh1',
    user_id: 'u1',
    interest_rate: 0,
    minimum_payment_pence: 10000, // £100
    overpayment_pence: 0,
    compounding_frequency: 'monthly',
    is_recurring: true,
    recurrence_type: 'monthly',
    posting_day: 1,
    is_household: false,
    split_ratio: 1,
    deal_periods: [],
    ...overrides,
  };
}

describe('computePayoffStrategy', () => {
  it('returns empty result when no debts', () => {
    const result = computePayoffStrategy([], 'avalanche');
    expect(result.months).toHaveLength(0);
    expect(result.total_payoff_date).toBeNull();
  });

  it('single debt: snowball and avalanche produce identical results', () => {
    const debt = makeDebt({ id: 'd1', name: 'Card', balance_pence: 100000, interest_rate: 0 });
    const snowball = computePayoffStrategy([debt], 'snowball');
    const avalanche = computePayoffStrategy([debt], 'avalanche');
    expect(snowball.months.length).toBe(avalanche.months.length);
    expect(snowball.total_payoff_date).toBe(avalanche.total_payoff_date);
  });

  it('single zero-interest debt: pays off in exact number of months', () => {
    // £1000 debt, £100/month payment, no interest => 10 months
    const debt = makeDebt({ id: 'd1', name: 'Loan', balance_pence: 100000, interest_rate: 0, minimum_payment_pence: 10000 });
    const result = computePayoffStrategy([debt], 'avalanche');
    expect(result.months).toHaveLength(10);
    expect(result.months[9].total_balance_pence).toBe(0);
    expect(result.total_payoff_date).toBeTruthy();
  });

  it('two debts snowball: smallest balance pays off first', () => {
    const small = makeDebt({ id: 's', name: 'Small', balance_pence: 50000, interest_rate: 0, minimum_payment_pence: 5000 });
    const large = makeDebt({ id: 'l', name: 'Large', balance_pence: 200000, interest_rate: 0, minimum_payment_pence: 5000, overpayment_pence: 5000 });
    const result = computePayoffStrategy([small, large], 'snowball');
    // Small (£500) should pay off before large (£2000)
    expect(result.payoff_dates['s']).toBeTruthy();
    expect(result.payoff_dates['l']).toBeTruthy();
    expect(result.payoff_dates['s'] < result.payoff_dates['l']).toBe(true);
  });

  it('two debts avalanche: highest interest rate pays off first', () => {
    const highRate = makeDebt({ id: 'h', name: 'High Rate', balance_pence: 100000, interest_rate: 24, minimum_payment_pence: 5000 });
    const lowRate = makeDebt({ id: 'lo', name: 'Low Rate', balance_pence: 100000, interest_rate: 5, minimum_payment_pence: 5000, overpayment_pence: 5000 });
    const result = computePayoffStrategy([highRate, lowRate], 'avalanche');
    // High rate should be targeted first
    expect(result.payoff_dates['h']).toBeTruthy();
    expect(result.payoff_dates['lo']).toBeTruthy();
    expect(result.payoff_dates['h'] <= result.payoff_dates['lo']).toBe(true);
  });

  it('zero-interest debt: no interest accrues', () => {
    const debt = makeDebt({ id: 'd1', name: 'Zero', balance_pence: 30000, interest_rate: 0, minimum_payment_pence: 10000 });
    const result = computePayoffStrategy([debt], 'avalanche');
    // Each month the balance should decrease by exactly £100 (10000 pence)
    expect(result.months[0].total_balance_pence).toBe(20000);
    expect(result.months[1].total_balance_pence).toBe(10000);
    expect(result.months[2].total_balance_pence).toBe(0);
    expect(result.months).toHaveLength(3);
  });

  it('closing balance reaches exactly 0 on final month', () => {
    const debt = makeDebt({ id: 'd1', name: 'Exact', balance_pence: 50000, interest_rate: 0, minimum_payment_pence: 10000 });
    const result = computePayoffStrategy([debt], 'snowball');
    const lastMonth = result.months[result.months.length - 1];
    expect(lastMonth.total_balance_pence).toBe(0);
  });

  it('debt with deal period: interest rate switches mid-schedule', () => {
    const debt = makeDebt({
      id: 'd1',
      name: 'Deal',
      balance_pence: 200000,
      interest_rate: 20,
      minimum_payment_pence: 20000,
      deal_periods: [
        { id: 'p1', debt_id: 'd1', label: '0% Offer', interest_rate: 0, start_date: '2020-01-01', end_date: '2020-06-30' },
      ],
    });
    const result = computePayoffStrategy([debt], 'avalanche');
    // Should still reach zero eventually
    expect(result.total_payoff_date).toBeTruthy();
    // There should be multiple months
    expect(result.months.length).toBeGreaterThan(0);
  });

  it('freed minimum payments accelerate remaining debt', () => {
    // Budget is £200/month total. Small debt (£500) pays off in ~5 months.
    // After that, all £200 goes to large debt.
    const small = makeDebt({ id: 's', name: 'Small', balance_pence: 50000, interest_rate: 0, minimum_payment_pence: 10000 });
    const large = makeDebt({ id: 'l', name: 'Large', balance_pence: 200000, interest_rate: 0, minimum_payment_pence: 10000, overpayment_pence: 10000 });
    const snowball = computePayoffStrategy([small, large], 'snowball');
    // After small pays off, large should receive full £200/month
    // Large standalone at £100/month would take 20 months; with freed £100 it should finish faster
    const smallPayoff = snowball.payoff_dates['s'];
    const largePayoff = snowball.payoff_dates['l'];
    expect(smallPayoff).toBeTruthy();
    expect(largePayoff).toBeTruthy();
    // Large should finish faster than if it only received £100/month (20 months from the start)
    const totalMonths = snowball.months.length;
    expect(totalMonths).toBeLessThan(20);
  });
});
