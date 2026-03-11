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

function RowLayout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-b-0">
      <span className="text-sm text-[var(--color-text)]">{label}</span>
      {children}
    </div>
  );
}

function ValueRow({ label, value }: { label: string; value: number }) {
  return (
    <RowLayout label={label}>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-mono text-[var(--color-text)]">{formatCurrency(value)}</p>
          <p className="text-xs text-[var(--color-text-muted)] opacity-0 pointer-events-none select-none" aria-hidden="true">
            placeholder
          </p>
        </div>
        <div className="px-2 py-0.5 rounded text-xs font-medium opacity-0 pointer-events-none select-none" aria-hidden="true">
          0.0%
        </div>
      </div>
    </RowLayout>
  );
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
    <RowLayout label={label}>
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
    </RowLayout>
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
          <ValueRow label="Income" value={thisMonth.income_pence} />
          <ValueRow label="Expenses" value={thisMonth.expenses_pence} />
          <ValueRow label="Debt Payments" value={thisMonth.debt_payments_pence} />
          <ValueRow label="Savings" value={thisMonth.savings_pence} />
          <ValueRow label="Disposable" value={thisMonth.disposable_pence} />
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
