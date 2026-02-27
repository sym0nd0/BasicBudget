import { useState } from 'react';
import type { SavingsGoal } from '../../types';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { poundsToPence, penceToPoundsStr } from '../../utils/formatters';

interface SavingsGoalFormProps {
  initial?: SavingsGoal;
  onSave: (data: Omit<SavingsGoal, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
}

export function SavingsGoalForm({ initial, onSave, onCancel }: SavingsGoalFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [targetAmount, setTargetAmount] = useState(
    initial ? penceToPoundsStr(initial.target_amount_pence) : '',
  );
  const [currentAmount, setCurrentAmount] = useState(
    initial ? penceToPoundsStr(initial.current_amount_pence) : '0',
  );
  const [monthlyContribution, setMonthlyContribution] = useState(
    initial ? penceToPoundsStr(initial.monthly_contribution_pence) : '0',
  );
  const [targetDate, setTargetDate] = useState(initial?.target_date ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    const target = parseFloat(targetAmount);
    if (targetAmount.trim() !== '' && (isNaN(target) || target < 0)) e.targetAmount = 'Enter a valid target amount';
    const current = parseFloat(currentAmount);
    if (isNaN(current) || current < 0) e.currentAmount = 'Enter a valid current amount';
    const monthly = parseFloat(monthlyContribution);
    if (isNaN(monthly) || monthly < 0) e.monthlyContribution = 'Enter a valid monthly contribution';
    return e;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    onSave({
      name: name.trim(),
      target_amount_pence: targetAmount.trim() ? poundsToPence(targetAmount) : 0,
      current_amount_pence: poundsToPence(currentAmount),
      monthly_contribution_pence: poundsToPence(monthlyContribution),
      target_date: targetDate || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Savings Name"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="e.g. Emergency Fund"
        error={errors.name}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Target Amount (optional)"
          type="number"
          step="0.01"
          min="0"
          value={targetAmount}
          onChange={e => setTargetAmount(e.target.value)}
          prefix="£"
          error={errors.targetAmount}
        />
        <Input
          label="Current Amount"
          type="number"
          step="0.01"
          min="0"
          value={currentAmount}
          onChange={e => setCurrentAmount(e.target.value)}
          prefix="£"
          error={errors.currentAmount}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Monthly Contribution"
          type="number"
          step="0.01"
          min="0"
          value={monthlyContribution}
          onChange={e => setMonthlyContribution(e.target.value)}
          prefix="£"
          error={errors.monthlyContribution}
        />
        <Input
          label="Target Date (optional)"
          type="date"
          value={targetDate}
          onChange={e => setTargetDate(e.target.value)}
        />
      </div>
      <Input
        label="Notes (optional)"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Any notes..."
      />
      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{initial ? 'Save Changes' : 'Add Savings'}</Button>
      </div>
    </form>
  );
}
