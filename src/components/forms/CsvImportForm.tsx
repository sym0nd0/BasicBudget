import { useState, useRef } from 'react';
import { Button } from '../ui/Button';
import { Select } from '../ui/Input';

interface CsvImportFormProps {
  onSuccess: (message: string) => void;
  onCancel: () => void;
}

export function CsvImportForm({ onSuccess, onCancel }: CsvImportFormProps) {
  const [importType, setImportType] = useState<'expenses' | 'incomes'>('expenses');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', importType);

      const res = await fetch('/api/import/csv', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json() as { message: string; imported: number; skipped: number; errors: { row: number; message: string }[] };

      if (!res.ok) {
        setError(result.message ?? 'Import failed');
        return;
      }

      let msg = result.message;
      if (result.errors?.length > 0) {
        msg += `. Errors on rows: ${result.errors.map(e => e.row).join(', ')}`;
      }
      onSuccess(msg);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-[var(--color-text-muted)] mb-3">
          Import expenses or incomes from a CSV file. Dates should be in DD/MM/YYYY format and amounts in pounds (e.g. 12.50).
        </p>
        <Select
          label="Import Type"
          value={importType}
          onChange={e => setImportType(e.target.value as 'expenses' | 'incomes')}
          options={[
            { value: 'expenses', label: 'Expenses' },
            { value: 'incomes', label: 'Incomes' },
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
          {importType === 'expenses'
            ? 'Columns: name, amount, day, category, type, household, notes, start_date, end_date'
            : 'Columns: name, amount, day, contributor, gross_or_net, notes, start_date, end_date'}
        </p>
      </div>

      {error && (
        <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-light)] rounded-lg px-3 py-2">
          {error}
        </p>
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
