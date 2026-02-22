import { useApi } from '../hooks/useApi';
import { useFilter } from '../context/FilterContext';
import { PageShell } from '../components/layout/PageShell';
import { Card, CardHeader } from '../components/ui/Card';
import { FilterBar } from '../components/layout/FilterBar';
import { IncomeVsExpensesBar } from '../components/charts/IncomeVsExpensesBar';
import { formatCurrency, formatPercent } from '../utils/formatters';
import type { HouseholdOverview } from '../types';

interface HouseholdPageProps {
  onMenuClick: () => void;
}

export function HouseholdPage({ onMenuClick }: HouseholdPageProps) {
  const { activeMonth } = useFilter();
  const { data: overview } = useApi<HouseholdOverview>(`/household?month=${activeMonth}`);

  return (
    <PageShell title="Household Overview" onMenuClick={onMenuClick}>
      {/* Filter bar */}
      <div className="mb-5">
        <Card>
          <FilterBar />
        </Card>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5 items-stretch">
        <Card className="h-full">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Total Income</p>
          <p className="text-2xl font-bold text-[var(--color-success)]">
            {formatCurrency(overview?.total_income_pence ?? 0)}
          </p>
        </Card>
        <Card className="h-full">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Total Expenses</p>
          <p className="text-2xl font-bold text-[var(--color-danger)]">
            {formatCurrency(overview?.total_expenses_pence ?? 0)}
          </p>
          {(overview?.shared_expenses_pence ?? 0) > 0 && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {formatCurrency(overview!.shared_expenses_pence)} shared
            </p>
          )}
        </Card>
        <Card className="h-full">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Debt Payments</p>
          <p className="text-2xl font-bold text-[var(--color-warning)]">
            {formatCurrency(overview?.debt_payments_pence ?? 0)}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {formatPercent(overview?.debt_to_income_ratio ?? 0)} DTI
          </p>
        </Card>
        <Card className="h-full">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Disposable</p>
          <p className={`text-2xl font-bold ${
            (overview?.disposable_income_pence ?? 0) >= 0
              ? 'text-[var(--color-primary)]'
              : 'text-[var(--color-danger)]'
          }`}>
            {formatCurrency(overview?.disposable_income_pence ?? 0)}
          </p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader title="Income vs Outgoings" subtitle="Full household view" />
          <IncomeVsExpensesBar
            income={overview?.total_income_pence ?? 0}
            expenses={overview?.total_expenses_pence ?? 0}
            debtPayments={overview?.debt_payments_pence ?? 0}
          />
        </Card>

        <Card>
          <CardHeader title="Expense Split" subtitle="Shared vs sole expenses" />
          <div className="mt-4 space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[var(--color-text-muted)]">Shared (household)</span>
                <span className="font-mono font-medium text-[var(--color-text)]">
                  {formatCurrency(overview?.shared_expenses_pence ?? 0)}
                </span>
              </div>
              <div className="w-full bg-[var(--color-surface-2)] rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-[var(--color-primary)]"
                  style={{
                    width: overview && overview.total_expenses_pence > 0
                      ? `${(overview.shared_expenses_pence / overview.total_expenses_pence) * 100}%`
                      : '0%',
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[var(--color-text-muted)]">Sole expenses</span>
                <span className="font-mono font-medium text-[var(--color-text)]">
                  {formatCurrency(overview?.sole_expenses_pence ?? 0)}
                </span>
              </div>
              <div className="w-full bg-[var(--color-surface-2)] rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-[var(--color-warning)]"
                  style={{
                    width: overview && overview.total_expenses_pence > 0
                      ? `${(overview.sole_expenses_pence / overview.total_expenses_pence) * 100}%`
                      : '0%',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Debt-to-income */}
          <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-text)]">Debt-to-Income Ratio</p>
                <p className="text-xs text-[var(--color-text-muted)]">Monthly debt payments ÷ income</p>
              </div>
              <div className={`text-xl font-bold ${
                (overview?.debt_to_income_ratio ?? 0) > 35
                  ? 'text-[var(--color-danger)]'
                  : 'text-[var(--color-success)]'
              }`}>
                {formatPercent(overview?.debt_to_income_ratio ?? 0)}
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {(overview?.debt_to_income_ratio ?? 0) <= 35
                ? 'Healthy — below the 35% guideline'
                : 'Above 35% — consider reducing debt payments'}
            </p>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
