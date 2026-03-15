# Data Import

This page provides a detailed reference for the CSV import feature. For an overview of how to use the import tool, see [[Importing Data\|Importing-Data]].

## CSV Column Reference — Expenses

| Column | Required | Description |
|---|---|---|
| `name` | Yes | Expense name |
| `amount` | Yes | Amount in pounds (e.g. `50.00`) |
| `category` | Yes | Category name (must match an existing category) |
| `recurrence_type` | Yes | `one-off`, `monthly`, `weekly`, `yearly`, or `fortnightly` |
| `posting_day` | Yes | Day of month (1–31) |
| `account` | No | Payment account name (must match an existing account) |
| `start_date` | No | `YYYY-MM` format |
| `end_date` | No | `YYYY-MM` format |
| `is_household` | No | `true` or `false` |
| `notes` | No | Free text |

## CSV Column Reference — Income

| Column | Required | Description |
|---|---|---|
| `name` | Yes | Income name |
| `amount` | Yes | Amount in pounds |
| `recurrence_type` | Yes | `one-off`, `monthly`, `weekly`, `yearly`, or `fortnightly` |
| `posting_day` | Yes | Day of month (1–31) |
| `gross_or_net` | No | `gross` or `net` |
| `start_date` | No | `YYYY-MM` format |
| `end_date` | No | `YYYY-MM` format |
| `is_household` | No | `true` or `false` |
| `notes` | No | Free text |

## CSV Column Reference — Debts

| Column | Required | Description |
|---|---|---|
| `name` | Yes | Debt name |
| `balance` | Yes | Outstanding balance in pounds |
| `apr` | Yes | Annual Percentage Rate (e.g. `19.95`) |
| `minimum_payment` | Yes | Minimum monthly payment in pounds |
| `overpayment` | No | Additional monthly payment in pounds |
| `posting_day` | Yes | Day of month (1–31) |
| `is_household` | No | `true` or `false` |
| `notes` | No | Free text |

## CSV Column Reference — Savings Goals

| Column | Required | Description |
|---|---|---|
| `name` | Yes | Goal name |
| `target_amount` | Yes | Target amount in pounds |
| `current_amount` | No | Current saved amount in pounds |
| `monthly_contribution` | No | Monthly contribution in pounds |
| `target_date` | No | `YYYY-MM-DD` format |
| `is_household` | No | `true` or `false` |
| `notes` | No | Free text |

## Notes

- Amount values are in **pounds**, not pence. The application converts them to pence internally.
- `category` and `account` values must exactly match existing entries (case-insensitive matching is applied). Create the categories and accounts first in the Admin panel and Settings before importing.
- Rows with validation errors are skipped; valid rows are imported.
- The import preview shows each row with its parsed values before you confirm.

---

<p>
  <span style="float:left;">← Back: [[Automation]]</span>
  <span style="float:right;">[[API]] →</span>
</p>
<div style="clear:both;"></div>
