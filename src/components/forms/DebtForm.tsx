import { useState } from 'react';
import type { Debt } from '../../types';
import { Input, Select } from '../ui/Input';
import { Button } from '../ui/Button';
import { poundsToPence, penceToPoundsStr } from '../../utils/formatters';

interface DebtFormProps {
  initial?: Debt;
  onSave: (data: Omit<Debt, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
}

export function DebtForm({ initial, onSave, onCancel }: DebtFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [balance, setBalance] = useState(initial ? penceToPoundsStr(initial.balance_pence) : '');
  const [interestRate, setInterestRate] = useState(String(initial?.interest_rate ?? '0'));
  const [minimumPayment, setMinimumPayment] = useState(
    initial ? penceToPoundsStr(initial.minimum_payment_pence) : '',
  );
  const [overpayment, setOverpayment] = useState(
    initial ? penceToPoundsStr(initial.overpayment_pence) : '0',
  );
  const [postingDay, setPostingDay] = useState(String(initial?.posting_day ?? '1'));
  const [isRecurring, setIsRecurring] = useState(initial?.is_recurring ?? true);
  const [recurrenceType, setRecurrenceType] = useState<string>(initial?.recurrence_type ?? 'monthly');
  const [startDate, setStartDate] = useState(initial?.start_date ?? '');
  const [endDate, setEndDate] = useState(initial?.end_date ?? '');
  const [isHousehold, setIsHousehold] = useState(initial?.is_household ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    if (isNaN(parseFloat(balance)) || parseFloat(balance) < 0) e.balance = 'Enter a valid balance';
    if (isNaN(parseFloat(interestRate)) || parseFloat(interestRate) < 0) e.interestRate = 'Enter a valid APR (0 for interest-free)';
    if (isNaN(parseFloat(minimumPayment)) || parseFloat(minimumPayment) < 0) e.minimumPayment = 'Enter a valid minimum payment';
    if (isNaN(parseFloat(overpayment)) || parseFloat(overpayment) < 0) e.overpayment = 'Enter a valid overpayment (0 if none)';
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
      balance_pence: poundsToPence(balance),
      interest_rate: parseFloat(interestRate),
      minimum_payment_pence: poundsToPence(minimumPayment),
      overpayment_pence: poundsToPence(overpayment),
      compounding_frequency: 'monthly',
      is_recurring: isRecurring,
      recurrence_type: recurrenceType,
      posting_day: parseInt(postingDay),
      start_date: startDate || null,
      end_date: endDate || null,
      is_household: isHousehold,
      split_ratio: isHousehold ? 0.5 : 1.0,
      notes: notes.trim() || null,
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
          value={interestRate}
          onChange={e => setInterestRate(e.target.value)}
          suffix="%"
          placeholder="0"
          error={errors.interestRate}
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
          label="Overpayment"
          type="number"
          step="0.01"
          min="0"
          value={overpayment}
          onChange={e => setOverpayment(e.target.value)}
          prefix="£"
          error={errors.overpayment}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Posting Day"
          type="number"
          min="1"
          max="31"
          value={postingDay}
          onChange={e => setPostingDay(e.target.value)}
        />
        <Select
          label="Recurrence"
          value={isRecurring ? recurrenceType : 'one-off'}
          onChange={e => {
            const v = e.target.value;
            if (v === 'one-off') {
              setIsRecurring(false);
            } else {
              setIsRecurring(true);
              setRecurrenceType(v);
            }
          }}
          options={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'yearly', label: 'Yearly' },
            { value: 'one-off', label: 'One-off' },
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Start Date (optional)"
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
        />
        <Input
          label="End Date (optional)"
          type="date"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isHousehold}
          onChange={e => setIsHousehold(e.target.checked)}
          className="w-4 h-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
        />
        <span className="text-sm text-[var(--color-text)]">
          Household debt <span className="text-[var(--color-text-muted)]">(split 50/50 with partner)</span>
        </span>
      </label>
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
