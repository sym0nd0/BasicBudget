import { useState, useRef } from 'react';
import { getCsrfToken } from '../../api/client';
import { Button } from '../ui/Button';
import { Select } from '../ui/Input';

interface CsvImportFormProps {
  onSuccess: (message: string) => void;
  onCancel: () => void;
}

type ImportType = 'expenses' | 'incomes' | 'debts' | 'savings';

const COLUMN_HINTS: Record<ImportType, string> = {
  expenses: 'name, amount, day, category, household, split_ratio, account, recurrence_type, is_recurring, notes, start_date, end_date',
  incomes: 'name, amount, day, contributor, gross_or_net, recurrence_type, is_recurring, notes, start_date, end_date',
  debts: 'name, balance, interest_rate, minimum_payment, overpayment, compounding_frequency, day, is_household, split_ratio, recurrence_type, is_recurring, notes, start_date, end_date',
  savings: 'name, target_amount, current_amount, monthly_contribution, is_household, target_date, notes',
};

const TEMPLATE_HEADERS: Record<ImportType, string> = {
  expenses: 'name,amount,day,category,household,split_ratio,account,recurrence_type,is_recurring,notes,start_date,end_date',
  incomes: 'name,amount,day,contributor,gross_or_net,recurrence_type,is_recurring,notes,start_date,end_date',
  debts: 'name,balance,interest_rate,minimum_payment,overpayment,compounding_frequency,day,is_household,split_ratio,recurrence_type,is_recurring,notes,start_date,end_date',
  savings: 'name,target_amount,current_amount,monthly_contribution,is_household,target_date,notes',
};

export function CsvImportForm({ onSuccess, onCancel }: CsvImportFormProps) {
  const [importType, setImportType] = useState<ImportType>('expenses');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<{ row: number; message: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Please select a CSV file');
      return;
    }

    setLoading(true);
    setError(null);
    setRowErrors([]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', importType);

      const csrfToken = await getCsrfToken();
      let res = await fetch('/api/import/csv', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken },
        body: formData,
      });

      if (res.status === 403) {
        const freshToken = await getCsrfToken();
        res = await fetch('/api/import/csv', {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-CSRF-Token': freshToken },
          body: formData,
        });
      }

      const result = await res.json() as { message: string; imported: number; skipped: number; errors: { row: number; message: string }[] };

      if (!res.ok) {
        setError(result.message ?? 'Import failed');
        return;
      }

      if (result.errors?.length > 0) {
        setRowErrors(result.errors);
      }
      onSuccess(result.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE_HEADERS[importType] + '\n')}`;
  const templateFilename = `${importType}-template.csv`;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-[var(--color-text-muted)] mb-3">
          Import data from a CSV file. Dates should be in DD/MM/YYYY format and amounts in pounds (e.g. 12.50).
        </p>
        <Select
          label="Import Type"
          value={importType}
          onChange={e => {
            setImportType(e.target.value as ImportType);
            setRowErrors([]);
            setError(null);
          }}
          options={[
            { value: 'expenses', label: 'Expenses' },
            { value: 'incomes', label: 'Incomes' },
            { value: 'debts', label: 'Debts' },
            { value: 'savings', label: 'Savings Goals' },
          ]}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
          CSV File
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="block w-full text-sm text-[var(--color-text-muted)]
            file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
            file:text-sm file:font-medium
            file:bg-[var(--color-primary)] file:text-white
            hover:file:opacity-90 cursor-pointer"
        />
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Columns: {COLUMN_HINTS[importType]}
        </p>
        <a
          href={templateHref}
          download={templateFilename}
          className="mt-1 inline-block text-xs text-[var(--color-primary)] hover:underline"
        >
          Download template
        </a>
      </div>

      {error && (
        <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-light)] rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {rowErrors.length > 0 && (
        <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-light)] rounded-lg px-3 py-2">
          <p className="font-medium mb-1">Row errors:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {rowErrors.map(e => (
              <li key={e.row}>Row {e.row}: {e.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Importing…' : 'Import'}
        </Button>
      </div>
    </form>
  );
}
