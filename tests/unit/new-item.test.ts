import { describe, expect, it } from 'vitest';
import { getFirstRelevantMonth, isNewInDisplayedMonth } from '../../src/utils/newItem';

describe('new-item month helpers', () => {
  it('uses start_date as the first relevant month when present', () => {
    const item = {
      start_date: '2026-05-15',
      created_at: '2026-04-01 12:00:00',
    };

    expect(getFirstRelevantMonth(item)).toBe('2026-05');
    expect(isNewInDisplayedMonth(item, '2026-04')).toBe(false);
    expect(isNewInDisplayedMonth(item, '2026-05')).toBe(true);
    expect(isNewInDisplayedMonth(item, '2026-06')).toBe(false);
  });

  it('falls back to created_at when no start_date exists', () => {
    const item = {
      created_at: '2026-05-03 09:30:00',
    };

    expect(getFirstRelevantMonth(item)).toBe('2026-05');
    expect(isNewInDisplayedMonth(item, '2026-05')).toBe(true);
    expect(isNewInDisplayedMonth(item, '2026-06')).toBe(false);
  });

  it('returns false when no month metadata is available', () => {
    expect(getFirstRelevantMonth({})).toBeNull();
    expect(isNewInDisplayedMonth({}, '2026-05')).toBe(false);
  });
});
