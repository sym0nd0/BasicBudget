import { useState } from 'react';
import { useSavings } from '../context/SavingsContext';
import { useFilter } from '../context/FilterContext';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { useApi } from '../hooks/useApi';
import { PageShell } from '../components/layout/PageShell';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { FilterBar } from '../components/layout/FilterBar';
import { SavingsGoalForm } from '../components/forms/SavingsGoalForm';
import { SavingsGrowthChart } from '../components/charts/SavingsGrowthChart';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { findDuplicateSavingsGoal } from '../utils/duplicates';
import type { SavingsGoal, SavingsTransaction, SavingsTransactionType } from '../types';

interface SavingsPageProps {
  onMenuClick: () => void;
}

function monthsToGoal(goal: SavingsGoal): number | null {
  const remaining = goal.target_amount_pence - goal.current_amount_pence;
  if (remaining <= 0) return 0;
  if (goal.monthly_contribution_pence <= 0) return null;
  return Math.ceil(remaining / goal.monthly_contribution_pence);
}

function progressPercent(goal: SavingsGoal): number {
  if (goal.target_amount_pence <= 0) return 0;
  return Math.min(100, (goal.current_amount_pence / goal.target_amount_pence) * 100);
}

function txTypeBadgeVariant(type: SavingsTransactionType): 'success' | 'warning' {
  return type === 'withdrawal' ? 'warning' : 'success';
}

function txTypeLabel(type: SavingsTransactionType): string {
  if (type === 'contribution') return 'Auto';
  if (type === 'deposit') return 'Deposit';
  return 'Withdrawal';
}

