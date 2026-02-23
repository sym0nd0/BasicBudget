import db from '../db.js';

// ─── In-memory cache ──────────────────────────────────────────────────────────

const cache = new Map<string, string>();
let cacheLoaded = false;

function loadCache(): void {
  if (cacheLoaded) return;
  const rows = db.prepare('SELECT key, value FROM system_settings').all() as { key: string; value: string }[];
  for (const row of rows) {
    cache.set(row.key, row.value);
  }
  cacheLoaded = true;
}

// ─── Core CRUD ────────────────────────────────────────────────────────────────

export function getSetting(key: string): string | null {
  loadCache();
  return cache.get(key) ?? null;
}

export function setSetting(key: string, value: string): void {
  db.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(key, value);
  cache.set(key, value);
  cacheLoaded = true;
}

export function deleteSetting(key: string): void {
  db.prepare('DELETE FROM system_settings WHERE key = ?').run(key);
  cache.delete(key);
}

export function getSettingsGroup(prefix: string): Record<string, string> {
  loadCache();
  const result: Record<string, string> = {};
  for (const [key, value] of cache.entries()) {
    if (key.startsWith(prefix)) {
      result[key.slice(prefix.length)] = value;
    }
  }
  return result;
}

// ─── SMTP ─────────────────────────────────────────────────────────────────────

export interface SmtpConfigFull {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export function getSmtpConfig(): SmtpConfigFull | null {
  const host = getSetting('smtp.host');
  if (!host) return null;
  return {
    host,
    port: parseInt(getSetting('smtp.port') ?? '587', 10),
    secure: getSetting('smtp.secure') === 'true',
    user: getSetting('smtp.user') ?? '',
    pass: getSetting('smtp.pass') ?? '',
    from: getSetting('smtp.from') ?? 'BasicBudget <no-reply@basicbudget.app>',
  };
}

export function getSmtpConfigMasked(): (Omit<SmtpConfigFull, 'pass'> & { pass: string }) | null {
  const cfg = getSmtpConfig();
  if (!cfg) return null;
  return { ...cfg, pass: cfg.pass ? '••••••••' : '' };
}

// ─── OIDC ─────────────────────────────────────────────────────────────────────

export interface OidcConfigFull {
  issuer_url: string;
  client_id: string;
  client_secret: string;
}

export function getOidcConfig(): OidcConfigFull | null {
  const issuer_url = getSetting('oidc.issuer_url');
  const client_id = getSetting('oidc.client_id');
  if (!issuer_url || !client_id) return null;
  return {
    issuer_url,
    client_id,
    client_secret: getSetting('oidc.client_secret') ?? '',
  };
}

export function getOidcConfigMasked(): OidcConfigFull | null {
  const cfg = getOidcConfig();
  if (!cfg) return null;
  return { ...cfg, client_secret: cfg.client_secret ? '••••••••' : '' };
}

// ─── Cache invalidation ───────────────────────────────────────────────────────

export function invalidateCache(): void {
  cache.clear();
  cacheLoaded = false;
}
