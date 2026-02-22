CREATE TABLE IF NOT EXISTS accounts (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    sort_order  INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS incomes (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    amount_pence      INTEGER NOT NULL,
    posting_day       INTEGER NOT NULL DEFAULT 28,
    contributor_name  TEXT,
    gross_or_net      TEXT CHECK(gross_or_net IN ('gross','net')) DEFAULT 'net',
    is_recurring      INTEGER DEFAULT 1,
    recurrence_type   TEXT CHECK(recurrence_type IN ('monthly','weekly','yearly')) DEFAULT 'monthly',
    start_date        TEXT,
    end_date          TEXT,
    notes             TEXT,
    created_at        TEXT DEFAULT (datetime('now')),
    updated_at        TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expenses (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    amount_pence    INTEGER NOT NULL,
    posting_day     INTEGER NOT NULL DEFAULT 1,
    account_id      TEXT REFERENCES accounts(id),
    type            TEXT CHECK(type IN ('fixed','variable')) DEFAULT 'fixed',
    category        TEXT NOT NULL DEFAULT 'Other',
    is_household    INTEGER DEFAULT 0,
    split_ratio     REAL DEFAULT 1.0,
    is_recurring    INTEGER DEFAULT 1,
    recurrence_type TEXT CHECK(recurrence_type IN ('monthly','weekly','yearly')) DEFAULT 'monthly',
    start_date      TEXT,
    end_date        TEXT,
    notes           TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS debts (
    id                      TEXT PRIMARY KEY,
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
    updated_at              TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS savings_goals (
    id                          TEXT PRIMARY KEY,
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
    year_month  TEXT PRIMARY KEY,
    locked_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_account ON expenses(account_id);
CREATE INDEX IF NOT EXISTS idx_incomes_contributor ON incomes(contributor_name);
