-- ─── Auth tables ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id                  TEXT PRIMARY KEY,
    email               TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name        TEXT NOT NULL DEFAULT '',
    password_hash       TEXT,
    email_verified      INTEGER NOT NULL DEFAULT 0,
    system_role         TEXT NOT NULL DEFAULT 'user' CHECK(system_role IN ('admin','user')),
    failed_login_count  INTEGER NOT NULL DEFAULT 0,
    locked_until        TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS households (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS household_members (
    household_id    TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner','member')),
    joined_at       TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(household_id, user_id)
);

CREATE TABLE IF NOT EXISTS sessions (
    sid         TEXT PRIMARY KEY,
    sess        TEXT NOT NULL,
    expired     INTEGER NOT NULL,
    user_id     TEXT REFERENCES users(id) ON DELETE CASCADE,
    user_agent  TEXT,
    ip_address  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS oidc_accounts (
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issuer      TEXT NOT NULL,
    subject     TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(issuer, subject)
);

CREATE TABLE IF NOT EXISTS totp_secrets (
    user_id          TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    encrypted_secret TEXT NOT NULL,
    iv               TEXT NOT NULL,
    auth_tag         TEXT NOT NULL,
    verified         INTEGER NOT NULL DEFAULT 0,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recovery_codes (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash   TEXT NOT NULL,
    used        INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS totp_used_tokens (
    user_id   INTEGER NOT NULL,
    token     TEXT    NOT NULL,
    period    INTEGER NOT NULL,
    used_at   INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)),
    PRIMARY KEY (user_id, token, period)
);

CREATE TABLE IF NOT EXISTS reset_tokens (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    type        TEXT NOT NULL CHECK(type IN ('password_reset','email_verify','email_change','invite','totp_reset')),
    new_email   TEXT,
    expires_at  TEXT NOT NULL,
    used        INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
    id          TEXT PRIMARY KEY,
    user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
    action      TEXT NOT NULL,
    detail      TEXT,
    ip_address  TEXT,
    user_agent  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS login_alerts (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address  TEXT,
    user_agent  TEXT,
    fingerprint TEXT NOT NULL,
    notified    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Data tables (with user_id + household_id) ────────────────────────────────

CREATE TABLE IF NOT EXISTS accounts (
    id           TEXT PRIMARY KEY,
    household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    sort_order   INTEGER DEFAULT 0,
    is_joint     INTEGER DEFAULT 0,
    created_at   TEXT DEFAULT (datetime('now')),
    UNIQUE(name, household_id)
);

CREATE TABLE IF NOT EXISTS incomes (
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
);

CREATE TABLE IF NOT EXISTS expenses (
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
);

CREATE TABLE IF NOT EXISTS debts (
    id                      TEXT PRIMARY KEY,
    household_id            TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    user_id                 TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                    TEXT NOT NULL,
    balance_pence           INTEGER NOT NULL,
    interest_rate           REAL DEFAULT 0,
    minimum_payment_pence   INTEGER DEFAULT 0,
    overpayment_pence       INTEGER DEFAULT 0,
    compounding_frequency   TEXT DEFAULT 'monthly',
    is_recurring            INTEGER DEFAULT 1,
    recurrence_type         TEXT DEFAULT 'monthly',
    posting_day             INTEGER DEFAULT 1,
    start_date              TEXT,
    end_date                TEXT,
    is_household            INTEGER DEFAULT 0,
    split_ratio             REAL DEFAULT 1.0,
    notes                   TEXT,
    created_at              TEXT DEFAULT (datetime('now')),
    updated_at              TEXT DEFAULT (datetime('now')),
    reminder_months         INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS debt_deal_periods (
    id              TEXT PRIMARY KEY,
    debt_id         TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    label           TEXT,
    interest_rate   REAL NOT NULL DEFAULT 0,
    start_date      TEXT NOT NULL,
    end_date        TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS debt_notifications_sent (
    id              TEXT PRIMARY KEY,
    debt_id         TEXT NOT NULL,
    deal_period_id  TEXT NOT NULL REFERENCES debt_deal_periods(id) ON DELETE CASCADE,
    sent_at         TEXT DEFAULT (datetime('now')),
    UNIQUE(debt_id, deal_period_id)
);

CREATE TABLE IF NOT EXISTS savings_goals (
    id                          TEXT PRIMARY KEY,
    household_id                TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    user_id                     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                        TEXT NOT NULL,
    target_amount_pence         INTEGER NOT NULL,
    current_amount_pence        INTEGER DEFAULT 0,
    monthly_contribution_pence  INTEGER DEFAULT 0,
    target_date                 TEXT,
    notes                       TEXT,
    created_at                  TEXT DEFAULT (datetime('now')),
    updated_at                  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS month_locks (
    year_month      TEXT NOT NULL,
    household_id    TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    locked_at       TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (year_month, household_id)
);

-- ─── System settings ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS system_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS debt_balance_snapshots (
    id              TEXT PRIMARY KEY,
    debt_id         TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    household_id    TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    balance_pence   INTEGER NOT NULL,
    recorded_at     TEXT NOT NULL DEFAULT (date('now'))
);

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
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_household_members_user ON household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_household ON household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired);
CREATE INDEX IF NOT EXISTS idx_oidc_accounts_user ON oidc_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_totp_secrets_user ON totp_secrets(user_id);
CREATE INDEX IF NOT EXISTS idx_recovery_codes_user ON recovery_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_login_alerts_user ON login_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_household ON accounts(household_id);
CREATE INDEX IF NOT EXISTS idx_incomes_household ON incomes(household_id);
CREATE INDEX IF NOT EXISTS idx_expenses_household ON expenses(household_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_account ON expenses(account_id);
CREATE INDEX IF NOT EXISTS idx_debts_household ON debts(household_id);
CREATE INDEX IF NOT EXISTS idx_deal_periods_debt ON debt_deal_periods(debt_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_debt ON debt_notifications_sent(debt_id);
CREATE INDEX IF NOT EXISTS idx_savings_goals_household ON savings_goals(household_id);
CREATE INDEX IF NOT EXISTS idx_savings_transactions_goal_id ON savings_transactions(savings_goal_id);
CREATE INDEX IF NOT EXISTS idx_savings_transactions_household_id ON savings_transactions(household_id);
CREATE INDEX IF NOT EXISTS idx_month_locks_household ON month_locks(household_id);
CREATE INDEX IF NOT EXISTS idx_incomes_contributor ON incomes(contributor_name);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);
CREATE INDEX IF NOT EXISTS idx_debt_balance_snapshots_debt ON debt_balance_snapshots(debt_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_debt_balance_snapshots_household ON debt_balance_snapshots(household_id, recorded_at);
