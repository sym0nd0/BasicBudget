import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { PageShell } from '../components/layout/PageShell';
import { Card, CardHeader } from '../components/ui/Card';
import { DebtBalanceChart } from '../components/charts/DebtBalanceChart';
import { TimeRangeSelector } from '../components/ui/TimeRangeSelector';
import { formatCurrency } from '../utils/formatters';
import { resolveRange } from '../utils/reportRanges';
import type { ReportRange, MonthlyReportRow } from '../types';

interface ReportsPageProps {
  onMenuClick: () => void;
}

export function ReportsPage({ onMenuClick }: ReportsPageProps) {
  const [range, setRange] = useState<ReportRange>('1y');
  const { from, to } = resolveRange(range);
  const { data: overview } = useApi<MonthlyReportRow[]>(`/reports/overview?from=${from}&to=${to}`);

  // Calculate aggregates across the range
  const totals = {
    income: 0,
    expenses: 0,
    debt: 0,
    savings: 0,
    disposable: 0,
  };

  if (overview) {
    for (const row of overview) {
      totals.income += row.income_pence;
      totals.expenses += row.expenses_pence;
      totals.debt += row.debt_payments_pence;
      totals.savings += row.savings_pence;
      totals.disposable += row.disposable_pence;
    }
  }

  return (
    <PageShell title="Reports" onMenuClick={onMenuClick}>
      {/* Time range selector */}
      <div className="mb-5">
        <Card>
          <TimeRangeSelector value={range} onChange={setRange} />
        </Card>
      </div>

      {/* Summary cards */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5 items-stretch">
          <Card className="h-full">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Total Income</p>
            <p className="text-2xl font-bold text-[var(--color-success)]">{formatCurrency(totals.income)}</p>
          </Card>
          <Card className="h-full">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Total Expenses</p>
            <p className="text-2xl font-bold text-[var(--color-danger)]">{formatCurrency(totals.expenses)}</p>
          </Card>
          <Card className="h-full">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Debt Payments</p>
            <p className="text-2xl font-bold text-[var(--color-warning)]">{formatCurrency(totals.debt)}</p>
          </Card>
          <Card className="h-full">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Savings</p>
            <p className="text-2xl font-bold text-[var(--color-primary)]">{formatCurrency(totals.savings)}</p>
          </Card>
          <Card className="h-full">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Disposable</p>
            <p className={`text-2xl font-bold ${totals.disposable >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
              {formatCurrency(totals.disposable)}
            </p>
          </Card>
        </div>
      )}

      {/* Monthly overview table */}
      {overview && overview.length > 0 && (
        <Card className="mb-5">
          <CardHeader title="Monthly Overview" subtitle="Income, expenses, and debt payments per month" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)]">
                  <th className="text-left px-4 py-2 font-semibold text-[var(--color-text-muted)]">Month</th>
                  <th className="text-right px-4 py-2 font-semibold text-[var(--color-text-muted)]">Income</th>
                  <th className="text-right px-4 py-2 font-semibold text-[var(--color-text-muted)]">Expenses</th>
                  <th className="text-right px-4 py-2 font-semibold text-[var(--color-text-muted)]">Debt</th>
                  <th className="text-right px-4 py-2 font-semibold text-[var(--color-text-muted)]">Savings</th>
                  <th className="text-right px-4 py-2 font-semibold text-[var(--color-text-muted)]">Disposable</th>
                </tr>
              </thead>
              <tbody>
                {overview.map((row, idx) => (
                  <tr key={idx} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]">
                    <td className="px-4 py-2 font-medium text-[var(--color-text)]">{row.month}</td>
                    <td className="text-right px-4 py-2 font-mono text-[var(--color-success)]">{formatCurrency(row.income_pence)}</td>
                    <td className="text-right px-4 py-2 font-mono text-[var(--color-danger)]">{formatCurrency(row.expenses_pence)}</td>
                    <td className="text-right px-4 py-2 font-mono text-[var(--color-warning)]">{formatCurrency(row.debt_payments_pence)}</td>
                    <td className="text-right px-4 py-2 font-mono text-[var(--color-primary)]">{formatCurrency(row.savings_pence)}</td>
                    <td className={`text-right px-4 py-2 font-mono ${row.disposable_pence >= 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-danger)]'}`}>
                      {formatCurrency(row.disposable_pence)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Debt projection */}
      <div className="mb-4">
        <DebtBalanceChart />
      </div>

      {/* Spending by category table */}
      {overview && overview.length > 0 && (
        <Card>
          <CardHeader title="Top Expense Categories" subtitle="Top 5 categories across the period" />
          <div className="p-4">
            {(() => {
              const categoryMap = new Map<string, number>();
              for (const row of overview) {
                for (const cat of row.category_breakdown) {
                  categoryMap.set(cat.category, (categoryMap.get(cat.category) ?? 0) + cat.total_pence);
                }
              }
              const sorted = Array.from(categoryMap.entries())
                .map(([category, total]) => ({ category, total }))
                .sort((a, b) => b.total - a.total)
                .slice(0, 5);

              if (sorted.length === 0) {
                return <p className="text-sm text-[var(--color-text-muted)]">No expense data available</p>;
              }

              const max = sorted[0].total;
              return (
                <div className="space-y-3">
                  {sorted.map(item => (
                    <div key={item.category}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[var(--color-text)]">{item.category}</span>
                        <span className="font-mono font-medium text-[var(--color-text)]">{formatCurrency(item.total)}</span>
                      </div>
                      <div className="w-full bg-[var(--color-surface-2)] rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-[var(--color-warning)]"
                          style={{ width: `${(item.total / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </Card>
      )}
    </PageShell>
  );
}
