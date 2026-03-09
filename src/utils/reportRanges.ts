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
