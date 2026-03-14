import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { useFilter } from '../context/FilterContext';
import { api } from '../api/client';
import { PageShell } from '../components/layout/PageShell';
import { Card, CardHeader } from '../components/ui/Card';
import { FilterBar } from '../components/layout/FilterBar';
import { IncomeVsExpensesBar } from '../components/charts/IncomeVsExpensesBar';
import { ExpenseDonut } from '../components/charts/ExpenseDonut';
import { DebtBalanceChart } from '../components/charts/DebtBalanceChart';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useRangeOverview } from '../hooks/useRangeOverview';
import { formatCurrency, formatPercent } from '../utils/formatters';
import type { HouseholdOverview, HouseholdMember } from '../types';

interface HouseholdPageProps {
  onMenuClick: () => void;
}

export function HouseholdPage({ onMenuClick }: HouseholdPageProps) {
  const { householdRole } = useAuth();
  const { activeMonth } = useFilter();
  const { data: overview } = useApi<HouseholdOverview>(`/household/summary?month=${activeMonth}`);
  const { isRangeActive, data: rangeOverview } = useRangeOverview({ householdOnly: true });

  const displayOverview: HouseholdOverview | null = isRangeActive && rangeOverview ? (() => {
    const categoryMap = new Map<string, number>();
    for (const row of rangeOverview) {
      for (const cat of row.category_breakdown) {
        categoryMap.set(cat.category, (categoryMap.get(cat.category) ?? 0) + cat.total_pence);
      }
    }
    const shared_expenses_pence = rangeOverview.reduce((s, r) => s + r.expenses_pence, 0);
    const debt_payments_pence = rangeOverview.reduce((s, r) => s + r.debt_payments_pence, 0);
    const total_income_pence = rangeOverview.reduce((s, r) => s + r.income_pence, 0);
    const category_breakdown = Array.from(categoryMap.entries())
      .map(([category, total_pence]) => ({
        category,
        total_pence,
        percentage: shared_expenses_pence > 0 ? (total_pence / shared_expenses_pence) * 100 : 0,
      }))
      .sort((a, b) => b.total_pence - a.total_pence);
    return {
      total_income_pence,
      shared_expenses_pence,
      total_expenses_pence: shared_expenses_pence,
      sole_expenses_pence: 0,
      debt_payments_pence,
      household_savings_pence: 0,
      disposable_income_pence: total_income_pence - shared_expenses_pence - debt_payments_pence,
      debt_to_income_ratio: total_income_pence > 0 ? Math.round((debt_payments_pence / total_income_pence) * 1000) / 10 : 0,
      total_debt_balance_pence: overview?.total_debt_balance_pence ?? 0,
      category_breakdown,
    } as HouseholdOverview;
  })() : overview;
  const { data: householdDetails, refetch } = useApi<{ id?: string; name?: string; members?: HouseholdMember[] }>('/household');

  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(householdDetails?.name ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const memberCount = householdDetails?.members?.length ?? 1;
  const totalOutgoingPence = (displayOverview?.shared_expenses_pence ?? 0) + (displayOverview?.debt_payments_pence ?? 0);
  const perMemberOutgoingPence = Math.round(totalOutgoingPence / memberCount);

  const handleSaveName = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError('Household name cannot be empty');
      return;
    }
    if (trimmed === householdDetails?.name) {
      setIsEditingName(false);
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      await api.updateHousehold(trimmed);
      await refetch();
      setIsEditingName(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setNewName(householdDetails?.name ?? '');
    setIsEditingName(false);
    setError('');
  };

  return (
    <PageShell title="Household Overview" onMenuClick={onMenuClick}>
      {/* Household name header */}
      <div className="mb-5">
        <Card>
          <div className="flex items-center justify-between gap-3">
            {isEditingName ? (
              <div className="flex-1 flex gap-2">
                <Input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Household name"
                  autoFocus
                  disabled={isSaving}
                />
                <Button onClick={handleSaveName} disabled={isSaving} size="sm">
                  {isSaving ? 'Saving…' : 'Save'}
                </Button>
                <Button onClick={handleCancelEdit} variant="secondary" disabled={isSaving} size="sm">
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-[var(--color-text)]">{householdDetails?.name ?? 'My Household'}</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {memberCount} member{memberCount !== 1 ? 's' : ''}
                  </p>
                </div>
                {householdRole === 'owner' && (
                  <Button onClick={() => { setNewName(householdDetails?.name ?? ''); setIsEditingName(true); setError(''); }} variant="secondary" size="sm">
                    Edit Name
                  </Button>
                )}
              </>
            )}
          </div>
          {error && <div className="text-xs text-[var(--color-danger)] mt-2">{error}</div>}
        </Card>
      </div>

      {/* Filter bar */}
      <div className="mb-5">
        <Card>
          <FilterBar />
        </Card>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-5 items-stretch">
        <Card className="h-full">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Total Income</p>
          <p className="text-2xl font-bold text-[var(--color-success)]">
            {formatCurrency(displayOverview?.total_income_pence ?? 0)}
          </p>
        </Card>
        <Card className="h-full">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Shared Expenses</p>
          <p className="text-2xl font-bold text-[var(--color-danger)]">
            {formatCurrency(displayOverview?.shared_expenses_pence ?? 0)}
          </p>
        </Card>
        <Card className="h-full">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Debt Payments</p>
          <p className="text-2xl font-bold text-[var(--color-warning)]">
            {formatCurrency(displayOverview?.debt_payments_pence ?? 0)}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {formatPercent(displayOverview?.debt_to_income_ratio ?? 0)} DTI
          </p>
        </Card>
        <Card className="h-full">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Total Monthly Outgoing</p>
          <p className="text-2xl font-bold text-[var(--color-primary)]">
            {formatCurrency(totalOutgoingPence)}
          </p>
        </Card>
        <Card className="h-full">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Per Member</p>
          <p className="text-2xl font-bold text-[var(--color-primary)]">
            {formatCurrency(perMemberOutgoingPence)}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            ÷ {memberCount} member{memberCount !== 1 ? 's' : ''}
          </p>
        </Card>
        <Card className="h-full">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Disposable</p>
          <p className={`text-2xl font-bold ${
            (displayOverview?.disposable_income_pence ?? 0) >= 0
              ? 'text-[var(--color-primary)]'
              : 'text-[var(--color-danger)]'
          }`}>
            {formatCurrency(displayOverview?.disposable_income_pence ?? 0)}
          </p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader title="Income vs Outgoings" subtitle="Full household view" />
          <IncomeVsExpensesBar
            income={displayOverview?.total_income_pence ?? 0}
            expenses={displayOverview?.shared_expenses_pence ?? 0}
            debtPayments={displayOverview?.debt_payments_pence ?? 0}
          />
        </Card>

        <Card>
          <CardHeader title="Expense Breakdown" subtitle="By category — full household" />
          <ExpenseDonut breakdown={displayOverview?.category_breakdown ?? []} />
        </Card>

      </div>

      {/* Debt balance chart */}
      <div className="mb-4">
        <DebtBalanceChart householdOnly={true} />
      </div>
    </PageShell>
  );
}
