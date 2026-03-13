# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

`npx` and bare `node` are not on the shell PATH in this environment. Use the full Windows path:

```bash
# TypeScript check — frontend (tsconfig.json references)
"/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc -b --noEmit

# TypeScript check — server
"/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --project tsconfig.server.json --noEmit

# Lint
"/c/Program Files/nodejs/node.exe" node_modules/.bin/eslint src server shared
```

Start dev (run in an external terminal — two processes):
```bash
npm run dev   # Vite on :5173 + Express on :3001 via concurrently + tsx watch
```

Build and release:
```bash
npm run build            # tsc -b && vite build  →  dist/   +  tsc server  →  dist-server/
npm start                # production: Express serves dist/ as static + /api/*
```

Docker image is built and pushed to GHCR automatically by GitHub Actions on every push to `master` or any `v*` tag. To retrigger after moving a tag: delete and recreate the tag, then push.

## Architecture

### Request flow

```
Browser → Vite dev server (:5173)
            └─ /api/* proxy → Express (:3001) → better-sqlite3 → data/basicbudget.db
Production: single Express (:3000) serves dist/ (static) + /api/* routes
```

### TypeScript split

Three separate compilation units share one `shared/types.ts`:

| Config | Scope | Mode |
|---|---|---|
| `tsconfig.app.json` | `src/` | `noEmit`, bundler mode (Vite owns emit) |
| `tsconfig.node.json` | `vite.config.ts` | `noEmit`, bundler mode |
| `tsconfig.server.json` | `server/`, `shared/` | emits to `dist-server/`, NodeNext module resolution |

Server imports must use `.js` extensions even for `.ts` source files (NodeNext requirement). e.g. `import db from '../db.js'`.

### SQLite / type-casting rules

`better-sqlite3` returns all rows as `Record<string, unknown>`. Two patterns are in use:

- **Booleans**: SQLite stores `INTEGER 0/1`. Always coerce with `Boolean(row.is_recurring)` — never rely on the raw value being a JS boolean.
- **Interface casts**: Cast through `unknown` — `row as unknown as MyInterface` — because `Record<string, unknown>` doesn't structurally overlap typed interfaces.
- **`req.params` values**: `@types/express` v5 types these as `string | string[]`. Use `req.params['key'] as string`.

### Recurring engine (`server/utils/recurring.ts`)

All GET list endpoints filter through `filterActiveInMonth(items, yearMonth)` before responding. This determines whether each income/expense/debt is active in the requested month based on `recurrence_type`, `start_date`, `end_date`, and `posting_day`. Weekly items get `amount_pence` multiplied by the number of occurrences in the month.

### Duplicate detection (`src/utils/duplicates.ts`)

`norm(v)` canonicalises values before comparison: `null`/`undefined`/`''` → `null`, strings → lowercase trimmed, booleans → `'1'`/`'0'` (matching SQLite integer storage), numbers → `String(v)`. This is critical — SQLite booleans return as integers; skipping this coercion silently breaks duplicate checks.

### Money

All monetary values are stored and passed as **integer pence** (`amount_pence`, `balance_pence`, etc.). `src/utils/formatters.ts` handles pence → display conversion. Never store or compute with floating-point pounds.

### Percentage formatting

**All percentage values — both displayed text and user input fields — must support exactly 2 decimal places.**

**Display formatting:** Use `formatPercent()` function
The `formatPercent(value: number)` function in `src/utils/formatters.ts` formats numbers to exactly 2 decimal places with a `%` suffix:

```typescript
import { formatPercent } from '../utils/formatters';

// ✓ Good — displayed text
<Badge>{formatPercent(debt.interest_rate)}</Badge>  // e.g. "19.95%"
<p>{formatPercent(progress)} complete</p>           // e.g. "75.50% complete"
<td>{formatPercent(period.interest_rate)}</td>      // e.g. "0.00%"

// ✗ Bad
<p>{value.toFixed(1)}%</p>                          // inconsistent with 1 decimal
<p>{value}%</p>                                      // no formatting
```

