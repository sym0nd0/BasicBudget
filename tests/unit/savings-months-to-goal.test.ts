import { describe, it, expect } from 'vitest';

function monthsToGoal(goal: {
  target_amount_pence: number;
  current_amount_pence: number;
  monthly_contribution_pence: number;
}): number | null {
  let remaining = goal.target_amount_pence - goal.current_amount_pence;
  if (remaining <= 0) return 0;
  if (goal.monthly_contribution_pence <= 0) return null;
  let months = 0;
  while (remaining > 0 && months < 1201) {
    remaining -= goal.monthly_contribution_pence;
    months++;
  }
  return months > 1200 ? null : months;
}

describe('monthsToGoal', () => {
  it('returns 0 when already at or past target', () => {
    expect(monthsToGoal({ target_amount_pence: 10000, current_amount_pence: 10000, monthly_contribution_pence: 500 })).toBe(0);
    expect(monthsToGoal({ target_amount_pence: 10000, current_amount_pence: 12000, monthly_contribution_pence: 500 })).toBe(0);
  });

  it('returns null when monthly_contribution_pence is 0', () => {
    expect(monthsToGoal({ target_amount_pence: 10000, current_amount_pence: 5000, monthly_contribution_pence: 0 })).toBeNull();
  });

  it('returns correct months for exact multiple', () => {
    expect(monthsToGoal({ target_amount_pence: 5000, current_amount_pence: 0, monthly_contribution_pence: 2500 })).toBe(2);
  });

  it('returns correct months when remainder is non-zero (ceiling behaviour)', () => {
    expect(monthsToGoal({ target_amount_pence: 5001, current_amount_pence: 0, monthly_contribution_pence: 2500 })).toBe(3);
  });

  it('returns 1200 for a goal that takes exactly 1200 months (boundary — within cap)', () => {
    expect(monthsToGoal({ target_amount_pence: 1200, current_amount_pence: 0, monthly_contribution_pence: 1 })).toBe(1200);
  });

  it('returns null for a goal that requires 1201 months (boundary — exceeds cap)', () => {
    expect(monthsToGoal({ target_amount_pence: 1201, current_amount_pence: 0, monthly_contribution_pence: 1 })).toBeNull();
  });

  it('returns null for effectively unreachable goals (> 100 years)', () => {
    expect(monthsToGoal({ target_amount_pence: 100_000_000, current_amount_pence: 0, monthly_contribution_pence: 1 })).toBeNull();
  });
});
