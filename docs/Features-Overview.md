# Features Overview

A comprehensive list of everything BasicBudget can do.

## Budget Management

- **Monthly budgeting** — select any past or present month and view a full snapshot of your finances
- **Income tracking** — add recurring and one-off income entries with gross/net toggle, contributor attribution, and recurrence type
- **Expense tracking** — fixed and variable expenses with categories, payment accounts, recurrence type, and household split ratio
- **Month locking** — lock past months to prevent accidental edits to historical data
- **Duplicate detection** — warns before saving an entry identical to an existing one
- **Filter bar** — filter entries by contributor, account, category, or recurrence type; toggle a date range picker to cycle through a from/to month window

## Debt Tracking

- **Debt entries** — record credit cards, loans, mortgages, and other debts with APR, minimum payment, and overpayment
- **Repayment schedule** — month-by-month projection of interest, payments, and closing balance
- **Deal periods** — track promotional interest rates (e.g. 0% balance transfer offers) with email reminders before expiry
- **Payoff summary** — projected payoff date and total interest over the repayment period

## Savings Goals

- **Goal tracking** — name, target amount, current amount, monthly contribution, and optional target date
- **Deposits and withdrawals** — record ad-hoc deposits and withdrawals against each goal
- **Auto-contributions** — monthly contributions applied automatically to the goal balance
- **Transaction history** — per-goal log of all deposits, withdrawals, and auto-contributions
- **Progress bars** — visual progress towards each goal with months-to-goal calculation
- **Household goals** — share savings goals across household members

## Household

- **Multi-user households** — one owner, multiple members, with invitation by email
- **Household summary** — combined view of all household-flagged income, expenses, debts, and savings
- **Role-based access** — owners can manage membership; members can contribute and view shared data

## Reports & Analytics

- **Time-range selection** — 1 week, 1 month, 3 months, YTD, 1 year, 2 years, 5 years, or all time
- **Overview cards** — total income, expenses, disposable income, savings rate, and total debt with trend indicators
- **Income vs expenses chart** — grouped bar chart comparing monthly income and expenses
- **Disposable income trend** — line chart of monthly disposable income
- **Savings rate chart** — monthly savings rate as a percentage of income
- **Expense breakdown donut** — spending by category for the selected period
- **Category trends** — stacked area chart of category spending over time
- **Debt projection chart** — forward projection of combined debt balance to payoff date
- **Debt-to-income ratio** — historical chart of debt relative to annual income
- **Monthly detail table** — sortable table with per-month income, expenses, disposable income, and savings rate

## Data Management

- **CSV import** — bulk-import expenses, income, debts, and savings goals from spreadsheet files
- **JSON export** — full data export for backup or migration
- **Payment accounts** — track which bank account or card pays each expense

## Authentication & Security

- **Email/password registration** — with minimum password requirements
- **TOTP two-factor authentication** — via any standard authenticator app
- **Recovery codes** — single-use codes for 2FA recovery
- **OIDC single sign-on** — integrate with Google, Keycloak, Authentik, or any OIDC provider
- **Session management** — view active sessions and revoke individual sessions
- **New device alerts** — email notification on login from a new device
- **Account lockout** — automatic lockout after 5 failed login attempts

## Administration

- **User management** — promote/demote admins, lock/unlock accounts, remove 2FA, delete users
- **SMTP configuration** — configure outgoing email for invitations, alerts, and reminders
- **OIDC configuration** — set up single sign-on at runtime without restarting the server
- **Expense categories** — add, remove, and reorder expense categories
- **Registration control** — enable or disable public self-registration
- **Database backup and restore** — download a full JSON backup; restore atomically from a backup file; automated scheduled backups to server disk with configurable interval and retention
- **Audit log** — searchable, paginated log of significant actions
- **Log level** — adjust server logging verbosity at runtime

## Appearance

- **Light / Dark / System theme** — follows OS preference or manual selection
- **Colour blindness palettes** — Deuteranopia, Protanopia, and Tritanopia optimised chart palettes
- **Version update notifications** — opt-in sidebar badge notifying admins when a new release is available on GitHub

---

<p>
  <span style="float:left;">← Back: [[Introduction]]</span>
  <span style="float:right;">[[Screenshots]] →</span>
</p>
<div style="clear:both;"></div>