**Input field formatting:** Use `step="0.01"`
All number input fields accepting percentages must use `step="0.01"` to allow users to enter values with 2 decimal places:

```typescript
<Input
  label="APR (%)"
  type="number"
  step="0.01"  // ← Allows 0.01 increments (e.g., 19.95%), NOT 0.1
  min="0"
  value={interestRate}
  suffix="%"
/>
```

Without `step="0.01"`, HTML5 validation rejects valid 2-decimal values with "Please enter a valid value. The nearest values are X and Y."

**Exception:** Inline CSS width values for progress bars (`style={{ width: \`${percentage}%\` }}`) are not text display and do not need `formatPercent()`.

### Settings service (`server/services/settings.ts`)

SMTP and OIDC configuration is stored in the `system_settings` SQLite table (key/value pairs) and accessed through this service. It maintains an in-memory cache invalidated on writes.

- `getSetting(key)` / `setSetting(key, value)` — thin wrappers over the table.
- `getSmtpConfig()` / `getOidcConfig()` — return typed config structs, or `null` if not configured.
- `getSmtpConfigMasked()` / `getOidcConfigMasked()` — same but with secrets replaced by `••••••••` for API responses.
- `invalidateCache()` — call after bulk settings changes (e.g. OIDC update) so the next read re-fetches from DB.

On startup, `server/db.ts` runs a one-time migration: if any `SMTP_HOST` / `OIDC_ISSUER_URL` etc. env vars are set and the `system_settings` table is empty for those keys, they are seeded automatically (backwards-compatible upgrade path). SMTP/OIDC env vars are **no longer in `config.ts`** — they are not validated on startup.

### Admin panel

- All routes under `/api/admin` require `requireAuth` + `requireAdmin` middleware.
- The first user to register is automatically assigned `system_role = 'admin'`.
- Admin nav items in the sidebar are conditional on `user?.system_role === 'admin'`.
- OIDC client cache (`server/routes/oidc.ts`) uses `undefined` as "not yet built" sentinel and `null` as "built but not configured". Call `resetOidcClient()` after updating OIDC settings to force a rebuild.

### Household tab — jointly appointed items only

**All data displayed on the Household tab (`/household`) must be filtered to `is_household = true` items only.** This applies to every section without exception: income, expenses, debts, savings, charts, and projections. Personal (sole) items must never appear on this page.

- The `/api/household/summary` endpoint uses `sharedExpensesPence` for `total_expenses_pence`, disposable income, and category breakdown — never `totalExpensesPence` (which includes sole expenses).
- The `DebtBalanceChart` on the Household page must always pass `householdOnly={true}`, which appends `&household_only=true` to `/api/reports/debt-projection`.
- When adding new components or API calls to the Household tab, always apply the `is_household = true` filter at the server level. Never display sole/personal data on this page.

### Semantic Versioning

