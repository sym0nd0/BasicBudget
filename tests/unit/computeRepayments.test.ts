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
    // Anchor the schedule so the deal period covers exactly Mar-May 2026.
    const debt = makeDebt({
      balance_pence: 120000,
      interest_rate: 12,
      minimum_payment_pence: 2000,
      posting_day: 1,
      deal_periods: [
        {
          id: 'dp1',
          debt_id: 'test-debt',
          interest_rate: 0,
          start_date: '2026-03-01',
          end_date: '2026-05-31',
        },
      ],
    });
    const result = computeRepayments(debt, '2026-03');
    // Mar-May 2026 are inside the 0% deal period.
    for (let i = 0; i < Math.min(3, result.schedule.length); i++) {
      expect(result.schedule[i].interest_charge_pence).toBe(0);
    }
    // June 2026 should use the base 12% annual rate if the debt is still open.
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
    // payoffDate is always set to the last schedule entry's date, even when balance remains.
    // There is no separate 'payoff confirmed' flag on DebtPayoffSummary.
    expect(result.payoffDate).toBe(lastDate);
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

  it('schedule dates are anchored to the provided anchorYM, not new Date()', () => {
    // Anchor is well in the past. Without the fix, schedule dates are in 2026 (today).
    const debt = makeDebt({ balance_pence: 30000, minimum_payment_pence: 10000, interest_rate: 0 });
    const result = computeRepayments(debt, '2020-01');
    expect(result.schedule.length).toBeGreaterThan(0);
    for (const row of result.schedule) {
      expect(row.date.startsWith('2020-')).toBe(true);
    }
  });

  it('end_date comparison uses posting_day not the 1st of the month', () => {
    // Anchor: 2026-03. posting_day: 20. end_date: 2026-04-15.
    // Month 1 → 2026-03, posting date 2026-03-20 ≤ 2026-04-15 → included.
    // Month 2 → 2026-04, posting date 2026-04-20 > 2026-04-15 → loop breaks.
    // Before fix: dayStr = 2026-04-01 ≤ 2026-04-15, so 2026-04 IS included (wrong).
    // After fix:  dayStr = 2026-04-20 > 2026-04-15, so 2026-04 is NOT included (correct).
    const debt = makeDebt({
      balance_pence: 50000,
      minimum_payment_pence: 10000,
      interest_rate: 0,
      posting_day: 20,
      end_date: '2026-04-15',
    });
    const result = computeRepayments(debt, '2026-03');
    const dates = result.schedule.map(r => r.date);
    expect(dates).toContain('2026-03');
    expect(dates).not.toContain('2026-04');
  });

  it('deal period rate boundary uses posting_day not the 1st of the month', () => {
    // Anchor: 2026-03. posting_day: 20. Deal period 0% ends 2026-04-15.
    // Month 1 → 2026-03, posting date 2026-03-20 ≤ 2026-04-15 → 0% rate (within deal).
    // Month 2 → 2026-04, posting date 2026-04-20 > 2026-04-15 → base 12% rate applies.
    // Before fix: dayStr = 2026-04-01 ≤ 2026-04-15, so April still gets 0% (wrong).
    // After fix:  dayStr = 2026-04-20 > 2026-04-15, so April uses 12% (correct).
    const debt = makeDebt({
      balance_pence: 200000,
      interest_rate: 12,
      minimum_payment_pence: 5000,
      posting_day: 20,
      deal_periods: [
        {
          id: 'dp1',
          debt_id: 'test-debt',
          interest_rate: 0,
          start_date: '2026-01-01',
          end_date: '2026-04-15',
        },
      ],
    });
    const result = computeRepayments(debt, '2026-03');
    // Month 1 (2026-03): posting is 2026-03-20, within deal period → 0 interest
    expect(result.schedule[0].interest_charge_pence).toBe(0);
    // Month 2 (2026-04): posting is 2026-04-20, after deal end → 12%/yr interest
    if (result.schedule.length > 1) {
      expect(result.schedule[1].interest_charge_pence).toBeGreaterThan(0);
    }
  });

  it('posting_day 31 is clamped to last valid day in February so end_date comparison is correct', () => {
    // Anchor: 2026-02. posting_day: 31. end_date: 2026-02-28.
    // Clamped posting date for Feb: 2026-02-28 (28 days in Feb 2026).
    // 2026-02-28 ≤ 2026-02-28 → loop continues → Feb IS included.
    // Before fix (no clamp): dayStr = '2026-02-31' > '2026-02-28' lexicographically
    //   → loop breaks immediately → schedule is empty (wrong).
    // After fix: dayStr = '2026-02-28' ≤ '2026-02-28' → Feb included (correct).
    const debt = makeDebt({
      balance_pence: 30000,
      minimum_payment_pence: 10000,
      interest_rate: 0,
      posting_day: 31,
      end_date: '2026-02-28',
    });
    const result = computeRepayments(debt, '2026-02');
    expect(result.schedule.length).toBeGreaterThan(0);
    expect(result.schedule[0].date).toBe('2026-02');
  });

  it('posting_day 0 is clamped to 1 so deal period starting on the 1st applies', () => {
    // posting_day 0 produces dayStr '2026-03-00' without a lower-bound clamp.
    // The deal period starts on '2026-03-01'; the check is p.start_date <= dayStr.
    // '2026-03-01' <= '2026-03-00' is FALSE → deal wrongly excluded → interest > 0.
    // After the fix (clamp to min 1): dayStr = '2026-03-01' → deal IS applied → interest = 0.
    const debt = makeDebt({
      balance_pence: 100000,
      interest_rate: 12,
      minimum_payment_pence: 5000,
      posting_day: 0,
      deal_periods: [
        {
          id: 'dp1',
          debt_id: 'test-debt',
          interest_rate: 0,
          start_date: '2026-03-01',
          end_date: '2026-06-30',
        },
      ],
    });
    const result = computeRepayments(debt, '2026-03');
    // posting_day 0 clamped to 1: dayStr = '2026-03-01', within the deal period → 0% interest
    expect(result.schedule[0].interest_charge_pence).toBe(0);
  });
});
