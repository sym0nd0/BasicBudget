import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DB_PATH
  ? path.dirname(process.env.DB_PATH)
  : path.join(process.cwd(), 'data');

const DB_FILE = process.env.DB_PATH ?? path.join(DATA_DIR, 'basicbudget.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_FILE);

// Performance pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Apply schema
const schema = fs.readFileSync(
  path.join(process.cwd(), 'server', 'schema.sql'),
  'utf8',
);
db.exec(schema);

// Migrate SMTP/OIDC settings from environment variables to DB (one-time, for existing deployments)
(function migrateEnvToSettings() {
  const migrations = [
    { key: 'smtp.host',          env: process.env.SMTP_HOST },
    { key: 'smtp.port',          env: process.env.SMTP_PORT },
    { key: 'smtp.secure',        env: process.env.SMTP_SECURE },
    { key: 'smtp.user',          env: process.env.SMTP_USER },
    { key: 'smtp.pass',          env: process.env.SMTP_PASS },
    { key: 'smtp.from',          env: process.env.SMTP_FROM },
    { key: 'oidc.issuer_url',    env: process.env.OIDC_ISSUER_URL },
    { key: 'oidc.client_id',     env: process.env.OIDC_CLIENT_ID },
    { key: 'oidc.client_secret', env: process.env.OIDC_CLIENT_SECRET },
  ];

  const hasAny = migrations.some(({ env }) => !!env);
  if (!hasAny) return;

  const existing = db.prepare(`SELECT COUNT(*) as count FROM system_settings WHERE key LIKE 'smtp.%' OR key LIKE 'oidc.%'`).get() as { count: number };
  if (existing.count > 0) return; // Already migrated

  const upsert = db.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO NOTHING
  `);

  for (const { key, env } of migrations) {
    if (env) upsert.run(key, env);
  }
  console.log('[DB] Migrated SMTP/OIDC settings from environment variables to database.');
})();

// Add invitee_email column to reset_tokens for storing invite recipient email (for new-user registration flow)
try {
  db.prepare('ALTER TABLE reset_tokens ADD COLUMN invitee_email TEXT').run();
} catch {
  // Column already exists, ignore
}

// Add colour_palette column to users for accessibility palette preference
try {
  db.prepare("ALTER TABLE users ADD COLUMN colour_palette TEXT NOT NULL DEFAULT 'default'").run();
} catch {
  // Column already exists, ignore
}

export default db;
