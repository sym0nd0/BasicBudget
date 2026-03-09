import { formatCurrency } from '../../utils/formatters';
import type { MonthlyReportRow } from '../../types';

interface MonthlyComparisonProps {
  data: MonthlyReportRow[];
}

function getDelta(current: number, previous: number): { delta: number; percentage: number; isPositive: boolean } {
  const delta = current - previous;
  const percentage = previous !== 0 ? (delta / previous) * 100 : 0;
  const isPositive = delta >= 0;
  return { delta, percentage, isPositive };
}

function ComparisonRow({
  label,
  current,
  previous,
}: {
  label: string;
  current: number;
  previous: number;
}) {
  const { delta, percentage, isPositive } = getDelta(current, previous);

  // For income/savings: higher is better (green)
  // For expenses/debt: lower is better (green)
  const isGood = (label === 'Income' || label === 'Savings' || label === 'Disposable')
    ? isPositive
    : !isPositive;

  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-b-0">
      <span className="text-sm text-[var(--color-text)]">{label}</span>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-mono text-[var(--color-text)]">{formatCurrency(current)}</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {isGood ? '+' : '−'}{formatCurrency(Math.abs(delta))}
          </p>
        </div>
        <div className={`px-2 py-0.5 rounded text-xs font-medium ${
          isGood
            ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
            : 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
        }`}>
          {isGood ? '↓' : '↑'} {Math.abs(percentage).toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

export function MonthlyComparison({ data }: MonthlyComparisonProps) {
  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 text-[var(--color-text-muted)] text-sm">
        Insufficient data for comparison
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => a.month.localeCompare(b.month));
  const lastMonth = sorted[sorted.length - 2];
  const thisMonth = sorted[sorted.length - 1];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* This Month */}
      <div className="bg-[var(--color-surface-2)] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3">This Month</h3>
        <p className="text-xs text-[var(--color-text-muted)] mb-3">{thisMonth.month}</p>
        <div className="space-y-1">
          <div className="flex justify-between py-2">
            <span className="text-sm text-[var(--color-text)]">Income</span>
            <span className="text-sm font-mono text-[var(--color-success)]">{formatCurrency(thisMonth.income_pence)}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-sm text-[var(--color-text)]">Expenses</span>
            <span className="text-sm font-mono text-[var(--color-danger)]">{formatCurrency(thisMonth.expenses_pence)}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-sm text-[var(--color-text)]">Debt Payments</span>
            <span className="text-sm font-mono text-[var(--color-warning)]">{formatCurrency(thisMonth.debt_payments_pence)}</span>
          </div>
          <div className="flex justify-between py-2 border-t border-[var(--color-border)] pt-2">
            <span className="text-sm text-[var(--color-text)]">Savings</span>
            <span className="text-sm font-mono text-[var(--color-primary)]">{formatCurrency(thisMonth.savings_pence)}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-sm text-[var(--color-text)]">Disposable</span>
            <span className={`text-sm font-mono ${thisMonth.disposable_pence >= 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-danger)]'}`}>
              {formatCurrency(thisMonth.disposable_pence)}
            </span>
          </div>
        </div>
      </div>

      {/* Change vs Last Month */}
      <div className="bg-[var(--color-surface-2)] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3">Change</h3>
        <p className="text-xs text-[var(--color-text-muted)] mb-3">vs {lastMonth.month}</p>
        <div className="space-y-1">
          <ComparisonRow label="Income" current={thisMonth.income_pence} previous={lastMonth.income_pence} />
          <ComparisonRow label="Expenses" current={thisMonth.expenses_pence} previous={lastMonth.expenses_pence} />
          <ComparisonRow label="Debt Payments" current={thisMonth.debt_payments_pence} previous={lastMonth.debt_payments_pence} />
          <ComparisonRow label="Savings" current={thisMonth.savings_pence} previous={lastMonth.savings_pence} />
          <ComparisonRow label="Disposable" current={thisMonth.disposable_pence} previous={lastMonth.disposable_pence} />
        </div>
      </div>
    </div>
  );
}
