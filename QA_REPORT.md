# BasicBudget QA Report

**Version:** v2.13.4
**Commit:** 657f92b
**Date:** 2026-03-02
**Scope:** Full codebase — server, frontend, shared types, DB migrations, recurring engine, auth, admin

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 1 |
| Medium | 2 |
| Low | 7 |
| ✅ No issues | 13 areas |

The codebase is generally well-structured with strong security practices (CSRF, rate limiting, session hardening, TOTP replay protection, argon2 password hashing, AES-256-GCM secrets encryption). The primary concern is a data inconsistency in the `mapUser` function between two route files.

---

## Critical

### C-1 — Profile `mapUser` missing `has_totp` field
**File:** `server/routes/profile.ts` — `mapUser()` function
**Also:** `server/routes/auth.ts` — duplicate `mapUser()` function

Two separate `mapUser` implementations exist and have drifted. The `auth.ts` version (used by `GET /api/auth/status`) queries the DB for `has_totp` and includes it in the returned `User` object. The `profile.ts` version (used by `GET /api/auth/profile` and `PUT /api/auth/profile`) does not include `has_totp`.

**Impact:** Any client code relying on `has_totp` from the profile endpoint will silently receive `undefined`, which could cause the TOTP UI to render incorrectly or allow a user to believe 2FA is not configured when it is.

**Fix:** Extract a single shared `mapUser(row)` utility (e.g. `server/utils/mapUser.ts`) used by both routes, or copy the TOTP check from `auth.ts` into `profile.ts`. The TOTP check pattern from `auth.ts` is:
```typescript
const totpRow = db.prepare('SELECT id FROM totp_credentials WHERE user_id = ?').get(row.id);
has_totp: Boolean(totpRow),
```

---

## High

### H-1 — `reset_tokens.new_email` column repurposed to store `householdId`
**File:** `server/routes/household.ts` — invite flow

During the household invite flow, the `new_email` column in `reset_tokens` is used to store a `householdId` string instead of an email address. The value is later read back as `consumed.newEmail` and used as a household ID.

**Impact:** Works at runtime but is semantically incorrect and a maintenance hazard. Any future migration, audit, or developer reading the schema will not understand that `new_email` holds a household UUID. It also means the field cannot be used for its original purpose in an invite token.

**Fix:** Add a `metadata TEXT` column to `reset_tokens` for auxiliary data, or add an explicit `household_id TEXT` column. Migrate the invite flow to use that column.

---

## Medium

### M-1 — Schema load has no error handling
**File:** `server/db.ts` — top of file, schema execution

```typescript
const schema = fs.readFileSync(path.join(process.cwd(), 'server', 'schema.sql'), 'utf8');
db.exec(schema);
```

If `schema.sql` is missing from the Docker image or the working directory is wrong, this throws an unhandled exception that crashes the server with no clear message.

**Fix:** Wrap in try/catch and emit a clear startup error:
```typescript
try {
  const schema = fs.readFileSync(path.join(process.cwd(), 'server', 'schema.sql'), 'utf8');
  db.exec(schema);
} catch (err) {
  process.stderr.write(`Failed to load schema.sql: ${err}\n`);
  process.exit(1);
}
```

### M-2 — CSRF initialisation uses `as any` on session object
**File:** `server/routes/auth.ts:364`

```typescript
(req.session as any)._csrfInitialized = true;
```

Bypasses TypeScript's session type checking. Low risk in isolation, but if the session interface changes this becomes silently broken.

**Fix:** Augment the session type to include `_csrfInitialized?: boolean` via declaration merging or a custom session interface.

---

## Low

### L-1 — Dynamic import of `randomUUID` inside function body
**File:** `server/services/debtNotifications.ts:55`

```typescript
const { randomUUID } = await import('node:crypto');
```

`randomUUID` is a stable, synchronous export of `node:crypto`. Importing it dynamically inside a function body introduces unnecessary async overhead on each call.

**Fix:** Add `import { randomUUID } from 'node:crypto'` at the top of the file.

### L-2 — `split_ratio` float arithmetic
**File:** `server/routes/summary.ts:25`, `server/routes/household.ts`

`split_ratio` is a SQLite `REAL` column used to scale `effective_pence`. The arithmetic is:
```typescript
Math.round((e.effective_pence ?? 0) * ((e.split_ratio as number) ?? 1))
```
`Math.round()` is applied, which is correct. However, if `split_ratio` values are accumulated across multiple expenses (e.g. a `reduce` summing rounded results), small rounding differences compound. Currently benign, but worth noting if the split logic becomes more complex.

