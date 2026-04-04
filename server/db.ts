import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { migrateEncryptedSettings } from './services/settings.js';

type DbLogLevel = 'debug' | 'info' | 'warn' | 'error';

const DB_LEVEL_ORDER: Record<DbLogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
let dbLogLevel: DbLogLevel = config.LOG_LEVEL;

function writeDbLog(level: DbLogLevel, message: string, meta?: Record<string, unknown>): void {
  if (DB_LEVEL_ORDER[level] < DB_LEVEL_ORDER[dbLogLevel]) return;
  const line: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    message,
    meta: {
      source: 'db-init',
      ...meta,
    },
  };
  const stream = level === 'error' ? process.stderr : process.stdout;
  stream.write(JSON.stringify(line) + '\n');
}

const DATA_DIR = config.DB_PATH
  ? path.dirname(config.DB_PATH)
  : path.join(process.cwd(), 'data');

const DB_FILE = config.DB_PATH ?? path.join(DATA_DIR, 'basicbudget.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  writeDbLog('info', 'Created database data directory', { data_dir: DATA_DIR });
}

writeDbLog('info', 'Opening SQLite database', {
  db_path: DB_FILE,
  configured_log_level: dbLogLevel,
});

let db: Database.Database = new Database(DB_FILE);

// Performance pragmas — try each journal mode in order of preference.
// WAL is ideal but requires shared-memory auxiliary files (-wal, -shm) that
// some Docker volume backends (NFS, certain overlay2 variants) cannot create.
//
// When WAL fails we take the following recovery steps:
//   1. Close the broken connection.
//   2. Delete any stale WAL auxiliary files.
//   3. Patch the SQLite file header: bytes 18–19 record the file-format
//      write/read version (0x02 = WAL, 0x01 = legacy). If left as 0x02,
//      re-opening the file triggers WAL recovery, which also fails on the
//      same filesystem and poisons the fresh connection before any pragma
//      can run. Resetting to 0x01 bypasses WAL recovery entirely.
//      MEMORY and OFF modes are per-connection settings not stored in the
//      header, so this one-time write is sufficient.
//   4. Open a fresh connection (no WAL recovery triggered).
//   5. Try MEMORY mode (journal in RAM — no new files needed).
//   6. Try OFF mode (no journal — direct writes to the main DB file).
//   7. Fall back to DELETE (implicit default — may still fail on some
//      filesystems if a .db-journal file cannot be created).
let journalMode: string;
try {
  db.pragma('journal_mode = WAL');
  journalMode = 'wal';
  writeDbLog('info', 'SQLite journal mode configured', { journal_mode: journalMode });
} catch {
  // Step 1 — close the broken connection.
  try { db.close(); } catch { /* ignore */ }

  // Step 2 — remove stale WAL auxiliary files.
  for (const ext of ['-wal', '-shm']) {
    try { fs.unlinkSync(DB_FILE + ext); } catch { /* may not exist */ }
  }

  // Step 3 — patch the database header to clear the WAL format indicator.
  try {
    const SQLITE_MAGIC = Buffer.from('SQLite format 3\0');
    const fd = fs.openSync(DB_FILE, 'r+');
    const buf = Buffer.alloc(20);
    fs.readSync(fd, buf, 0, 20, 0);
    if (buf.subarray(0, 16).equals(SQLITE_MAGIC) && (buf[18] === 2 || buf[19] === 2)) {
      buf[18] = 1;
      buf[19] = 1;
      fs.writeSync(fd, buf, 18, 2, 18);
    }
    fs.closeSync(fd);
  } catch { /* new database, read-only fs, or header already correct */ }

  // Step 4 — fresh connection (WAL recovery will not be triggered).
  db = new Database(DB_FILE);

  // Steps 5–7 — progressively more permissive journal modes.
  journalMode = 'delete';
  try {
    db.pragma('journal_mode = MEMORY');
    journalMode = 'memory';
  } catch {
    try {
      db.pragma('journal_mode = OFF');
      journalMode = 'off';
    } catch {
      // DELETE is the implicit SQLite default.
    }
  }

  const modeMessages: Record<string, string> = {
    memory: 'WAL journal mode unavailable on this filesystem — using MEMORY journal mode (journal held in RAM; no auxiliary disk files required).',
    off:    'WAL and MEMORY journal modes both unavailable — using OFF journal mode (no journal; writes go directly to the database file; not crash-safe).',
    delete: 'WAL, MEMORY, and OFF journal modes all unavailable — falling back to DELETE mode. Writes requiring a journal file may fail on this filesystem.',
  };
  writeDbLog('warn', modeMessages[journalMode] ?? 'Journal mode fallback active.', {
    journal_mode: journalMode,
  });
}
db.pragma('foreign_keys = ON');
writeDbLog('debug', 'SQLite foreign key enforcement enabled', { pragma: 'foreign_keys = ON' });

