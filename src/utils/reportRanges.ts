import type { ReportRange } from '../types';

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function addMonthsToYM(ym: string, n: number): string {
  let [y, m] = ym.split('-').map(Number);
  m += n;
  while (m > 12) { m -= 12; y++; }
  while (m < 1) { m += 12; y--; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

/**
 * Resolve a ReportRange to { from: YYYY-MM, to: YYYY-MM }.
 *
 * - 1m  = current month only
 * - 3m  = previous 3 full months excluding current
 * - 6m  = previous 6 full months excluding current
 * - 12m = previous 12 full months excluding current
 * - custom = not handled here; caller supplies from/to directly
 */
export function resolveRange(range: ReportRange): { from: string; to: string } {
  const current = currentYearMonth();
  switch (range) {
    case '1m':
      return { from: current, to: current };
    case '3m':
      return { from: addMonthsToYM(current, -3), to: addMonthsToYM(current, -1) };
    case '6m':
      return { from: addMonthsToYM(current, -6), to: addMonthsToYM(current, -1) };
    case '12m':
      return { from: addMonthsToYM(current, -12), to: addMonthsToYM(current, -1) };
    case 'custom':
    default:
      return { from: current, to: current };
  }
}

/**
 * Calculate the previous equal-length period for a given range.
 * Returns { from: YYYY-MM, to: YYYY-MM } for the preceding period.
 */
export function previousRange(range: ReportRange, from?: string, to?: string): { from: string; to: string } {
  if (range === 'custom' && from && to) {
    const [fy, fm] = from.split('-').map(Number);
    const [ty, tm] = to.split('-').map(Number);
    const monthCount = (ty - fy) * 12 + (tm - fm) + 1;
    return {
      from: addMonthsToYM(from, -monthCount),
      to: addMonthsToYM(from, -1),
    };
  }
  const { from: f, to: t } = resolveRange(range);
  const [fy, fm] = f.split('-').map(Number);
  const [ty, tm] = t.split('-').map(Number);
  const monthCount = (ty - fy) * 12 + (tm - fm) + 1;
  return {
    from: addMonthsToYM(f, -monthCount),
    to: addMonthsToYM(f, -1),
  };
}
