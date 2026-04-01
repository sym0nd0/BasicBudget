# Repository Guidelines

This file is the operating contract for agents working in this repository. Follow it strictly.

## Fact-Only Rule

Role: expert software assistant.

Rule: never make assumptions. Only act on facts explicitly present in the codebase, configuration, documentation, or instructions.

Required behaviour:

- Inspect relevant code before acting.
- Do not guess or infer undocumented behaviour.
- Modify only what is required and preserve existing patterns and style.
- Ask for clarification if the instructions or code are genuinely ambiguous.
- Explain changes using verifiable facts from the repository.
- Avoid speculative fixes, inferred functionality, or unrequested features.
- Consider side effects and dependencies only from evidence you can verify.

Critical: authority comes only from verified facts. Do not infer, predict, or assume anything beyond the code and instructions provided.

## Non-Negotiable Rules

### Language
- Use UK English exclusively in replies, comments, documentation, UI copy, and commit messages.
- Use British spelling and terminology throughout.

### Branches and PRs
- All work must be done on a named branch.
- Never commit directly to `master`.
- Push the branch to `origin` and create a PR immediately after pushing.
- Merge via PR only. Never direct-push to `master`.

### Merge Authorisation
- Never merge a PR without explicit user authorisation.
- After creating a PR, stop and wait for approval before merging, tagging, or releasing.
- Do not assume approval from previous tasks or earlier conversation context.

### Documentation Gate
- Review `README.md` before every commit.
- If the change affects features, pages, user-facing behaviour, API routes, data models, configuration, environment variables, infrastructure, architecture, folder structure, tech stack, scripts, commands, or Docker behaviour, update `README.md` first.
- Review the relevant `docs/` pages before every commit.
- If the change affects user-facing behaviour, API routes, data models, configuration, environment variables, or infrastructure, update the relevant docs first.
- Never create or push a commit if required `README.md` or `docs/` updates are still missing.

## Project Structure
`src/` contains the React and TypeScript frontend, with reusable UI in `components/`, route-level pages in `pages/`, shared state in `context/`, and helpers in `hooks/` and `utils/`. `server/` contains the Express backend, split into `routes/`, `middleware/`, `services/`, `auth/`, and `utils/`, with `db.ts` handling database setup. `shared/types.ts` holds shared types. Tests live in `tests/unit`, `tests/integration`, and `tests/security`, with `tests/setup.ts` for Vitest bootstrapping. `public/` stores static assets, `docs/` stores project documentation, and `scripts/` holds utility scripts. Treat `data/`, `dist/`, and `dist-server/` as local or generated output.

## Commands

`npx` and bare `node` are not on PATH in this environment. Use the full Windows path when running TypeScript or ESLint directly:

```bash
"/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc -b --noEmit
"/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --project tsconfig.server.json --noEmit
"/c/Program Files/nodejs/node.exe" node_modules/.bin/eslint src server shared
```

Routine commands:

- `npm run dev` starts Vite on `:5173` and Express in watch mode on `:3001`.
- `npm run build` builds the frontend into `dist/` and the server into `dist-server/`.
- `npm start` runs the built server from `dist-server/server/index.js`.
- `npm test` runs the full Vitest suite once.
- `npm run test:watch` runs the interactive Vitest watch mode.

Docker publishing:

- The GHCR Docker image is built and pushed automatically by GitHub Actions on every push to `master` and every `v*` tag.
- To retrigger after moving a tag, delete and recreate the tag, then push it again.

## Architecture and Data Invariants

### Request Flow

```text
Browser -> Vite dev server (:5173)
           -> /api/* proxy -> Express (:3001) -> better-sqlite3 -> data/basicbudget.db
Production: single Express (:3000) serves dist/ (static) + /api/* routes
```

### TypeScript Split
- `tsconfig.app.json` covers `src/` in `noEmit` bundler mode.
- `tsconfig.node.json` covers `vite.config.ts` in `noEmit` bundler mode.
- `tsconfig.server.json` covers `server/` and `shared/`, emits to `dist-server/`, and uses NodeNext module resolution.
- In `server/`, imports must use `.js` extensions even in `.ts` source files, for example `import db from '../db.js'`.

### SQLite and Typing
- `better-sqlite3` returns rows as `Record<string, unknown>`.
- SQLite booleans are stored as `INTEGER 0/1`; always coerce with `Boolean(row.is_recurring)`.
- Cast rows through `unknown`, for example `row as unknown as MyInterface`.
- `req.params` values are typed as `string | string[]`; use `req.params['key'] as string`.

