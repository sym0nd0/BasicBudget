import { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { PageShell } from '../components/layout/PageShell';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { IncomeForm } from '../components/forms/IncomeForm';
import { Badge } from '../components/ui/Badge';
import { formatCurrency, formatOrdinal } from '../utils/formatters';
import type { Income } from '../types';

interface IncomePageProps {
  onMenuClick: () => void;
}

export function IncomePage({ onMenuClick }: IncomePageProps) {
  const { state, dispatch } = useBudget();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Income | undefined>();

  const total = state.incomes.reduce((sum, i) => sum + i.amount, 0);

  const handleSave = (income: Income) => {
    if (editing) {
      dispatch({ type: 'UPDATE_INCOME', payload: income });
    } else {
      dispatch({ type: 'ADD_INCOME', payload: income });
    }
    setModalOpen(false);
    setEditing(undefined);
  };

  const handleEdit = (income: Income) => {
    setEditing(income);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this income entry?')) {
      dispatch({ type: 'DELETE_INCOME', payload: id });
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
      {/* Summary card */}
      <div className="mb-5">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">Total Monthly Income</p>
              <p className="text-3xl font-bold text-[var(--color-success)] mt-1">{formatCurrency(total)}</p>
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
        <CardHeader
          title="Income Sources"
          subtitle={`${state.incomes.length} source${state.incomes.length !== 1 ? 's' : ''}`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)]">
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Name</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Amount/mo</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Day</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Notes</th>
                <th className="px-5 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {state.incomes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-[var(--color-text-muted)]">
                    No income sources yet. Add one above.
                  </td>
                </tr>
              )}
              {state.incomes.map((income, idx) => (
                <tr
                  key={income.id}
                  className={[
                    'border-t border-[var(--color-border)] transition-colors hover:bg-[var(--color-surface-2)]',
                    idx % 2 === 0 ? '' : '',
                  ].join(' ')}
                >
                  <td className="px-5 py-3.5 font-medium text-[var(--color-text)]">{income.name}</td>
                  <td className="px-5 py-3.5 text-right font-mono font-semibold text-[var(--color-success)]">
                    {formatCurrency(income.amount)}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <Badge variant="default">{formatOrdinal(income.dayOfMonth)}</Badge>
                  </td>
                  <td className="px-5 py-3.5 text-[var(--color-text-muted)] max-w-xs truncate">
                    {income.notes || '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(income)}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(income.id)}
                        className="hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-light)]">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(undefined); }}
        title={editing ? 'Edit Income' : 'Add Income'}
      >
        <IncomeForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => { setModalOpen(false); setEditing(undefined); }}
        />
      </Modal>
    </PageShell>
  );
}