// Apply schema
try {
  const schema = fs.readFileSync(
    path.join(process.cwd(), 'server', 'schema.sql'),
    'utf8',
  );
  db.exec(schema);
  writeDbLog('info', 'Schema applied successfully', {
    schema_path: path.join(process.cwd(), 'server', 'schema.sql'),
  });
} catch (err) {
  // Schema exec may fail on Docker filesystems that cannot create auxiliary
  // journal files (required by DELETE journal mode for write transactions).
  // If the database was previously initialised the tables already exist and
  // the app can continue — individual writes will surface errors rather than
  // crashing the process in a restart loop.
  let isInitialised = false;
  try {
    isInitialised = !!db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'",
    ).get();
  } catch { /* cannot query — treat as uninitialised */ }

  if (!isInitialised) {
    writeDbLog('error', 'Failed to apply schema to an uninitialised database', { error: String(err) });
    process.exit(1);
  }
  writeDbLog(
    'warn',
    'Schema exec failed on an already-initialised database — continuing with existing schema',
    { error: String(err) },
  );
}

function refreshDbLogLevelFromSettings(): void {
  try {
    const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('log.level') as { value: string } | undefined;
    if (row?.value && row.value in DB_LEVEL_ORDER) {
      dbLogLevel = row.value as DbLogLevel;
    }
  } catch {
    // Keep env-configured fallback if the settings table is unavailable.
  }
}

refreshDbLogLevelFromSettings();

