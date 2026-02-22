# BasicBudget

A personal budgeting and debt management application built with React 19, TypeScript, and a Node.js/SQLite backend. BasicBudget helps you track monthly income and expenses across multiple contributors, manage debts with full amortization schedules, track savings goals, and visualise your financial picture through interactive charts — all self-hosted and data-sovereign.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Data Models](#data-models)
5. [API Routes](#api-routes)
6. [Folder Structure](#folder-structure)
7. [Getting Started](#getting-started)
8. [Docker Deployment](#docker-deployment)
9. [Available Scripts](#available-scripts)
10. [License](#license)

---

## Features

### Dashboard
- At-a-glance budget summary showing total income, total expenses, total debt payments, and disposable income
- Expense donut chart broken down by category
- Income vs Expenses bar chart
- Debt payoff timeline showing cumulative balance across all debts month by month

### Income Management
- Add, edit, and delete income sources with contributor names (multi-person support)
- Record the day of month income is received
- Track income as gross or net
- Set recurrence type: monthly, weekly, or yearly
- Optional start and end dates for time-bounded income entries

### Expense Management
- Add, edit, and delete monthly expenses
- Categorise each expense: Housing, Transport, Food & Groceries, Utilities, Subscriptions, Personal, Health, Entertainment, Debt Payments, Savings, Other
- Tag expenses as `fixed` or `variable`
- Assign expenses to a named payment account
- Mark expenses as household expenses with a configurable split ratio so only your share counts in budget summaries
- Set recurrence type and optional start/end dates

### Debt Management
- Add, edit, and delete debts
- Record balance, interest rate, minimum payment, and overpayment amount
- Full per-debt amortization table: month-by-month opening balance, interest charge, principal paid, and closing balance
- Payoff summary per debt: months to payoff, total interest paid, total paid, projected payoff date
- Debt payoff chart plotting all balances over a shared monthly timeline
- Household splitting support on debt payments

### Savings Goals
- Create and track savings goals with target amounts and monthly contributions
- Optional target dates
- Progress tracking against current saved amount

### Household Overview
- Combined view of total household income and expenses
- Breakdown of shared vs sole expenses
- Debt-to-income ratio

### Settings & Accounts
- Manage named payment accounts
- Month locking — lock closed months to prevent accidental edits
- CSV import and export for bulk data management

### Additional Features
- **Duplicate detection** — warns before saving an entry identical to an existing one across all fields
- **Theme toggle** — light, dark, and system-preference modes
- **Filter bar** — filter entries by contributor, account, category, or recurrence type
- **Persistent storage** — all data lives in a local SQLite database; no cloud account required

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
| Backend | Express | 4.x |
| Database | SQLite (better-sqlite3) | 12.x |
| Runtime | Node.js | 20 |
| Container | Docker (multi-stage) | — |

---

## Architecture

BasicBudget is a full-stack application with a clear separation between frontend and backend:

```
Browser (React SPA)
      │  HTTP / JSON
      ▼
Express API Server  (port 3001 dev / 3000 prod)
      │
      ▼
SQLite Database  (data/basicbudget.db)
```

### Frontend

A React 19 SPA built with Vite. In development, Vite serves the frontend on port 5173 and proxies `/api/*` requests to the Express server on port 3001. In production, the Express server serves the pre-built static bundle and handles all API requests from the same origin.

State is managed with React's built-in `useReducer` + `useContext` pattern. API calls go through typed hooks in `src/hooks/useApi.ts`.

### Backend

An Express server written in TypeScript, transpiled with `tsx` in development and compiled to `dist-server/` for production. Routes are organized by resource under `server/routes/`. The database layer uses `better-sqlite3` for synchronous, zero-latency SQLite access.

The database file is stored at `data/basicbudget.db` by default, configurable via the `DB_PATH` environment variable. WAL journal mode and foreign key enforcement are enabled on startup.

---

## Data Models

All types are defined in `shared/types.ts` and re-exported from `src/types/index.ts`.

Monetary values are stored as **integer pence** throughout (e.g. £3,000.89 → `300089`) to avoid floating-point precision issues.

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

### AmortizationRow

```typescript
interface AmortizationRow {
  month: number;
  date: string;
  opening_balance_pence: number;
  interest_charge_pence: number;
  payment_pence: number;
  principal_paid_pence: number;
  closing_balance_pence: number;
}
```

---

## API Routes

All routes are prefixed with `/api`.

| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/incomes` | List all / create income |
| GET/PUT/DELETE | `/api/incomes/:id` | Get / update / delete income |
| GET/POST | `/api/expenses` | List all / create expense |
| GET/PUT/DELETE | `/api/expenses/:id` | Get / update / delete expense |
| GET/POST | `/api/debts` | List all / create debt |
| GET/PUT/DELETE | `/api/debts/:id` | Get / update / delete debt |
| GET/POST | `/api/savings-goals` | List all / create savings goal |
| GET/PUT/DELETE | `/api/savings-goals/:id` | Get / update / delete savings goal |
| GET/POST | `/api/accounts` | List all / create account |
| GET/PUT/DELETE | `/api/accounts/:id` | Get / update / delete account |
| GET | `/api/summary` | Budget summary with category breakdown |
| GET | `/api/household` | Household overview |
| GET/POST | `/api/months` | List locked months / lock a month |
| POST | `/api/import` | CSV bulk import |
| GET | `/api/export` | CSV export |

---

## Folder Structure

```
BasicBudget/
├── data/                              # SQLite database (gitignored)
│   └── basicbudget.db
│
├── server/                            # Express backend
│   ├── index.ts                       # App entry point, route mounting
│   ├── db.ts                          # Database connection + schema init
│   ├── schema.sql                     # DDL — tables and indexes
│   └── routes/
│       ├── accounts.ts
│       ├── debts.ts
│       ├── expenses.ts
│       ├── export.ts
│       ├── household.ts
│       ├── import.ts
│       ├── incomes.ts
│       ├── months.ts
│       ├── savings-goals.ts
│       └── summary.ts
│
├── shared/
│   └── types.ts                       # Shared TypeScript interfaces (frontend + backend)
│
├── src/                               # React frontend
│   ├── App.tsx                        # Root component, router setup
│   ├── main.tsx                       # React entry point
│   ├── index.css                      # Global styles / Tailwind imports
│   │
│   ├── api/                           # Typed API client functions
│   │
│   ├── components/
│   │   ├── charts/
│   │   │   ├── DebtPayoffLine.tsx
│   │   │   ├── ExpenseDonut.tsx
│   │   │   └── IncomeVsExpensesBar.tsx
│   │   ├── forms/
│   │   │   ├── CsvImportForm.tsx
│   │   │   ├── DebtForm.tsx
│   │   │   ├── ExpenseForm.tsx
│   │   │   ├── IncomeForm.tsx
│   │   │   └── SavingsGoalForm.tsx
│   │   └── layout/
│   │       ├── FilterBar.tsx
│   │       ├── Header.tsx
│   │       ├── PageShell.tsx
│   │       └── Sidebar.tsx
│   │
│   ├── context/
│   │   ├── BudgetContext.tsx
│   │   ├── DebtContext.tsx
│   │   ├── FilterContext.tsx
│   │   ├── SavingsContext.tsx
│   │   └── ThemeContext.tsx
│   │
│   ├── hooks/
│   │   └── useApi.ts                  # Typed fetch wrappers
│   │
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── DebtPage.tsx
│   │   ├── ExpensesPage.tsx
│   │   ├── HouseholdPage.tsx
│   │   ├── IncomePage.tsx
│   │   ├── SavingsPage.tsx
│   │   └── SettingsPage.tsx
│   │
│   ├── types/
│   │   └── index.ts                   # Re-exports from shared/types.ts
│   │
│   └── utils/
│       ├── duplicates.ts              # Full-field duplicate detection
│       └── formatters.ts             # Currency, percent, date formatters
│
├── Dockerfile                         # Multi-stage build (Node build → Node serve)
├── docker-compose.yml
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
└── tsconfig.server.json
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- npm 10 or later (bundled with Node.js)

### Install dependencies

```bash
npm install
```

### Run in development mode

```bash
npm run dev
```

This starts two processes concurrently:
- **Vite** dev server at `http://localhost:5173` (React frontend with HMR)
- **Express** API server at `http://localhost:3001` (watched by `tsx`)

The Vite config proxies all `/api/*` requests to the Express server automatically. Open `http://localhost:5173` in your browser.

The SQLite database is created automatically at `data/basicbudget.db` on first run.

### Build for production

```bash
npm run build
```

This runs both:
- `build:frontend` — TypeScript check + Vite bundle → `dist/`
- `build:server` — TypeScript compile → `dist-server/`

### Run the production build locally

```bash
npm start
```

Starts the Express server on port 3000. The server serves the built frontend from `public/` and handles all API routes on the same origin.

---

## Docker Deployment

The app is published as a pre-built image to GitHub Container Registry (GHCR) on every push to `master`. The multi-stage Dockerfile produces a minimal Node.js Alpine image — no Nginx required; Express serves everything.

### Pull and run with Docker Compose

```bash
docker compose pull
docker compose up -d
```

The app is served on **[http://localhost:8080](http://localhost:8080)**.

Data is persisted in a named Docker volume (`bb-data`) mounted at `/app/data`. The database survives container restarts and image updates.

The container restarts automatically unless explicitly stopped:

```bash
docker compose down
```

### Update to the latest image

```bash
docker compose pull && docker compose up -d
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the Express server listens on |
| `NODE_ENV` | `production` | Set to `production` to enable static file serving |
| `DB_PATH` | `data/basicbudget.db` | Path to the SQLite database file |

---

## Available Scripts

| Script | Command | Description |
|---|---|---|
| Dev server | `npm run dev` | Start Vite + Express concurrently with hot reload |
| Build (all) | `npm run build` | Type-check and bundle frontend + compile server |
| Build frontend | `npm run build:frontend` | Vite production build only |
| Build server | `npm run build:server` | Compile server TypeScript only |
| Start | `npm start` | Run the compiled production server |
| Preview | `npm run preview` | Serve the Vite production build locally |
| Lint | `npm run lint` | Run ESLint across the whole project |

---

## License

This project is provided as-is for personal use. No license is currently applied. If you fork or distribute this project, please add an appropriate open-source license.
