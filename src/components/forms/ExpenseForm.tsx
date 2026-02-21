import { useState } from 'react';
import type { Expense, ExpenseCategory } from '../../types';
import { EXPENSE_CATEGORIES, ACCOUNTS } from '../../types';
import { Input, Select } from '../ui/Input';
import { Button } from '../ui/Button';
import { generateId } from '../../utils/id';

interface ExpenseFormProps {
  initial?: Expense;
  onSave: (expense: Expense) => void;
  onCancel: () => void;
}

export function ExpenseForm({ initial, onSave, onCancel }: ExpenseFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(String(initial?.amount ?? ''));
  const [dayOfMonth, setDayOfMonth] = useState(String(initial?.dayOfMonth ?? '1'));
  const [account, setAccount] = useState<Expense['account']>(initial?.account ?? 'First Direct');
  const [type, setType] = useState<Expense['type']>(initial?.type ?? 'fixed');
  const [category, setCategory] = useState<ExpenseCategory>(initial?.category ?? 'Other');
  const [isHousehold, setIsHousehold] = useState(initial?.isHousehold ?? false);
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
    const splitRatio = isHousehold ? 0.5 : 1.0;
    onSave({
      id: initial?.id ?? generateId(),
      name: name.trim(),
      amount: parseFloat(amount),
      dayOfMonth: parseInt(dayOfMonth),
      account,
      type,
      category,
      isHousehold,
      splitRatio,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Name"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="e.g. Netflix"
        error={errors.name}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Amount"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          prefix="£"
          error={errors.amount}
        />
        <Input
          label="Day of Month"
          type="number"
          min="1"
          max="31"
          value={dayOfMonth}
          onChange={e => setDayOfMonth(e.target.value)}
          error={errors.dayOfMonth}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Account"
          value={account}
          onChange={e => setAccount(e.target.value as Expense['account'])}
          options={ACCOUNTS.map(a => ({ value: a, label: a }))}
        />
        <Select
          label="Type"
          value={type}
          onChange={e => setType(e.target.value as Expense['type'])}
          options={[
            { value: 'fixed', label: 'Fixed' },
            { value: 'variable', label: 'Variable' },
          ]}
        />
      </div>
      <Select
        label="Category"
        value={category}
        onChange={e => setCategory(e.target.value as ExpenseCategory)}
        options={EXPENSE_CATEGORIES.map(c => ({ value: c, label: c }))}
      />
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isHousehold}
          onChange={e => setIsHousehold(e.target.checked)}
          className="w-4 h-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
        />
        <span className="text-sm text-[var(--color-text)]">
          Household expense <span className="text-[var(--color-text-muted)]">(split 50/50 with partner)</span>
        </span>
      </label>
      <Input
        label="Notes (optional)"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Any notes..."
      />
      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{initial ? 'Save Changes' : 'Add Expense'}</Button>
      </div>
    </form>
  );
}
