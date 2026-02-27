import { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import { useAuth } from '../context/AuthContext';
import { PageShell } from '../components/layout/PageShell';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { CsvImportForm } from '../components/forms/CsvImportForm';
import { api } from '../api/client';
import type { Account, TotpSetupResponse, SessionInfo } from '../types';

interface SettingsPageProps {
  onMenuClick: () => void;
}

export function SettingsPage({ onMenuClick }: SettingsPageProps) {
  const { accounts, addAccount, updateAccount, deleteAccount } = useBudget();
  const { user, household, householdRole, refreshAuth } = useAuth();

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

  // Security — change password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Security — TOTP setup
  const [totpSetup, setTotpSetup] = useState<TotpSetupResponse | null>(null);
  const [totpToken, setTotpToken] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [totpMsg, setTotpMsg] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);

  // Security — TOTP reset
  const [showTotpReset, setShowTotpReset] = useState(false);
  const [totpResetPassword, setTotpResetPassword] = useState('');
  const [totpResetOtp, setTotpResetOtp] = useState('');
  const [totpResetLoading, setTotpResetLoading] = useState(false);
  const [totpResetMsg, setTotpResetMsg] = useState('');
  const [lostAccessMsg, setLostAccessMsg] = useState('');

  // Sessions
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Appearance — colour palette
  const [paletteMsg, setPaletteMsg] = useState('');
  const [paletteLoading, setPaletteLoading] = useState(false);

  // Household invite
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');

  // ─── Account management handlers ────────────────────────────────────────────

  const handleAccountSave = async () => {
    if (!accountName.trim()) { setAccountError('Name is required'); return; }
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
    try { await deleteAccount(id); } catch (err) { alert((err as Error).message); }
  };

  // ─── Export handler ──────────────────────────────────────────────────────────

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.exportJson();
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

  // ─── Security handlers ───────────────────────────────────────────────────────

  const handleChangePassword = async () => {
    setPasswordMsg('');
    setPasswordLoading(true);
    try {
      const r = await api.changePassword(currentPassword, newPassword);
      setPasswordMsg(r.message);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPasswordMsg((err as Error).message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleTotpSetup = async () => {
    setTotpLoading(true);
    setTotpMsg('');
    try {
      const setup = await api.totpSetup();
      setTotpSetup(setup);
    } catch (err) {
      setTotpMsg((err as Error).message);
    } finally {
      setTotpLoading(false);
    }
  };

  const handleTotpVerifySetup = async () => {
    setTotpLoading(true);
    setTotpMsg('');
    try {
      const r = await api.totpVerifySetup(totpToken);
      setRecoveryCodes(r.recoveryCodes);
      setTotpSetup(null);
      setTotpToken('');
      await refreshAuth();
    } catch (err) {
      setTotpMsg((err as Error).message);
    } finally {
      setTotpLoading(false);
    }
  };

  const handleTotpDisable = async () => {
    setTotpResetLoading(true);
    setTotpResetMsg('');
    try {
      const val = totpResetOtp.trim();
      const isOtp = /^\d{6}$/.test(val);
      await api.totpDisable(totpResetPassword, isOtp ? val : undefined, isOtp ? undefined : val || undefined);
      setShowTotpReset(false);
      setTotpResetPassword('');
      setTotpResetOtp('');
      await refreshAuth();
    } catch (err) {
      setTotpResetMsg((err as Error).message);
    } finally {
      setTotpResetLoading(false);
    }
  };

  const handleLostAccess = async () => {
    setLostAccessMsg('');
    try {
      await api.totpRequestReset();
      setLostAccessMsg('A reset link has been sent to your email. It will be available after 24 hours.');
    } catch (err) {
      setLostAccessMsg((err as Error).message);
    }
  };

  const handleLoadSessions = async () => {
    setSessionsLoading(true);
    try {
      const s = await api.getSessions();
      setSessions(s);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleRevokeSession = async (sid: string) => {
    try {
      await api.revokeSession(sid);
      setSessions(prev => prev?.filter(s => s.sid !== sid) ?? null);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handlePaletteChange = async (palette: string) => {
    setPaletteLoading(true);
    setPaletteMsg('');
    try {
      await api.updatePalette(palette);
      await refreshAuth();
      setPaletteMsg('Palette saved.');
    } catch (err) {
      setPaletteMsg((err as Error).message);
    } finally {
      setPaletteLoading(false);
    }
  };

  const handleInvite = async () => {
    setInviteMsg('');
    try {
      const r = await api.inviteMember(inviteEmail);
      setInviteMsg(r.message);
      setInviteEmail('');
    } catch (err) {
      setInviteMsg((err as Error).message);
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <Card>
          <CardHeader title="Import CSV" subtitle="Import expenses or incomes from a CSV file" />
          {importSuccess && (
            <p className="mt-3 text-sm text-[var(--color-success)] bg-[var(--color-success-light)] rounded-lg px-3 py-2">
              {importSuccess}
            </p>
          )}
          <Button className="mt-4" onClick={() => { setImportSuccess(null); setImportModalOpen(true); }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import CSV
          </Button>
        </Card>

        <Card>
          <CardHeader title="Export JSON" subtitle="Download all data as a JSON file" />
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            Exports all accounts, incomes, expenses, debts, savings goals, and month locks.
          </p>
          <Button className="mt-4" variant="secondary" onClick={handleExport} disabled={exporting}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? 'Exporting…' : 'Export JSON'}
          </Button>
        </Card>
      </div>

      {/* Appearance */}
      <Card className="mb-5">
        <CardHeader title="Appearance" subtitle="Accessibility and visual preferences" />
        <div className="mt-4 border-t border-[var(--color-border)] pt-4">
          <h3 className="text-sm font-semibold text-[var(--color-text)] mb-1">Colour Blindness Palette</h3>
          <p className="text-xs text-[var(--color-text-muted)] mb-3">
            Select a colour palette optimised for your vision. Affects status colours and charts.
          </p>
          <div className="flex flex-col gap-2 max-w-sm">
            {([
              { value: 'default', label: 'Default', desc: 'Standard colour scheme' },
              { value: 'deuteranopia', label: 'Deuteranopia', desc: 'Red-Green (green deficiency) — blue & orange' },
              { value: 'protanopia', label: 'Protanopia', desc: 'Red-Green (red deficiency) — teal & pink' },
              { value: 'tritanopia', label: 'Tritanopia', desc: 'Blue-Yellow deficiency — green & red' },
            ] as const).map(opt => (
              <label key={opt.value} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="colour_palette"
                  value={opt.value}
                  checked={(user?.colour_palette ?? 'default') === opt.value}
                  onChange={() => handlePaletteChange(opt.value)}
                  disabled={paletteLoading}
                  className="mt-0.5"
                />
                <span>
                  <span className="text-sm font-medium text-[var(--color-text)]">{opt.label}</span>
                  <span className="block text-xs text-[var(--color-text-muted)]">{opt.desc}</span>
                </span>
              </label>
            ))}
          </div>
          {paletteMsg && <p className="text-xs text-[var(--color-text-muted)] mt-2">{paletteMsg}</p>}
        </div>
      </Card>

      {/* Security */}
      <Card className="mb-5">
        <CardHeader title="Security" subtitle="Manage your password and two-factor authentication" />

        {/* Change password */}
        <div className="mt-4 border-t border-[var(--color-border)] pt-4">
          <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3">Change Password</h3>
          <div className="flex flex-col gap-3 max-w-sm">
            <Input
              label="Current password"
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
            />
            <Input
              label="New password"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Min 8 chars, upper, lower, digit"
            />
            {passwordMsg && (
              <p className="text-xs text-[var(--color-text-muted)]">{passwordMsg}</p>
            )}
            <Button size="sm" variant="secondary" onClick={handleChangePassword} disabled={passwordLoading}>
              {passwordLoading ? 'Saving…' : 'Change password'}
            </Button>
          </div>
        </div>

        {/* 2FA setup */}
        <div className="mt-4 border-t border-[var(--color-border)] pt-4">
          <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3">Two-Factor Authentication</h3>
          {recoveryCodes ? (
            <div>
              <p className="text-sm text-[var(--color-text)] mb-2">
                2FA is enabled. Save these recovery codes in a safe place — they will not be shown again.
              </p>
              <div className="grid grid-cols-2 gap-1 font-mono text-xs bg-[var(--color-surface-2)] rounded-lg p-3 mb-3">
                {recoveryCodes.map(c => <span key={c}>{c}</span>)}
              </div>
              <Button size="sm" variant="secondary" onClick={() => setRecoveryCodes(null)}>Done</Button>
            </div>
          ) : totpSetup ? (
            <div className="flex flex-col gap-3 max-w-sm">
              <p className="text-sm text-[var(--color-text-muted)]">Scan this QR code with your authenticator app, then enter the code to confirm.</p>
              <img src={totpSetup.qrDataUrl} alt="TOTP QR code" className="w-40 h-40 rounded-lg" />
              <p className="text-xs font-mono text-[var(--color-text-muted)] break-all">{totpSetup.base32Secret}</p>
              <Input
                label="6-digit code"
                value={totpToken}
                onChange={e => setTotpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
              />
              {totpMsg && <p className="text-xs text-[var(--color-danger)]">{totpMsg}</p>}
              <Button size="sm" onClick={handleTotpVerifySetup} disabled={totpLoading || totpToken.length !== 6}>
                {totpLoading ? 'Verifying…' : 'Enable 2FA'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setTotpSetup(null)}>Cancel</Button>
            </div>
          ) : user?.has_totp ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-success-light)] text-[var(--color-success)]">
                  2FA Enabled
                </span>
              </div>
              {!showTotpReset ? (
                <Button size="sm" variant="secondary" onClick={() => { setShowTotpReset(true); setTotpResetMsg(''); setLostAccessMsg(''); }}>
                  Reset 2FA
                </Button>
              ) : (
                <div className="flex flex-col gap-3 max-w-sm">
                  <Input
                    label="Current password"
                    type="password"
                    value={totpResetPassword}
                    onChange={e => setTotpResetPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <Input
                    label="OTP or recovery code"
                    value={totpResetOtp}
                    onChange={e => setTotpResetOtp(e.target.value)}
                    placeholder="6-digit code or recovery code"
                  />
                  {totpResetMsg && <p className="text-xs text-[var(--color-danger)]">{totpResetMsg}</p>}
                  <div className="flex gap-2">
                    <Button size="sm" variant="danger" onClick={handleTotpDisable} disabled={totpResetLoading || !totpResetPassword}>
                      {totpResetLoading ? 'Disabling…' : 'Disable 2FA'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowTotpReset(false); setTotpResetMsg(''); }}>Cancel</Button>
                  </div>
                  <button
                    className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] text-left"
                    onClick={handleLostAccess}
                  >
                    Lost access to authenticator?
                  </button>
                  {lostAccessMsg && <p className="text-xs text-[var(--color-text-muted)]">{lostAccessMsg}</p>}
                </div>
              )}
            </div>
          ) : (
            <div>
              {totpMsg && <p className="text-xs text-[var(--color-danger)] mb-2">{totpMsg}</p>}
              {!user?.email_verified && (
                <p className="text-xs text-[var(--color-text-muted)] mb-2">You must verify your email before enabling 2FA.</p>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={handleTotpSetup}
                disabled={totpLoading || !user?.email_verified}
              >
                {totpLoading ? 'Loading…' : 'Set up 2FA'}
              </Button>
            </div>
          )}
        </div>

        {/* Active sessions */}
        <div className="mt-4 border-t border-[var(--color-border)] pt-4">
          <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3">Active Sessions</h3>
          {sessions ? (
            <div className="flex flex-col gap-2">
              {sessions.map(s => (
                <div key={s.sid} className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--color-border)] last:border-0">
                  <div>
                    <span className="text-[var(--color-text)]" title={s.user_agent ?? undefined}>
                      {s.browser && s.os ? `${s.browser} on ${s.os}` : s.user_agent ?? 'Unknown device'}
                    </span>
                    {s.current && <span className="ml-2 text-[var(--color-primary)]">(current)</span>}
                    <div className="text-[var(--color-text-muted)]">{s.ip_address ?? 'Unknown IP'}</div>
                  </div>
                  {!s.current && (
                    <Button size="sm" variant="ghost" onClick={() => handleRevokeSession(s.sid)}
                      className="hover:text-[var(--color-danger)]">
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Button size="sm" variant="secondary" onClick={handleLoadSessions} disabled={sessionsLoading}>
              {sessionsLoading ? 'Loading…' : 'View active sessions'}
            </Button>
          )}
        </div>
      </Card>

      {/* Household management */}
      <Card>
        <CardHeader title="Household" subtitle={`Members of ${household?.name ?? 'your household'}`} />
        {householdRole === 'owner' && (
          <div className="mt-4 border-t border-[var(--color-border)] pt-4">
            <h3 className="text-sm font-semibold text-[var(--color-text)] mb-1">Invite Member</h3>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">Add a household member</p>
            <div className="flex gap-2 max-w-sm">
              <Input
                label=""
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="e.g., family@household.com"
                type="email"
              />
              <Button size="sm" onClick={handleInvite} disabled={!inviteEmail}>
                Invite
              </Button>
            </div>
            {inviteMsg && <p className="text-xs text-[var(--color-text-muted)] mt-1">{inviteMsg}</p>}
          </div>
        )}
      </Card>

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
