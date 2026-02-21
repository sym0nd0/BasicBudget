import { useState } from 'react';
import type { Debt } from '../../types';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { generateId } from '../../utils/id';

interface DebtFormProps {
  initial?: Debt;
  onSave: (debt: Debt) => void;
  onCancel: () => void;
}

export function DebtForm({ initial, onSave, onCancel }: DebtFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [balance, setBalance] = useState(String(initial?.balance ?? ''));
  const [apr, setApr] = useState(String(initial?.apr ?? '0'));
  const [minimumPayment, setMinimumPayment] = useState(String(initial?.minimumPayment ?? ''));
  const [currentPayment, setCurrentPayment] = useState(String(initial?.currentPayment ?? ''));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    if (isNaN(parseFloat(balance)) || parseFloat(balance) < 0) e.balance = 'Enter a valid balance';
    if (isNaN(parseFloat(apr)) || parseFloat(apr) < 0) e.apr = 'Enter a valid APR (0 for interest-free)';
    if (isNaN(parseFloat(minimumPayment)) || parseFloat(minimumPayment) < 0) e.minimumPayment = 'Enter a valid minimum payment';
    const cp = parseFloat(currentPayment);
    if (isNaN(cp) || cp < 0) e.currentPayment = 'Enter a valid payment';
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
      balance: parseFloat(balance),
      apr: parseFloat(apr),
      minimumPayment: parseFloat(minimumPayment),
      currentPayment: parseFloat(currentPayment),
      notes: notes.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Debt Name"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="e.g. Tesco Credit Card"
        error={errors.name}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Current Balance"
          type="number"
          step="0.01"
          min="0"
          value={balance}
          onChange={e => setBalance(e.target.value)}
          prefix="£"
          error={errors.balance}
        />
        <Input
          label="APR (%)"
          type="number"
          step="0.1"
          min="0"
          value={apr}
          onChange={e => setApr(e.target.value)}
          suffix="%"
          placeholder="0"
          error={errors.apr}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Minimum Payment"
          type="number"
          step="0.01"
          min="0"
          value={minimumPayment}
          onChange={e => setMinimumPayment(e.target.value)}
          prefix="£"
          error={errors.minimumPayment}
        />
        <Input
          label="Current Payment"
          type="number"
          step="0.01"
          min="0"
          value={currentPayment}
          onChange={e => setCurrentPayment(e.target.value)}
          prefix="£"
          error={errors.currentPayment}
        />
      </div>
      <Input
        label="Notes (optional)"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="e.g. 0% ends June 2025"
      />
      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{initial ? 'Save Changes' : 'Add Debt'}</Button>
      </div>
    </form>
  );
}