export function SavingsPage({ onMenuClick }: SavingsPageProps) {
  const { goals, addGoal, updateGoal, deleteGoal, createTransaction, refetchGoals } = useSavings();
  const { fromMonth, toMonth } = useFilter();
  const { confirm, ConfirmDialogElement } = useConfirmDialog();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SavingsGoal | undefined>();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Combined deposit/withdrawal modal
  const [txGoal, setTxGoal] = useState<SavingsGoal | undefined>();
  const [txType, setTxType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [txAmount, setTxAmount] = useState('');
  const [txNotes, setTxNotes] = useState('');
  const [txError, setTxError] = useState<string | null>(null);

  const txUrl = `/savings-goals/transactions?from=${fromMonth}&to=${toMonth}`;
  const { data: transactions, refetch: refetchTx } = useApi<SavingsTransaction[]>(txUrl);

  const totalSaved = goals.reduce((s, g) => s + g.current_amount_pence, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target_amount_pence, 0);
  const totalMonthly = goals.reduce((s, g) => s + g.monthly_contribution_pence, 0);

  const handleSave = async (data: Omit<SavingsGoal, 'id' | 'created_at' | 'updated_at'>) => {
    if (!editing) {
      const dup = findDuplicateSavingsGoal(goals, data);
      if (dup && !await confirm('Duplicate Savings Goal', 'A savings goal with identical details already exists. Add anyway?')) return;
    }
    try {
      if (editing) {
        await updateGoal(editing.id, data);
      } else {
        await addGoal(data);
      }
      setModalOpen(false);
      setEditing(undefined);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleEdit = (goal: SavingsGoal) => {
    setEditing(goal);
    setModalOpen(true);
  };

  const openTxModal = (goal: SavingsGoal, type: 'deposit' | 'withdrawal') => {
    setTxGoal(goal);
    setTxType(type);
    setTxAmount('');
    setTxNotes('');
    setTxError(null);
  };

  const handleTxSubmit = async () => {
    if (!txGoal) return;
    const pounds = parseFloat(txAmount);
    if (isNaN(pounds) || pounds <= 0) {
      setTxError('Please enter a valid amount.');
      return;
    }
    const pence = Math.round(pounds * 100);
    try {
      await createTransaction(txGoal.id, { type: txType, amount_pence: pence, notes: txNotes.trim() || null });
      refetchTx();
      setTxGoal(undefined);
      setTxAmount('');
      setTxNotes('');
      setTxError(null);
    } catch (err) {
      setTxError((err as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!await confirm('Delete Savings Goal', 'Delete this savings goal?', 'danger')) return;
    try {
      await deleteGoal(id);
      refetchGoals();
      refetchTx();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <PageShell
      title="Savings"
      onMenuClick={onMenuClick}
      headerAction={
        <Button onClick={() => { setEditing(undefined); setModalOpen(true); }} size="sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Savings
        </Button>
      }
    >
      {/* Filter bar */}
      <div className="mb-5">
        <Card>
          <FilterBar />
        </Card>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5 items-stretch">
        <Card className="h-full">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Total Saved</p>
          <p className="text-2xl font-bold text-[var(--color-success)]">{formatCurrency(totalSaved)}</p>
        </Card>
        <Card className="h-full">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Total Target</p>
          <p className="text-2xl font-bold text-[var(--color-primary)]">{formatCurrency(totalTarget)}</p>
        </Card>
        <Card className="h-full">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Monthly Contributions</p>
          <p className="text-2xl font-bold text-[var(--color-warning)]">{formatCurrency(totalMonthly)}</p>
        </Card>
      </div>

      {/* Goals list */}
      {goals.length === 0 ? (
        <Card>
          <p className="text-center py-8 text-[var(--color-text-muted)]">
            No savings goals yet. Add one above.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {goals.map(goal => {
            const hasTarget = goal.target_amount_pence > 0;
            const progress = hasTarget ? progressPercent(goal) : 0;
            const months = hasTarget ? monthsToGoal(goal) : null;
            const achieved = hasTarget && progress >= 100;

            return (
              <Card key={goal.id}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[var(--color-text)]">{goal.name}</h3>
                      {achieved && <Badge variant="success">Achieved!</Badge>}
                      {Boolean(goal.auto_contribute) && (
                        <Badge variant="primary">Auto</Badge>
                      )}
                    </div>
                    {goal.notes && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{goal.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(goal)}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </Button>
                    {/* Deposit button */}
                    <Button variant="ghost" size="sm"
                      className="hover:text-[var(--color-success)] hover:bg-[var(--color-success-light)]"
                      onClick={() => openTxModal(goal, 'deposit')}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    </Button>
                    {/* Withdraw button */}
                    <Button variant="ghost" size="sm"
                      className="hover:text-[var(--color-warning)] hover:bg-[var(--color-warning-light)]"
                      onClick={() => openTxModal(goal, 'withdrawal')}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(goal.id)}
                      className="hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-light)]">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </Button>
                  </div>
                </div>

                {/* Progress bar — only shown when a target is set */}
                {hasTarget && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1">
                      <span>{formatCurrency(goal.current_amount_pence)} saved</span>
                      <span>{formatCurrency(goal.target_amount_pence)} target</span>
                    </div>
                    <div className="w-full bg-[var(--color-surface-2)] rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${achieved ? 'bg-[var(--color-success)]' : 'bg-[var(--color-primary)]'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">{formatPercent(progress)} complete</p>
                  </div>
                )}

                {/* Stats */}
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="text-[var(--color-text-muted)]">
                    Saved: <span className="font-medium text-[var(--color-text)]">{formatCurrency(goal.current_amount_pence)}</span>
                  </span>
                  {goal.monthly_contribution_pence > 0 && (
                    <span className="text-[var(--color-text-muted)]">
                      <span className="font-medium text-[var(--color-text)]">{formatCurrency(goal.monthly_contribution_pence)}</span>/mo
                    </span>
                  )}
                  {months !== null && !achieved && (
                    <span className="text-[var(--color-text-muted)]">
                      ~<span className="font-medium text-[var(--color-text)]">{months}</span> months to target
                    </span>
                  )}
                  {goal.target_date && (
                    <span className="text-[var(--color-text-muted)]">
                      Target: <span className="font-medium text-[var(--color-text)]">
                        {new Date(goal.target_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                      </span>
                    </span>
                  )}
                  {Boolean(goal.auto_contribute) && goal.contribution_day && (
                    <span className="text-[var(--color-text-muted)]">
                      Auto on day <span className="font-medium text-[var(--color-text)]">{goal.contribution_day}</span>
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Savings Balance chart */}
      {(transactions?.length ?? 0) > 0 && (
        <div className="mt-6">
          <Card padding={false}>
            <div className="px-5 pt-5">
              <CardHeader title="Savings Balance" subtitle="Balance progression over time" />
            </div>
            <div className="px-5 pb-5">
              <SavingsGrowthChart transactions={transactions ?? []} goals={goals} />
            </div>
          </Card>
        </div>
      )}

      {/* Transaction history */}
      <div className="mt-6">
        <Card padding={false}>
          <div className="px-5 pt-5">
            <CardHeader title="Transaction History" subtitle="All deposits, withdrawals, and auto-contributions" />
          </div>
          {!transactions || transactions.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-[var(--color-text-muted)]">No transactions in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left px-5 py-2 text-xs text-[var(--color-text-muted)] font-medium">Date</th>
                    <th className="text-left px-5 py-2 text-xs text-[var(--color-text-muted)] font-medium">Goal</th>
                    <th className="text-left px-5 py-2 text-xs text-[var(--color-text-muted)] font-medium">Type</th>
                    <th className="text-right px-5 py-2 text-xs text-[var(--color-text-muted)] font-medium">Amount</th>
                    <th className="text-right px-5 py-2 text-xs text-[var(--color-text-muted)] font-medium">Balance After</th>
                    <th className="text-left px-5 py-2 text-xs text-[var(--color-text-muted)] font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-5 py-2.5 text-[var(--color-text-muted)] whitespace-nowrap">
                        {tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-5 py-2.5 text-[var(--color-text)]">{tx.goal_name ?? '—'}</td>
                      <td className="px-5 py-2.5">
                        <Badge variant={txTypeBadgeVariant(tx.type)}>{txTypeLabel(tx.type)}</Badge>
                      </td>
                      <td className="px-5 py-2.5 text-right font-medium text-[var(--color-text)]">
                        {tx.type === 'withdrawal' ? '−' : '+'}{formatCurrency(tx.amount_pence)}
                      </td>
                      <td className="px-5 py-2.5 text-right text-[var(--color-text-muted)]">
                        {formatCurrency(tx.balance_after_pence)}
                      </td>
                      <td className="px-5 py-2.5 text-[var(--color-text-muted)]">{tx.notes ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {ConfirmDialogElement}

      {/* Add/Edit modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(undefined); setErrorMsg(null); }}
        title={editing ? 'Edit Savings' : 'Add Savings'}
      >
        {errorMsg && (
          <p className="mb-3 text-sm text-[var(--color-danger)] bg-[var(--color-danger-light)] rounded-lg px-3 py-2">
            {errorMsg}
          </p>
        )}
        <SavingsGoalForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => { setModalOpen(false); setEditing(undefined); setErrorMsg(null); }}
        />
      </Modal>

      {/* Deposit / Withdrawal modal */}
      <Modal
        isOpen={!!txGoal}
        onClose={() => { setTxGoal(undefined); setTxAmount(''); setTxNotes(''); setTxError(null); }}
        title={txType === 'deposit' ? 'Deposit to Savings' : 'Withdraw from Savings'}
      >
        {txError && (
          <p className="mb-3 text-sm text-[var(--color-danger)] bg-[var(--color-danger-light)] rounded-lg px-3 py-2">{txError}</p>
        )}
        {/* Type toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTxType('deposit')}
            className={[
              'flex-1 py-1.5 rounded text-sm font-medium transition-colors',
              txType === 'deposit'
                ? 'bg-[var(--color-success)] text-white'
                : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
            ].join(' ')}
          >
            Deposit
          </button>
          <button
            onClick={() => setTxType('withdrawal')}
            className={[
              'flex-1 py-1.5 rounded text-sm font-medium transition-colors',
              txType === 'withdrawal'
                ? 'bg-[var(--color-warning)] text-white'
                : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
            ].join(' ')}
          >
            Withdraw
          </button>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] mb-3">
          Current balance: <span className="font-medium text-[var(--color-text)]">{txGoal && formatCurrency(txGoal.current_amount_pence)}</span>
        </p>
        <Input
          label="Amount (£)"
          type="number"
          step="0.01"
          min="0.01"
          value={txAmount}
          onChange={e => setTxAmount(e.target.value)}
          autoFocus
        />
        <div className="mt-3">
          <Input
            label="Notes (optional)"
            value={txNotes}
            onChange={e => setTxNotes(e.target.value)}
            placeholder="e.g. Holiday fund top-up"
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => { setTxGoal(undefined); setTxAmount(''); setTxNotes(''); setTxError(null); }}>Cancel</Button>
          <Button onClick={handleTxSubmit}>{txType === 'deposit' ? 'Deposit' : 'Withdraw'}</Button>
        </div>
      </Modal>
    </PageShell>
  );
}
