import { useState, useEffect } from 'react';
import { useBudget } from '../context/BudgetContext';
import { useFilter } from '../context/FilterContext';
import { useApi } from '../hooks/useApi';
import { api } from '../api/client';
import { addMonthsToYM } from '../utils/reportRanges';
import { PageShell } from '../components/layout/PageShell';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { IncomeForm } from '../components/forms/IncomeForm';
import { FilterBar } from '../components/layout/FilterBar';
import { Badge } from '../components/ui/Badge';
import { NewItemBadge } from '../components/ui/NewItemBadge';
import { SortableHeader } from '../components/ui/SortableHeader';
import { useSortableTable } from '../hooks/useSortableTable';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { useRangeOverview } from '../hooks/useRangeOverview';
import { usePreviousPeriod } from '../hooks/usePreviousPeriod';
import { DeltaIndicator } from '../components/ui/DeltaIndicator';
import { formatCurrency, formatOrdinal } from '../utils/formatters';
import { findDuplicateIncome } from '../utils/duplicates';
import { isNewInDisplayedMonth } from '../utils/newItem';
import type { Income } from '../types';

interface IncomePageProps {
  onMenuClick: () => void;
}

interface HouseholdMember { user_id: string; display_name: string; email: string }

interface IncomeRowProps {
  readonly income: Income;
  readonly prevIncome: Income | null;
  readonly showBadge: boolean;
  readonly getMemberName: (userId: string | null | undefined) => string;
  readonly onEdit: (income: Income) => void;
  readonly onDelete: (id: string) => void;
}

