import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { useFilter } from '../context/FilterContext';
import { api } from '../api/client';
import { PageShell } from '../components/layout/PageShell';
import { Card, CardHeader } from '../components/ui/Card';
import { FilterBar } from '../components/layout/FilterBar';
import { IncomeVsExpensesBar } from '../components/charts/IncomeVsExpensesBar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { formatCurrency, formatPercent } from '../utils/formatters';
import type { HouseholdOverview, HouseholdMember } from '../types';

interface HouseholdPageProps {
  onMenuClick: () => void;
}

export function HouseholdPage({ onMenuClick }: HouseholdPageProps) {
  const { householdRole } = useAuth();
  const { activeMonth } = useFilter();
  const { data: overview } = useApi<HouseholdOverview>(`/household/summary?month=${activeMonth}`);
  const { data: householdDetails, refetch } = useApi<{ id?: string; name?: string; members?: HouseholdMember[] }>('/household');

  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(householdDetails?.name ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const memberCount = householdDetails?.members?.length ?? 1;
  const totalOutgoingPence = (overview?.shared_expenses_pence ?? 0) + (overview?.debt_payments_pence ?? 0);
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
            {formatCurrency(overview?.total_income_pence ?? 0)}
          </p>
        </Card>
        <Card className="h-full">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Shared Expenses</p>
          <p className="text-2xl font-bold text-[var(--color-danger)]">
            {formatCurrency(overview?.shared_expenses_pence ?? 0)}
          </p>
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
