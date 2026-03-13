# Introduction

BasicBudget is a self-hosted, open-source personal finance application designed for individuals and households who want full control over their financial data. It runs on your own infrastructure, stores everything in a local SQLite database, and is accessible from any modern browser.

## Who Is BasicBudget For?

BasicBudget is designed for people who want to:

- Track monthly income and expenses across one or more household members
- Manage outstanding debts with full repayment projections
- Work towards savings goals with progress tracking
- Understand their financial position through interactive charts and reports
- Self-host their financial data without relying on third-party cloud services

## Core Concepts

### Money as Pence

All monetary values in BasicBudget are stored and processed internally as **integer pence** (1/100 of a pound). This avoids floating-point rounding errors that can accumulate in financial calculations. The user interface always displays values in pounds, converted automatically.

### Household Model

BasicBudget supports **multi-user households**. A household is a group of users who share a combined financial view. Each item (income entry, expense, debt, savings goal) has an optional **Household** flag. When enabled, the item appears on the shared Household page alongside other members' contributions.

Personal items — those without the Household flag — remain private to the individual user and appear only on their own Dashboard and pages.

### Recurring vs One-Off

Every financial item has a **recurrence type**: Monthly, Weekly, Fortnightly, or One-off. The recurring engine automatically determines which items are active for a given month, and multiplies weekly or fortnightly amounts by the number of occurrences in that month.

### Month-Based Budgeting

BasicBudget uses a **month-by-month** model. You select a month using the filter bar, and all pages show data relevant to that month. Past months can be locked to prevent accidental edits.

## Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React with TypeScript, built with Vite |
| **Backend** | Express (Node.js) with TypeScript |
| **Database** | SQLite via better-sqlite3 |
| **Deployment** | Docker (recommended) or manual Node.js |

---

<p>
  <span style="float:left;">← Back: [[Home]]</span>
  <span style="float:right;">[[Features Overview|Features-Overview]] →</span>
</p>
<div style="clear:both;"></div>
