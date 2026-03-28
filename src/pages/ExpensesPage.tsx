import { useState, useMemo, Fragment } from 'react';
import { useBudget } from '../context/BudgetContext';
import { useFilter } from '../context/FilterContext';
import { PageShell } from '../components/layout/PageShell';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ExpenseForm } from '../components/forms/ExpenseForm';
import { Badge } from '../components/ui/Badge';
import { FilterBar } from '../components/layout/FilterBar';
import { SortableHeader } from '../components/ui/SortableHeader';
import { useSortableTable } from '../hooks/useSortableTable';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { useRangeOverview } from '../hooks/useRangeOverview';
import { usePreviousPeriod } from '../hooks/usePreviousPeriod';
import { DeltaIndicator } from '../components/ui/DeltaIndicator';
import { formatCurrency, formatOrdinal, formatPercent } from '../utils/formatters';
import { findDuplicateExpense } from '../utils/duplicates';
import type { Expense } from '../types';

interface ExpensesPageProps {
  onMenuClick: () => void;
}

type ExpenseRow = Expense & {
  display_full_pence: number;
  display_share_pence: number;
};

export function ExpensesPage({ onMenuClick }: ExpensesPageProps) {
  const { expenses, accounts, addExpense, updateExpense, deleteExpense } = useBudget();
  const { filterCategory } = useFilter();
  const { isRangeActive, data: rangeOverview } = useRangeOverview();
  const prevPeriod = usePreviousPeriod();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | undefined>();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const preFiltered = useMemo<ExpenseRow[]>(() => {
    return expenses
      .filter(expense => {
        if (filterCategory !== 'all' && expense.category !== filterCategory) return false;
        return true;
      })
      .map(expense => {
        const splitRatio = expense.split_ratio ?? 1;
        const monthlyShare = Math.round(expense.amount_pence * splitRatio);
        const display_full_pence = isRangeActive
          ? expense.range_full_pence ?? expense.amount_pence
          : expense.amount_pence;
        const display_share_pence = isRangeActive
          ? expense.range_share_pence ?? monthlyShare
          : monthlyShare;
        return {
          ...expense,
          display_full_pence,
          display_share_pence,
        };
      });
  }, [expenses, filterCategory, isRangeActive]);

  const { sorted: filtered, sortKey, sortDir, toggleSort } = useSortableTable<ExpenseRow>(preFiltered, 'name');
  const { confirm, ConfirmDialogElement } = useConfirmDialog();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggleExpand = (id: string) => setExpandedId(prev => prev === id ? null : id);

  const tableTotalEffective = filtered.reduce((sum, e) => sum + e.display_share_pence, 0);
  const tableTotalFull = filtered.reduce((sum, e) => sum + e.display_full_pence, 0);
  const totalAll = isRangeActive && rangeOverview
    ? rangeOverview.reduce((sum, row) => sum + row.expenses_pence, 0)
    : expenses.reduce((sum, e) => sum + Math.round(e.amount_pence * e.split_ratio), 0);
  const totalEffective = isRangeActive && rangeOverview
    ? filterCategory === 'all'
      ? rangeOverview.reduce((sum, row) => sum + row.expenses_pence, 0)
      : rangeOverview.reduce((sum, row) => {
        const categoryMatch = row.category_breakdown.find(cat => cat.category === filterCategory);
        return sum + (categoryMatch?.total_pence ?? 0);
      }, 0)
    : tableTotalEffective;

  const handleSave = async (data: Omit<Expense, 'id' | 'created_at' | 'updated_at'>) => {
    if (!editing) {
      const dup = findDuplicateExpense(expenses, data);
      if (dup && !await confirm('Duplicate Expense', 'An expense with identical details already exists. Add anyway?')) return;
    }
    try {
      if (editing) {
        await updateExpense(editing.id, data);
      } else {
        await addExpense(data);
      }
      setModalOpen(false);
      setEditing(undefined);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditing(expense);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!await confirm('Delete Expense', 'Delete this expense?', 'danger')) return;
    try {
      await deleteExpense(id);
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleAdd = () => {
    setEditing(undefined);
    setModalOpen(true);
  };

  // Find account name from accounts list
  const accountName = (accountId: string | null | undefined) => {
    if (!accountId) return '—';
    return accounts.find(a => a.id === accountId)?.name ?? '—';
  };

  return (
    <PageShell
      title="Expenses"
      onMenuClick={onMenuClick}
      headerAction={
        <Button onClick={handleAdd} size="sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Expense
        </Button>
      }
    >
      {/* Filter bar */}
      <div className="mb-5">
        <Card>
          <FilterBar showCategory />
        </Card>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <Card className="h-full">
          <p className="text-sm text-[var(--color-text-muted)]">Your Share (All Expenses)</p>
          <p className="text-2xl font-bold text-[var(--color-danger)] mt-1">{formatCurrency(totalAll)}</p>
          <DeltaIndicator
            current={totalAll}
            previous={prevPeriod?.expenses ?? null}
            semantics="positive-down"
          />
          <p className="text-xs text-[var(--color-text-muted)] mt-1">{expenses.length} expenses total</p>
        </Card>
        <Card className="h-full">
          <p className="text-sm text-[var(--color-text-muted)]">Filtered Total</p>
          <p className="text-2xl font-bold text-[var(--color-text)] mt-1">{formatCurrency(totalEffective)}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">{filtered.length} shown</p>
        </Card>
      </div>

      {/* Table */}
      <Card padding={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title="Expenses"
            subtitle={`Showing ${filtered.length} of ${expenses.length} — your share: ${formatCurrency(tableTotalEffective)}`}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)] group">
                <SortableHeader label="Name" sortKey="name" activeSortKey={sortKey as string} sortDir={sortDir} onSort={k => toggleSort(k as keyof ExpenseRow)} />
                <SortableHeader label="Full Amount" sortKey="display_full_pence" activeSortKey={sortKey as string} sortDir={sortDir} onSort={k => toggleSort(k as keyof ExpenseRow)} />
                <th className="text-center px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Your Share</th>
                <SortableHeader label="Day" sortKey="posting_day" activeSortKey={sortKey as string} sortDir={sortDir} onSort={k => toggleSort(k as keyof ExpenseRow)} />
                <SortableHeader label="Category" sortKey="category" activeSortKey={sortKey as string} sortDir={sortDir} onSort={k => toggleSort(k as keyof ExpenseRow)} />
                <th className="text-center px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Account</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Notes</th>
                <th className="text-center px-5 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-[var(--color-text-muted)]">
                    No expenses match your filters.
                  </td>
                </tr>
              )}
              {filtered.map(expense => {
                const isExpanded = expandedId === expense.id;
                return (
                  <Fragment key={expense.id}>
                    <tr
                      className="border-t border-[var(--color-border)] transition-colors hover:bg-[var(--color-surface-2)] cursor-pointer"
                      onClick={() => toggleExpand(expense.id)}
                    >
                      <td className="px-5 py-3 font-medium text-[var(--color-text)] text-center">
                        <div className="flex items-center justify-center gap-2">
                          <svg
                            className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                          {expense.name}
                          {expense.is_household && (
                            <Badge variant="primary" className="text-[10px]">½</Badge>
                          )}
                          {expense.is_recurring && (
                            <Badge variant="default" className="text-[10px]">{expense.recurrence_type}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-[var(--color-text-muted)] text-center">
                        {formatCurrency(expense.display_full_pence)}
                      </td>
                      <td className="px-5 py-3 font-mono font-semibold text-[var(--color-danger)] text-center">
                        {formatCurrency(expense.display_share_pence)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <Badge variant="default">{formatOrdinal(expense.posting_day)}</Badge>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <Badge variant="default">{expense.category}</Badge>
                      </td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)] text-xs text-center">
                        {accountName(expense.account_id)}
                      </td>
                      <td className="px-5 py-3 text-[var(--color-text-muted)] text-xs max-w-[140px] truncate text-center">
                        {expense.notes ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-center">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(expense)}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(expense.id)}
                            className="hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-light)]">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="border-t border-[var(--color-border)]">
                        <td colSpan={8} className="px-5 py-4 bg-[var(--color-surface-2)]">
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3 text-sm">
                            <div>
                              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-0.5">Start Date</p>
                              <p className="text-[var(--color-text)]">{expense.start_date ?? '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-0.5">End Date</p>
                              <p className="text-[var(--color-text)]">{expense.end_date ?? '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-0.5">Recurring</p>
                              <p className="text-[var(--color-text)]">{expense.is_recurring ? expense.recurrence_type : 'No'}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-0.5">Split</p>
                              <p className="text-[var(--color-text)]">{formatPercent(expense.split_ratio * 100)}</p>
                            </div>
                            {expense.notes && (
                              <div className="col-span-2">
                                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-0.5">Notes</p>
                                <p className="text-[var(--color-text)]">{expense.notes}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-0.5">Created</p>
                              <p className="text-xs text-[var(--color-text-muted)]">{expense.created_at ?? '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-0.5">Updated</p>
                              <p className="text-xs text-[var(--color-text-muted)]">{expense.updated_at ?? '—'}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {/* Totals row */}
              {filtered.length > 0 && (
                <tr className="border-t-2 border-[var(--color-border)] bg-[var(--color-surface-2)]">
                  <td className="px-5 py-3 font-semibold text-[var(--color-text)] text-center">
                    Total ({filtered.length})
                  </td>
                  <td className="px-5 py-3 font-mono text-[var(--color-text-muted)] text-center">
                    {formatCurrency(tableTotalFull)}
                  </td>
                  <td className="px-5 py-3 font-mono font-bold text-[var(--color-danger)] text-center">
                    {formatCurrency(tableTotalEffective)}
                  </td>
                  <td colSpan={6} className="text-center"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {ConfirmDialogElement}
      {errorMsg && !modalOpen && (
        <p className="mb-4 text-sm text-[var(--color-danger)] bg-[var(--color-danger-light)] rounded-lg px-3 py-2">
          {errorMsg}
        </p>
      )}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(undefined); setErrorMsg(null); }}
        title={editing ? 'Edit Expense' : 'Add Expense'}
      >
        {errorMsg && (
          <p className="mb-3 text-sm text-[var(--color-danger)] bg-[var(--color-danger-light)] rounded-lg px-3 py-2">
            {errorMsg}
          </p>
        )}
        <ExpenseForm
          initial={editing}
          accounts={accounts}
          onSave={handleSave}
          onCancel={() => { setModalOpen(false); setEditing(undefined); setErrorMsg(null); }}
        />
      </Modal>
    </PageShell>
  );
}
