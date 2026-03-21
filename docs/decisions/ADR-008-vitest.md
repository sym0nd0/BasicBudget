# ADR-008: Vitest + Supertest with Real SQLite in Integration Tests

**Date:** 2024-01-01
**Status:** Accepted

---

## Context

BasicBudget needed a testing strategy covering both pure utility functions and full HTTP API flows. A critical constraint emerged after an early incident: mocked database tests passed while the real database migration failed in production — the mock diverged from the real behaviour without the test suite catching it.

## Decision

We adopted **Vitest** as the test runner and **Supertest** for HTTP integration tests. Integration tests run against a **real SQLite `:memory:` database** — the database is never mocked.

Test structure:
- `tests/unit/` — pure function tests (recurring engine, formatters, etc.)
- `tests/integration/` — full HTTP request/response cycles via Supertest + real SQLite
- `tests/security/` — IDOR, CSRF, injection, rate limiting, and visibility tests
- `tests/setup.ts` — sets `DB_PATH=:memory:` and required environment variables before any module loads

`supertest.agent(app)` is used (not bare `supertest(app)`) when tests need to preserve session cookies across multiple requests.

The 80% coverage target applies to server routes and utility functions. New routes must have at least one integration test; new utility functions must have unit tests.

## Consequences

**Positive:**
- Real SQLite in tests catches migration failures, schema errors, and type coercion bugs that mocks would miss
- `:memory:` databases are fast — integration tests run in milliseconds
- Vitest's ESM support works seamlessly with the project's `"type": "module"` setup
- Supertest with `agent()` correctly handles CSRF cookies and session state

**Negative / trade-offs:**
- Tests cannot run without the full server module loading (including `server/db.ts`), which means environment variables must be set before any import
- In-memory SQLite means test data does not persist between test runs — `beforeAll` must set up all required state

## Alternatives Considered

| Alternative | Reason rejected |
|---|---|
| Jest | ESM support in Jest was experimental and required complex configuration at time of adoption; Vitest has native ESM support |
| Mocked database | Caused a production incident when mock diverged from real SQLite behaviour |
| Playwright for all tests | E2E browser tests are too slow and fragile for routine API contract testing; Playwright is kept for UI-level tests only |
| Separate test database file | `:memory:` is faster and does not leave artefacts on disk |