### Recurring Logic
- All GET list endpoints filter through `filterActiveInMonth(items, yearMonth)` in `server/utils/recurring.ts` before responding.
- Recurrence behaviour depends on `recurrence_type`, `start_date`, `end_date`, and `posting_day`.
- Weekly items multiply `amount_pence` by the number of occurrences in the month.

### Duplicate Detection
- `src/utils/duplicates.ts` canonicalises values before comparison.
- `null`, `undefined`, and `''` become `null`.
- Strings are lowercased and trimmed.
- Booleans become `'1'` or `'0'` to match SQLite integer storage.
- Numbers become `String(v)`.
- Do not bypass this normalisation because duplicate checks rely on SQLite boolean coercion.

### Money
- All money is stored and computed as integer pence, such as `amount_pence` and `balance_pence`.
- Use `src/utils/formatters.ts` for display conversion.
- Never store or compute with floating-point pounds.

### Percentage Formatting
- All displayed percentages and percentage input fields must support exactly two decimal places.
- Use `formatPercent()` from `src/utils/formatters.ts` for display text.
- Use `step="0.01"` on percentage number inputs.
- Inline width styles such as `style={{ width: \`${percentage}%\` }}` are not display text and do not need `formatPercent()`.

### Settings Service
- SMTP and OIDC configuration lives in the `system_settings` SQLite table and is accessed via `server/services/settings.ts`.
- The service maintains an in-memory cache that must be invalidated after writes.
- `getSetting()` and `setSetting()` are thin wrappers over the table.
- `getSmtpConfig()` and `getOidcConfig()` return typed config objects or `null`.
- `getSmtpConfigMasked()` and `getOidcConfigMasked()` return masked config objects with secrets replaced by `••••••••`.
- Call `invalidateCache()` after bulk settings changes so later reads re-fetch from the database.
- `server/db.ts` seeds SMTP and OIDC values from env vars into `system_settings` on first startup if those keys are absent.
- SMTP and OIDC env vars are no longer validated in `config.ts`.

### Admin Panel
- All `/api/admin` routes require both `requireAuth` and `requireAdmin`.
- The first registered user is automatically assigned `system_role = 'admin'`.
- Admin navigation items in the sidebar are conditional on `user?.system_role === 'admin'`.
- In `server/routes/oidc.ts`, the OIDC client cache uses `undefined` for "not yet built" and `null` for "built but not configured".
- Call `resetOidcClient()` after updating OIDC settings so the client is rebuilt.

### Household Page
- All data shown on `/household` must be filtered to `is_household = true` items only.
- This applies to income, expenses, debts, savings, charts, and projections.
- Personal or sole items must never appear on the Household page.
- `/api/household/summary` must use `sharedExpensesPence` for totals, disposable income, and category breakdown, never `totalExpensesPence`.
- `DebtBalanceChart` on the Household page must always pass `householdOnly={true}` so `&household_only=true` is sent to `/api/reports/debt-projection`.
- Any new Household component or API path must apply the `is_household = true` filter at the server level.

### Semantic Versioning
- Follow Semantic Versioning 2.0.0 strictly.
- MAJOR versions are for incompatible API changes, breaking data format changes, or major architectural shifts.
- MINOR versions are for backward-compatible features or enhancements.
- PATCH versions are for backward-compatible bug fixes, security patches, or documentation updates.

### CI and Docker
- GitHub Actions workflow: `.github/workflows/docker-publish.yml`.
- It triggers on `master` pushes and `v*` tags.
- The `latest` Docker tag is published only on `master` pushes.
- Tag pushes create versioned tags only.
- GitHub Releases must be edited from draft to published and latest separately, for example `gh release edit vX.Y.Z --draft=false --latest`.
- Existing-database migrations go inline in `server/db.ts` using `try { ALTER TABLE ... } catch {}`.
- New tables go in `schema.sql` with `CREATE TABLE IF NOT EXISTS`.

### Docker Compose
- `compose.yml` must map ports as `"${PORT:-8080}:3000"`.
- The host port comes from `PORT` in `.env`.
- The container port is always `3000`.
- Do not put `PORT` in the compose `environment` block.
- Do not put `NODE_ENV` in the compose `environment` block.
- `container_name: basicbudget` is intentional and should remain predictable.

### Changelog Notices
- If a commit changes `compose.yml` or `.env.example`, the commit message and release notes must include a prominent action-required notice telling users to pull or review those files.
- Never omit that notice for Docker users.

