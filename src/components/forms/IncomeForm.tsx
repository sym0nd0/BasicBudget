import { useState } from 'react';
import type { Income } from '../../types';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { generateId } from '../../utils/id';

interface IncomeFormProps {
  initial?: Income;
  onSave: (income: Income) => void;
  onCancel: () => void;
}

export function IncomeForm({ initial, onSave, onCancel }: IncomeFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(String(initial?.amount ?? ''));
  const [dayOfMonth, setDayOfMonth] = useState(String(initial?.dayOfMonth ?? '28'));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) e.amount = 'Enter a valid amount';
    const day = parseInt(dayOfMonth);
    if (isNaN(day) || day < 1 || day > 31) e.dayOfMonth = 'Enter a day between 1–31';
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
      id: initial?.id ?? generateId(),
      name: name.trim(),
      amount: parseFloat(amount),
      dayOfMonth: parseInt(dayOfMonth),
      notes: notes.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Name"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="e.g. Salary"
        error={errors.name}
      />
      <Input
        label="Monthly Amount"
        type="number"
        step="0.01"
        min="0"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        prefix="£"
        error={errors.amount}
      />
      <Input
        label="Day of Month Received"
        type="number"
        min="1"
        max="31"
        value={dayOfMonth}
        onChange={e => setDayOfMonth(e.target.value)}
        error={errors.dayOfMonth}
      />
      <Input
        label="Notes (optional)"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Any notes..."
      />
      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{initial ? 'Save Changes' : 'Add Income'}</Button>
      </div>
    </form>
  );
}
