import { describe, it, expect } from 'vitest';
import { isActiveInMonth, filterActiveInMonth } from '../../server/utils/recurring.js';

const base = {
  is_recurring: 1 as number,
  recurrence_type: 'monthly',
  posting_day: 1,
  amount_pence: 1000,
};

describe('monthly posting_day clamping', () => {
  it('posting_day=29 in Feb 2024 (leap year) is active', () => {
    const item = { ...base, posting_day: 29 };
    const { active } = isActiveInMonth(item, '2024-02');
    expect(active).toBe(true);
  });

  it('posting_day=29 in Feb 2025 (non-leap year) is active (clamped to 28)', () => {
    const item = { ...base, posting_day: 29 };
    const { active } = isActiveInMonth(item, '2025-02');
    expect(active).toBe(true);
  });

  it('posting_day=31 in Feb 2024 is active (clamped to 29)', () => {
    const item = { ...base, posting_day: 31 };
    const { active } = isActiveInMonth(item, '2024-02');
    expect(active).toBe(true);
  });

  it('posting_day=31 in April is active (clamped to 30)', () => {
    const item = { ...base, posting_day: 31 };
    const { active } = isActiveInMonth(item, '2025-04');
    expect(active).toBe(true);
  });
});

describe('weekly recurrence in February', () => {
  it('counts Fridays in Feb 2024 (leap year: 1, 8, 15, 22, 29 = 5 Fridays)', () => {
    // Feb 1 2024 is a Thursday, so first Friday is Feb 2
    const item = { ...base, recurrence_type: 'weekly', posting_day: 5 }; // 5 = Friday
    const { active, effectivePence } = isActiveInMonth(item, '2024-02');
    expect(active).toBe(true);
    expect(effectivePence).toBe(1000 * 4); // Feb 2024: Fridays on 2, 9, 16, 23 = 4
  });

  it('counts Thursdays in Feb 2024 (leap year)', () => {
    // Feb 2024: Thursdays on 1, 8, 15, 22, 29 = 5
    const item = { ...base, recurrence_type: 'weekly', posting_day: 4 }; // 4 = Thursday
    const { active, effectivePence } = isActiveInMonth(item, '2024-02');
    expect(active).toBe(true);
    expect(effectivePence).toBe(1000 * 5);
  });

  it('counts Saturdays in Feb 2025 (non-leap year)', () => {
    // Feb 1 2025 is a Saturday — Saturdays: 1, 8, 15, 22 = 4
    const item = { ...base, recurrence_type: 'weekly', posting_day: 6 }; // 6 = Saturday
    const { active, effectivePence } = isActiveInMonth(item, '2025-02');
    expect(active).toBe(true);
    expect(effectivePence).toBe(1000 * 4);
  });
});

describe('fortnightly recurrence across Feb leap year boundary', () => {
  it('fortnightly Friday anchored on 2024-02-02 has 2 occurrences in Feb 2024', () => {
    // Fridays in Feb 2024: 2, 9, 16, 23 — fortnightly from 2024-02-02: 2, 16 = 2
    const item = {
      ...base,
      recurrence_type: 'fortnightly',
      posting_day: 5, // Friday
      start_date: '2024-02-02',
    };
    const { active, effectivePence } = isActiveInMonth(item, '2024-02');
    expect(active).toBe(true);
    expect(effectivePence).toBe(1000 * 2);
  });

  it('fortnightly item is inactive before start_date month', () => {
    const item = {
      ...base,
      recurrence_type: 'fortnightly',
      posting_day: 5,
      start_date: '2024-03-01',
    };
    const { active } = isActiveInMonth(item, '2024-02');
    expect(active).toBe(false);
  });

  it('fortnightly item spans Jan-Feb 2024 leap year boundary correctly', () => {
    // Thursday fortnightly anchored on 2024-01-04 — in Feb 2024 (Thursdays: 1, 8, 15, 22, 29)
    // From anchor 2024-01-04 (Thu): fortnightly pattern gives 2024-01-04, 01-18, 02-01, 02-15, 02-29 etc.
    const item = {
      ...base,
      recurrence_type: 'fortnightly',
      posting_day: 4, // Thursday
      start_date: '2024-01-04',
    };
    const { active, effectivePence } = isActiveInMonth(item, '2024-02');
    expect(active).toBe(true);
    // Feb Thursdays: 1, 8, 15, 22, 29 — from anchor 2024-01-04:
    // Feb 1 (diff=28 ✓), Feb 15 (diff=42 ✓), Feb 29 (diff=56 ✓) = 3 occurrences
    expect(effectivePence).toBe(1000 * 3);
  });
});

describe('filterActiveInMonth with leap year items', () => {
  it('filters out items that start after month end', () => {
    const items = [
      { ...base, posting_day: 29, start_date: '2025-03-01' },
      { ...base, posting_day: 15, start_date: '2025-01-01' },
    ];
    const result = filterActiveInMonth(items, '2025-02');
    expect(result).toHaveLength(1);
    expect(result[0].posting_day).toBe(15);
  });

  it('filters out items that ended before month start', () => {
    const items = [
      { ...base, posting_day: 15, end_date: '2025-01-31' },
      { ...base, posting_day: 15 },
    ];
    const result = filterActiveInMonth(items, '2025-02');
    expect(result).toHaveLength(1);
  });
});