Follow [Semantic Versioning 2.0.0](https://semver.org/) strictly:

- **MAJOR** (v1.0.0 → v2.0.0): incompatible API changes, breaking changes to data format, or major architectural shifts
- **MINOR** (v2.0.0 → v2.1.0): backward-compatible new features or non-breaking enhancements (e.g. new admin panel, new endpoints)
- **PATCH** (v2.1.0 → v2.1.1): backward-compatible bug fixes, security patches, or documentation updates

Examples:
- `v2.0.0`: Multi-user auth, TOTP 2FA, OIDC SSO — major new features (breaking change from v1.x single-user)
- `v2.1.0`: Admin panel, user management, runtime SMTP/OIDC config — new features, backward-compatible
- `v2.1.1`: Fix SMTP test email failure — bug fix

### CI / Docker

- GitHub Actions workflow: `.github/workflows/docker-publish.yml` — triggers on `master` push and `v*` tags.
- `latest` Docker tag is published only on `master` pushes (`enable={{is_default_branch}}`). Tag pushes get a versioned tag only.
- The GitHub Release must be separately edited from Draft → Published + Latest (`gh release edit vX.Y.Z --draft=false --latest`).
- Schema migrations for existing databases are applied inline in `server/db.ts` with bare `try { ALTER TABLE … } catch {}` blocks. New tables (e.g. `system_settings`) are added via `schema.sql` using `CREATE TABLE IF NOT EXISTS`.

---

## Coding Guidelines

These guidelines ensure consistent, efficient, and minimal changes to the codebase.

### Global Instructions

- **Analyse codebase first**: Before making changes, explore the existing code to understand patterns, conventions, and architecture.
- **Maintain design system consistency**: All UI changes must follow existing design patterns and component styles.
- **No unsolicited style changes**: Do not modify CSS, formatting, or styling unless explicitly requested.
- **Prefer layout over style**: When possible, adjust component layout or structure rather than introducing new styles.
- **Minimum necessary changes**: Only modify what is directly needed to accomplish the stated task. Do not refactor, restructure, or improve surrounding code unless explicitly asked.

### Guard Clauses

- **No unrelated functionality changes**: Do not add, modify, or remove features outside the stated scope of the task.
- **No unnecessary refactoring**: Do not refactor code, rename variables, reorganise functions, or restructure logic unless explicitly requested.
- **No new UI styles outside design system**: Do not introduce new CSS classes, colour schemes, fonts, or styling patterns. Reuse existing design system components.
- **Preserve component patterns**: Maintain existing naming conventions, component structure, prop patterns, and hooks usage.

### Codebase Integrity

- **Use only what exists**: Only use existing files, components, hooks, utilities, and libraries. Do not create new ones unless the task explicitly requires it and no existing alternative exists.
- **Communicate gaps**: If something the task requires does not exist, explicitly state what is missing rather than creating it without asking.
- **Follow project structure**: Respect the existing folder structure, naming conventions, and architectural patterns. Do not reorganise files or create new directories without explicit approval.

### Token & Scope Efficiency

- **Output minimal code**: Show only the modified files or the smallest possible code blocks needed to implement the change.
- **Avoid repeating unchanged code**: Do not show full files or large unchanged sections. Use targeted edits and diffs.
- **Do not exceed scope**: Modify only files mentioned in or directly required by the task. Do not touch unrelated files.
- **Reuse existing utilities**: Always prefer existing components, hooks, utilities, and stylesheets over creating new ones.

---

## Critical Rules (non-negotiable)

### 1. Language
**Use UK English exclusively** in all contexts — no exceptions:
- Spelling: colour, centre, organisation, realise, analyse, favour, honour, etc.
- Terminology: British English conventions throughout
- All replies, documentation, comments, and commit messages must use UK English

### 2. Git Workflow — Named Branches Only
**All work MUST be on named branches — NEVER commit directly to master:**
- Every change (feature, fix, docs, anything) goes to a descriptive named branch
- Push the branch to origin
- Create a PR immediately after pushing
- Merge via PR only (never direct push to master)
- This is non-negotiable and applies without exception

### 3. PR Merge Authorisation — WAIT FOR USER APPROVAL
**🚫 ABSOLUTE RULE: NEVER MERGE A PR WITHOUT EXPLICIT USER AUTHORISATION 🚫**

This is **non-negotiable and applies without exception** — no conditions, no shortcuts, no assumptions.

**Required workflow:**
1. Create the PR and share the link
2. **STOP.** Wait for explicit user approval before proceeding
3. Do NOT automatically run `gh pr merge` — do not merge, tag, or release until user explicitly authorises it
4. Only merge when user clearly states "merge it", "go ahead", "release this", or similar explicit approval
5. Do not assume approval from previous tasks or conversations

**Why this is critical:**
- Merging without approval bypasses your review and control
- Automated merges can introduce unintended changes to production
- User authorisation is the gatekeeper — respect it absolutely

**Violation of this rule:** Merging without explicit user authorisation is a critical breach of control and trust and must never occur.

---

## Workflow Rules (mandatory — no exceptions)

### ⚠️ CRITICAL: All work MUST be on a named branch — ALWAYS

**NO DIRECT COMMITS TO MASTER. EVER.**

Every single change — no matter how small (typo fix, one-liner, docs) — must be developed on a descriptive named branch, pushed to origin, and merged via PR. This is non-negotiable and applies without exception.

### 1. README must be reviewed before every commit

Before creating any commit, review `README.md` and determine whether the change affects:
- Features, pages, or user-facing behaviour
- API routes or data models
- Configuration, environment variables, or infrastructure
- Architecture, folder structure, or tech stack
- Scripts, commands, or Docker behaviour

If any of the above are affected, update `README.md` first. Only proceed with the commit after the README is up to date or explicitly confirmed as not requiring changes.

**A commit must never be created or pushed if README.md requires an update but has not been updated.**

### 2. All work must be on a named branch (NO EXCEPTIONS)

Direct commits to `master` (or any other protected branch) are strictly prohibited without exception.

Every change — feature, fix, refactor, docs update, configuration change, typo fix — must be developed on a new branch. Branch names must clearly describe the purpose:

| Type | Pattern | Example |
|---|---|---|
| Feature | `feature/<short-description>` | `feature/totp-setup-flow` |
| Bug fix | `fix/<short-description>` | `fix/login-session-timeout` |
| Docs | `docs/<short-description>` | `docs/readme-auth-section` |
| Chore / config | `chore/<short-description>` | `chore/update-dependencies` |
| Refactor | `refactor/<short-description>` | `refactor/auth-middleware` |

### 3. A PR must be created for every branch

Every branch pushed to origin must have a corresponding Pull Request opened immediately after the push. The PR body **must use and fully complete the repository's PR template** (`.github/PULL_REQUEST_TEMPLATE.md`) — fill in every section; do not leave placeholder text or skip sections. The PR must include:
- A clear title describing the purpose of the change
- A summary of what changed and why
- A note on README.md: either what was updated, or an explicit statement that no README update was required and why

### 4. Pre-push checklist

**STOP: Before running `git push`, confirm ALL of the following. Do not push if any item fails.**

- [ ] **YOU ARE NOT ON `master`** — verify `git branch` shows a named branch, NOT `* master`
- [ ] `README.md` is up to date (or explicitly confirmed as unchanged)
- [ ] The current branch has a descriptive name following the naming convention above
- [ ] A PR will be created immediately after pushing
- [ ] TypeScript checks pass: `tsc -b --noEmit` and `tsc --project tsconfig.server.json --noEmit`
- [ ] `package.json` version is bumped to the correct semver for this change (PATCH/MINOR/MAJOR)
- [ ] Tests pass: `npm test`

**If ANY item is not met, do not push. Fix the issue first.**

**ESPECIALLY: If you are on master, STOP. Create a new branch immediately. Do not push to master.**

### 5. Releasing a new version — mandatory steps (in order)

Every release **must** include updating `package.json` to the new version number **before** tagging. The sidebar reads the version directly from `package.json` at runtime — if it is not updated, the wrong version will be displayed.

**Release checklist (run in order, no skipping):**

1. **Bump `package.json`** — update `"version"` to the new semver (e.g. `"2.12.0"`) on the feature/fix branch, as part of the same PR
2. **Merge PR to master**
3. **Pull master** — `git checkout master && git pull`
4. **Tag** — `git tag vX.Y.Z && git push origin vX.Y.Z`
5. **Create & publish release** — `gh release create vX.Y.Z --title "vX.Y.Z" --notes "..."` then `gh release edit vX.Y.Z --draft=false --latest`

**`package.json` version must always match the git tag.** Never tag without bumping `package.json` first.

### 6. Release notes — breaking changes

If a release contains any breaking changes, they **must** appear at the very top of the release notes, before any other content, in this format:

```
## ⚠️ Breaking Changes

### <Short title of the breaking change>
**What changed:** <What is different from the previous version>
**Why:** <The reason the breaking change was necessary>
**Action required:** <Exactly what the user must do before or after updating — e.g. run a migration, update config, wipe a volume. If no action is needed, state "None — the migration runs automatically on first startup.">

---
```

If there are no breaking changes, omit this section entirely — do not include it with "None" or similar.
