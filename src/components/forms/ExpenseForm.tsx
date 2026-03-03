import { useState } from 'react';
import type { Expense, Account, HouseholdMember } from '../../types';
import { EXPENSE_CATEGORIES } from '../../types';
import { Input, Select } from '../ui/Input';
import { Button } from '../ui/Button';
import { poundsToPence, penceToPoundsStr } from '../../utils/formatters';
import { useApi } from '../../hooks/useApi';

interface ExpenseFormProps {
  initial?: Expense;
  accounts: Account[];
  onSave: (data: Omit<Expense, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
}

export function ExpenseForm({ initial, accounts, onSave, onCancel }: ExpenseFormProps) {
  const { data: householdDetails } = useApi<{ id?: string; name?: string; members?: HouseholdMember[] }>('/household');
  const { data: categoriesData } = useApi<string[]>('/categories');
  const categories = categoriesData ?? EXPENSE_CATEGORIES;
  const memberCount = householdDetails?.members?.length ?? 2;
  const splitText = memberCount === 2 ? 'split equally with 2 members' : `split equally with ${memberCount} members`;

  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial ? penceToPoundsStr(initial.amount_pence) : '');
  const [postingDay, setPostingDay] = useState(String(initial?.posting_day ?? '1'));
  const [accountId, setAccountId] = useState(initial?.account_id ?? '');
  const [type, setType] = useState<'fixed' | 'variable'>(initial?.type ?? 'fixed');
  const [category, setCategory] = useState<string>(initial?.category ?? 'Other');
  const [isHousehold, setIsHousehold] = useState(initial?.is_household ?? false);
  const [isRecurring, setIsRecurring] = useState(initial?.is_recurring ?? true);
  const [recurrenceType, setRecurrenceType] = useState<'monthly' | 'weekly' | 'yearly' | 'fortnightly'>(
    initial?.recurrence_type ?? 'monthly',
  );
  const [startDate, setStartDate] = useState(initial?.start_date ?? '');
  const [endDate, setEndDate] = useState(initial?.end_date ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Helper: get next occurrence of a day of week (1=Mon, 7=Sun)
  const getNextOccurrenceOfDayOfWeek = (targetDow: number): string => {
    const today = new Date();
    const todayDow = today.getDay() === 0 ? 7 : today.getDay(); // Convert JS dow to ISO
    const daysUntil = targetDow >= todayDow ? targetDow - todayDow : 7 - todayDow + targetDow;
    const nextDate = new Date(today);
    nextDate.setDate(nextDate.getDate() + daysUntil);
    return nextDate.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) e.amount = 'Enter a valid amount';
    const day = parseInt(postingDay);
    if (recurrenceType === 'weekly' || recurrenceType === 'fortnightly') {
      if (isNaN(day) || day < 1 || day > 7) e.postingDay = 'Select a day of the week';
      if (!startDate) e.startDate = 'Start date is required for weekly/fortnightly items';
    } else {
      if (isNaN(day) || day < 1 || day > 31) e.postingDay = 'Enter a day between 1–31';
    }
    return e;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    const split_ratio = isHousehold ? 0.5 : 1.0;
    onSave({
      name: name.trim(),
      amount_pence: poundsToPence(amount),
      posting_day: parseInt(postingDay),
      account_id: accountId || null,
      type,
      category,
      is_household: isHousehold,
      split_ratio,
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
        {(recurrenceType === 'weekly' || recurrenceType === 'fortnightly') ? (
          <Select
            label="Day of Week"
            value={postingDay}
            onChange={e => {
              const newDow = parseInt(e.target.value, 10);
              setPostingDay(e.target.value);
              // Auto-adjust start_date to next occurrence of selected day of week
              setStartDate(getNextOccurrenceOfDayOfWeek(newDow));
            }}
            options={[
              { value: '1', label: 'Monday' },
              { value: '2', label: 'Tuesday' },
              { value: '3', label: 'Wednesday' },
              { value: '4', label: 'Thursday' },
              { value: '5', label: 'Friday' },
              { value: '6', label: 'Saturday' },
              { value: '7', label: 'Sunday' },
            ]}
            error={errors.postingDay}
          />
        ) : (
          <Input
            label="Posting Day"
            type="number"
            min="1"
            max="31"
            value={postingDay}
            onChange={e => setPostingDay(e.target.value)}
            error={errors.postingDay}
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Account"
          value={accountId}
          onChange={e => setAccountId(e.target.value)}
          options={[
            { value: '', label: 'None' },
            ...accounts.map(a => ({ value: a.id, label: a.name })),
          ]}
        />
        <Select
          label="Type"
          value={type}
          onChange={e => setType(e.target.value as 'fixed' | 'variable')}
          options={[
            { value: 'fixed', label: 'Fixed' },
            { value: 'variable', label: 'Variable' },
          ]}
        />
      </div>
      <Select
        label="Category"
        value={category}
        onChange={e => setCategory(e.target.value)}
        options={categories.map(c => ({ value: c, label: c }))}
      />
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
              const newType = v as 'monthly' | 'weekly' | 'yearly' | 'fortnightly';
              setRecurrenceType(newType);
              // Reset posting_day to valid default when switching to/from weekly/fortnightly
              if ((newType === 'weekly' || newType === 'fortnightly') && parseInt(postingDay) > 7) {
                setPostingDay('1'); // Default to Monday
              } else if ((newType === 'monthly' || newType === 'yearly') && parseInt(postingDay) <= 7) {
                setPostingDay('1'); // Default to 1st of month
              }
              // Auto-set start_date to next occurrence of day of week for weekly/fortnightly
              if (newType === 'weekly' || newType === 'fortnightly') {
                setStartDate(getNextOccurrenceOfDayOfWeek(1)); // Monday by default
              }
            }
          }}
          options={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'fortnightly', label: 'Fortnightly' },
            { value: 'yearly', label: 'Yearly' },
            { value: 'one-off', label: 'One-off' },
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label={recurrenceType === 'weekly' || recurrenceType === 'fortnightly' ? 'Start Date (required)' : 'Start Date (optional)'}
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          error={errors.startDate}
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
          Household expense <span className="text-[var(--color-text-muted)]">({splitText})</span>
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
