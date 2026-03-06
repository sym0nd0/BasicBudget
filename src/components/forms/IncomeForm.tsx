import { useState, useEffect } from 'react';
import type { Income } from '../../types';
import { Input, Select } from '../ui/Input';
import { Button } from '../ui/Button';
import { poundsToPence, penceToPoundsStr } from '../../utils/formatters';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

interface IncomeFormProps {
  initial?: Income;
  onSave: (data: Omit<Income, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
}

interface HouseholdMember {
  user_id: string;
  display_name: string;
  email: string;
}

export function IncomeForm({ initial, onSave, onCancel }: IncomeFormProps) {
  const { user } = useAuth();
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial ? penceToPoundsStr(initial.amount_pence) : '');
  const [postingDay, setPostingDay] = useState(String(initial?.posting_day ?? '28'));
  const [contributorUserId, setContributorUserId] = useState(initial?.contributor_user_id ?? '');
  const [grossOrNet, setGrossOrNet] = useState<'gross' | 'net'>(initial?.gross_or_net ?? 'net');
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

  useEffect(() => {
    api.getHouseholdDetails().then((data) => {
      const raw = (data as { members?: HouseholdMember[] }).members ?? [];
      const currentUser = raw.find(m => m.user_id === user?.id);
      const others = raw
        .filter(m => m.user_id !== user?.id)
        .sort((a, b) => (a.display_name || a.email).localeCompare(b.display_name || b.email));
      setMembers(currentUser ? [currentUser, ...others] : others);
    }).catch(() => {});
  }, [user?.id]);

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
    onSave({
      name: name.trim(),
      amount_pence: poundsToPence(amount),
      posting_day: parseInt(postingDay),
      contributor_user_id: contributorUserId || null,
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
          label="Contributor (optional)"
          value={contributorUserId}
          onChange={e => setContributorUserId(e.target.value)}
          options={[
            { value: '', label: '— None —' },
            ...members.map(m => ({ value: m.user_id, label: m.display_name || m.email })),
          ]}
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
              const newType = v as 'monthly' | 'weekly' | 'yearly' | 'fortnightly';
              setRecurrenceType(newType);
              // Reset posting_day to valid default when switching to/from weekly/fortnightly
              if ((newType === 'weekly' || newType === 'fortnightly') && parseInt(postingDay) > 7) {
                setPostingDay('1'); // Default to Monday
              } else if ((newType === 'monthly' || newType === 'yearly') && parseInt(postingDay) <= 7) {
                setPostingDay('28'); // Default to 28th of month
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
