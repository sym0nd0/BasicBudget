import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useDebt } from '../context/DebtContext';
import { useFilter } from '../context/FilterContext';
import { usePreviousPeriod } from '../hooks/usePreviousPeriod';
import { PageShell } from '../components/layout/PageShell';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { FilterBar } from '../components/layout/FilterBar';
import { DeltaIndicator } from '../components/ui/DeltaIndicator';
import { IncomeVsExpensesBar } from '../components/charts/IncomeVsExpensesBar';
import { ExpenseDonut } from '../components/charts/ExpenseDonut';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { addMonthsToYM } from '../utils/reportRanges';
import type { BudgetSummary, MonthlyReportRow } from '../types';

interface DashboardProps {
  onMenuClick: () => void;
}

interface SummaryCardProps {
  label: string;
  value: string;
  sub?: string;
  colorClass: string;
  iconBgClass: string;
  icon: React.ReactNode;
  to: string;
  deltaElement?: React.ReactNode;
}

function SummaryCard({ label, value, sub, colorClass, iconBgClass, icon, to, deltaElement }: SummaryCardProps) {
  return (
    <Link to={to} className="block group h-full">
      <Card className="h-full transition-all duration-150 group-hover:shadow-md group-hover:border-[var(--color-primary)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide font-medium">{label}</p>
            <p className={`text-2xl font-bold mt-1.5 ${colorClass}`}>{value}</p>
            {deltaElement}
            {sub && <p className="text-xs text-[var(--color-text-muted)] mt-1">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBgClass}`}>
            {icon}
          </div>
        </div>
      </Card>
    </Link>
  );
}

export function Dashboard({ onMenuClick }: DashboardProps) {
  const { debts } = useDebt();
  const { activeMonth, fromMonth, toMonth, isRangeActive } = useFilter();
  const prevPeriod = usePreviousPeriod();

  const { data: summary } = useApi<BudgetSummary>(
    !isRangeActive ? `/summary?month=${activeMonth}` : null
  );
  const { data: overview } = useApi<MonthlyReportRow[]>(
    isRangeActive && fromMonth && toMonth
      ? `/reports/overview?from=${fromMonth}&to=${toMonth}`
      : null
  );
  const prevMonth = addMonthsToYM(activeMonth, -1);
  const { data: prevSummary } = useApi<BudgetSummary>(
    !isRangeActive ? `/summary?month=${prevMonth}` : null
  );

  const rangeSummary: BudgetSummary | null = overview ? (() => {
    const categoryMap = new Map<string, number>();
    for (const row of overview) {
      for (const cat of row.category_breakdown) {
        categoryMap.set(cat.category, (categoryMap.get(cat.category) ?? 0) + cat.total_pence);
      }
    }
    const total_expenses_pence = overview.reduce((s, r) => s + r.expenses_pence, 0);
    const category_breakdown = Array.from(categoryMap.entries())
      .map(([category, total_pence]) => ({
        category, total_pence,
        percentage: total_expenses_pence > 0 ? (total_pence / total_expenses_pence) * 100 : 0,
      }))
      .sort((a, b) => b.total_pence - a.total_pence);
    return {
      total_income_pence: overview.reduce((s, r) => s + r.income_pence, 0),
      total_expenses_pence,
      total_debt_payments_pence: overview.reduce((s, r) => s + r.debt_payments_pence, 0),
      total_savings_pence: overview.reduce((s, r) => s + r.savings_pence, 0),
      disposable_income_pence: overview.reduce((s, r) => s + r.disposable_pence, 0),
      category_breakdown,
    };
  })() : null;

  const displaySummary = isRangeActive ? rangeSummary : summary;

  const totalDebtPence = debts.reduce((s, d) => s + d.balance_pence, 0);
  const disposablePence = displaySummary?.disposable_income_pence ?? 0;
  const disposableVariant = disposablePence >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]';
  const prevTotalOutgoing = prevPeriod != null
    ? prevPeriod.expenses + prevPeriod.debt + prevPeriod.savings
    : null;

  return (
    <PageShell title="Dashboard" onMenuClick={onMenuClick}>
      {/* Filter bar */}
      <div className="mb-5">
        <Card>
          <FilterBar />
        </Card>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6 items-stretch">
        <SummaryCard
          label="Monthly Income"
          value={formatCurrency(displaySummary?.total_income_pence ?? 0)}
          colorClass="text-[var(--color-success)]"
          iconBgClass="bg-[var(--color-success-light)]"
          to="/income"
          deltaElement={
            <DeltaIndicator
              current={displaySummary?.total_income_pence ?? 0}
              previous={prevPeriod?.income ?? null}
              semantics="positive-up"
            />
          }
          icon={
            <svg className="w-5 h-5 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
            </svg>
          }
        />
        <SummaryCard
          label="Monthly Expenses"
          value={formatCurrency(displaySummary?.total_expenses_pence ?? 0)}
          colorClass="text-[var(--color-danger)]"
          iconBgClass="bg-[var(--color-danger-light)]"
          to="/expenses"
          deltaElement={
            <DeltaIndicator
              current={displaySummary?.total_expenses_pence ?? 0}
              previous={prevPeriod?.expenses ?? null}
              semantics="positive-down"
            />
          }
          icon={
            <svg className="w-5 h-5 text-[var(--color-danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
            </svg>
          }
        />
        <SummaryCard
          label="Debt Payments"
          value={formatCurrency(displaySummary?.total_debt_payments_pence ?? 0)}
          sub={`${debts.length} debt${debts.length !== 1 ? 's' : ''} — ${formatCurrency(totalDebtPence)} total`}
          colorClass="text-[var(--color-warning)]"
          iconBgClass="bg-[var(--color-warning-light)]"
          to="/debt"
          deltaElement={
            <DeltaIndicator
              current={displaySummary?.total_debt_payments_pence ?? 0}
              previous={prevPeriod?.debt ?? null}
              semantics="positive-down"
            />
          }
          icon={
            <svg className="w-5 h-5 text-[var(--color-warning)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <SummaryCard
          label="Monthly Savings"
          value={formatCurrency(displaySummary?.total_savings_pence ?? 0)}
          sub={!isRangeActive && displaySummary?.total_saved_pence != null
            ? `${formatCurrency(displaySummary.total_saved_pence)} total saved`
            : undefined}
          colorClass="text-[var(--color-success)]"
          iconBgClass="bg-[var(--color-success-light)]"
          to="/savings"
          deltaElement={
            <DeltaIndicator
              current={displaySummary?.total_savings_pence ?? 0}
              previous={prevPeriod?.savings ?? null}
              semantics="positive-up"
            />
          }
          icon={
            <svg className="w-5 h-5 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
        <SummaryCard
          label="Total Monthly Outgoing"
          value={formatCurrency((displaySummary?.total_expenses_pence ?? 0) + (displaySummary?.total_debt_payments_pence ?? 0) + (displaySummary?.total_savings_pence ?? 0))}
          colorClass="text-[var(--color-primary)]"
          iconBgClass="bg-[var(--color-primary-light)]"
          to="/"
          deltaElement={
            <DeltaIndicator
              current={(displaySummary?.total_expenses_pence ?? 0) + (displaySummary?.total_debt_payments_pence ?? 0) + (displaySummary?.total_savings_pence ?? 0)}
              previous={prevTotalOutgoing}
              semantics="positive-down"
            />
          }
          icon={
            <svg className="w-5 h-5 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="9" />
              <text x="12" y="16.5" textAnchor="middle" fontSize="11" fontWeight="bold" fill="currentColor" stroke="none">£</text>
            </svg>
          }
        />
        <SummaryCard
          label="Disposable Income"
          value={formatCurrency(disposablePence)}
          colorClass={disposableVariant}
          iconBgClass={disposablePence >= 0 ? 'bg-[var(--color-primary-light)]' : 'bg-[var(--color-danger-light)]'}
          to="/"
          deltaElement={
            <DeltaIndicator
              current={disposablePence}
              previous={prevPeriod?.disposable ?? null}
              semantics="positive-up"
            />
          }
          icon={
            <svg
              className={`w-5 h-5 ${disposablePence >= 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-danger)]'}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            >
              <circle cx="12" cy="12" r="9" />
              <text x="12" y="16.5" textAnchor="middle" fontSize="11" fontWeight="bold" fill="currentColor" stroke="none">£</text>
            </svg>
          }
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader
            title="Income vs Outgoings"
            subtitle="Monthly overview"
          />
          <IncomeVsExpensesBar
            income={displaySummary?.total_income_pence ?? 0}
            expenses={displaySummary?.total_expenses_pence ?? 0}
            debtPayments={displaySummary?.total_debt_payments_pence ?? 0}
            savings={displaySummary?.total_savings_pence ?? 0}
          />
        </Card>

        <Card>
          <CardHeader
            title="Expense Breakdown"
            subtitle="By category (your share)"
          />
          <ExpenseDonut breakdown={displaySummary?.category_breakdown ?? []} />
        </Card>
      </div>

      {/* Category breakdown table */}
      {(displaySummary?.category_breakdown?.length ?? 0) > 0 && (
        <Card padding={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Category Breakdown"
              subtitle="Your share of expenses by category"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)]">
                  <th className="text-center px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Category</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Amount</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">% of Expenses</th>
                  <th className="text-center px-5 py-3 w-40 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Share</th>
                </tr>
              </thead>
              <tbody>
                {displaySummary?.category_breakdown.map(cat => (
                  <tr key={cat.category} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)] transition-colors">
                    <td className="px-5 py-3 font-medium text-[var(--color-text)] text-center">
                      <Badge variant="default">{cat.category}</Badge>
                    </td>
                    <td className="px-5 py-3 font-mono text-[var(--color-danger)] text-center">
                      {formatCurrency(cat.total_pence)}
                      <DeltaIndicator
                        current={cat.total_pence}
                        previous={
                          prevSummary
                            ? (prevSummary.category_breakdown.find(p => p.category === cat.category)?.total_pence ?? null)
                            : null
                        }
                        semantics="positive-down"
                      />
                    </td>
                    <td className="px-5 py-3 text-[var(--color-text-muted)] text-center">
                      {formatPercent(cat.percentage)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="w-full bg-[var(--color-surface-2)] rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-[var(--color-primary)]"
                          style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </PageShell>
  );
}
