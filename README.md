# BasicBudget

A personal budgeting and debt management application built with React 19 and TypeScript. BasicBudget helps you track your monthly income and expenses, manage debts with full amortization schedules, and visualise your financial picture through interactive charts — all without a backend or account. Your data lives in your browser's localStorage.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Data Models](#data-models)
4. [Folder Structure](#folder-structure)
5. [Seed Data](#seed-data)
6. [Getting Started](#getting-started)
7. [Docker Deployment](#docker-deployment)
8. [Available Scripts](#available-scripts)
9. [Architecture Notes](#architecture-notes)
10. [License](#license)

---

## Features

### Dashboard
- At-a-glance budget summary card showing total income, total expenses, total debt payments, and disposable income
- Expense donut chart broken down by category (Housing, Transport, Food & Groceries, Utilities, Subscriptions, Personal, Health, Entertainment, Debt Payments, Savings, Other)
- Income vs Expenses bar chart for visual comparison
- Debt payoff timeline line chart showing cumulative balance across all debts month by month

### Income Management
- Add, edit, and delete income sources
- Record the day of month income is received
- Optional notes per income entry

### Expense Management
- Add, edit, and delete monthly expenses
- Categorise each expense into one of 11 categories
- Tag expenses as `fixed` or `variable`
- Assign expenses to a payment account: First Direct, Natwest, Cash, or Other
- Mark expenses as household expenses and apply a 50/50 split ratio so only your share is counted in your budget summary
- Optional notes per expense entry

### Debt Management
- Add, edit, and delete debts
- Record balance, APR, minimum payment, and your actual current payment
- Full per-debt amortization table showing month-by-month opening balance, interest charge, principal paid, and closing balance
- Payoff summary per debt: months to payoff, total interest paid, total paid, and projected payoff date
- Debt payoff chart plotting all debt balances over time on a single timeline

### Additional Features
- **Theme toggle** — light, dark, and system-preference modes
- **Household splitting** — expenses shared with a partner count at 50% in all summaries and charts
- **Amortization engine** — handles variable APRs, interest-free periods (0% APR), and payments above the minimum
- **localStorage persistence** — all data is saved automatically; no account or server required

---

## Tech Stack

| Layer | Library / Tool | Version |
|---|---|---|
| UI Framework | React | 19.2 |
| Language | TypeScript | 5.9 |
| Build Tool | Vite | 7.x |
| Styling | Tailwind CSS | v4 |
| Charts | Recharts | 3.x |
| Routing | React Router | 7.x |
| Container | Docker + Nginx | — |

---

## Data Models

All types are defined in `src/types/index.ts`.

### Income

```typescript
interface Income {
  id: string;
  name: string;
  amount: number;       // monthly amount in GBP
  dayOfMonth: number;   // day income lands (1–31)
  notes?: string;
}
```

### Expense

```typescript
interface Expense {
  id: string;
  name: string;
  amount: number;
  dayOfMonth: number;
  account: 'First Direct' | 'Natwest' | 'Cash' | 'Other';
  type: 'fixed' | 'variable';
  category: ExpenseCategory;
  isHousehold: boolean;
  splitRatio: number;   // 0.5 for shared household costs, 1.0 for sole costs
  notes?: string;
}
```

### Debt

```typescript
interface Debt {
  id: string;
  name: string;
  balance: number;
  apr: number;            // annual percentage rate
  minimumPayment: number;
  currentPayment: number; // actual payment being made
  notes?: string;
}
```

### AmortizationRow

```typescript
interface AmortizationRow {
  month: number;
  date: string;
  openingBalance: number;
  interestCharge: number;
  payment: number;
  principalPaid: number;
  closingBalance: number;
}
```

### DebtPayoffSummary

```typescript
interface DebtPayoffSummary {
  debtId: string;
  debtName: string;
  monthsToPayoff: number;
  totalInterestPaid: number;
  totalPaid: number;
  payoffDate: string;
  schedule: AmortizationRow[];
}
```

### BudgetSummary

```typescript
interface BudgetSummary {
  totalIncome: number;
  totalExpenses: number;
  totalDebtPayments: number;
  disposableIncome: number;
  categoryBreakdown: CategoryBreakdown[];
}
```

### Theme

```typescript
type Theme = 'light' | 'dark' | 'system';
```

---

## Folder Structure

```
BasicBudget/
├── public/
│   └── favicon.svg
├── src/
│   ├── App.tsx                          # Root component, router setup
│   ├── main.tsx                         # React entry point
│   ├── index.css                        # Global styles / Tailwind imports
│   │
│   ├── components/
│   │   ├── charts/
│   │   │   ├── DebtPayoffLine.tsx       # Multi-debt balance over time (line)
│   │   │   ├── ExpenseDonut.tsx         # Expense category breakdown (donut)
│   │   │   └── IncomeVsExpensesBar.tsx  # Income vs expenses (bar)
│   │   ├── forms/
│   │   │   ├── DebtForm.tsx             # Add / edit debt modal form
│   │   │   ├── ExpenseForm.tsx          # Add / edit expense modal form
│   │   │   └── IncomeForm.tsx           # Add / edit income modal form
│   │   ├── layout/
│   │   │   ├── Header.tsx               # Top navigation bar
│   │   │   ├── PageShell.tsx            # Page wrapper with title slot
│   │   │   └── Sidebar.tsx              # Left navigation sidebar
│   │   └── ui/
│   │       ├── Badge.tsx                # Pill badge for categories / types
│   │       ├── Button.tsx               # Reusable button component
│   │       ├── Card.tsx                 # Surface card wrapper
│   │       ├── Input.tsx                # Labelled form input
│   │       ├── Modal.tsx                # Accessible dialog wrapper
│   │       └── ThemeToggle.tsx          # Light / dark / system switcher
│   │
│   ├── constants/
│   │   └── defaults.ts                  # Seed incomes, expenses, and debts
│   │
│   ├── context/
│   │   ├── BudgetContext.tsx            # Income + expense state & dispatch
│   │   ├── DebtContext.tsx              # Debt state & dispatch
│   │   └── ThemeContext.tsx             # Theme state & toggle
│   │
│   ├── hooks/
│   │   └── useLocalStorage.ts           # Generic localStorage sync hook
│   │
│   ├── pages/
│   │   ├── Dashboard.tsx                # Overview charts and summary
│   │   ├── DebtPage.tsx                 # Debt list, amortization tables
│   │   ├── ExpensesPage.tsx             # Expense list and management
│   │   └── IncomePage.tsx               # Income list and management
│   │
│   ├── types/
│   │   └── index.ts                     # All TypeScript interfaces and types
│   │
│   └── utils/
│       ├── calculations.ts              # Budget summary + amortization engine
│       ├── formatters.ts                # Currency, percent, date formatters
│       └── id.ts                        # crypto.randomUUID() wrapper
│
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── eslint.config.js
├── Dockerfile
├── docker-compose.yml
└── nginx.conf
```

31 source files under `src/`.

---

## Seed Data

The app ships with realistic seed data so it is useful out of the box. Seed values are defined in `src/constants/defaults.ts` and loaded into localStorage on first run.

### Income (1 entry)

| Name | Amount | Day |
|---|---|---|
| Salary | £3,000.89 | 28th |

### Expenses (22 entries)

Selected highlights:

| Name | Category | Amount | Split |
|---|---|---|---|
| House bills | Housing | £2,264.80 | 50% (£1,132.40) |
| Groceries | Food & Groceries | £200.00 | sole |
| Fuel | Transport | £120.00 | sole |
| Savings transfer | Savings | £100.00 | sole |
| Car insurance | Transport | £89.50 | sole |
| Eating out | Food & Groceries | £80.00 | sole |
| Entertainment | Entertainment | £60.00 | sole |
| Clothing | Personal | £50.00 | sole |
| Very catalogue payment | Debt Payments | £30.00 | sole |
| Gym | Personal | £29.99 | sole |
| Littlewoods payment | Debt Payments | £25.00 | sole |
| Netflix | Subscriptions | £17.99 | 50% |
| Spotify | Subscriptions | £11.99 | 50% |
| Amazon Prime | Subscriptions | £8.99 | 50% |
| iCloud Storage | Subscriptions | £2.99 | 50% |
| … | … | … | … |

### Debts (10 entries)

| Name | Balance | APR | Payment |
|---|---|---|---|
| Tesco Credit Card | £1,423.56 | 37.7% | £100.00 |
| Natwest Personal Loan | £4,200.00 | 15.9% | £150.00 |
| Natwest Credit Card | £2,850.00 | 0% | £75.00 |
| Halifax Credit Card | £1,950.00 | 0% | £50.00 |
| Barclaycard | £1,680.00 | 0% | £75.00 |
| Very Catalogue | £1,240.28 | 0% | £30.00 |
| JD Williams | £960.00 | 0% | £100.00 |
| Littlewoods | £980.00 | 0% | £25.00 |
| Studio | £856.00 | 0% | £100.00 |
| Overdraft | £1,000.00 | 0% | £69.76 |

**Total debt: £17,139.84 — Monthly payments: £774.76**

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

Open [http://localhost:5173](http://localhost:5173) in your browser. The dev server supports hot module replacement — changes are reflected instantly without a full page reload.

### Build for production

```bash
npm run build
```

Output is written to the `dist/` directory. Serve it from any static file host or web server.

---

## Docker Deployment

A multi-stage Dockerfile is included. Stage 1 builds the app with Node.js; Stage 2 serves the static output with Nginx Alpine, keeping the final image small.

### Build and run with Docker Compose

```bash
docker compose up -d
```

The app is served on **[http://localhost:8080](http://localhost:8080)**.

The container restarts automatically unless explicitly stopped (`restart: unless-stopped`). To stop it:

```bash
docker compose down
```

### Rebuild after code changes

```bash
docker compose up -d --build
```

---

## Available Scripts

| Script | Command | Description |
|---|---|---|
| Dev server | `npm run dev` | Start Vite dev server with HMR |
| Build | `npm run build` | Type-check then bundle for production |
| Preview | `npm run preview` | Serve the production build locally |
| Lint | `npm run lint` | Run ESLint across the whole project |

---

## Architecture Notes

### No backend

BasicBudget is a fully client-side application. There is no API, database, or authentication layer. All state is held in React Context and persisted to `localStorage`.

### State management

State is managed with React's built-in `useReducer` + `useContext` pattern. Two top-level contexts are provided:

- **BudgetContext** — owns `incomes` and `expenses` arrays; dispatches `ADD_INCOME`, `UPDATE_INCOME`, `DELETE_INCOME`, `ADD_EXPENSE`, `UPDATE_EXPENSE`, `DELETE_EXPENSE`, and `SET_STATE`
- **DebtContext** — owns the `debts` array; dispatches `ADD_DEBT`, `UPDATE_DEBT`, `DELETE_DEBT`, and `SET_STATE`

Both contexts are consumed through typed custom hooks (`useBudget()`, `useDebt()`).

### localStorage keys

| Key | Content |
|---|---|
| `bb-budget` | Serialised `{ incomes: Income[], expenses: Expense[] }` |
| `bb-debts` | Serialised `{ debts: Debt[] }` |
| `bb-theme` | Active theme string: `'light'`, `'dark'`, or `'system'` |

On first load, if a key is absent, the seed data from `src/constants/defaults.ts` is written. Subsequent loads read persisted state directly.

### Theme system

`ThemeContext` exposes the current theme and a `setTheme` function. The context applies a `dark` class to `<html>` when the effective theme is dark, enabling Tailwind's dark mode variant (`dark:…`). When set to `'system'`, the context listens to `prefers-color-scheme` media query changes in real time.

### Amortization engine

`calculateAmortization()` in `src/utils/calculations.ts` generates a month-by-month amortization schedule for a single debt:

1. Applies monthly interest (`APR / 12`) to the opening balance
2. Subtracts the current payment (floored at the outstanding balance in the final month)
3. Repeats until the closing balance reaches zero or a 600-month safety cap is hit

For 0% APR debts the schedule is a simple linear paydown. `buildDebtPayoffChartData()` merges all individual schedules onto a shared monthly timeline for the chart.

### Household splitting

Any expense flagged `isHousehold: true` is stored with `splitRatio: 0.5`. `calculateBudgetSummary()` multiplies each expense's `amount` by its `splitRatio` before summing, so the summary reflects only your share of shared costs. The full raw amount is displayed in the expense list for transparency.

---

## License

This project is provided as-is for personal use. No license is currently applied. If you fork or distribute this project, please add an appropriate open-source license.
