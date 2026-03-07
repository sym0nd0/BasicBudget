import { useState } from 'react';
import { useSavings } from '../context/SavingsContext';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { PageShell } from '../components/layout/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { SavingsGoalForm } from '../components/forms/SavingsGoalForm';
import { Badge } from '../components/ui/Badge';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { findDuplicateSavingsGoal } from '../utils/duplicates';
import type { SavingsGoal } from '../types';

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

export function SavingsPage({ onMenuClick }: SavingsPageProps) {
  const { goals, addGoal, updateGoal, deleteGoal } = useSavings();
  const { confirm, ConfirmDialogElement } = useConfirmDialog();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SavingsGoal | undefined>();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  const handleDelete = async (id: string) => {
    if (!await confirm('Delete Savings Goal', 'Delete this savings goal?', 'danger')) return;
    try {
      await deleteGoal(id);
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
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {ConfirmDialogElement}
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
    </PageShell>
  );
}
