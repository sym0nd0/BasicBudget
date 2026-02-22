import { useState, useMemo } from 'react';
import { useBudget } from '../context/BudgetContext';
import { useFilter } from '../context/FilterContext';
import { PageShell } from '../components/layout/PageShell';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ExpenseForm } from '../components/forms/ExpenseForm';
import { Badge } from '../components/ui/Badge';
import { FilterBar } from '../components/layout/FilterBar';
import { formatCurrency, formatOrdinal } from '../utils/formatters';
import { findDuplicateExpense } from '../utils/duplicates';
import type { Expense } from '../types';

interface ExpensesPageProps {
  onMenuClick: () => void;
}

export function ExpensesPage({ onMenuClick }: ExpensesPageProps) {
  const { expenses, accounts, addExpense, updateExpense, deleteExpense } = useBudget();
  const { filterCategory } = useFilter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | undefined>();
  const [filterType, setFilterType] = useState<string>('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return expenses.filter(e => {
      if (filterCategory !== 'all' && e.category !== filterCategory) return false;
      if (filterType !== 'all' && e.type !== filterType) return false;
      return true;
    });
  }, [expenses, filterCategory, filterType]);

  const totalEffective = filtered.reduce((sum, e) => sum + Math.round(e.amount_pence * e.split_ratio), 0);
  const totalAll = expenses.reduce((sum, e) => sum + Math.round(e.amount_pence * e.split_ratio), 0);

  const handleSave = async (data: Omit<Expense, 'id' | 'created_at' | 'updated_at'>) => {
    if (!editing) {
      const dup = findDuplicateExpense(expenses, data);
      if (dup && !confirm('An expense with identical details already exists. Add anyway?')) return;
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
    if (!confirm('Delete this expense?')) return;
    try {
      await deleteExpense(id);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleAdd = () => {
    setEditing(undefined);
    setModalOpen(true);
  };

  const typeVariant = (type: string) => type === 'fixed' ? 'info' : 'warning';

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
          <p className="text-xs text-[var(--color-text-muted)] mt-1">{expenses.length} expenses total</p>
        </Card>
        <Card className="h-full">
          <p className="text-sm text-[var(--color-text-muted)]">Filtered Total</p>
          <p className="text-2xl font-bold text-[var(--color-text)] mt-1">{formatCurrency(totalEffective)}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">{filtered.length} shown</p>
        </Card>
      </div>

      {/* Type filter */}
      <Card className="mb-5">
        <div className="flex flex-wrap gap-2">
          {(['all', 'fixed', 'variable'] as const).map(t => (
            <Button
              key={t}
              size="sm"
              variant={filterType === t ? 'primary' : 'ghost'}
              onClick={() => setFilterType(t)}
            >
              {t === 'all' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1)}
            </Button>
          ))}
        </div>
      </Card>

      {/* Table */}
      <Card padding={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title="Expenses"
            subtitle={`Showing ${filtered.length} of ${expenses.length} — your share: ${formatCurrency(totalEffective)}`}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)]">
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Name</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Full Amount</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Your Share</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Day</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Category</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Type</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Account</th>
                <th className="px-5 py-3 w-24"></th>
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
              {filtered.map(expense => (
                <tr
                  key={expense.id}
                  className="border-t border-[var(--color-border)] transition-colors hover:bg-[var(--color-surface-2)]"
                >
                  <td className="px-5 py-3 font-medium text-[var(--color-text)]">
                    <div className="flex items-center gap-2">
                      {expense.name}
                      {expense.is_household && (
                        <Badge variant="primary" className="text-[10px]">½</Badge>
                      )}
                      {expense.is_recurring && (
                        <Badge variant="default" className="text-[10px]">{expense.recurrence_type}</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[var(--color-text-muted)]">
                    {formatCurrency(expense.amount_pence)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-semibold text-[var(--color-danger)]">
                    {formatCurrency(Math.round(expense.amount_pence * expense.split_ratio))}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <Badge variant="default">{formatOrdinal(expense.posting_day)}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant="default">{expense.category}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant={typeVariant(expense.type)}>
                      {expense.type}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-[var(--color-text-muted)] text-xs">
                    {accountName(expense.account_id)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 justify-end">
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
              ))}
              {/* Totals row */}
              {filtered.length > 0 && (
                <tr className="border-t-2 border-[var(--color-border)] bg-[var(--color-surface-2)]">
                  <td className="px-5 py-3 font-semibold text-[var(--color-text)]">
                    Total ({filtered.length})
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[var(--color-text-muted)]">
                    {formatCurrency(filtered.reduce((s, e) => s + e.amount_pence, 0))}
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-bold text-[var(--color-danger)]">
                    {formatCurrency(totalEffective)}
                  </td>
                  <td colSpan={5}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

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
