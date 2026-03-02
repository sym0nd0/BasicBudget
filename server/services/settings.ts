import db from '../db.js';
import { encryptSecret, decryptSecret } from '../auth/totp.js';

// ─── In-memory cache ──────────────────────────────────────────────────────────

const ENCRYPTED_KEYS = new Set(['smtp.pass', 'oidc.client_secret']);
const ENC_PREFIX = 'enc:';

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
  const raw = cache.get(key) ?? null;
  if (raw && ENCRYPTED_KEYS.has(key) && raw.startsWith(ENC_PREFIX)) {
    const payload = raw.slice(ENC_PREFIX.length);
    const [iv, authTag, encrypted] = payload.split(':');
    return decryptSecret(encrypted, iv, authTag);
  }
  return raw;
}

export function setSetting(key: string, value: string): void {
  let stored = value;
  if (ENCRYPTED_KEYS.has(key) && value && value !== '••••••••' && !value.startsWith(ENC_PREFIX)) {
    const { encrypted_secret, iv, auth_tag } = encryptSecret(value);
    stored = `${ENC_PREFIX}${iv}:${auth_tag}:${encrypted_secret}`;
  }
  db.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(key, stored);
  cache.set(key, stored);
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

// ─── Migrations ───────────────────────────────────────────────────────────────

export function migrateEncryptedSettings(): void {
  for (const key of ENCRYPTED_KEYS) {
    const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key) as { value: string } | undefined;
    if (row?.value && !row.value.startsWith(ENC_PREFIX)) {
      setSetting(key, row.value);
    }
  }
}
