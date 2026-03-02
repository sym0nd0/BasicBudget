import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { migrateEncryptedSettings } from './services/settings.js';

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

// DB logging helper (local to avoid circular imports with logger.ts)
function dbLog(message: string): void {
  process.stdout.write(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    message,
    meta: { source: 'db-migration' },
  }) + '\n');
}

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
  dbLog('Migrated SMTP/OIDC settings from environment variables to database.');
})();

// Migrate incomes/expenses tables to support 'fortnightly' recurrence_type
// SQLite can't ALTER CHECK constraints, so we rebuild the tables if needed
(function migrateFortnightlyRecurrence() {
  // Check if fortnightly is already accepted by trying a test insert
  // Use a simpler approach: check the table sql in sqlite_master
  const incomeTableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='incomes'").get() as { sql: string } | undefined;
  const expenseTableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='expenses'").get() as { sql: string } | undefined;

  const needsMigration = (info: { sql: string } | undefined) =>
    info && !info.sql.includes('fortnightly');

  if (needsMigration(incomeTableInfo)) {
    db.transaction(() => {
      db.prepare('ALTER TABLE incomes RENAME TO _incomes_old').run();
      db.prepare(`
        CREATE TABLE incomes (
          id                TEXT PRIMARY KEY,
          household_id      TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
          user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name              TEXT NOT NULL,
          amount_pence      INTEGER NOT NULL,
          posting_day       INTEGER NOT NULL DEFAULT 28,
          contributor_name  TEXT,
          gross_or_net      TEXT CHECK(gross_or_net IN ('gross','net')) DEFAULT 'net',
          is_recurring      INTEGER DEFAULT 1,
          recurrence_type   TEXT CHECK(recurrence_type IN ('monthly','weekly','yearly','fortnightly')) DEFAULT 'monthly',
          start_date        TEXT,
          end_date          TEXT,
          notes             TEXT,
          created_at        TEXT DEFAULT (datetime('now')),
          updated_at        TEXT DEFAULT (datetime('now'))
        )
      `).run();
      db.prepare('INSERT INTO incomes SELECT * FROM _incomes_old').run();
      db.prepare('DROP TABLE _incomes_old').run();
    })();
    dbLog('Migrated incomes table to support fortnightly recurrence.');
  }

  if (needsMigration(expenseTableInfo)) {
    db.transaction(() => {
      db.prepare('ALTER TABLE expenses RENAME TO _expenses_old').run();
      db.prepare(`
        CREATE TABLE expenses (
          id              TEXT PRIMARY KEY,
          household_id    TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
          user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name            TEXT NOT NULL,
          amount_pence    INTEGER NOT NULL,
          posting_day     INTEGER NOT NULL DEFAULT 1,
          account_id      TEXT REFERENCES accounts(id),
          type            TEXT CHECK(type IN ('fixed','variable')) DEFAULT 'fixed',
          category        TEXT NOT NULL DEFAULT 'Other',
          is_household    INTEGER DEFAULT 0,
          split_ratio     REAL DEFAULT 1.0,
          is_recurring    INTEGER DEFAULT 1,
          recurrence_type TEXT CHECK(recurrence_type IN ('monthly','weekly','yearly','fortnightly')) DEFAULT 'monthly',
          start_date      TEXT,
          end_date        TEXT,
          notes           TEXT,
          created_at      TEXT DEFAULT (datetime('now')),
          updated_at      TEXT DEFAULT (datetime('now'))
        )
      `).run();
      db.prepare('INSERT INTO expenses SELECT * FROM _expenses_old').run();
      db.prepare('DROP TABLE _expenses_old').run();
    })();
    dbLog('Migrated expenses table to support fortnightly recurrence.');
  }
})();

// Add is_joint column to accounts for shared account visibility across household members
try {
  db.prepare('ALTER TABLE accounts ADD COLUMN is_joint INTEGER DEFAULT 0').run();
} catch {
  // Column already exists, ignore
}

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

// Add reminder_months column to debts for deal period notifications
try {
  db.prepare('ALTER TABLE debts ADD COLUMN reminder_months INTEGER DEFAULT 0').run();
} catch {
  // Column already exists, ignore
}

// Add notify_updates column to users for version update notifications
try {
  db.prepare('ALTER TABLE users ADD COLUMN notify_updates INTEGER DEFAULT 1').run();
} catch {
  // Column already exists, ignore
}

// Encrypt existing plaintext SMTP/OIDC secrets at rest
try {
  migrateEncryptedSettings();
} catch {
  // Migration already applied or no secrets to migrate, ignore
}

export default db;
