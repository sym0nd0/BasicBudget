import { describe, it, expect } from 'vitest';
import { computeRepayments } from '../../server/utils/debtRepayments.js';
import type { Debt } from '../../shared/types.js';

function makeDebt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: 'test-debt',
    household_id: 'hh',
    user_id: 'u',
    name: 'Test Debt',
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

describe('computeRepayments', () => {
  it('zero-interest debt pays off in the correct number of months', () => {
    const debt = makeDebt({ balance_pence: 50000, minimum_payment_pence: 10000, interest_rate: 0 });
    const result = computeRepayments(debt);
    expect(result.monthsToPayoff).toBe(5);
    expect(result.schedule).toHaveLength(5);
    expect(result.schedule[4].closing_balance_pence).toBe(0);
  });

  it('balance decreases monotonically when payment exceeds monthly interest', () => {
    // Rate: 12% annual = 1%/month; payment: 5000p; balance 100000p
    // Monthly interest ≈ 1000p; payment 5000p → net decrease ≈ 4000p/month
    const debt = makeDebt({ balance_pence: 100000, interest_rate: 12, minimum_payment_pence: 5000 });
    const result = computeRepayments(debt);
    for (let i = 1; i < result.schedule.length; i++) {
      expect(result.schedule[i].closing_balance_pence).toBeLessThan(
        result.schedule[i - 1].closing_balance_pence,
      );
    }
  });

  it('overpayment clamps balance to zero on the final month', () => {
    // balance 5000p, payment 100000p → pays off in month 1, payment clamped to balance
    const debt = makeDebt({ balance_pence: 5000, minimum_payment_pence: 100000, interest_rate: 0 });
    const result = computeRepayments(debt);
    expect(result.monthsToPayoff).toBe(1);
    expect(result.schedule[0].closing_balance_pence).toBe(0);
    expect(result.schedule[0].payment_pence).toBe(5000);
  });

  it('does not add interest when interest_rate is 0', () => {
    const debt = makeDebt({ balance_pence: 30000, interest_rate: 0, minimum_payment_pence: 10000 });
    const result = computeRepayments(debt);
    for (const row of result.schedule) {
      expect(row.interest_charge_pence).toBe(0);
    }
  });

  it('applies deal period rate for months within the period', () => {
    // Base rate 12% (1%/month). Deal period 0% for next 3 months.
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const threeMonthsLater = new Date(now.getFullYear(), now.getMonth() + 3, 28);
    const dealEnd = `${threeMonthsLater.getFullYear()}-${String(threeMonthsLater.getMonth() + 1).padStart(2, '0')}-28`;

    const debt = makeDebt({
      balance_pence: 120000,
      interest_rate: 12,
      minimum_payment_pence: 2000,
      deal_periods: [{
        id: 'dp1',
        debt_id: 'test-debt',
        interest_rate: 0,
        start_date: `${ym}-01`,
        end_date: dealEnd,
      }],
    });
    const result = computeRepayments(debt);
    // First 3 months should have 0 interest (within deal period)
    for (let i = 0; i < Math.min(3, result.schedule.length); i++) {
      expect(result.schedule[i].interest_charge_pence).toBe(0);
    }
    // Month 4+ should have positive interest (if balance > 0)
    if (result.schedule.length > 3) {
      expect(result.schedule[3].interest_charge_pence).toBeGreaterThan(0);
    }
  });

  it('stops schedule at end_date even with remaining balance', () => {
    // end_date 3 months from now; debt would take 10 months to pay off otherwise
    const now = new Date();
    const threeMonthsLater = new Date(now.getFullYear(), now.getMonth() + 3, 15);
    const endDate = `${threeMonthsLater.getFullYear()}-${String(threeMonthsLater.getMonth() + 1).padStart(2, '0')}-15`;

    const debt = makeDebt({
      balance_pence: 100000,
      minimum_payment_pence: 10000,
      interest_rate: 0,
      end_date: endDate,
    });
    const result = computeRepayments(debt);
    const endMonth = endDate.slice(0, 7);
    const lastDate = result.schedule[result.schedule.length - 1]?.date ?? '';
    expect(lastDate <= endMonth).toBe(true);
    expect(result.schedule[result.schedule.length - 1].closing_balance_pence).toBeGreaterThan(0);
  });

  it('closing_balance equals opening_balance + interest - payment for each row', () => {
    const debt = makeDebt({ balance_pence: 200000, interest_rate: 6, minimum_payment_pence: 15000 });
    const result = computeRepayments(debt);
    for (const row of result.schedule) {
      const expected = row.opening_balance_pence + row.interest_charge_pence - row.payment_pence;
      expect(row.closing_balance_pence).toBe(Math.max(0, expected));
    }
  });

  it('each schedule row date is later than the previous', () => {
    const debt = makeDebt({ balance_pence: 60000, minimum_payment_pence: 10000, interest_rate: 0 });
    const result = computeRepayments(debt);
    for (let i = 1; i < result.schedule.length; i++) {
      expect(result.schedule[i].date > result.schedule[i - 1].date).toBe(true);
    }
  });

  it('schedule has no duplicate month dates', () => {
    const debt = makeDebt({ balance_pence: 100000, minimum_payment_pence: 10000, interest_rate: 0 });
    const result = computeRepayments(debt);
    const dates = result.schedule.map(r => r.date);
    expect(new Set(dates).size).toBe(dates.length);
  });
});
