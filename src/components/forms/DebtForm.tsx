import { useState } from 'react';
import type { Debt, DebtDealPeriod, HouseholdMember } from '../../types';
import { useApi } from '../../hooks/useApi';
import { Input, Select } from '../ui/Input';
import { Button } from '../ui/Button';
import { poundsToPence, penceToPoundsStr } from '../../utils/formatters';

interface DraftPeriod {
  key: string;
  interest_rate: string;
  start_date: string;
  end_date: string;
}

interface DebtFormProps {
  initial?: Debt;
  onSave: (data: Omit<Debt, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
}

export function DebtForm({ initial, onSave, onCancel }: DebtFormProps) {
  const { data: householdDetails } = useApi<{ id?: string; name?: string; members?: HouseholdMember[] }>('/household');
  const memberCount = householdDetails?.members?.length ?? 2;
  const splitText = memberCount === 2 ? 'split equally with 2 members' : `split equally with ${memberCount} members`;

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
  const [reminderMonths, setReminderMonths] = useState(String(initial?.reminder_months ?? '0'));
  const [dealPeriods, setDealPeriods] = useState<DraftPeriod[]>(
    initial?.deal_periods?.map((p) => ({
      key: p.id,
      interest_rate: String(p.interest_rate),
      start_date: p.start_date,
      end_date: p.end_date ?? '',
    })) ?? [],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    if (isNaN(parseFloat(balance)) || parseFloat(balance) < 0) e.balance = 'Enter a valid balance';
    if (isNaN(parseFloat(interestRate)) || parseFloat(interestRate) < 0) e.interestRate = 'Enter a valid APR (0 for interest-free)';
    if (isNaN(parseFloat(minimumPayment)) || parseFloat(minimumPayment) < 0) e.minimumPayment = 'Enter a valid minimum payment';
    if (isNaN(parseFloat(overpayment)) || parseFloat(overpayment) < 0) e.overpayment = 'Enter a valid overpayment (0 if none)';
    if (reminderMonths && (isNaN(parseInt(reminderMonths)) || parseInt(reminderMonths) < 0 || parseInt(reminderMonths) > 24)) {
      e.reminderMonths = 'Enter a valid reminder (0-24 months, 0 = off)';
    }
    return e;
  };

  const addPeriod = () => {
    const newKey = `period-${Date.now()}-${Math.random()}`;
    setDealPeriods([...dealPeriods, {
      key: newKey,
      interest_rate: '0',
      start_date: '',
      end_date: '',
    }]);
  };

  const removePeriod = (key: string) => {
    setDealPeriods(dealPeriods.filter(p => p.key !== key));
  };

  const updatePeriod = (key: string, field: keyof Omit<DraftPeriod, 'key'>, value: string) => {
    setDealPeriods(dealPeriods.map(p =>
      p.key === key ? { ...p, [field]: value } : p
    ));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    // Convert deal periods to proper format (without id and debt_id, those are assigned server-side)
    // Labels are auto-generated server-side based on period index
    const convertedPeriods = dealPeriods
      .filter(p => p.start_date) // Only include periods with a start date
      .map(p => ({
        interest_rate: parseFloat(p.interest_rate) || 0,
        start_date: p.start_date,
        end_date: p.end_date || null,
      }));

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
      reminder_months: parseInt(reminderMonths) || 0,
      deal_periods: convertedPeriods as unknown as DebtDealPeriod[],
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
      <div className="grid grid-cols-[2fr_1fr] gap-3">
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
          step="0.01"
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
          Household debt <span className="text-[var(--color-text-muted)]">({splitText})</span>
        </span>
      </label>
      <Input
        label="Notes (optional)"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="e.g. 0% ends June 2025"
      />

      {/* Deal Periods */}
      <div className="border-t border-[var(--color-border)] pt-4 mt-2">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-[var(--color-text)]">
            Deal Periods (optional)
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addPeriod}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Period
          </Button>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mb-3">
          Track different interest rates or promotional periods (e.g. 0% for 12 months, then 19.9%).
        </p>

        {dealPeriods.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)] py-2">No deal periods. Click "Add Period" to create one.</p>
        ) : (
          <div className="space-y-2 mb-3">
            {dealPeriods.map((period, idx) => (
              <div key={period.key} className="flex gap-2 items-end bg-[var(--color-surface-2)] rounded-lg p-3">
                <div className="w-16">
                  <label className="text-xs text-[var(--color-text-muted)]">Period</label>
                  <div className="w-full text-sm px-2 py-1.5 bg-[var(--color-surface)] text-[var(--color-text)] rounded border border-[var(--color-border)] flex items-center">
                    {idx + 1}
                  </div>
                </div>
                <div className="w-28">
                  <label className="text-xs text-[var(--color-text-muted)]">Rate %</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={period.interest_rate}
                    onChange={e => updatePeriod(period.key, 'interest_rate', e.target.value)}
                    className="w-full text-sm border border-[var(--color-border)] rounded px-2 py-1.5 bg-[var(--color-surface)] text-[var(--color-text)]"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-[var(--color-text-muted)]">From</label>
                  <input
                    type="date"
                    value={period.start_date}
                    onChange={e => updatePeriod(period.key, 'start_date', e.target.value)}
                    className="w-full text-sm border border-[var(--color-border)] rounded px-2 py-1.5 bg-[var(--color-surface)] text-[var(--color-text)]"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-[var(--color-text-muted)]">Until</label>
                  <input
                    type="date"
                    value={period.end_date}
                    onChange={e => updatePeriod(period.key, 'end_date', e.target.value)}
                    placeholder="Leave blank for ongoing"
                    className="w-full text-sm border border-[var(--color-border)] rounded px-2 py-1.5 bg-[var(--color-surface)] text-[var(--color-text)]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removePeriod(period.key)}
                  className="text-[var(--color-danger)] hover:bg-[var(--color-danger-light)] rounded p-1.5"
                  title="Remove period"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-[var(--color-border)] pt-4 mt-2">
        <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
          Deal Period Reminder (optional)
        </label>
        <div className="flex items-start gap-3">
          <Input
            type="number"
            min="0"
            max="24"
            value={reminderMonths}
            onChange={e => setReminderMonths(e.target.value)}
            placeholder="0"
            error={errors.reminderMonths}
            className="w-24"
          />
          <div className="flex-1">
            <p className="text-sm text-[var(--color-text)]">
              months before a deal period ends
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Set to 0 to disable reminders. Only applies to debts with deal periods that have end dates.
            </p>
          </div>
        </div>
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{initial ? 'Save Changes' : 'Add Debt'}</Button>
      </div>
    </form>
  );
}
