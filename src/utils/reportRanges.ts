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

  switch (range) {
    case '1w':  return { from: addMonths(-1), to: addMonths(1) };   // ±1 month (debt doesn't change weekly)
    case '1m':  return { from: addMonths(-1), to: today };
    case '3m':  return { from: addMonths(-3), to: today };
    case 'ytd': return { from: `${y}-01-01`, to: today };
    case '2y':  return { from: addMonths(-24), to: today };
    case '5y':  return { from: addMonths(-60), to: today };
    case 'all': return { from: addMonths(-120), to: today };
    case '1y':
    default:    return { from: addMonths(-12), to: today };
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