// DB logging helper (local to avoid circular imports with logger.ts)
function dbLog(message: string, level: DbLogLevel = 'info', meta?: Record<string, unknown>): void {
  writeDbLog(level, message, { source: 'db-migration', ...meta });
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

// Add date_format column to users for date display preference
try {
  db.prepare("ALTER TABLE users ADD COLUMN date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY'").run();
} catch { /* column already exists */ }

// Add time_format column to users for 12h/24h time display preference
try {
  db.prepare("ALTER TABLE users ADD COLUMN time_format TEXT NOT NULL DEFAULT '12h'").run();
} catch { /* column already exists */ }

// Add is_household column to savings_goals for joint savings (proportioned equally)
try {
  db.prepare('ALTER TABLE savings_goals ADD COLUMN is_household INTEGER DEFAULT 0').run();
} catch {
  // Column already exists, ignore
}

// Add contributor_user_id to financial tables for per-user visibility
try {
  db.prepare('ALTER TABLE incomes ADD COLUMN contributor_user_id TEXT REFERENCES users(id)').run();
} catch {
  // Column already exists, ignore
}
try {
  db.prepare('ALTER TABLE expenses ADD COLUMN contributor_user_id TEXT REFERENCES users(id)').run();
} catch {
  // Column already exists, ignore
}
try {
  db.prepare('ALTER TABLE debts ADD COLUMN contributor_user_id TEXT REFERENCES users(id)').run();
} catch {
  // Column already exists, ignore
}
try {
  db.prepare('ALTER TABLE savings_goals ADD COLUMN contributor_user_id TEXT REFERENCES users(id)').run();
} catch {
  // Column already exists, ignore
}

// Add is_household to incomes (expenses/debts/savings_goals already have it)
try {
  db.prepare('ALTER TABLE incomes ADD COLUMN is_household INTEGER DEFAULT 0').run();
} catch {
  // Column already exists, ignore
}

try {
  db.prepare('ALTER TABLE savings_goals ADD COLUMN auto_contribute INTEGER DEFAULT 0').run();
} catch { /* Column already exists */ }

try {
  db.prepare('ALTER TABLE savings_goals ADD COLUMN contribution_day INTEGER DEFAULT 1').run();
} catch { /* Column already exists */ }

// Create savings_transactions table for existing databases
db.prepare(`
  CREATE TABLE IF NOT EXISTS savings_transactions (
    id                  TEXT PRIMARY KEY,
    savings_goal_id     TEXT NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
    household_id        TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                TEXT NOT NULL CHECK(type IN ('contribution','deposit','withdrawal')),
    amount_pence        INTEGER NOT NULL,
    balance_after_pence INTEGER NOT NULL,
    notes               TEXT,
    created_at          TEXT DEFAULT (datetime('now'))
  )
`).run();

db.prepare('CREATE INDEX IF NOT EXISTS idx_savings_transactions_goal_id ON savings_transactions(savings_goal_id)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_savings_transactions_household_id ON savings_transactions(household_id)').run();
db.prepare(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_savings_tx_contribution_unique
  ON savings_transactions(savings_goal_id, substr(created_at, 1, 7))
  WHERE type = 'contribution'
`).run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_savings_transactions_household_created ON savings_transactions(household_id, created_at)').run();

// Migrate existing contributor_name values to contributor_user_id where a matching user exists
try {
  db.prepare(`
    UPDATE incomes SET contributor_user_id = (
      SELECT u.id FROM users u
      JOIN household_members hm ON hm.user_id = u.id AND hm.household_id = incomes.household_id
      WHERE LOWER(u.display_name) = LOWER(incomes.contributor_name)
      LIMIT 1
    ) WHERE contributor_name IS NOT NULL AND contributor_name != '' AND contributor_user_id IS NULL
  `).run();
} catch {
  // Migration already applied or no matching users, ignore
}

// Fix totp_used_tokens.user_id declared type from INTEGER to TEXT (data is ephemeral, 2-min lifetime)
try {
  const cols = db.prepare("PRAGMA table_info(totp_used_tokens)").all() as unknown as { name: string; type: string }[];
  const uidCol = cols.find(c => c.name === 'user_id');
  if (uidCol?.type === 'INTEGER') {
    db.exec(`
      CREATE TABLE totp_used_tokens_v2 (
        user_id   TEXT    NOT NULL,
        token     TEXT    NOT NULL,
        period    INTEGER NOT NULL,
        used_at   INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)),
        PRIMARY KEY (user_id, token, period)
      );
      DROP TABLE totp_used_tokens;
      ALTER TABLE totp_used_tokens_v2 RENAME TO totp_used_tokens;
    `);
    dbLog('Migrated totp_used_tokens.user_id from INTEGER to TEXT.');
  }
} catch {
  // Migration failed or not needed, ignore
}

// Encrypt existing plaintext SMTP/OIDC secrets at rest
try {
  migrateEncryptedSettings();
} catch {
  // Migration already applied or no secrets to migrate, ignore
}

// Remove the informational-only 'type' column from expenses (SQLite ≥3.35)
try {
  db.prepare('ALTER TABLE expenses DROP COLUMN type').run();
  dbLog('Dropped expenses.type column.');
} catch {
  // Column already removed or not supported, ignore
}

// Seed initial debt balance snapshots for existing debts (one-time)
try {
  const snapshotCount = (db.prepare('SELECT COUNT(*) as c FROM debt_balance_snapshots').get() as { c: number }).c;
  if (snapshotCount === 0) {
    const existingDebts = db.prepare('SELECT id, household_id, balance_pence FROM debts WHERE balance_pence > 0').all() as Array<{ id: string; household_id: string; balance_pence: number }>;
    const today = new Date().toISOString().slice(0, 10);
    const ins = db.prepare('INSERT OR IGNORE INTO debt_balance_snapshots (id, debt_id, household_id, balance_pence, recorded_at) VALUES (?, ?, ?, ?, ?)');
    for (const d of existingDebts) {
      ins.run(randomUUID(), d.id, d.household_id, d.balance_pence, today);
    }
    if (existingDebts.length > 0) {
      dbLog(`Seeded ${existingDebts.length} initial debt balance snapshots.`);
    }
  }
} catch {
  // Snapshots already seeded or table doesn't exist yet, ignore
}

export default db;
