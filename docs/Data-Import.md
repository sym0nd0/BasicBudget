# Data Import

This page provides a detailed reference for the CSV import feature. For an overview of how to use the import tool, see [[Importing Data\|Importing-Data]].

## CSV Column Reference — Expenses

| Column | Required | Description |
|---|---|---|
| `name` | Yes | Expense name |
| `amount` | Yes | Amount in pounds (e.g. `50.00`) |
| `day` | No | Day of month (1–31), or weekday number 1–7 for weekly/fortnightly entries |
| `category` | Yes | Category name (must match an existing category) |
| `household` | No | `true`, `yes`, or `1` to mark as household-shared |
| `split_ratio` | No | Decimal share from `0` to `1`; defaults to `0.5` for household expenses, otherwise `1.0` |
| `account` | No | Payment account name (case-insensitive match against existing accounts) |
| `recurrence_type` | Yes | `one-off`, `monthly`, `weekly`, `yearly`, or `fortnightly` |
| `is_recurring` | No | `yes`, `true`, or `1`; blank defaults to recurring |
| `start_date` | No | `DD/MM/YYYY` or ISO date |
| `end_date` | No | `DD/MM/YYYY` or ISO date |
| `notes` | No | Free text |

## CSV Column Reference — Income

| Column | Required | Description |
|---|---|---|
| `name` | Yes | Income name |
| `amount` | Yes | Amount in pounds |
| `day` | No | Day of month (1–31), or weekday number 1–7 for weekly/fortnightly entries |
| `contributor` | No | Contributor display name or email text stored with the imported row |
| `gross_or_net` | No | `gross` or `net` |
| `recurrence_type` | Yes | `one-off`, `monthly`, `weekly`, `yearly`, or `fortnightly` |
| `is_recurring` | No | `yes`, `true`, or `1`; blank defaults to recurring |
| `start_date` | No | `DD/MM/YYYY` or ISO date |
| `end_date` | No | `DD/MM/YYYY` or ISO date |
| `notes` | No | Free text |

## CSV Column Reference — Debts

| Column | Required | Description |
|---|---|---|
| `name` | Yes | Debt name |
| `balance` | Yes | Outstanding balance in pounds |
| `interest_rate` | Yes | Annual Percentage Rate (e.g. `19.95`) |
| `minimum_payment` | Yes | Minimum monthly payment in pounds |
| `overpayment` | No | Additional monthly payment in pounds |
| `compounding_frequency` | No | Stored compounding label; defaults to `monthly` |
| `day` | No | Posting day of month (1–31) |
| `is_household` | No | `true` or `false` |
| `split_ratio` | No | Decimal share from `0` to `1`; defaults to `0.5` for household debts, otherwise `1.0` |
| `recurrence_type` | No | `one-off`, `monthly`, `weekly`, `yearly`, or `fortnightly`; invalid values default to `monthly` |
| `is_recurring` | No | `yes`, `true`, or `1`; blank defaults to recurring |
| `start_date` | No | `DD/MM/YYYY` or ISO date |
| `end_date` | No | `DD/MM/YYYY` or ISO date |
| `notes` | No | Free text |

## CSV Column Reference — Savings Goals

| Column | Required | Description |
|---|---|---|
| `name` | Yes | Goal name |
| `target_amount` | Yes | Target amount in pounds |
| `current_amount` | No | Current saved amount in pounds |
| `monthly_contribution` | No | Monthly contribution in pounds |
| `target_date` | No | `DD/MM/YYYY` or ISO date |
| `is_household` | No | `true` or `false` |
| `notes` | No | Free text |

## Notes

- Amount values are in **pounds**, not pence. The application converts them to pence internally.
- Unknown expense categories are imported as `Other`.
- Account names are matched case-insensitively against existing accounts. If no account matches, the expense is imported with no account assigned.
- If any row has a validation error, the import request returns those row errors and no rows are written.
- Duplicate rows are skipped automatically and included in the final success message.
- Debt CSV import does not import deal periods or reminder settings; those are configured manually in the Debt form after import.
- Savings CSV import does not import auto-contribution settings or transaction history; those are configured/created in the Savings page after import.

---

<p>
  <span style="float:left;">← Back: [[Automation]]</span>
  <span style="float:right;">[[API]] →</span>
</p>
<div style="clear:both;"></div>