function IncomeRow({ income, prevIncome, showBadge, getMemberName, onEdit, onDelete }: IncomeRowProps) {
  return (
    <tr className="border-t border-[var(--color-border)] transition-colors hover:bg-[var(--color-surface-2)]">
      <td className="px-5 py-3 font-medium text-[var(--color-text)] text-center">
        <div className="flex items-center justify-center gap-2">
          {income.name}
          {showBadge && <NewItemBadge />}
          {income.is_recurring && (
            <Badge variant="info" className="text-[10px]">
              {income.recurrence_type}
            </Badge>
          )}
        </div>
      </td>
      <td className="px-5 py-3 text-[var(--color-text-muted)] text-sm text-center">
        {getMemberName(income.contributor_user_id)}
      </td>
      <td className="px-5 py-3 font-mono font-semibold text-[var(--color-success)] text-center">
        {formatCurrency(income.amount_pence)}
        <DeltaIndicator
          current={income.amount_pence}
          previous={prevIncome?.amount_pence ?? null}
          semantics="positive-up"
        />
      </td>
      <td className="px-5 py-3 text-center">
        <Badge variant="default">{formatOrdinal(income.posting_day)}</Badge>
      </td>
      <td className="px-5 py-3 text-center">
        <Badge variant="default">{income.gross_or_net}</Badge>
      </td>
      <td className="px-5 py-3 text-[var(--color-text-muted)] max-w-xs truncate text-center">
        {income.notes ?? '—'}
      </td>
      <td className="px-5 py-3 text-center">
        <div className="flex items-center gap-1 justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(income)}
            aria-label={`Edit ${income.name || income.id}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(income.id)}
            className="hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-light)]"
            aria-label={`Delete ${income.name || income.id}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </Button>
        </div>
      </td>
    </tr>
  );
}

export function IncomePage({ onMenuClick }: IncomePageProps) {
  const { incomes, addIncome, updateIncome, deleteIncome } = useBudget();
  const { sorted: sortedIncomes, sortKey, sortDir, toggleSort } = useSortableTable<Income>(incomes, 'name');
  const { isRangeActive, data: rangeOverview } = useRangeOverview();
  const showComparisons = !isRangeActive;
  const prevPeriod = usePreviousPeriod();
  const { activeMonth } = useFilter();
  const prevMonth = addMonthsToYM(activeMonth, -1);
  const { data: prevIncomes, refetch: refetchPrevIncomes } = useApi<Income[]>(
    showComparisons ? `/incomes?month=${prevMonth}` : null,
  );
  const { confirm, ConfirmDialogElement } = useConfirmDialog();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Income | undefined>();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const prevIncomeMap = new Map((prevIncomes ?? []).map(income => [income.id, income] as const));

  useEffect(() => {
    api.getHouseholdDetails().then((data) => {
      setMembers((data as { members?: HouseholdMember[] }).members ?? []);
    }).catch(() => {});
  }, []);

  const getMemberName = (userId: string | null | undefined) => {
    if (!userId) return '—';
    const m = members.find(m => m.user_id === userId);
    return m ? (m.display_name || m.email) : '—';
  };

  const total = isRangeActive && rangeOverview
    ? rangeOverview.reduce((s, r) => s + r.income_pence, 0)
    : incomes.reduce((s, i) => s + ((i as Income & { effective_pence?: number }).effective_pence ?? i.amount_pence), 0);

  const handleSave = async (data: Omit<Income, 'id' | 'created_at' | 'updated_at'>) => {
    if (!editing) {
      const dup = findDuplicateIncome(incomes, data);
      if (dup && !await confirm('Duplicate Income', 'An income with identical details already exists. Add anyway?')) return;
    }
    try {
      if (editing) {
        await updateIncome(editing.id, data);
      } else {
        await addIncome(data);
      }
      refetchPrevIncomes();
      setModalOpen(false);
      setEditing(undefined);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleEdit = (income: Income) => {
    setEditing(income);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!await confirm('Delete Income', 'Delete this income entry?', 'danger')) return;
    try {
      await deleteIncome(id);
      refetchPrevIncomes();
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleAdd = () => {
    setEditing(undefined);
    setModalOpen(true);
  };

  return (
    <PageShell
      title="Income"
      onMenuClick={onMenuClick}
      headerAction={
        <Button onClick={handleAdd} size="sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Income
        </Button>
      }
    >
      {/* Filter bar */}
      <div className="mb-5">
        <Card>
          <FilterBar />
        </Card>
      </div>

      {/* Summary card */}
      <div className="mb-5">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">Total Income</p>
              <p className="text-3xl font-bold text-[var(--color-success)] mt-1">{formatCurrency(total)}</p>
              <DeltaIndicator
                current={total}
                previous={prevPeriod?.income ?? null}
                semantics="positive-up"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{incomes.length} source{incomes.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[var(--color-success-light)] flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
              </svg>
            </div>
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card padding={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title="Income Sources"
            subtitle={`${incomes.length} source${incomes.length !== 1 ? 's' : ''}`}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)] group">
                <SortableHeader label="Name" sortKey="name" activeSortKey={sortKey as string} sortDir={sortDir} onSort={k => toggleSort(k as keyof Income)} />
                <SortableHeader label="Contributor" sortKey="contributor_user_id" activeSortKey={sortKey as string} sortDir={sortDir} onSort={k => toggleSort(k as keyof Income)} />
                <SortableHeader label="Amount/mo" sortKey="amount_pence" activeSortKey={sortKey as string} sortDir={sortDir} onSort={k => toggleSort(k as keyof Income)} />
                <SortableHeader label="Day" sortKey="posting_day" activeSortKey={sortKey as string} sortDir={sortDir} onSort={k => toggleSort(k as keyof Income)} />
                <SortableHeader label="Type" sortKey="recurrence_type" activeSortKey={sortKey as string} sortDir={sortDir} onSort={k => toggleSort(k as keyof Income)} />
                <th className="text-center px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Notes</th>
                <th className="text-center px-5 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {incomes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-[var(--color-text-muted)]">
                    No income sources for this month. Add one above.
                  </td>
                </tr>
              )}
              {sortedIncomes.map(income => {
                const prevIncome = prevIncomeMap.get(income.id) ?? null;
                const showBadge = isNewInDisplayedMonth(income, activeMonth);

                return (
                  <IncomeRow
                    key={income.id}
                    income={income}
                    prevIncome={prevIncome}
                    showBadge={showBadge}
                    getMemberName={getMemberName}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                );
              })}
              {/* Totals row */}
              {incomes.length > 0 && (
                <tr className="border-t-2 border-[var(--color-border)] bg-[var(--color-surface-2)]">
                  <td className="px-5 py-3 font-semibold text-[var(--color-text)] text-center">Total ({incomes.length})</td>
                  <td className="text-center"></td>
                  <td className="px-5 py-3 font-mono font-bold text-[var(--color-success)] text-center">{formatCurrency(total)}</td>
                  <td colSpan={4} className="text-center"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {ConfirmDialogElement}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(undefined); setErrorMsg(null); }}
        title={editing ? 'Edit Income' : 'Add Income'}
      >
        {errorMsg && (
          <p className="mb-3 text-sm text-[var(--color-danger)] bg-[var(--color-danger-light)] rounded-lg px-3 py-2">
            {errorMsg}
          </p>
        )}
        <IncomeForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => { setModalOpen(false); setEditing(undefined); setErrorMsg(null); }}
        />
      </Modal>
    </PageShell>
  );
}
