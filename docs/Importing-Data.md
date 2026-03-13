# Importing Data

BasicBudget supports bulk data import from CSV files. This is useful when migrating from a spreadsheet or another application.

## How to Import

1. Go to **Settings** in the sidebar.
2. Scroll to the **CSV Import** section.
3. Select the import type from the dropdown: **Expenses**, **Income**, **Debts**, or **Savings Goals**.
4. Click **Download Template** to get a CSV file with the correct column headers and example data.
5. Fill in your data in the template, then save the file.
6. Click **Choose File**, select your CSV, and click **Import**.
7. A preview is shown before the import completes. Review the entries and confirm.

## Supported Import Types

| Type | Description |
|---|---|
| **Expenses** | Import expense entries |
| **Income** | Import income entries |
| **Debts** | Import debt entries |
| **Savings Goals** | Import savings goal entries |

## Tips

- Amount values must be in pounds (e.g. `50.00`), not pence.
- Category names (for expenses) must exactly match an existing category in the Admin panel.
- Account names (for expenses) must exactly match an existing payment account in Settings.
- Date fields use `YYYY-MM` format (e.g. `2026-01`).
- Boolean fields (`is_household`) accept `true` or `false`.

For full column specifications for each type, see [[Data Import\|Data-Import]].

---

<p>
  <span style="float:left;">← Back: [[Adding Transactions|Adding-Transactions]]</span>
  <span style="float:right;">[[Dashboard]] →</span>
</p>
<div style="clear:both;"></div>
