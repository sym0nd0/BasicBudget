import { describe, expect, it } from 'vitest';
import type { Income } from '../../shared/types.js';
import { findDuplicateIncome } from '../../src/utils/duplicates.js';

describe('findDuplicateIncome', () => {
  it('treats income entries with different household flags as distinct', () => {
    const existing: Income = {
      id: 'income-1',
      name: 'Salary',
      amount_pence: 250000,
      posting_day: 28,
      contributor_user_id: null,
      is_household: false,
      gross_or_net: 'net',
      is_recurring: true,
      recurrence_type: 'monthly',
      start_date: null,
      end_date: null,
      notes: null,
    };

    const result = findDuplicateIncome([existing], {
      name: 'Salary',
      amount_pence: 250000,
      posting_day: 28,
      contributor_user_id: null,
      is_household: true,
      gross_or_net: 'net',
      is_recurring: true,
      recurrence_type: 'monthly',
      start_date: null,
      end_date: null,
      notes: null,
    });

    expect(result).toBeUndefined();
  });
});
