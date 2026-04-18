import type { RecurringItem } from './recurring.js';
import type { UpcomingBillStatus } from '../../shared/types.js';

const MS_PER_DAY = 86_400_000;

function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function isWithinBounds(date: Date, startDate: Date | null, endDate: Date | null): boolean {
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

function isoDayOfWeek(date: Date): number {
  const jsDay = date.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

export function getUpcomingBillStatus(dueDate: string, today: string = formatDateOnly(new Date())): UpcomingBillStatus {
  if (dueDate < today) return 'past_due_date';
  if (dueDate === today) return 'due_today';
  return 'upcoming';
}

export function getRecurringOccurrenceDates(item: RecurringItem, yearMonth: string): string[] {
  const [year, month] = yearMonth.split('-').map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const startDate = parseDateOnly(item.start_date);
  const endDate = parseDateOnly(item.end_date);
  const type = item.recurrence_type ?? 'monthly';

  if (item.is_recurring === 0) {
    if (!startDate) return [];
    return startDate >= monthStart && startDate <= monthEnd ? [formatDateOnly(startDate)] : [];
  }

  if (startDate && startDate > monthEnd) return [];
  if (endDate && endDate < monthStart) return [];

  if (type === 'monthly') {
    const day = Math.min(item.posting_day, daysInMonth(year, month));
    const date = new Date(year, month - 1, day);
    return isWithinBounds(date, startDate, endDate) ? [formatDateOnly(date)] : [];
  }

  if (type === 'yearly') {
    if (!startDate || startDate.getMonth() + 1 !== month) return [];
    const day = Math.min(item.posting_day || startDate.getDate(), daysInMonth(year, month));
    const date = new Date(year, month - 1, day);
    return isWithinBounds(date, startDate, endDate) ? [formatDateOnly(date)] : [];
  }

  if (type === 'weekly') {
    const dates: string[] = [];
    const targetDow = item.posting_day;
    const cursor = new Date(monthStart);
    while (cursor <= monthEnd) {
      if (isoDayOfWeek(cursor) === targetDow && isWithinBounds(cursor, startDate, endDate)) {
        dates.push(formatDateOnly(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }

  if (type === 'fortnightly') {
    if (!startDate) return [];
    const dates: string[] = [];
    const targetDow = item.posting_day;
    const anchorTime = startDate.getTime();
    const cursor = new Date(monthStart);
    while (cursor <= monthEnd) {
      const diffDays = Math.round((cursor.getTime() - anchorTime) / MS_PER_DAY);
      if (
        isoDayOfWeek(cursor) === targetDow
        && diffDays >= 0
        && diffDays % 14 === 0
        && isWithinBounds(cursor, startDate, endDate)
      ) {
        dates.push(formatDateOnly(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }

  return [];
}
