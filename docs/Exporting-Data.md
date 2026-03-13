# Exporting Data

BasicBudget can export all your financial data as a JSON file. This is useful for backups, migration to another system, or analysis in a spreadsheet application.

## How to Export

1. Go to **Settings** in the sidebar.
2. Scroll to the **JSON Export** section.
3. Click **Export Data**.

A JSON file is downloaded immediately to your browser.

## What Is Included

The export contains all of your personal data:

- Income entries
- Expense entries
- Debt entries (including deal periods)
- Savings goals

> **Note:** The export includes only your own data, not other household members' personal entries. Household-flagged items that you own are included.

## File Format

The exported file is a JSON object with top-level keys for each data type:

```json
{
  "incomes": [...],
  "expenses": [...],
  "debts": [...],
  "savingsGoals": [...]
}
```

Each entry in the arrays matches the application's internal data model, with amounts in pence.

## Using the Export for Backup

For a complete backup strategy, combine the JSON export with a direct backup of the SQLite database file. See [[Backup and Restore\|Backup-and-Restore]].

---

<table width="100%">
<tr>
<td align="left">&#8592; <a href="Net-Worth-Tracking">Net Worth Tracking</a></td>
<td align="right"><a href="Automation">Automation</a> &#8594;</td>
</tr>
</table>
