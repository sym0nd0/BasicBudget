import { useState, useMemo } from 'react';
import { useBudget } from '../context/BudgetContext';
import { PageShell } from '../components/layout/PageShell';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ExpenseForm } from '../components/forms/ExpenseForm';
import { Badge } from '../components/ui/Badge';
import { Select } from '../components/ui/Input';
import { formatCurrency, formatOrdinal } from '../utils/formatters';
import { EXPENSE_CATEGORIES } from '../types';
import type { Expense } from '../types';

interface ExpensesPageProps {
  onMenuClick: () => void;
}

export function ExpensesPage({ onMenuClick }: ExpensesPageProps) {
  const { state, dispatch } = useBudget();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | undefined>();
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const filtered = useMemo(() => {
    return state.expenses.filter(e => {
      if (filterCategory !== 'all' && e.category !== filterCategory) return false;
      if (filterType !== 'all' && e.type !== filterType) return false;
      return true;
    });
  }, [state.expenses, filterCategory, filterType]);

  const totalEffective = filtered.reduce((sum, e) => sum + e.amount * e.splitRatio, 0);
  const totalAll = state.expenses.reduce((sum, e) => sum + e.amount * e.splitRatio, 0);

  const handleSave = (expense: Expense) => {
    if (editing) {
      dispatch({ type: 'UPDATE_EXPENSE', payload: expense });
    } else {
      dispatch({ type: 'ADD_EXPENSE', payload: expense });
    }
    setModalOpen(false);
    setEditing(undefined);
  };

  const handleEdit = (expense: Expense) => {
    setEditing(expense);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this expense?')) {
      dispatch({ type: 'DELETE_EXPENSE', payload: id });
    }
  };

  const handleAdd = () => {
    setEditing(undefined);
    setModalOpen(true);
  };

  const typeVariant = (type: string) => type === 'fixed' ? 'info' : 'warning';

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
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <Card>
          <p className="text-sm text-[var(--color-text-muted)]">Your Share (All Expenses)</p>
          <p className="text-2xl font-bold text-[var(--color-danger)] mt-1">{formatCurrency(totalAll)}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">{state.expenses.length} expenses total</p>
        </Card>
        <Card>
          <p className="text-sm text-[var(--color-text-muted)]">Filtered Total</p>
          <p className="text-2xl font-bold text-[var(--color-text)] mt-1">{formatCurrency(totalEffective)}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">{filtered.length} shown</p>
        </Card>
      </div>

      {/* Filter bar */}
      <Card className="mb-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-40">
            <Select
              label="Category"
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              options={[
                { value: 'all', label: 'All Categories' },
                ...EXPENSE_CATEGORIES.map(c => ({ value: c, label: c })),
              ]}
            />
          </div>
          <div className="flex-1 min-w-40">
            <Select
              label="Type"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'fixed', label: 'Fixed' },
                { value: 'variable', label: 'Variable' },
              ]}
            />
          </div>
          {(filterCategory !== 'all' || filterType !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setFilterCategory('all'); setFilterType('all'); }}
            >
              Clear
            </Button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card padding={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title="Expenses"
            subtitle={`Showing ${filtered.length} of ${state.expenses.length} — your share: ${formatCurrency(totalEffective)}`}
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
                      {expense.isHousehold && (
                        <Badge variant="primary" className="text-[10px]">½</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[var(--color-text-muted)]">
                    {formatCurrency(expense.amount)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-semibold text-[var(--color-danger)]">
                    {formatCurrency(expense.amount * expense.splitRatio)}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <Badge variant="default">{formatOrdinal(expense.dayOfMonth)}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant="default">{expense.category}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant={typeVariant(expense.type)}>
                      {expense.type}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-[var(--color-text-muted)] text-xs">{expense.account}</td>
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
                  <td colSpan={1} className="px-5 py-3 text-right font-mono text-[var(--color-text-muted)]">
                    {formatCurrency(filtered.reduce((s, e) => s + e.amount, 0))}
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
        onClose={() => { setModalOpen(false); setEditing(undefined); }}
        title={editing ? 'Edit Expense' : 'Add Expense'}
      >
        <ExpenseForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => { setModalOpen(false); setEditing(undefined); }}
        />
      </Modal>
    </PageShell>
  );
}
