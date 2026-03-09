import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { PageShell } from '../components/layout/PageShell';
import { Card, CardHeader } from '../components/ui/Card';
import { DebtBalanceChart } from '../components/charts/DebtBalanceChart';
import { TimeRangeSelector } from '../components/ui/TimeRangeSelector';
import { IncomeExpensesTrend } from '../components/charts/IncomeExpensesTrend';
import { ExpenseDonut } from '../components/charts/ExpenseDonut';
import { ReportSection } from '../components/reports/ReportSection';
import { MonthlyComparison } from '../components/reports/MonthlyComparison';
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

  // Aggregate all categories across the range
  const aggregatedCategories = (() => {
    if (!overview) return [];
    const categoryMap = new Map<string, { total_pence: number; percentage: number }>();
    for (const row of overview) {
      for (const cat of row.category_breakdown) {
        const existing = categoryMap.get(cat.category) ?? { total_pence: 0, percentage: 0 };
        categoryMap.set(cat.category, {
          total_pence: existing.total_pence + cat.total_pence,
          percentage: 0,
        });
      }
    }
    const total = Array.from(categoryMap.values()).reduce((sum, cat) => sum + cat.total_pence, 0);
    return Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        total_pence: data.total_pence,
        percentage: total > 0 ? (data.total_pence / total) * 100 : 0,
      }))
      .sort((a, b) => b.total_pence - a.total_pence);
  })();

  return (
    <PageShell title="Reports" onMenuClick={onMenuClick}>
      {/* Time range selector */}
      <div className="mb-6">
        <Card>
          <TimeRangeSelector value={range} onChange={setRange} />
        </Card>
      </div>

      {/* Overview section */}
      {overview && (
        <ReportSection title="Overview">
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 items-stretch">
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

            {/* Monthly comparison */}
            {overview.length > 0 && (
              <Card>
                <CardHeader title="Month-over-Month Comparison" subtitle="Change versus previous month" />
                <div className="p-4">
                  <MonthlyComparison data={overview} />
                </div>
              </Card>
            )}
          </div>
        </ReportSection>
      )}

      {/* Trends section */}
      {overview && overview.length > 0 && (
        <ReportSection title="Trends">
          <div className="space-y-4">
            {/* Income vs Expenses */}
            <Card>
              <CardHeader title="Income vs Expenses Over Time" subtitle="Monthly comparison across the period" />
              <IncomeExpensesTrend data={overview} />
            </Card>
          </div>
        </ReportSection>
      )}

      {/* Spending section */}
      {overview && aggregatedCategories.length > 0 && (
        <ReportSection title="Spending">
          <div className="space-y-4">
            {/* Expense breakdown donut */}
            <Card>
              <CardHeader title="Expense Breakdown" subtitle="Proportions across the period" />
              <ExpenseDonut breakdown={aggregatedCategories} />
            </Card>
          </div>
        </ReportSection>
      )}

      {/* Debt section */}
      <ReportSection title="Debt">
        <DebtBalanceChart />
      </ReportSection>

      {/* Detail section */}
      {overview && overview.length > 0 && (
        <ReportSection title="Detail">
          <Card>
            <CardHeader title="Monthly Overview" subtitle="Exact numbers for all months" />
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
        </ReportSection>
      )}
    </PageShell>
  );
}
