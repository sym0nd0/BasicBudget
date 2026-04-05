# Importing Data

BasicBudget supports bulk data import from CSV files. This is useful when migrating from a spreadsheet or another application.

## How to Import

1. Go to **Settings** in the sidebar.
2. Scroll to the **CSV Import** section.
3. Select the import type from the dropdown: **Expenses**, **Income**, **Debts**, or **Savings Goals**.
4. Click **Download template** to get a CSV file with the correct column headers.
5. Fill in your data in the template, then save the file.
6. Click **Choose File**, select your CSV, and click **Import**.
7. If validation fails, row-level errors are shown in the dialog and no rows are written. Duplicate rows are skipped automatically.

## Supported Import Types

| Type | Description |
|---|---|
| **Expenses** | Import expense entries |
| **Income** | Import income entries |
| **Debts** | Import debt entries |
| **Savings Goals** | Import savings goal entries |

## Tips

- Amount values must be in pounds (e.g. `50.00`), not pence.
- Category names (for expenses) should match an existing category; unknown values are imported as `Other`.
- Account names (for expenses) are matched case-insensitively against existing accounts; unknown values are imported with no account assigned.
- Date fields use `DD/MM/YYYY` format. ISO dates are accepted when already present in the file.
- Boolean fields accept `true` or `false`; the Expenses CSV uses `household`, while Debt and Savings CSVs use `is_household`.

For full column specifications for each type, see [[Data Import\|Data-Import]].

---

<p>
  <span style="float:left;">← Back: [[Adding Transactions|Adding-Transactions]]</span>
  <span style="float:right;">[[Dashboard]] →</span>
</p>
<div style="clear:both;"></div>
