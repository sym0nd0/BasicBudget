<p align="center">
  <a href="https://github.com/sym0nd0/BasicBudget">
  <img width="350" alt="basicbudget_logo" src="/public/basicbudget_logo.png">
  </a>
</p>

# BasicBudget

A multi-user personal budgeting and debt management application built with React 19, TypeScript, and a Node.js/SQLite backend. BasicBudget helps households track monthly income and expenses, manage debts with full amortisation schedules, track savings goals, and visualise their financial picture through interactive charts — with per-household data isolation, optional TOTP 2FA, and OIDC single sign-on.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Getting Started](#getting-started)
4. [Environment Variables](#environment-variables)
5. [Docker Deployment](#docker-deployment)
6. [Available Scripts](#available-scripts)
7. [Architecture](#architecture)
8. [Data Models](#data-models)
9. [API Routes](#api-routes)
10. [Folder Structure](#folder-structure)
11. [License](#license)

---

## Features

### Authentication & Security
- Email + password registration and login (Argon2id, 64 MB memory cost)
- Email verification flow on registration
- Account lockout after 5 failed login attempts (30-minute lock)
- TOTP 2FA via authenticator app (QR code setup, 10 single-use recovery codes); status badge in settings; reset 2FA with password + OTP/recovery code; "lost access" delayed-reset flow via email
- Generic OpenID Connect (OIDC) single sign-on — any OIDC-compatible provider
- Session management with device fingerprinting and new-device email alerts
- Active session list with per-session revocation; sessions display parsed browser and OS instead of raw user-agent string
- Password reset and email change flows via time-limited tokens
- CSRF protection (double-submit cookie), Helmet security headers, rate limiting

### Households & RBAC
- Every user belongs to a household (created automatically on registration)
- **Owner** role: read and write all household entries
- **Member** role: read all entries, write only own entries
- Invite members by email (7-day expiring token); invitees can register and join even if they don't have an account yet; role management by owner
- All financial data is isolated per household

### Admin Panel
- The **first registered user** is automatically promoted to system admin
- Admin-only panel accessible from the sidebar under the "Admin" section
- **User management**: list all users, promote/demote roles, lock/unlock accounts, delete users
- **System settings**: configure SMTP (email) and OIDC (SSO) at runtime via the UI — no restart required
- **Audit log**: paginated, filterable log of all authentication and admin actions
- All admin actions are written to the audit log

### Dashboard
- At-a-glance budget summary showing total income, total expenses, total debt payments, and disposable income
- Expense donut chart broken down by category
- Income vs Expenses bar chart
- Debt payoff timeline showing cumulative balance across all debts month by month

### Income Management
- Add, edit, and delete income sources with contributor names
- Record the day of month income is received; track as gross or net
- Set recurrence type: monthly, weekly, or yearly
- Optional start and end dates for time-bounded income entries

### Expense Management
- Add, edit, and delete monthly expenses
- 11 expense categories; fixed or variable tag
- Assign expenses to a named payment account
- Mark expenses as household expenses with a configurable split ratio so only your share counts in budget summaries
- Set recurrence type and optional start/end dates

### Debt Management
- Add, edit, and delete debts
- Record balance, APR, minimum payment, and overpayment amount
- Full per-debt amortisation table: month-by-month opening balance, interest charge, principal paid, and closing balance
- Payoff summary: months remaining, total interest paid, projected payoff date
- Debt payoff chart plotting all balances on a shared monthly timeline

### Savings Goals
- Create and track savings goals with target amounts and monthly contributions
- Optional target dates; progress bars

### Settings & Accounts
- Manage named payment accounts; month locking to prevent edits on closed months
- Change password, change email, 2FA setup/disable
- CSV import and export for bulk data management

### Additional
- **Duplicate detection** — warns before saving an entry identical to an existing one
- **Theme toggle** — light, dark, and system-preference modes
- **Filter bar** — filter entries by contributor, account, category, or recurrence type

---

## Tech Stack

| Layer | Library / Tool | Version |
|---|---|---|
| UI Framework | React | 19.x |
| Language | TypeScript | 5.9 |
| Build Tool | Vite | 7.x |
| Styling | Tailwind CSS | v4 |
| Charts | Recharts | 3.x |
| Routing | React Router | 7.x |
| Backend | Express | 5.x |
| Database | SQLite (better-sqlite3) | — |
| Auth | Argon2id, express-session | — |
| 2FA | otpauth (TOTP), AES-256-GCM | — |
| OIDC | openid-client v6 (PKCE) | — |
| Email | Nodemailer | — |
| Validation | Zod | — |
| Security | Helmet, cors, csrf-csrf, express-rate-limit | — |
| Tests | Vitest + Supertest | — |
| Container | Docker (multi-stage) | — |

---

## Getting Started

### Prerequisites

- Node.js 20 or later
- npm 10 or later

### Install dependencies

```bash
npm install
```

### Configure environment

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

Minimum required for local development:

```env
SESSION_SECRET=change_me_at_least_32_characters_long
TOTP_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
APP_URL=http://localhost:5173
```

See [Environment Variables](#environment-variables) for the full reference.

### Run in development mode

```bash
npm run dev
```

This starts two processes concurrently:
- **Vite** dev server at `http://localhost:5173` (React frontend with HMR)
- **Express** API server at `http://localhost:3001` (watched by `tsx`)

The Vite config proxies all `/api/*` requests to the Express server automatically. The SQLite database is created automatically at `data/basicbudget.db` on first run.

### Run tests

```bash
npm test
```

Uses an in-memory SQLite database. No `.env` required.

### Build for production

```bash
npm run build
```

Compiles the frontend to `dist/` and the server to `dist-server/`. Run with `npm start`.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SESSION_SECRET` | Yes | Min 32-char random string for session signing |
| `TOTP_ENCRYPTION_KEY` | Yes | 64 hex chars (32 bytes) for AES-256-GCM TOTP secret encryption |
| `APP_URL` | Yes | Public URL of the app, e.g. `https://budget.example.com` |
| `CORS_ORIGIN` | No | Allowed CORS origin (defaults to `APP_URL`) |
| `DB_PATH` | No | Path to SQLite file (default `data/basicbudget.db`) |
| `PORT` | No | Server port (default `3001`; Docker exposes `8080`) |

> **SMTP and OIDC** are configured through the **Admin Panel** (`/admin/settings`) at runtime — no environment variables or restarts needed. If `SMTP_HOST` / `OIDC_ISSUER_URL` are present in the environment on first startup, they are automatically migrated into the database for backwards compatibility with existing deployments.

---

## Docker Deployment

The app is published as a pre-built image to GitHub Container Registry (GHCR) on every push to `master`. The multi-stage Dockerfile produces a minimal Node.js Alpine image; Express serves everything. A non-root user (`appuser`) is used inside the container.

### Pull and run with Docker Compose

```bash
docker compose pull
docker compose up -d
```

The app is served on **http://localhost:8080**.

All secrets are passed via environment variables. Create a `.env` file alongside `docker-compose.yml` (Docker Compose picks it up automatically):

```env
SESSION_SECRET=<random 32+ char string>
TOTP_ENCRYPTION_KEY=<64 hex chars>
APP_URL=https://budget.example.com
```

SMTP and OIDC are configured through the Admin Panel after first login.

Data is persisted in a named Docker volume (`bb-data`) mounted at `/app/data`.

### Update to the latest image

```bash
docker compose pull && docker compose up -d
```

### Stop

```bash
docker compose down
```

---

## Available Scripts

| Script | Command | Description |
|---|---|---|
| Dev server | `npm run dev` | Start Vite + Express concurrently with hot reload |
| Build (all) | `npm run build` | Type-check and bundle frontend + compile server |
| Start | `npm start` | Run the compiled production server |
| Test | `npm test` | Run all tests (Vitest + Supertest, in-memory DB) |
| Test watch | `npm run test:watch` | Run tests in watch mode |
| Lint | `npm run lint` | Run ESLint across src/, server/, shared/ |

---

## Architecture

### Request flow

```
Browser (React SPA)
      │  HTTP / JSON
      ▼
Express API Server  (port 3001 dev / 3000 prod)
      │
      ▼
SQLite Database  (data/basicbudget.db)
```

In development, Vite serves the frontend on port 5173 and proxies `/api/*` to Express on port 3001. In production, Express serves the pre-built static bundle and handles all API requests from the same origin.

### TypeScript split

Three separate compilation units share `shared/types.ts`:

| Config | Scope |
|---|---|
| `tsconfig.app.json` | `src/` — bundler mode (Vite owns emit) |
| `tsconfig.node.json` | `vite.config.ts` |
| `tsconfig.server.json` | `server/`, `shared/` — emits to `dist-server/`, NodeNext |

Server imports use `.js` extensions on `.ts` source files (NodeNext requirement).

### Session & CSRF

Sessions are stored in SQLite via a custom `SqliteSessionStore`. Cookies: `bb.sid` (session), `bb.csrf` (CSRF double-submit). CSRF tokens are fetched from `GET /api/auth/csrf-token` and sent as the `X-CSRF-Token` header on all mutating requests.

### TOTP encryption

TOTP secrets are encrypted with AES-256-GCM before being stored in the database. The encryption key is `TOTP_ENCRYPTION_KEY` (32 bytes, hex-encoded). Each secret gets a unique IV and auth tag stored alongside it.

### Money

All monetary values are stored and passed as **integer pence** (e.g. £3,000.89 → `300089`) to avoid floating-point precision issues. `src/utils/formatters.ts` handles conversion to display format.

### Recurring engine

`filterActiveInMonth(items, yearMonth)` determines whether each income/expense is active in a given month based on `recurrence_type`, `start_date`, `end_date`, and `posting_day`. Weekly items have their `amount_pence` multiplied by the number of occurrences in the month.

### Data isolation

Every data table has a `household_id` foreign key. All queries are scoped to `req.householdId`, set by the `requireAuth` middleware. Cross-household access is structurally impossible at the query level.

---

## Data Models

All types are defined in `shared/types.ts` and re-exported from `src/types/index.ts`.

### Income

```typescript
interface Income {
  id: string;
  name: string;
  amount_pence: number;
  posting_day: number;
  contributor_name?: string | null;
  gross_or_net: 'gross' | 'net';
  is_recurring: boolean;
  recurrence_type: 'monthly' | 'weekly' | 'yearly';
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
}
```

### Expense

```typescript
interface Expense {
  id: string;
  name: string;
  amount_pence: number;
  posting_day: number;
  account_id?: string | null;
  type: 'fixed' | 'variable';
  category: ExpenseCategory;
  is_household: boolean;
  split_ratio: number;        // 0.5 for shared costs, 1.0 for sole costs
  is_recurring: boolean;
  recurrence_type: 'monthly' | 'weekly' | 'yearly';
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
}
```

### Debt

```typescript
interface Debt {
  id: string;
  name: string;
  balance_pence: number;
  interest_rate: number;
  minimum_payment_pence: number;
  overpayment_pence: number;
  compounding_frequency: string;
  is_recurring: boolean;
  recurrence_type: string;
  posting_day: number;
  start_date?: string | null;
  end_date?: string | null;
  is_household: boolean;
  split_ratio: number;
  notes?: string | null;
}
```

### SavingsGoal

```typescript
interface SavingsGoal {
  id: string;
  name: string;
  target_amount_pence: number;
  current_amount_pence: number;
  monthly_contribution_pence: number;
  target_date?: string | null;
  notes?: string | null;
}
```

---

## API Routes

All routes are prefixed with `/api`. All data routes require a valid session (`requireAuth`).

### Auth

| Method | Path | Description |
|---|---|---|
| GET | `/api/auth/csrf-token` | Get CSRF token (public) |
| GET | `/api/auth/status` | Get current session / user info |
| POST | `/api/auth/register` | Create account + household |
| POST | `/api/auth/login` | Log in |
| POST | `/api/auth/logout` | Destroy session |
| POST | `/api/auth/forgot-password` | Request password reset email |
| POST | `/api/auth/reset-password` | Consume token, set new password |
| POST | `/api/auth/verify-email` | Consume email verification token |
| POST | `/api/auth/totp/setup` | Begin TOTP setup (returns QR) |
| POST | `/api/auth/totp/verify-setup` | Confirm TOTP setup, get recovery codes |
| POST | `/api/auth/totp/verify` | Submit OTP during login |
| POST | `/api/auth/totp/verify-recovery` | Submit recovery code during login |
| POST | `/api/auth/totp/disable` | Disable 2FA |
| GET | `/api/auth/sessions` | List active sessions |
| DELETE | `/api/auth/sessions/:sid` | Revoke a session |

### Invite (public)

| Method | Path | Description |
|---|---|---|
| GET | `/api/invite/info?token=X` | Peek at invite details (no auth required) |
| POST | `/api/household/accept-invite` | Accept invite and join household |

### Data

| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/incomes` | List / create income |
| GET/PUT/DELETE | `/api/incomes/:id` | Get / update / delete income |
| GET/POST | `/api/expenses` | List / create expense |
| GET/PUT/DELETE | `/api/expenses/:id` | Get / update / delete expense |
| GET/POST | `/api/debts` | List / create debt |
| GET/PUT/DELETE | `/api/debts/:id` | Get / update / delete debt |
| GET/POST | `/api/savings-goals` | List / create savings goal |
| GET/PUT/DELETE | `/api/savings-goals/:id` | Get / update / delete savings goal |
| GET/POST | `/api/accounts` | List / create account |
| GET/PUT/DELETE | `/api/accounts/:id` | Get / update / delete account |
| GET | `/api/summary` | Budget summary with category breakdown |
| GET | `/api/household` | Household details + members |
| GET/POST | `/api/months` | List locked months / lock a month |
| POST | `/api/import` | JSON bulk import |
| GET | `/api/export` | JSON export |

### Admin (requires `system_role = 'admin'`)

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/users` | List all users (paginated) |
| GET | `/api/admin/users/:id` | Get single user detail |
| PUT | `/api/admin/users/:id/role` | Change system role (`admin`/`user`) |
| PUT | `/api/admin/users/:id/lock` | Lock or unlock account |
| DELETE | `/api/admin/users/:id` | Delete user and all associated data |
| GET | `/api/admin/settings/smtp` | Get SMTP config (password masked) |
| PUT | `/api/admin/settings/smtp` | Update SMTP settings |
| POST | `/api/admin/settings/smtp/test` | Send test email to current admin |
| GET | `/api/admin/settings/oidc` | Get OIDC config (secret masked) |
| PUT | `/api/admin/settings/oidc` | Update OIDC settings |
| GET | `/api/admin/audit-log` | Paginated audit log with filters |

---

## Folder Structure

```
BasicBudget/
├── data/                              # SQLite database (gitignored)
│
├── server/                            # Express backend
│   ├── index.ts                       # App entry point, middleware chain
│   ├── db.ts                          # Database connection + schema init
│   ├── schema.sql                     # DDL — tables and indexes
│   ├── config.ts                      # Zod-validated env config
│   ├── auth/                          # Auth helpers
│   │   ├── device.ts                  # Device fingerprinting
│   │   ├── password.ts                # Argon2id hash/verify
│   │   ├── recovery-codes.ts          # Recovery code generate/hash
│   │   ├── session-store.ts           # SQLite session store
│   │   ├── session.ts                 # express-session config
│   │   ├── tokens.ts                  # Time-limited token create/consume
│   │   └── totp.ts                    # TOTP generate/encrypt/verify
│   ├── middleware/
│   │   ├── auth.ts                    # requireAuth / requireOwner / requireAdmin
│   │   ├── csrf.ts                    # csrf-csrf double-submit cookie
│   │   ├── rate-limit.ts              # 6 rate limiters
│   │   └── validate.ts                # Zod body validation middleware
│   ├── routes/
│   │   ├── admin.ts                   # Admin API (users, settings, audit log)
│   │   ├── auth.ts                    # Register, login, logout, password reset
│   │   ├── totp.ts                    # TOTP setup/verify/disable/reset
│   │   ├── oidc.ts                    # OIDC login/callback/link/unlink
│   │   ├── profile.ts                 # Profile management, change password/email
│   │   ├── sessions.ts                # List/revoke sessions
│   │   ├── accounts.ts
│   │   ├── debts.ts
│   │   ├── expenses.ts
│   │   ├── export.ts
│   │   ├── household.ts
│   │   ├── import.ts
│   │   ├── incomes.ts
│   │   ├── months.ts
│   │   ├── savings-goals.ts
│   │   └── summary.ts
│   ├── services/
│   │   ├── audit.ts                   # Audit log writer
│   │   ├── email.ts                   # SMTP transport + email templates
│   │   └── settings.ts                # DB-backed settings service (SMTP, OIDC)
│   └── utils/
│       ├── csv-parser.ts
│       └── recurring.ts               # filterActiveInMonth engine
│
├── shared/
│   └── types.ts                       # Shared TypeScript interfaces
│
├── src/                               # React frontend
│   ├── App.tsx                        # Root component, router + AuthProvider
│   ├── api/client.ts                  # Typed API client (CSRF, credentials)
│   ├── components/
│   │   ├── auth/ProtectedRoute.tsx    # Route guard (redirects to /login)
│   │   ├── charts/
│   │   ├── forms/
│   │   └── layout/
│   ├── context/
│   │   ├── AuthContext.tsx            # User/household/role state
│   │   ├── BudgetContext.tsx
│   │   ├── DebtContext.tsx
│   │   ├── FilterContext.tsx
│   │   ├── SavingsContext.tsx
│   │   └── ThemeContext.tsx
│   ├── hooks/useApi.ts
│   ├── pages/
│   │   ├── AdminAuditLogPage.tsx      # Admin: audit log viewer
│   │   ├── AdminSettingsPage.tsx      # Admin: SMTP + OIDC configuration
│   │   ├── AdminUsersPage.tsx         # Admin: user management
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   ├── TotpPage.tsx               # 2FA verification
│   │   ├── ForgotPasswordPage.tsx
│   │   ├── ResetPasswordPage.tsx
│   │   ├── VerifyEmailPage.tsx
│   │   ├── Dashboard.tsx
│   │   ├── DebtPage.tsx
│   │   ├── ExpensesPage.tsx
│   │   ├── HouseholdPage.tsx
│   │   ├── IncomePage.tsx
│   │   ├── SavingsPage.tsx
│   │   └── SettingsPage.tsx
│   ├── types/index.ts
│   └── utils/
│       ├── duplicates.ts
│       └── formatters.ts
│
├── tests/
│   ├── setup.ts
│   ├── helpers.ts
│   ├── unit/                          # password, totp, recovery-codes, tokens, middleware
│   ├── integration/                   # auth-flow, totp-flow, household, csrf
│   └── security/                      # injection, idor, rate-limit, session
│
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── vitest.config.ts
├── tsconfig.server.json
└── package.json
```

---

## License

This project is provided as-is for personal use. No licence is currently applied. If you fork or distribute this project, please add an appropriate open-source licence.

---

<p align="center">
  <a href="https://youtu.be/HefOvHZfkx8?si=w0sRMRmbz5tOna2O" target="_blank">
  <img width="200" alt="basic-thegoodplace" src="public/basic-thegoodplace.gif">
  </a>
</p>
