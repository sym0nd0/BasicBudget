import { useState } from 'react';
import type { Income } from '../../types';
import { Input, Select } from '../ui/Input';
import { Button } from '../ui/Button';
import { poundsToPence, penceToPoundsStr } from '../../utils/formatters';

interface IncomeFormProps {
  initial?: Income;
  onSave: (data: Omit<Income, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
}

export function IncomeForm({ initial, onSave, onCancel }: IncomeFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial ? penceToPoundsStr(initial.amount_pence) : '');
  const [postingDay, setPostingDay] = useState(String(initial?.posting_day ?? '28'));
  const [contributorName, setContributorName] = useState(initial?.contributor_name ?? '');
  const [grossOrNet, setGrossOrNet] = useState<'gross' | 'net'>(initial?.gross_or_net ?? 'net');
  const [isRecurring, setIsRecurring] = useState(initial?.is_recurring ?? true);
  const [recurrenceType, setRecurrenceType] = useState<'monthly' | 'weekly' | 'yearly'>(
    initial?.recurrence_type ?? 'monthly',
  );
  const [startDate, setStartDate] = useState(initial?.start_date ?? '');
  const [endDate, setEndDate] = useState(initial?.end_date ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) e.amount = 'Enter a valid amount';
    const day = parseInt(postingDay);
    if (isNaN(day) || day < 1 || day > 31) e.postingDay = 'Enter a day between 1–31';
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
      amount_pence: poundsToPence(amount),
      posting_day: parseInt(postingDay),
      contributor_name: contributorName.trim() || null,
      gross_or_net: grossOrNet,
      is_recurring: isRecurring,
      recurrence_type: recurrenceType,
      start_date: startDate || null,
      end_date: endDate || null,
      notes: notes.trim() || null,
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
      <div className="grid grid-cols-2 gap-3">
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
          label="Posting Day"
          type="number"
          min="1"
          max="31"
          value={postingDay}
          onChange={e => setPostingDay(e.target.value)}
          error={errors.postingDay}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Contributor (optional)"
          value={contributorName}
          onChange={e => setContributorName(e.target.value)}
          placeholder="e.g. Partner"
        />
        <Select
          label="Gross or Net"
          value={grossOrNet}
          onChange={e => setGrossOrNet(e.target.value as 'gross' | 'net')}
          options={[
            { value: 'net', label: 'Net (take-home)' },
            { value: 'gross', label: 'Gross (before tax)' },
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Recurrence"
          value={isRecurring ? recurrenceType : 'one-off'}
          onChange={e => {
            const v = e.target.value;
            if (v === 'one-off') {
              setIsRecurring(false);
            } else {
              setIsRecurring(true);
              setRecurrenceType(v as 'monthly' | 'weekly' | 'yearly');
            }
          }}
          options={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'weekly', label: 'Weekly' },
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
