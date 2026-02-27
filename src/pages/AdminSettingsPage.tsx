import { useState, useEffect } from 'react';
import { PageShell } from '../components/layout/PageShell';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { api } from '../api/client';
import type { SmtpConfig, OidcConfig } from '../types';
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
    if (!confirm('Reset categories to defaults?')) return;
    try {
      const result = await api.resetAdminCategories();
      setCats(result.categories);
      setCatsMsg('Categories reset to defaults.');
    } catch (e) {
      setCatsError(e instanceof Error ? e.message : 'Failed to reset');
    }
  };

  const smtpConfigured = !!smtp.host;
  const oidcConfigured = !!(oidc.issuer_url && oidc.client_id);

  return (
    <PageShell title="Admin — System Settings" onMenuClick={onMenuClick}>
      <div className="space-y-5">

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
