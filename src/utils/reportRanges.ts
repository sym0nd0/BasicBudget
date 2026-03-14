import type { ReportRange } from '../types';

/**
 * Resolve a ReportRange to { from: YYYY-MM-DD, to: YYYY-MM-DD }
 */
export function resolveRange(range: ReportRange): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();

  const pad = (n: number) => String(n).padStart(2, '0');
  const today = `${y}-${pad(m)}-${pad(d)}`;

  const addMonths = (months: number) => {
    const date = new Date(now);
    date.setMonth(date.getMonth() + months);
    const ny = date.getFullYear();
    const nm = date.getMonth() + 1;
    const nd = date.getDate();
    return `${ny}-${pad(nm)}-${pad(nd)}`;
  };

  const addDays = (days: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    const ny = date.getFullYear();
    const nm = date.getMonth() + 1;
    const nd = date.getDate();
    return `${ny}-${pad(nm)}-${pad(nd)}`;
  };

  // Returns YYYY-MM-01 for the month `months` offsets from now.
  // Use firstOfMonth(-(N-1)) to get exactly N calendar months including the current month.
  const firstOfMonth = (months: number): string => {
    const date = new Date(now.getFullYear(), now.getMonth() + months, 1);
    const ny = date.getFullYear();
    const nm = date.getMonth() + 1;
    return `${ny}-${pad(nm)}-01`;
  };

  switch (range) {
    case '1w':  return { from: addDays(-7), to: today };
    case '1m':  return { from: addMonths(-1), to: today };
    case '3m':  return { from: firstOfMonth(-2), to: today };
    case 'ytd': return { from: `${y}-01-01`, to: today };
    case '2y':  return { from: firstOfMonth(-23), to: today };
    case '5y':  return { from: firstOfMonth(-59), to: today };
    case 'all': return { from: firstOfMonth(-119), to: today };
    case '1y':
    default:    return { from: firstOfMonth(-11), to: today };
  }
}

/**
 * Calculate the previous equal-length period for a given range.
 * Returns { from: YYYY-MM-DD, to: YYYY-MM-DD } for the preceding period.
 */
export function previousRange(range: ReportRange): { from: string; to: string } {
  const current = resolveRange(range);

  // Parse dates
  const fromDate = new Date(current.from);
  const toDate = new Date(current.to);

  // Calculate period length in days
  const periodLength = Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));

  // Go back by period length from the current from date
  const newToDate = new Date(fromDate);
  newToDate.setDate(newToDate.getDate() - 1);

  const newFromDate = new Date(newToDate);
  newFromDate.setDate(newFromDate.getDate() - periodLength);

  const pad = (n: number) => String(n).padStart(2, '0');
  const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    return `${y}-${pad(m)}-${pad(d)}`;
  };

  return {
    from: formatDate(newFromDate),
    to: formatDate(newToDate),
  };
}
