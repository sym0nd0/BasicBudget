import { useState, useEffect, useRef } from 'react';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { PageShell } from '../components/layout/PageShell';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { api } from '../api/client';
import type { SmtpConfig, OidcConfig, LoggingConfig, AutoBackupConfig } from '../types';
import { EXPENSE_CATEGORIES } from '../types';

interface AdminSettingsPageProps {
  onMenuClick: () => void;
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent';

export function AdminSettingsPage({ onMenuClick }: AdminSettingsPageProps) {
  const { confirm, ConfirmDialogElement } = useConfirmDialog();

  // ── SMTP ──
  const [smtp, setSmtp] = useState<SmtpConfig>({ host: '', port: 587, secure: false, user: '', pass: '', from: '' });
  const [smtpLoading, setSmtpLoading] = useState(true);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpMsg, setSmtpMsg] = useState('');
  const [smtpError, setSmtpError] = useState('');

  // ── Categories ──
  const [cats, setCats] = useState<string[]>([...EXPENSE_CATEGORIES]);
  const [catsLoading, setCatsLoading] = useState(true);
  const [catsSaving, setCatsSaving] = useState(false);
  const [catsMsg, setCatsMsg] = useState('');
  const [catsError, setCatsError] = useState('');
  const [newCat, setNewCat] = useState('');

  // ── OIDC ──
  const [oidc, setOidc] = useState<OidcConfig>({ issuer_url: '', client_id: '', client_secret: '' });
  const [oidcLoading, setOidcLoading] = useState(true);
  const [oidcSaving, setOidcSaving] = useState(false);
  const [oidcMsg, setOidcMsg] = useState('');
  const [oidcError, setOidcError] = useState('');

  // ── Registration ──
  const [regDisabled, setRegDisabled] = useState(false);
  const [regLoading, setRegLoading] = useState(true);
  const [regSaving, setRegSaving] = useState(false);
  const [regMsg, setRegMsg] = useState('');
  const [regError, setRegError] = useState('');

  // ── Backup ──
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const [backupError, setBackupError] = useState('');
  const [restoreMsg, setRestoreMsg] = useState('');
  const [restoreError, setRestoreError] = useState('');
  const restoreFileRef = useRef<HTMLInputElement>(null);

  // ── Automated Backup ──
  const [autoBackup, setAutoBackup] = useState<AutoBackupConfig>({
    enabled: false, interval_hours: 24, max_backups: 7,
    last_backup_at: null, next_backup_at: null, backup_count: 0,
  });
  const [autoBackupLoading, setAutoBackupLoading] = useState(true);
  const [autoBackupSaving, setAutoBackupSaving] = useState(false);
  const [autoBackupMsg, setAutoBackupMsg] = useState('');
  const [autoBackupError, setAutoBackupError] = useState('');

  // ── Logging ──
  const [logLevel, setLogLevel] = useState<LoggingConfig['level']>('info');
  const [logLoading, setLogLoading] = useState(true);
  const [logSaving, setLogSaving] = useState(false);
  const [logMsg, setLogMsg] = useState('');
  const [logError, setLogError] = useState('');

  useEffect(() => {
    api.getSmtpConfig().then(cfg => {
      if (cfg) setSmtp(cfg);
    }).catch(() => {}).finally(() => setSmtpLoading(false));

    api.getOidcConfig().then(cfg => {
      if (cfg) setOidc(cfg);
    }).catch(() => {}).finally(() => setOidcLoading(false));

    api.getAdminCategories().then(c => {
      if (c) setCats(c);
    }).catch(() => {}).finally(() => setCatsLoading(false));

    api.getLoggingConfig()
      .then(cfg => setLogLevel(cfg.level))
      .catch(() => {})
      .finally(() => setLogLoading(false));

    api.getRegistrationConfig()
      .then(cfg => setRegDisabled(cfg.disabled))
      .catch(() => {})
      .finally(() => setRegLoading(false));

    api.getAutoBackupConfig()
      .then(cfg => setAutoBackup(cfg))
      .catch(() => {})
      .finally(() => setAutoBackupLoading(false));
  }, []);

  const saveSMTP = async () => {
    setSmtpSaving(true);
    setSmtpMsg('');
    setSmtpError('');
    try {
      const result = await api.updateSmtpConfig(smtp);
      setSmtpMsg(result.message);
    } catch (e) {
      setSmtpError(e instanceof Error ? e.message : 'Failed to save SMTP settings');
    } finally {
      setSmtpSaving(false);
    }
  };