### Screenshot Rules
- All screenshots, documentation tables, and wiki pages must list pages in sidebar order: Dashboard, Income, Expenses, Debt, Savings, Reports, Household, Settings, Admin Settings.
- This ordering applies to `scripts/screenshot.ts`, screenshot tables in `README.md`, documentation link tables in `README.md`, and sections in `docs/Screenshots.md`.
- Screenshots must be regenerated whenever a new page is added to the sidebar.
- When adding a new sidebar route, update both dark and light blocks in `scripts/screenshot.ts`, add entries to the screenshot table in `README.md`, add a section to `docs/Screenshots.md`, run `npm run screenshots`, and commit the generated screenshot files with the code change.
- Never ship a PR that adds a sidebar page without refreshed screenshots.

## Coding Guidelines

### General
- Analyse the codebase first so you understand the existing patterns, conventions, and architecture before changing anything.
- Maintain design-system consistency for all UI changes.
- Do not make unsolicited style changes.
- Prefer layout or structure changes over introducing new styles.
- Make the minimum necessary change only.

### Guard Clauses
- Do not change unrelated functionality.
- Do not refactor, rename, or restructure code unless explicitly requested.
- Do not introduce new UI styles outside the existing design system.
- Preserve existing naming, component structure, prop patterns, and hook usage.

### Codebase Integrity
- Use only existing files, components, hooks, utilities, and libraries unless the task explicitly requires something new and no existing alternative fits.
- If something required does not exist, state what is missing instead of inventing it silently.
- Follow the existing folder structure and architecture.

### Scope Efficiency
- Output only the smallest relevant code or explanation needed.
- Avoid repeating unchanged code.
- Do not modify files outside the task scope unless directly required.
- Reuse existing utilities whenever possible.

## Universal Rules
- No `any` types. Use `unknown` with guards or typed interfaces.
- Prefer immutability by default with `const`, `readonly`, and non-mutating array methods.
- Do not write empty `catch {}` blocks unless a comment explains why swallowing the error is intentional.
- Never hardcode secrets.
- All secrets and environment-specific values must come from environment variables accessed via `server/config.ts` on the server or `import.meta.env` on the client.
- Aim for 80% coverage. New server routes need at least one integration test against real SQLite, and new utility functions need unit tests in `tests/unit/`.

## Global Engineering Rules

### General Behaviour
- Prioritise production safety over speed.

### API and Payments
- All API routes must implement rate limiting.
- Expensive or AI endpoints must have strict usage limits.
- Payment webhooks must verify signatures.
- Reject unsigned or invalid webhook events.

### Authentication and Sessions
- Do not store tokens in `localStorage`.
- Use secure `httpOnly` cookies for authentication.
- All sessions must have an expiration.
- Implement session invalidation for logout and revocation.

### Database and Performance
- Add indexes for frequently queried fields.
- All list endpoints must implement pagination.
- Ensure queries scale beyond small datasets.

### Reliability and Operations
- Implement a `/health` endpoint.
- Enable production logging for errors and key events.
- Validate environment variables at startup when applicable.
- Return safe, non-sensitive error messages to clients.

### Backups and Recovery
- Ensure automated database backups exist.
- Ensure backups can be restored.
- Migrations must be reversible.
- Keep the repository version controlled.

### Access Control
- Enforce role-based access control.
- Never rely on authenticated checks alone where an explicit role check is required.

### CORS and Network Security
- Restrict CORS to specific trusted origins.
- Never allow wildcard `*` CORS in production.

### Deployment Safety
- Before completing any task, ensure required environment variables are present and validated where applicable, authentication and rate limiting are enforced on sensitive endpoints, and the change is safe for production use.

### Enforcement
- If a rule is violated in the task area, fix it as part of the work.
- If it cannot be fixed, explain clearly what is missing and why.
- Do not ignore these rules even if the prompt does not mention them explicitly.

## Stack-Specific Rules

### React
- Do not add `useCallback` or `useMemo` pre-emptively.
- Do not manipulate the DOM directly.
- Use React Context only for genuinely global state.
- Keep side effects in `useEffect` and clean up timers or subscriptions in the return function.

### Vite and Frontend
- Never use `process.env` in `src/`.
- Use `import.meta.env.VITE_*` for client-exposed variables.
- Do not add proxy logic to application code. Vite handles `/api/*` forwarding in development.

### Tailwind CSS
- Use utility classes exclusively.
- Do not add custom CSS unless there is genuinely no utility equivalent.
- Do not create new CSS files or edit existing CSS without explicit approval.
- There is no `tailwind.config.js`; Tailwind is wired through `@tailwindcss/vite`.