**Recommendation:** No immediate change needed. If split calculations are ever extended, consider rounding only at the final aggregation step.

### L-3 — `has_totp` not returned by profile PUT response (consequence of C-1)
**File:** `server/routes/profile.ts` — `PUT /api/auth/profile`

This is a direct consequence of C-1. Addressed by the same fix.

### L-4 — No explicit 404 handler
**File:** `server/index.ts`

Express serves the frontend's `index.html` for unmatched routes (SPA fallback), but there is no explicit 404 JSON handler for unmatched `/api/*` routes. An API client hitting a non-existent route receives an HTML response instead of `{ message: 'Not found' }`.

**Fix:** Add before the SPA fallback:
```typescript
app.use('/api', (_req, res) => res.status(404).json({ message: 'Not found' }));
```

### L-5 — Household summary uses `filterActiveInMonth` with synthetic `amount_pence`
**File:** `server/routes/household.ts:163`, `server/routes/summary.ts:32`

Debts don't have a single `amount_pence` field; they use `minimum_payment_pence + overpayment_pence`. The routes pre-map them before passing to `filterActiveInMonth`. This is documented in CLAUDE.md but the mapping code is duplicated in two route files with no shared utility.

**Recommendation:** Extract the debt pre-mapping into a shared helper to avoid the two implementations diverging.

### L-6 — `req.params` typed as `string | string[]` — inconsistent casting
**File:** Multiple route files

Some files correctly use `req.params['id'] as string` per CLAUDE.md; a few older routes use `req.params.id` directly. Both work at runtime (Express always provides strings for named params), but the direct form generates a TypeScript warning in strict mode.

**Recommendation:** Audit remaining instances and standardise on `req.params['key'] as string`.

### L-7 — `@types/node` bumped to v25 but Node.js runtime is v24
**File:** `package.json`

The Dependabot bump brought `@types/node` to v25.3.3 while the Docker base image and runtime are Node.js v24. Type definitions for APIs that don't exist in v24 could silently pass compilation but fail at runtime.

**Recommendation:** Pin `@types/node` to `^24` to keep types and runtime aligned, e.g. `"@types/node": "^24.0.0"`.

---

## Areas with No Issues Found

The following areas were inspected and found to be correctly implemented:

| Area | Notes |
|------|-------|
| Recurring engine | Monthly, weekly, fortnightly, yearly, one-off — all edge cases handled |
| Duplicate detection (`norm()`) | Correct boolean → `'1'/'0'` coercion, null normalisation, string trimming |
| SQL injection | All queries use parameterised statements; no string concatenation |
| Auth middleware coverage | All API routes protected; admin routes double-gated with `requireAdmin` |
| Rate limiting | Comprehensive — login, registration, TOTP, password reset, invites |
| Session security | 72h absolute / 2h idle timeout, session regenerated on login |
| CSRF protection | Double-submit cookie pattern, `httpOnly`, `secure` in production |
| Account lockout | 5 failed attempts → 30 min lockout |
| TOTP replay protection | Tokens tracked per 30s period, cleaned after 2 minutes |
| Password strength | Validated on register and reset flows |
| Secrets at rest | AES-256-GCM encryption, masked in API responses |
| Settings cache | Proper invalidation on write |
| DB migrations | All wrapped in try/catch; transactional where needed |
| Money handling | All amounts in integer pence; `Math.round()` applied on float multiplication |
| Console/log hygiene | No `console.log` calls; all logging via `logger.ts` |
| Error response format | Consistent `{ message: string }` across all routes |
| Frontend error handling | 401/403/network errors all handled in `api/client.ts` |
| CSRF token refresh | Cleared on 401 and 403, auto-refreshed on next request |

---

## Recommended Actions (Priority Order)

1. **Fix C-1** — Extract shared `mapUser` utility and include `has_totp` in profile responses
2. **Fix H-1** — Add `household_id` column to `reset_tokens` and migrate invite flow
3. **Fix M-1** — Wrap schema.sql load in try/catch with `process.exit(1)`
4. **Fix L-7** — Pin `@types/node` back to `^24` to match runtime
5. **Fix L-4** — Add JSON 404 handler for unmatched `/api/*` routes
6. **Fix L-1** — Move `randomUUID` to static import in `debtNotifications.ts`
7. **Fix M-2** — Augment session type instead of `as any` for CSRF flag
8. **Fix L-5** — Extract shared debt pre-mapping helper used by summary and household routes
