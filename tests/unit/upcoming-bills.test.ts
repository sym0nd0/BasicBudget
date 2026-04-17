import { describe, expect, it } from 'vitest';
import {
  getRecurringOccurrenceDates,
  getUpcomingBillStatus,
} from '../../server/utils/upcomingBills.js';

describe('getRecurringOccurrenceDates', () => {
  it('clamps monthly posting days to the last day of short months', () => {
    const dates = getRecurringOccurrenceDates({
      is_recurring: 1,
      recurrence_type: 'monthly',
      posting_day: 31,
      amount_pence: 1000,
    }, '2026-02');

    expect(dates).toEqual(['2026-02-28']);
  });

  it('returns every weekly occurrence for the posting weekday in a month', () => {
    const dates = getRecurringOccurrenceDates({
      is_recurring: 1,
      recurrence_type: 'weekly',
      posting_day: 5,
      amount_pence: 1000,
      start_date: '2026-01-02',
    }, '2026-05');

    expect(dates).toEqual(['2026-05-01', '2026-05-08', '2026-05-15', '2026-05-22', '2026-05-29']);
  });

  it('returns fortnightly occurrences using start_date as the cycle anchor', () => {
    const dates = getRecurringOccurrenceDates({
      is_recurring: 1,
      recurrence_type: 'fortnightly',
      posting_day: 5,
      amount_pence: 1000,
      start_date: '2026-05-01',
    }, '2026-05');

    expect(dates).toEqual(['2026-05-01', '2026-05-15', '2026-05-29']);
  });

  it('keeps only occurrence dates inside start and end date bounds', () => {
    const dates = getRecurringOccurrenceDates({
      is_recurring: 1,
      recurrence_type: 'weekly',
      posting_day: 5,
      amount_pence: 1000,
      start_date: '2026-05-08',
      end_date: '2026-05-22',
    }, '2026-05');

    expect(dates).toEqual(['2026-05-08', '2026-05-15', '2026-05-22']);
  });

  it('returns a one-off item only in the start date month', () => {
    const item = {
      is_recurring: 0,
      recurrence_type: 'monthly',
      posting_day: 12,
      amount_pence: 1000,
      start_date: '2026-05-12',
    };

    expect(getRecurringOccurrenceDates(item, '2026-05')).toEqual(['2026-05-12']);
    expect(getRecurringOccurrenceDates(item, '2026-06')).toEqual([]);
  });
});

describe('getUpcomingBillStatus', () => {
  it('labels dates before, on, and after today without implying payment state', () => {
    expect(getUpcomingBillStatus('2026-04-16', '2026-04-17')).toBe('past_due_date');
    expect(getUpcomingBillStatus('2026-04-17', '2026-04-17')).toBe('due_today');
    expect(getUpcomingBillStatus('2026-04-18', '2026-04-17')).toBe('upcoming');
  });
});
