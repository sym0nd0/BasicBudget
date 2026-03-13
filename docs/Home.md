# BasicBudget Documentation

BasicBudget is a self-hosted, multi-user personal finance application for tracking monthly income and expenses, managing debts with full repayment schedules, monitoring savings goals, and visualising your household's financial picture through interactive charts.

## Key Capabilities

- **Income tracking** — recurring and one-off income with gross/net toggle, weekly/fortnightly multipliers, and per-contributor attribution
- **Expense tracking** — fixed and variable expenses categorised, assigned to payment accounts, and optionally split between household members
- **Debt management** — APR-based repayment schedules, promotional deal periods with email reminders, and payoff projections
- **Savings goals** — target amounts, monthly contributions, progress tracking, and household-shared goals
- **Household budgets** — multi-user households with owner and member roles, shared income/expense/debt/savings views
- **Reports and charts** — time-ranged trend analysis, spending breakdowns, debt projection, and savings rate
- **CSV import / JSON export** — bulk-import expenses, income, debts, and savings goals from spreadsheets
- **Authentication** — TOTP two-factor authentication, OIDC single sign-on, session management, and account recovery
- **Admin panel** — user management, SMTP configuration, OIDC setup, expense categories, and audit log

## Documentation Index

| Page | Description |
|---|---|
| [Getting Started](Getting-Started.md) | Docker setup, environment variables, first login, development mode |
| [Dashboard](Dashboard.md) | Summary cards, charts, and the filter bar |
| [Income](Income.md) | Adding and managing income entries |
| [Expenses](Expenses.md) | Adding and managing expense entries |
| [Debt](Debt.md) | Debt tracking, deal periods, and repayment schedules |
| [Savings](Savings.md) | Savings goals and progress tracking |
| [Household](Household.md) | Multi-user households, invites, and roles |
| [Reports](Reports.md) | Reports page, time ranges, and all chart sections |
| [Settings](Settings.md) | Profile, accounts, CSV import, export, appearance, and month locking |
| [Authentication](Authentication.md) | Login, 2FA, OIDC SSO, sessions, and account recovery |
| [Admin](Admin.md) | User management, SMTP, OIDC, categories, and audit log |
