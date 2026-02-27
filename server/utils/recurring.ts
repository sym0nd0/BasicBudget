// ─── Recurring Engine ──────────────────────────────────────────────────────────
// Determines whether an item (income, expense, debt) is active in a given month
// and computes its effective amount for that month.

export interface RecurringItem {
  is_recurring: number; // SQLite integer 0/1
  recurrence_type: string;
  posting_day: number;
  start_date?: string | null;
  end_date?: string | null;
  amount_pence?: number;
  // Allow additional columns from DB rows
  [key: string]: unknown;
}

interface ActiveResult {
  active: boolean;
  /** For weekly items this may differ from amount_pence (multiplied by occurrence count) */
  effectivePence?: number;
}

/**
 * Returns the number of days in a given month.
 * new Date(year, month, 0).getDate() gives last day of month (month is 1-indexed here).
 */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Clamp posting_day to the actual number of days in the month.
 * e.g. posting_day=31 in Feb 2025 → 28
 */
export function clampDay(day: number, year: number, month: number): number {
  return Math.min(day, daysInMonth(year, month));
}

/**
 * Determines if an item is active in the given month (YYYY-MM string).
 * Returns { active, effectivePence } where effectivePence is the amount for
 * that month (may differ for weekly recurrence).
 */
export function isActiveInMonth(
  item: RecurringItem,
  yearMonth: string,
): ActiveResult {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-indexed

  // Start/end of the target month (inclusive)
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0); // last day

  const parseDate = (d: string | null | undefined): Date | null => {
    if (!d) return null;
    return new Date(d);
  };

  const startDate = parseDate(item.start_date);
  const endDate = parseDate(item.end_date);

  if (item.is_recurring === 0) {
    // One-off: active only if start_date falls within this month
    if (!startDate) return { active: false };
    const active =
      startDate >= monthStart && startDate <= monthEnd;
    return { active, effectivePence: item.amount_pence };
  }

  // All recurring types: check date bounds first
  if (startDate && startDate > monthEnd) return { active: false };
  if (endDate && endDate < monthStart) return { active: false };

  const type = item.recurrence_type ?? 'monthly';

  if (type === 'monthly') {
    return { active: true, effectivePence: item.amount_pence };
  }

  if (type === 'yearly') {
    // Active only in the anniversary month
    if (!startDate) return { active: false };
    const startMonth = startDate.getMonth() + 1; // 1-indexed
    const active = startMonth === month;
    return { active, effectivePence: item.amount_pence };
  }

  if (type === 'weekly') {
    // posting_day is day-of-week: 1=Mon ... 7=Sun (ISO)
    const targetDow = item.posting_day; // 1–7
    let count = 0;
    const d = new Date(year, month - 1, 1);
    while (d.getMonth() === month - 1) {
      // JS getDay(): 0=Sun, 1=Mon ... 6=Sat
      // Convert to ISO: Mon=1 ... Sun=7
      const jsDay = d.getDay();
      const isoDow = jsDay === 0 ? 7 : jsDay;
      if (isoDow === targetDow) count++;
      d.setDate(d.getDate() + 1);
    }
    const effectivePence =
      item.amount_pence !== undefined ? item.amount_pence * count : undefined;
    return { active: count > 0, effectivePence };
  }

  if (type === 'fortnightly') {
    // posting_day is day-of-week: 1=Mon ... 7=Sun (ISO)
    // Anchor: start_date determines which weeks are "on"
    if (!startDate) return { active: false };
    const targetDow = item.posting_day; // 1–7
    // Find all days in month matching the target day-of-week
    // then filter to those where (date - startDate) % 14 === 0
    const anchorTime = startDate.getTime();
    let count = 0;
    const d = new Date(year, month - 1, 1);
    const MS_PER_DAY = 86400000;
    while (d.getMonth() === month - 1) {
      const jsDay = d.getDay();
      const isoDow = jsDay === 0 ? 7 : jsDay;
      if (isoDow === targetDow) {
        const diffDays = Math.round((d.getTime() - anchorTime) / MS_PER_DAY);
        if (diffDays >= 0 && diffDays % 14 === 0) count++;
      }
      d.setDate(d.getDate() + 1);
    }
    const effectivePence =
      item.amount_pence !== undefined ? item.amount_pence * count : undefined;
    return { active: count > 0, effectivePence };
  }

  return { active: false };
}

/**
 * Filter an array of recurring items to those active in the given month,
 * returning each with its effectivePence for that month.
 */
export function filterActiveInMonth<T extends RecurringItem>(
  items: T[],
  yearMonth: string,
): (T & { effective_pence: number })[] {
  const result: (T & { effective_pence: number })[] = [];
  for (const item of items) {
    const { active, effectivePence } = isActiveInMonth(item, yearMonth);
    if (active) {
      result.push({
        ...item,
        effective_pence: effectivePence ?? item.amount_pence ?? 0,
      });
    }
  }
  return result;
}

/**
 * Get the current month as YYYY-MM string.
 */
export function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
