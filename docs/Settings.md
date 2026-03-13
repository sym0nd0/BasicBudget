# Settings

The Settings page lets you manage your profile, payment accounts, data import/export, appearance, and month locking.

## Profile

- **Display Name** — Update the name shown in the sidebar and household views.
- **Change Password** — Enter your current password and a new password to update it.
- **Change Email** — Update the email address associated with your account.

## Payment Accounts

Payment accounts represent the bank accounts, credit cards, or wallets you use to pay expenses.

| Action | Description |
|---|---|
| **Add Account** | Create a new account with a name and optional notes. |
| **Edit Account** | Update the name or notes for an existing account. |
| **Delete Account** | Remove an account. Expenses linked to it will become unassigned. |
| **Joint Account** | Mark an account as jointly held with another household member. |
| **Sort Order** | Drag accounts to reorder how they appear in dropdowns. |

## Month Locking

Month locking prevents accidental edits to historical data.

- **Lock a month** — Select a past month and click **Lock**. Locked months cannot have income, expenses, debts, or savings updated.
- **Unlock a month** — Select a locked month and click **Unlock** to re-enable editing.

The current month and future months cannot be locked.

## CSV Import

Bulk-import financial data from a CSV file. Supported import types:

| Type | Description |
|---|---|
| **Expenses** | Import expense entries |
| **Income** | Import income entries |
| **Debts** | Import debt entries |
| **Savings Goals** | Import savings goal entries |

### How to Import

1. Select the import type from the dropdown.
2. Click **Download Template** to get a CSV template with the correct column headers.
3. Fill in your data in the template.
4. Click **Choose File**, select your CSV, and click **Import**.
5. A preview is shown before import. Review and confirm.

### CSV Column Reference — Expenses

| Column | Required | Description |
|---|---|---|
| `name` | Yes | Expense name |
| `amount` | Yes | Amount in pounds (e.g. `50.00`) |
| `category` | Yes | Category name (must match an existing category) |
| `type` | Yes | `fixed` or `variable` |
| `recurrence_type` | Yes | `one-off`, `monthly`, `weekly`, or `fortnightly` |
| `posting_day` | Yes | Day of month (1–31) |
| `account` | No | Payment account name |
| `start_date` | No | `YYYY-MM` format |
| `end_date` | No | `YYYY-MM` format |
| `is_household` | No | `true` or `false` |
| `notes` | No | Free text |

### CSV Column Reference — Income

| Column | Required | Description |
|---|---|---|
| `name` | Yes | Income name |
| `amount` | Yes | Amount in pounds |
| `recurrence_type` | Yes | `one-off`, `monthly`, `weekly`, or `fortnightly` |
| `posting_day` | Yes | Day of month (1–31) |
| `gross_or_net` | No | `gross` or `net` |
| `start_date` | No | `YYYY-MM` format |
| `end_date` | No | `YYYY-MM` format |
| `is_household` | No | `true` or `false` |
| `notes` | No | Free text |

### CSV Column Reference — Debts

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

### CSV Column Reference — Savings Goals

| Column | Required | Description |
|---|---|---|
| `name` | Yes | Goal name |
| `target_amount` | Yes | Target amount in pounds |
| `current_amount` | No | Current saved amount in pounds |
| `monthly_contribution` | No | Monthly contribution in pounds |
| `target_date` | No | `YYYY-MM-DD` format |
| `is_household` | No | `true` or `false` |
| `notes` | No | Free text |

## JSON Export

Click **Export Data** to download a full JSON export of all your income, expenses, debts, and savings goals. This file can be used for backup or migration purposes.

## Colour Blindness Palettes

Choose a chart colour palette optimised for different types of colour vision:

| Palette | Optimised for |
|---|---|
| **Default** | Standard colour vision |
| **Deuteranopia** | Red-green colour blindness (green deficiency) |
| **Protanopia** | Red-green colour blindness (red deficiency) |
| **Tritanopia** | Blue-yellow colour blindness |

## Theme

Choose between **Light**, **Dark**, or **System** (follows your operating system preference).


---

← [[Reports]] | [[Authentication]] →