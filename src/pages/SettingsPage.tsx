import { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { PageShell } from '../components/layout/PageShell';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { CsvImportForm } from '../components/forms/CsvImportForm';
import type { Account } from '../types';

interface SettingsPageProps {
  onMenuClick: () => void;
}

export function SettingsPage({ onMenuClick }: SettingsPageProps) {
  const { accounts, addAccount, updateAccount, deleteAccount } = useBudget();

  // Account management
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>();
  const [accountName, setAccountName] = useState('');
  const [accountError, setAccountError] = useState('');

  // CSV import
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  // Export
  const [exporting, setExporting] = useState(false);

  const handleAccountSave = async () => {
    if (!accountName.trim()) {
      setAccountError('Name is required');
      return;
    }
    try {
      if (editingAccount) {
        await updateAccount(editingAccount.id, { name: accountName.trim() });
      } else {
        await addAccount({ name: accountName.trim(), sort_order: accounts.length });
      }
      setAccountModalOpen(false);
      setAccountName('');
      setEditingAccount(undefined);
      setAccountError('');
    } catch (err) {
      setAccountError((err as Error).message);
    }
  };

  const handleAccountEdit = (account: Account) => {
    setEditingAccount(account);
    setAccountName(account.name);
    setAccountModalOpen(true);
  };

  const handleAccountDelete = async (id: string) => {
    if (!confirm('Delete this account? Expenses using it will be unlinked.')) return;
    try {
      await deleteAccount(id);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/export/json');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1]
        ?? `basicbudget-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <PageShell title="Settings" onMenuClick={onMenuClick}>
      {/* Accounts */}
      <Card padding={false} className="mb-5">
        <div className="px-5 pt-5 flex items-center justify-between">
          <CardHeader title="Accounts" subtitle="Manage bank accounts for expense tracking" />
          <Button
            size="sm"
            onClick={() => { setEditingAccount(undefined); setAccountName(''); setAccountModalOpen(true); }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Account
          </Button>
        </div>
        <div className="mt-3">
          {accounts.length === 0 ? (
            <p className="px-5 py-4 text-sm text-[var(--color-text-muted)]">
              No accounts yet. Add one to link expenses to specific bank accounts.
            </p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {accounts.map(account => (
                  <tr key={account.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]">
                    <td className="px-5 py-3 font-medium text-[var(--color-text)]">{account.name}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => handleAccountEdit(account)}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleAccountDelete(account.id)}
                          className="hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-light)]">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Import / Export */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Import CSV" subtitle="Import expenses or incomes from a CSV file" />
          {importSuccess && (
            <p className="mt-3 text-sm text-[var(--color-success)] bg-[var(--color-success-light)] rounded-lg px-3 py-2">
              {importSuccess}
            </p>
          )}
          <Button
            className="mt-4"
            onClick={() => { setImportSuccess(null); setImportModalOpen(true); }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import CSV
          </Button>
        </Card>

        <Card>
          <CardHeader title="Export JSON" subtitle="Download all data as a JSON file" />
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            Exports all accounts, incomes, expenses, debts, savings goals, and month locks with schema version.
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={handleExport}
            disabled={exporting}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? 'Exporting…' : 'Export JSON'}
          </Button>
        </Card>
      </div>

      {/* Account modal */}
      <Modal
        isOpen={accountModalOpen}
        onClose={() => { setAccountModalOpen(false); setEditingAccount(undefined); setAccountName(''); setAccountError(''); }}
        title={editingAccount ? 'Edit Account' : 'Add Account'}
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Account Name"
            value={accountName}
            onChange={e => setAccountName(e.target.value)}
            placeholder="e.g. Barclays Current"
            error={accountError}
          />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => { setAccountModalOpen(false); setEditingAccount(undefined); setAccountName(''); setAccountError(''); }}>
              Cancel
            </Button>
            <Button onClick={handleAccountSave}>
              {editingAccount ? 'Save Changes' : 'Add Account'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* CSV import modal */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import CSV"
      >
        <CsvImportForm
          onSuccess={msg => { setImportSuccess(msg); setImportModalOpen(false); }}
          onCancel={() => setImportModalOpen(false)}
        />
      </Modal>
    </PageShell>
  );
}