  const testSMTP = async () => {
    setSmtpTesting(true);
    setSmtpMsg('');
    setSmtpError('');
    try {
      const result = await api.testSmtp();
      setSmtpMsg(result.message);
    } catch (e) {
      setSmtpError(e instanceof Error ? e.message : 'SMTP test failed');
    } finally {
      setSmtpTesting(false);
    }
  };

  const saveOIDC = async () => {
    setOidcSaving(true);
    setOidcMsg('');
    setOidcError('');
    try {
      const result = await api.updateOidcConfig(oidc);
      setOidcMsg(result.message);
    } catch (e) {
      setOidcError(e instanceof Error ? e.message : 'Failed to save OIDC settings');
    } finally {
      setOidcSaving(false);
    }
  };

  const saveCats = async () => {
    setCatsSaving(true);
    setCatsMsg('');
    setCatsError('');
    try {
      const result = await api.updateAdminCategories(cats);
      setCatsMsg(result.message);
    } catch (e) {
      setCatsError(e instanceof Error ? e.message : 'Failed to save categories');
    } finally {
      setCatsSaving(false);
    }
  };

  const resetCats = async () => {
    if (!await confirm('Reset Categories', 'Reset categories to defaults?', 'danger')) return;
    try {
      const result = await api.resetAdminCategories();
      setCats(result.categories);
      setCatsMsg('Categories reset to defaults.');
    } catch (e) {
      setCatsError(e instanceof Error ? e.message : 'Failed to reset');
    }
  };

