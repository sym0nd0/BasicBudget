import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { PageShell } from '../components/layout/PageShell';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { addMonthsToYM } from '../utils/reportRanges';
import { formatCurrency, formatYearMonth } from '../utils/formatters';
import type { UpcomingBillOccurrence, UpcomingBillsReportResponse, UpcomingBillStatus } from '../types';

interface UpcomingBillsPageProps {
  onMenuClick: () => void;
}

type ViewType = 'calendar' | 'list';

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

function weekdayOffset(yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number);
  const day = new Date(year, month - 1, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function statusLabel(status: UpcomingBillStatus): string {
  if (status === 'past_due_date') return 'Past due date';
  if (status === 'due_today') return 'Due today';
  return 'Upcoming';
}

function statusVariant(status: UpcomingBillStatus): 'default' | 'warning' | 'info' {
  if (status === 'past_due_date') return 'warning';
  if (status === 'due_today') return 'info';
  return 'default';
}

function sourceLabel(source: UpcomingBillOccurrence['source']): string {
  if (source === 'expense') return 'Expense';
  if (source === 'debt') return 'Debt';
  return 'Savings';
}

function sourceVariant(source: UpcomingBillOccurrence['source']): 'danger' | 'warning' | 'success' {
  if (source === 'expense') return 'danger';
  if (source === 'debt') return 'warning';
  return 'success';
}

function formatDueDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function groupByDay(occurrences: UpcomingBillOccurrence[]): Map<number, UpcomingBillOccurrence[]> {
  const grouped = new Map<number, UpcomingBillOccurrence[]>();
  for (const occurrence of occurrences) {
    const day = Number(occurrence.due_date.slice(8, 10));
    grouped.set(day, [...(grouped.get(day) ?? []), occurrence]);
  }
  return grouped;
}

export function UpcomingBillsPage({ onMenuClick }: UpcomingBillsPageProps) {
  const [month, setMonth] = useState(currentYearMonth);
  const [viewType, setViewType] = useState<ViewType>('calendar');
  const { data, loading, error } = useApi<UpcomingBillsReportResponse>(`/reports/upcoming-bills?month=${month}`);
  const reportMonth = data?.month ?? month;

  const calendarDays = useMemo(() => {
    const grouped = groupByDay(data?.occurrences ?? []);
    const offset = weekdayOffset(reportMonth);
    const totalDays = daysInMonth(reportMonth);
    return [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length: totalDays }, (_, index) => ({
        day: index + 1,
        bills: grouped.get(index + 1) ?? [],
      })),
    ];
  }, [data?.occurrences, reportMonth]);

  const goToPreviousMonth = () => setMonth(current => addMonthsToYM(current, -1));
  const goToNextMonth = () => setMonth(current => addMonthsToYM(current, 1));
  const goToCurrentMonth = () => setMonth(currentYearMonth());

  const occurrences = data?.occurrences ?? [];

  return (
    <PageShell
      title="Upcoming Bills"
      onMenuClick={onMenuClick}
      headerAction={
        <Link to="/reports">
          <Button variant="secondary" size="sm">Back to Reports</Button>
        </Link>
      }
    >
      <div className="space-y-5">
        <Card>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={goToPreviousMonth} aria-label="Previous month">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </Button>
              <h2 className="min-w-32 text-center text-lg font-semibold text-[var(--color-text)]">{formatYearMonth(reportMonth)}</h2>
              <Button variant="ghost" size="sm" onClick={goToNextMonth} aria-label="Next month">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Button>
              <Button variant="secondary" size="sm" onClick={goToCurrentMonth}>Today</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={viewType === 'calendar' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setViewType('calendar')}
              >
                Calendar
              </Button>
              <Button
                variant={viewType === 'list' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setViewType('list')}
              >
                List
              </Button>
            </div>
          </div>
        </Card>

        {error && (
          <Card>
            <p className="text-sm text-[var(--color-danger)]">Could not load upcoming bills.</p>
          </Card>
        )}

        {loading && (
          <Card>
            <p className="text-sm text-[var(--color-text-muted)]">Loading upcoming bills…</p>
          </Card>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
              <Card className="h-full">
                <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Total Bills</p>
                <p className="text-2xl font-bold text-[var(--color-danger)]">{formatCurrency(data.summary.total_pence)}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">{data.summary.total_count} due</p>
              </Card>
              <Card className="h-full">
                <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Past due date</p>
                <p className="text-2xl font-bold text-[var(--color-warning)]">{formatCurrency(data.summary.past_due_pence)}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">{data.summary.past_due_count} dated earlier this month</p>
              </Card>
              <Card className="h-full">
                <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Due Today</p>
                <p className="text-2xl font-bold text-[var(--color-info)]">{formatCurrency(data.summary.due_today_pence)}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">{data.summary.due_today_count} due today</p>
              </Card>
              <Card className="h-full">
                <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Upcoming</p>
                <p className="text-2xl font-bold text-[var(--color-text)]">{formatCurrency(data.summary.upcoming_pence)}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">{data.summary.upcoming_count} still ahead</p>
              </Card>
            </div>

            {occurrences.length === 0 ? (
              <Card>
                <p className="text-center py-8 text-[var(--color-text-muted)]">No upcoming bills for this month.</p>
              </Card>
            ) : viewType === 'calendar' ? (
              <Card padding={false}>
                <div className="px-5 pt-5">
                  <CardHeader title="Calendar" subtitle="Outgoing bills by due date" />
                </div>
                <div className="grid grid-cols-7 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <div key={day} className="px-2 py-2 text-center text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {calendarDays.map((day, index) => (
                    <div
                      key={index}
                      className="min-h-28 border-t border-r border-[var(--color-border)] p-2 last:border-r-0"
                    >
                      {day && (
                        <>
                          <p className="mb-2 text-sm font-semibold text-[var(--color-text)]">{day.day}</p>
                          <div className="space-y-1">
                            {day.bills.slice(0, 3).map(bill => (
                              <div
                                key={bill.id}
                                title={`${bill.name}: ${formatCurrency(bill.amount_pence)}`}
                                className="rounded-md bg-[var(--color-surface-2)] px-2 py-1 text-xs"
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="truncate font-medium text-[var(--color-text)]">{bill.name}</span>
                                  <span className="shrink-0 font-mono text-[var(--color-danger)]">{formatCurrency(bill.amount_pence)}</span>
                                </div>
                              </div>
                            ))}
                            {day.bills.length > 3 && (
                              <p className="text-xs text-[var(--color-text-muted)]">+{day.bills.length - 3} more</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ) : (
              <Card padding={false}>
                <div className="px-5 pt-5">
                  <CardHeader title="List" subtitle="Upcoming outgoing bills in due-date order" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)]">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Bill</th>
                        <th className="text-center px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Type</th>
                        <th className="text-center px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Due Date</th>
                        <th className="text-center px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Status</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Your Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {occurrences.map(bill => (
                        <tr key={bill.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-[var(--color-text)]">{bill.name}</span>
                              {bill.is_household && <Badge variant="primary">Shared</Badge>}
                              {bill.category && <Badge variant="default">{bill.category}</Badge>}
                            </div>
                            {bill.notes && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{bill.notes}</p>}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <Badge variant={sourceVariant(bill.source)}>{sourceLabel(bill.source)}</Badge>
                          </td>
                          <td className="px-5 py-3 text-center text-[var(--color-text-muted)]">{formatDueDate(bill.due_date)}</td>
                          <td className="px-5 py-3 text-center">
                            <Badge variant={statusVariant(bill.status)}>{statusLabel(bill.status)}</Badge>
                          </td>
                          <td className="px-5 py-3 text-right font-mono font-semibold text-[var(--color-danger)]">{formatCurrency(bill.amount_pence)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
