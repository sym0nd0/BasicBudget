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

### CI / Docker

- GitHub Actions workflow: `.github/workflows/docker-publish.yml` — triggers on `master` push and `v*` tags.
- `latest` Docker tag is published only on `master` pushes (`enable={{is_default_branch}}`). Tag pushes get a versioned tag only.
- The GitHub Release must be separately edited from Draft → Published + Latest (`gh release edit vX.Y.Z --draft=false --latest`).
- Schema migrations for existing databases are applied inline in `server/db.ts` with bare `try { ALTER TABLE … } catch {}` blocks.

---

## Workflow Rules (mandatory — no exceptions)

### 1. README must be reviewed before every commit

Before creating any commit, review `README.md` and determine whether the change affects:
- Features, pages, or user-facing behaviour
- API routes or data models
- Configuration, environment variables, or infrastructure
- Architecture, folder structure, or tech stack
- Scripts, commands, or Docker behaviour

If any of the above are affected, update `README.md` first. Only proceed with the commit after the README is up to date or explicitly confirmed as not requiring changes.

**A commit must never be created or pushed if README.md requires an update but has not been updated.**

### 2. All work must be on a named branch

Direct commits to `master` (or any other protected branch) are prohibited.

Every change — feature, fix, refactor, docs update, configuration change — must be developed on a new branch. Branch names must clearly describe the purpose:

| Type | Pattern | Example |
|---|---|---|
| Feature | `feature/<short-description>` | `feature/totp-setup-flow` |
| Bug fix | `fix/<short-description>` | `fix/login-session-timeout` |
| Docs | `docs/<short-description>` | `docs/readme-auth-section` |
| Chore / config | `chore/<short-description>` | `chore/update-dependencies` |
| Refactor | `refactor/<short-description>` | `refactor/auth-middleware` |

### 3. A PR must be created for every branch

Every branch pushed to origin must have a corresponding Pull Request opened immediately after the push. The PR must include:
- A clear title describing the purpose of the change
- A summary of what changed and why
- A note on README.md: either what was updated, or an explicit statement that no README update was required and why

### 4. Pre-push checklist

Before running `git push`, confirm all of the following:

- [ ] `README.md` is up to date (or explicitly confirmed as unchanged)
- [ ] The current branch has a descriptive name following the naming convention above
- [ ] A PR will be created immediately after pushing
- [ ] TypeScript checks pass: `tsc -b --noEmit` and `tsc --project tsconfig.server.json --noEmit`
- [ ] Tests pass: `npm test`

If any item is not met, do not push. Fix the issue first.