  const saveRegistration = async () => {
    setRegSaving(true);
    setRegMsg('');
    setRegError('');
    try {
      const r = await api.updateRegistrationConfig({ disabled: regDisabled });
      setRegMsg(r.message);
    } catch (e) {
      setRegError(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setRegSaving(false);
    }
  };

  const saveLogging = async () => {
    setLogSaving(true);
    setLogMsg('');
    setLogError('');
    try {
      const r = await api.updateLoggingConfig({ level: logLevel });
      setLogMsg(r.message);
    } catch (e) {
      setLogError(e instanceof Error ? e.message : 'Failed to save logging settings');
    } finally {
      setLogSaving(false);
    }
  };

  const handleBackup = async () => {
    setBackupLoading(true);
    setBackupMsg('');
    setBackupError('');
    try {
      const res = await api.backupDatabase();
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1]
        ?? `basicbudget-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setBackupMsg('Backup downloaded successfully.');
    } catch (e) {
      setBackupError(e instanceof Error ? e.message : 'Failed to download backup');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestore = async () => {
    const file = restoreFileRef.current?.files?.[0];
    if (!file) {
      setRestoreError('Please select a backup file first.');
      return;
    }
    const confirmed = await confirm(
      'Restore Database Backup',
      'This will permanently replace ALL existing data — every user, household, and setting — with the contents of this backup file. All active sessions will be invalidated and everyone will need to log in again. This action cannot be undone.',
      'danger',
    );
    if (!confirmed) return;

    setRestoreLoading(true);
    setRestoreMsg('');
    setRestoreError('');
    try {
      const result = await api.restoreDatabase(file);
      setRestoreMsg(result.message);
      // Session is destroyed — redirect to login after a brief delay
      setTimeout(() => { window.location.href = '/login'; }, 3000);
    } catch (e) {
      setRestoreError(e instanceof Error ? e.message : 'Restore failed');
    } finally {
      setRestoreLoading(false);
      if (restoreFileRef.current) restoreFileRef.current.value = '';
    }
  };

  const saveAutoBackup = async () => {
    setAutoBackupSaving(true);
    setAutoBackupMsg('');
    setAutoBackupError('');
    try {
      const r = await api.updateAutoBackupConfig({
        enabled: autoBackup.enabled,
        interval_hours: autoBackup.interval_hours,
        max_backups: autoBackup.max_backups,
      });
      setAutoBackupMsg(r.message);
      const cfg = await api.getAutoBackupConfig();
      setAutoBackup(cfg);
    } catch (e) {
      setAutoBackupError(e instanceof Error ? e.message : 'Failed to save automated backup settings');
    } finally {
      setAutoBackupSaving(false);
    }
  };

  const smtpConfigured = !!smtp.host;
  const oidcConfigured = !!(oidc.issuer_url && oidc.client_id);

  return (
    <PageShell title="Admin — System Settings" onMenuClick={onMenuClick}>
      {ConfirmDialogElement}
      <div className="space-y-5">

        {/* Database Backup Card */}
        <Card>
          <CardHeader title="Database Backup" subtitle="Export or restore a full backup of all users, households, budget data, and system settings." />
          <div className="mt-4 space-y-5">
            {/* Download section */}
            <div className="space-y-2">
              <p className="text-sm text-[var(--color-text-muted)]">
                Download a complete backup of the database as a JSON file. This includes all users, households, budget data, and system settings.
              </p>
              <Button onClick={handleBackup} disabled={backupLoading} variant="secondary">
                {backupLoading ? 'Downloading…' : 'Download Backup'}
              </Button>
              {backupMsg && <p className="text-sm text-[var(--color-success)]">{backupMsg}</p>}
              {backupError && <p className="text-sm text-[var(--color-danger)]">{backupError}</p>}
            </div>

            {/* Divider */}
            <hr className="border-[var(--color-border)]" />

            {/* Restore section */}
            <div className="space-y-2">
              <p className="text-sm text-[var(--color-text-muted)]">
                Restore from a previously downloaded backup file. This will <strong>permanently replace all existing data</strong>.
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Note: encrypted secrets (TOTP 2FA, SMTP password, OIDC client secret) are tied to the TOTP_ENCRYPTION_KEY environment variable. If restoring on an instance with a different key, those secrets will be unrecoverable and affected users will need to re-enrol.
              </p>
              <input
                ref={restoreFileRef}
                type="file"
                accept=".json,application/json"
                aria-label="Select backup file to restore"
                className="block w-full text-sm text-[var(--color-text)] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[var(--color-surface-2)] file:text-[var(--color-text)] hover:file:bg-[var(--color-border)]"
              />
              <Button onClick={handleRestore} disabled={restoreLoading} variant="danger">
                {restoreLoading ? 'Restoring…' : 'Restore Backup'}
              </Button>
              {restoreMsg && <p className="text-sm text-[var(--color-success)]">{restoreMsg}</p>}
              {restoreError && <p className="text-sm text-[var(--color-danger)]">{restoreError}</p>}
            </div>

            {/* Divider */}
            <hr className="border-[var(--color-border)]" />

            {/* Automated Backups section */}
            {autoBackupLoading ? (
              <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)] mb-1">Automated Backups</p>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Schedule automatic backups to the server's <code className="text-xs bg-[var(--color-surface-2)] px-1 py-0.5 rounded">data/backups/</code> directory. Automated backup files are compatible with the manual restore function above.
                  </p>
                </div>
                <LabeledField label="Enable automated backups">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoBackup.enabled}
                      onChange={e => setAutoBackup(prev => ({ ...prev, enabled: e.target.checked }))}
                      className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                    />
                    <span className="text-sm text-[var(--color-text)]">
                      {autoBackup.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </LabeledField>
                <LabeledField label="Backup interval (hours)">
                  <input
                    type="number"
                    min="1"
                    max="720"
                    step="1"
                    className={inputClass}
                    value={autoBackup.interval_hours}
                    onChange={e => setAutoBackup(prev => ({ ...prev, interval_hours: parseInt(e.target.value, 10) || 24 }))}
                  />
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">Between 1 and 720 hours.</p>
                </LabeledField>
                <LabeledField label="Maximum backups to keep">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    className={inputClass}
                    value={autoBackup.max_backups}
                    onChange={e => setAutoBackup(prev => ({ ...prev, max_backups: parseInt(e.target.value, 10) || 7 }))}
                  />
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">Oldest files are removed when the limit is exceeded. Between 1 and 100.</p>
                </LabeledField>
                <div className="text-xs text-[var(--color-text-muted)] space-y-0.5">
                  <p>Backups stored: <span className="text-[var(--color-text)]">{autoBackup.backup_count}</span></p>
                  <p>Last backup: <span className="text-[var(--color-text)]">{autoBackup.last_backup_at ?? 'Never'}</span></p>
                  <p>Next backup: <span className="text-[var(--color-text)]">{autoBackup.next_backup_at ?? (autoBackup.enabled ? 'Pending restart' : 'Not scheduled')}</span></p>
                </div>
                <Button onClick={saveAutoBackup} disabled={autoBackupSaving} variant="secondary">
                  {autoBackupSaving ? 'Saving…' : 'Save Automated Backup Settings'}
                </Button>
                {autoBackupMsg && <p className="text-sm text-[var(--color-success)]">{autoBackupMsg}</p>}
                {autoBackupError && <p className="text-sm text-[var(--color-danger)]">{autoBackupError}</p>}
              </div>
            )}
          </div>
        </Card>

        {/* Categories Card */}
        <Card>
          <CardHeader title="Expense Categories" subtitle="Manage the categories available for expenses." />
          {catsLoading ? (
            <p className="text-sm text-[var(--color-text-muted)] mt-3">Loading…</p>
          ) : (
            <div className="mt-4 space-y-3">
              <ul className="space-y-1">
                {cats.map((cat, idx) => (
                  <li key={idx} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-[var(--color-surface-2)]">
                    <span className="text-sm text-[var(--color-text)]">{cat}</span>
                    <button
                      className="text-xs text-[var(--color-danger)] hover:underline"
                      onClick={() => setCats(prev => prev.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <input
                  className={inputClass + ' flex-1'}
                  value={newCat}
                  onChange={e => setNewCat(e.target.value)}
                  placeholder="Add new category…"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newCat.trim()) {
                      setCats(prev => [...prev, newCat.trim()]);
                      setNewCat('');
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => { if (newCat.trim()) { setCats(prev => [...prev, newCat.trim()]); setNewCat(''); } }}
                >
                  Add
                </Button>
              </div>
              {catsMsg && <p className="text-sm text-[var(--color-success)]">{catsMsg}</p>}
              {catsError && <p className="text-sm text-[var(--color-danger)]">{catsError}</p>}
              <div className="flex gap-3">
                <Button onClick={saveCats} disabled={catsSaving}>
                  {catsSaving ? 'Saving…' : 'Save Categories'}
                </Button>
                <Button variant="secondary" onClick={resetCats}>
                  Reset to Defaults
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Registration Card */}
        <Card>
          <CardHeader title="Registration" subtitle="Control whether new users can sign up publicly." />
          {regLoading ? (
            <p className="text-sm text-[var(--color-text-muted)] mt-3">Loading…</p>
          ) : (
            <div className="mt-4 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={regDisabled}
                  onChange={e => setRegDisabled(e.target.checked)}
                  className="w-4 h-4 accent-[var(--color-primary)]"
                />
                <span className="text-sm text-[var(--color-text)]">Disable public registration (invite-only mode)</span>
              </label>
              <p className="text-xs text-[var(--color-text-muted)]">
                When enabled, new accounts can only be created via household invites or directly by admins. The first user on a fresh instance can always register.
              </p>
              {regMsg && <p className="text-sm text-[var(--color-success)]">{regMsg}</p>}
              {regError && <p className="text-sm text-[var(--color-danger)]">{regError}</p>}
              <div className="flex gap-3 pt-1">
                <Button onClick={saveRegistration} disabled={regSaving}>
                  {regSaving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Logging Card */}
        <Card>
          <CardHeader title="Logging" subtitle="Set the minimum log level written to standard output." />
          {logLoading ? (
            <p className="text-sm text-[var(--color-text-muted)] mt-3">Loading…</p>
          ) : (
            <div className="mt-4 space-y-4">
              <LabeledField label="Log level">
                <select
                  className={inputClass}
                  value={logLevel}
                  onChange={e => setLogLevel(e.target.value as LoggingConfig['level'])}
                >
                  <option value="debug">debug — all messages including verbose diagnostics</option>
                  <option value="info">info — normal operation (default)</option>
                  <option value="warn">warn — warnings and errors only</option>
                  <option value="error">error — errors only</option>
                </select>
              </LabeledField>
              {logMsg && <p className="text-sm text-[var(--color-success)]">{logMsg}</p>}
              {logError && <p className="text-sm text-[var(--color-danger)]">{logError}</p>}
              <div className="flex gap-3 pt-1">
                <Button onClick={saveLogging} disabled={logSaving}>
                  {logSaving ? 'Saving…' : 'Save Log Level'}
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* SMTP Card */}
        <Card>
          <CardHeader
            title="SMTP Configuration"
            subtitle="Email delivery settings for verification emails, password resets, and alerts."
            action={
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${smtpConfigured ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]' : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'}`}>
                {smtpConfigured ? 'Configured' : 'Not configured'}
              </span>
            }
          />

