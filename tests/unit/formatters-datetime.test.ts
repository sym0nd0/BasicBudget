import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime } from '../../src/utils/formatters';

const iso = '2026-03-24T10:30:00.000Z';

describe('formatDate', () => {
  it('defaults to DD/MM/YYYY when no prefs provided', () => {
    expect(formatDate(iso)).toBe('24/03/2026');
  });
  it('formats DD/MM/YYYY correctly', () => {
    expect(formatDate(iso, { date_format: 'DD/MM/YYYY' })).toBe('24/03/2026');
  });
  it('formats MM/DD/YYYY correctly', () => {
    expect(formatDate(iso, { date_format: 'MM/DD/YYYY' })).toBe('03/24/2026');
  });
  it('formats YYYY-MM-DD by slicing the ISO string', () => {
    expect(formatDate(iso, { date_format: 'YYYY-MM-DD' })).toBe('2026-03-24');
  });
  it('falls back to DD/MM/YYYY for null prefs', () => {
    expect(formatDate(iso, { date_format: null })).toBe('24/03/2026');
  });
});

describe('formatDateTime', () => {
  it('includes a time component', () => {
    const result = formatDateTime(iso, { date_format: 'DD/MM/YYYY', time_format: '24h' });
    expect(result).toMatch(/^24\/03\/2026,\s/);
    expect(result).toMatch(/\d{2}:\d{2}/);
  });
  it('honours 12h preference', () => {
    const result = formatDateTime(iso, { date_format: 'DD/MM/YYYY', time_format: '12h' });
    expect(result.toLowerCase()).toMatch(/am|pm/);
  });
  it('honours 24h preference (no am/pm)', () => {
    const result = formatDateTime(iso, { date_format: 'DD/MM/YYYY', time_format: '24h' });
    expect(result.toLowerCase()).not.toMatch(/am|pm/);
  });
});
