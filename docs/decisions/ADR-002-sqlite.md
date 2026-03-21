# ADR-002: SQLite with better-sqlite3 and Integer Pence Storage

**Date:** 2024-01-01
**Status:** Accepted

---

## Context

BasicBudget is a personal/household budgeting tool intended to run as a single-container Docker image on a home server or VPS, without requiring external infrastructure. The data model is a set of related financial records (income, expenses, debts, savings goals) owned by households and users.

A decision was required on:
1. Which database engine to use
2. Which driver to use for Node.js
3. How to store monetary values to avoid floating-point rounding errors

## Decision

**Database engine: SQLite**

SQLite was chosen over Postgres, MySQL, and similar client-server databases. BasicBudget is a single-user or small-household application — it does not require the concurrency, replication, or network features of a client-server database. SQLite's file-based model means zero infrastructure: no database server to install, configure, or back up separately.

**Driver: better-sqlite3**

`better-sqlite3` was chosen over the official `sqlite3` package and `@libsql/client`. It uses a synchronous API (no callbacks or promises), which simplifies Express route handlers considerably — no `async/await` chains for every database call. Its synchronous nature also makes it easier to reason about transaction boundaries.

**Money storage: integer pence**

All monetary values are stored as integer pence (e.g. £19.99 → `1999`). This eliminates floating-point rounding errors entirely. The convention applies to every column containing money: `amount_pence`, `balance_pence`, `minimum_payment_pence`, etc. Display formatting (pence → `£X.XX`) is handled exclusively by `src/utils/formatters.ts`.

## Consequences

**Positive:**
- Zero infrastructure — SQLite runs in-process with no external server
- Simple backup: copy one file
- Synchronous `better-sqlite3` API produces simpler, more readable route handlers
- Integer pence eliminates `0.1 + 0.2 !== 0.3` class of bugs entirely

**Negative / trade-offs:**
- SQLite does not support concurrent writes well — this is acceptable for a single-user/small-household tool but would be a problem at scale
- WAL mode can fail on some Docker volume backends (NFS, certain overlay2 variants); the server detects this and falls back automatically
- Schema migrations cannot use `ALTER COLUMN` or `DROP COLUMN` in older SQLite versions — workarounds (new table + data copy) are sometimes needed
- All rows returned by `better-sqlite3` are typed as `Record<string, unknown>` — explicit row-mapping functions are required in every route

## Alternatives Considered

| Alternative | Reason rejected |
|---|---|
| PostgreSQL | Requires a separate server process; too much infrastructure for a personal tool |
| MySQL / MariaDB | Same concern as PostgreSQL |
| `sqlite3` (async driver) | Callback/promise API adds complexity with no meaningful benefit for this use case |
| Floating-point pounds | Floating-point arithmetic produces rounding errors that are unacceptable in financial data |
