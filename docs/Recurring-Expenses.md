# Recurring Expenses

BasicBudget supports four recurrence types for income and expense entries. The recurring engine automatically determines which entries are active for a given month.

## Recurrence Types

| Type | Behaviour |
|---|---|
| **One-off** | Appears only in a single specific month, determined by the posting date. |
| **Monthly** | Appears every month within the start/end date range. |
| **Weekly** | Appears every month; the amount is multiplied by the number of occurrences of the posting day in that month. |
| **Fortnightly** | Appears every month; the amount is multiplied by the number of fortnightly occurrences in that month. |

## Posting Day

The **Posting Day** field (1–31) controls which day of the month the entry is associated with. For weekly entries, it determines which day of the week is used for the multiplier calculation. For one-off entries, it determines the exact date.

If you set a posting day of 31 for a month that has fewer than 31 days, the entry is assigned to the last day of that month.

## Start and End Dates

Use **Start Date** and **End Date** to limit when a recurring entry is active:

| Field | Format | Behaviour |
|---|---|---|
| **Start Date** | `YYYY-MM` | Entry is not shown before this month. Leave blank to start from the beginning. |
| **End Date** | `YYYY-MM` | Entry is not shown after this month. Leave blank for no end date. |

## Weekly Multiplier

For weekly entries, BasicBudget counts the number of times the posting day occurs in the selected month and multiplies the amount accordingly.

**Example:** An expense of £50/week with posting day Monday:

| Month | Mondays | Amount shown |
|---|---|---|
| February 2026 | 4 | £200.00 |
| March 2026 | 5 | £250.00 |
| April 2026 | 4 | £200.00 |

This gives an accurate picture of weekly costs within each budget month.

## Fortnightly Multiplier

For fortnightly entries, BasicBudget counts occurrences of the fortnightly cycle within the month. Most months will show 2 occurrences (£amount × 2), but some months may show 3 depending on the cycle alignment.

## Use Cases

- **Monthly salary or rent** — use Monthly recurrence
- **Weekly food shop or childcare** — use Weekly recurrence so the monthly total reflects actual weeks
- **Fortnightly payroll** — use Fortnightly recurrence
- **One-off bonus or annual insurance payment** — use One-off recurrence with the specific month

---

<p>
  <span style="float:left;">← Back: [[Expenses]]</span>
  <span style="float:right;">[[Household]] →</span>
</p>
<div style="clear:both;"></div>