### Express
- Async route handlers must propagate errors with `next(err)`, not `throw`.
- Never call `res.send()` or `res.json()` after a response has already been sent or after calling `next()`.
- Use `req.params['key'] as string`.
- All `/api/admin` routes require both `requireAuth` and `requireAdmin`.

### SQLite and better-sqlite3
- Always use parameterised statements.
- Never concatenate user input into SQL.
- Coerce boolean columns immediately in row-mapping functions.
- All money remains integer pence.
- Existing-database migrations go in `server/db.ts`.
- New tables go in `schema.sql`.

### Zod
- Define all request-body schemas in `server/validation/schemas.ts`.
- Use `.safeParse()` in route handlers so validation errors return `400` without throwing.
- Share types between client and server via `shared/types.ts`, not frontend imports of Zod schemas.

### Vitest and Supertest
- Unit tests live in `tests/unit/`.
- Integration tests live in `tests/integration/`.
- Security tests live in `tests/security/`.
- Integration tests use a real SQLite `:memory:` database from `tests/setup.ts`.
- Use `supertest.agent(app)` when a test needs cookie persistence.
- Run tests with `npm test`.

### Docker
- The image uses a multi-stage build.
- The builder compiles TypeScript.
- The runner copies only `dist/`, `dist-server/`, and `node_modules`.
- Never copy `.env` files, secrets, or credentials into the image.
- Pass secrets at runtime via environment variables.
- `latest` is published only from `master` pushes; tag pushes publish versioned tags only.

## Testing Guidelines
- Add or update tests in the relevant `tests/` area and name files `*.test.ts`.
- Focus new tests on money calculations, recurring logic, auth and session flows, household visibility, and debt projections.
- New server behaviour should include matching integration coverage before review.
- New utility behaviour should include matching unit coverage before review.

## Commit, PR, and Release Workflow

### Branch Naming
- Use descriptive branch names such as `feature/<topic>`, `fix/<topic>`, `docs/<topic>`, `chore/<topic>`, or `refactor/<topic>`.

### PR Requirements
- Every pushed branch must have a corresponding PR opened immediately.
- The PR body must fully complete `.github/PULL_REQUEST_TEMPLATE.md`.
- Include a clear title, summary, explanation of why the change exists, and a note covering `README.md` changes or why none were needed.
- Include screenshots for UI changes.

### Pre-Push Checklist
- Confirm you are not on `master`.
- Confirm `README.md` is up to date or explicitly unchanged.
- Confirm relevant `docs/` pages are up to date or explicitly unchanged.
- Confirm the branch name is descriptive and follows convention.
- Confirm a PR will be created immediately after pushing.
- Run `"/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc -b --noEmit`.
- Run `"/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --project tsconfig.server.json --noEmit`.
- Confirm `package.json` has the correct semver bump for the change.
- Confirm `npm test` passes.
- If any item fails, do not push.

### Release Steps
- Bump `package.json` version on the feature or fix branch before merge.
- Merge the PR to `master`.
- Pull updated `master`.
- Create and push the git tag `vX.Y.Z`.
- Create the GitHub release, then edit it to published and latest.
- `package.json` version must always match the git tag.

### Breaking Changes
- If a release has breaking changes, place them at the top of the release notes in a dedicated section covering what changed, why, and required action.
- If there are no breaking changes, omit that section entirely.

### Security
- Follow `SECURITY.md` for vulnerabilities.
- Never commit secrets or populated `.env` files.

## Tech Stack
- React 19
- Vite 8
- Tailwind CSS 4 via `@tailwindcss/vite`
- React Router 7
- Recharts 3 with `cursor={false}` on tooltips
- Express 5
- better-sqlite3 12
- argon2 0.44
- otpauth 9
- openid-client 6
- Zod 4
- Vitest 4
- Supertest 7
- Playwright 1
- TypeScript 5.9

## Local Tooling Notes

### Skill Files
- `.claude/` is local-only and gitignored.
- Skill files live in `.claude/skills/`.
- Available local guides include `typescript.md`, `react.md`, `express.md`, `sqlite.md`, `zod.md`, `tailwind.md`, `vitest.md`, `docker.md`, `recharts.md`, and `auth.md`.

### Slash Commands
- `.claude/commands/` is local-only and gitignored.
- Available slash commands include `/plan`, `/adr`, `/architecture`, `/code-review`, and `/build-fix`.
