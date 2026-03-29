import { describe, it, expect } from 'vitest';
import { aggregateRangeOverview } from '../../src/utils/householdRangeAggregate';
import type { MonthlyReportRow } from '../../shared/types';

const row = (overrides: Partial<MonthlyReportRow> = {}): MonthlyReportRow => ({
  month: '2025-01',
  income_pence: 0,
  expenses_pence: 0,
  debt_payments_pence: 0,
  savings_pence: 0,
  disposable_pence: 0,
  category_breakdown: [],
  ...overrides,
});

describe('aggregateRangeOverview', () => {
  it('sums household_savings_pence from savings_pence across rows', () => {
    const rows = [row({ savings_pence: 5000 }), row({ savings_pence: 3000 })];
    const result = aggregateRangeOverview(rows, 0);
    expect(result.household_savings_pence).toBe(8000);
  });

  it('computes disposable_income_pence as income - expenses - debt - savings', () => {
    const rows = [
      row({ income_pence: 100000, expenses_pence: 30000, debt_payments_pence: 10000, savings_pence: 5000 }),
    ];
    const result = aggregateRangeOverview(rows, 0);
    expect(result.disposable_income_pence).toBe(55000);
  });

  it('totalOutgoingPence via expenses + debt + savings is consistent with disposable', () => {
    const rows = [
      row({ income_pence: 200000, expenses_pence: 40000, debt_payments_pence: 20000, savings_pence: 10000 }),
    ];
    const result = aggregateRangeOverview(rows, 0);
    const totalOutgoing = result.shared_expenses_pence + result.debt_payments_pence + result.household_savings_pence;
    expect(totalOutgoing).toBe(70000);
    expect(result.disposable_income_pence).toBe(result.total_income_pence - totalOutgoing);
  });

  it('aggregates category_breakdown across rows summing totals', () => {
    const rows = [
      row({ expenses_pence: 3000, category_breakdown: [{ category: 'Food', total_pence: 3000, percentage: 100 }] }),
      row({ expenses_pence: 2000, category_breakdown: [{ category: 'Food', total_pence: 2000, percentage: 100 }] }),
    ];
    const result = aggregateRangeOverview(rows, 0);
    const food = result.category_breakdown?.find(c => c.category === 'Food');
    expect(food?.total_pence).toBe(5000);
  });

  it('category percentage is relative to shared_expenses_pence total', () => {
    const rows = [
      row({ expenses_pence: 6000, category_breakdown: [{ category: 'Food', total_pence: 6000, percentage: 100 }] }),
      row({ expenses_pence: 4000, category_breakdown: [{ category: 'Transport', total_pence: 4000, percentage: 100 }] }),
    ];
    const result = aggregateRangeOverview(rows, 0);
    const food = result.category_breakdown?.find(c => c.category === 'Food');
    expect(food?.percentage).toBeCloseTo(60);
  });

  it('sets household_savings_pence to 0 when all savings_pence are 0', () => {
    const rows = [row(), row()];
    const result = aggregateRangeOverview(rows, 0);
    expect(result.household_savings_pence).toBe(0);
  });

  it('returns total_debt_balance_pence from the passed-in argument', () => {
    const result = aggregateRangeOverview([row()], 99999);
    expect(result.total_debt_balance_pence).toBe(99999);
  });

  it('computes debt_to_income_ratio correctly', () => {
    const rows = [row({ income_pence: 100000, debt_payments_pence: 30000 })];
    const result = aggregateRangeOverview(rows, 0);
    expect(result.debt_to_income_ratio).toBe(30);
  });

  it('rounds debt_to_income_ratio to one decimal place for fractional results', () => {
    // 100000 / 300000 = 33.333...% → rounds to 33.3
    const rows = [row({ income_pence: 300000, debt_payments_pence: 100000 })];
    const result = aggregateRangeOverview(rows, 0);
    expect(result.debt_to_income_ratio).toBe(33.3);
  });

  it('returns 0 debt_to_income_ratio when total_income_pence is 0', () => {
    const rows = [row({ income_pence: 0, debt_payments_pence: 5000 })];
    const result = aggregateRangeOverview(rows, 0);
    expect(result.debt_to_income_ratio).toBe(0);
  });

  it('returns empty category_breakdown when rows have none', () => {
    const rows = [row({ category_breakdown: [] })];
    const result = aggregateRangeOverview(rows, 0);
    expect(result.category_breakdown).toEqual([]);
  });
});