          {smtpLoading ? (
            <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <LabeledField label="Host">
                  <input
                    className={inputClass}
                    value={smtp.host}
                    onChange={e => setSmtp(s => ({ ...s, host: e.target.value }))}
                    placeholder="smtp.example.com"
                  />
                </LabeledField>
                <LabeledField label="Port">
                  <input
                    className={inputClass}
                    type="number"
                    value={smtp.port}
                    onChange={e => setSmtp(s => ({ ...s, port: parseInt(e.target.value, 10) || 587 }))}
                    placeholder="587"
                  />
                </LabeledField>
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="smtp-secure"
                  type="checkbox"
                  checked={smtp.secure}
                  onChange={e => setSmtp(s => ({ ...s, secure: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[var(--color-primary)]"
                />
                <label htmlFor="smtp-secure" className="text-sm text-[var(--color-text)]">
                  Use TLS/SSL (port 465)
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <LabeledField label="Username">
                  <input
                    className={inputClass}
                    value={smtp.user}
                    onChange={e => setSmtp(s => ({ ...s, user: e.target.value }))}
                    placeholder="you@example.com"
                    autoComplete="username"
                  />
                </LabeledField>
                <LabeledField label="Password">
                  <input
                    className={inputClass}
                    type="password"
                    value={smtp.pass}
                    onChange={e => setSmtp(s => ({ ...s, pass: e.target.value }))}
                    placeholder={smtpConfigured ? '(unchanged)' : 'password'}
                    autoComplete="current-password"
                  />
                </LabeledField>
              </div>

              <LabeledField label="From address">
                <input
                  className={inputClass}
                  value={smtp.from}
                  onChange={e => setSmtp(s => ({ ...s, from: e.target.value }))}
                  placeholder="BasicBudget <no-reply@example.com>"
                />
              </LabeledField>

              {smtpMsg && <p className="text-sm text-[var(--color-success)]">{smtpMsg}</p>}
              {smtpError && <p className="text-sm text-[var(--color-danger)]">{smtpError}</p>}

              <div className="flex gap-3 pt-1">
                <Button onClick={saveSMTP} disabled={smtpSaving}>
                  {smtpSaving ? 'Saving…' : 'Save SMTP'}
                </Button>
                <Button variant="secondary" onClick={testSMTP} disabled={smtpTesting || !smtpConfigured}>
                  {smtpTesting ? 'Sending…' : 'Send test email'}
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* OIDC Card */}
        <Card>
          <CardHeader
            title="OIDC Configuration"
            subtitle="Single sign-on via OpenID Connect (e.g. Google, Keycloak, Authentik)."
            action={
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${oidcConfigured ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]' : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'}`}>
                {oidcConfigured ? 'Configured' : 'Not configured'}
              </span>
            }
          />

          {oidcLoading ? (
            <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
          ) : (
            <div className="space-y-4">
              <LabeledField label="Issuer URL">
                <input
                  className={inputClass}
                  value={oidc.issuer_url}
                  onChange={e => setOidc(o => ({ ...o, issuer_url: e.target.value }))}
                  placeholder="https://accounts.google.com"
                />
              </LabeledField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <LabeledField label="Client ID">
                  <input
                    className={inputClass}
                    value={oidc.client_id}
                    onChange={e => setOidc(o => ({ ...o, client_id: e.target.value }))}
                    placeholder="your-client-id"
                  />
                </LabeledField>
                <LabeledField label="Client Secret">
                  <input
                    className={inputClass}
                    type="password"
                    value={oidc.client_secret}
                    onChange={e => setOidc(o => ({ ...o, client_secret: e.target.value }))}
                    placeholder={oidcConfigured ? '(unchanged)' : 'your-client-secret'}
                    autoComplete="current-password"
                  />
                </LabeledField>
              </div>

              {oidcMsg && <p className="text-sm text-[var(--color-success)]">{oidcMsg}</p>}
              {oidcError && <p className="text-sm text-[var(--color-danger)]">{oidcError}</p>}

              <div className="pt-1">
                <Button onClick={saveOIDC} disabled={oidcSaving}>
                  {oidcSaving ? 'Saving…' : 'Save OIDC'}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  );
}
