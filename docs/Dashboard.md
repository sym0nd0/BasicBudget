# Dashboard

The Dashboard is the home page of BasicBudget. It gives you an at-a-glance view of your financial position for the selected month.

## Summary Cards

Six cards appear at the top of the page:

| Card | Description |
|---|---|
| **Monthly Income** | Sum of all active income entries for the month |
| **Monthly Expenses** | Sum of all active expense entries for the month |
| **Debt Payments** | Total monthly debt repayment amounts across all active debts |
| **Monthly Savings** | Sum of all savings goal monthly contributions |
| **Total Monthly Outgoing** | Monthly Expenses + Debt Payments + Monthly Savings |
| **Disposable Income** | Monthly Income minus Total Monthly Outgoing |

Each card shows a two-line coloured indicator comparing the current period to the previous one:

```
↑ £10.50
0.49%
```

Line 1 shows the absolute change in pounds; line 2 shows the percentage change. Green indicates a favourable change; red indicates an unfavourable change. No indicator is shown when there is no previous data or when the value is unchanged.

The **Monthly Savings** card also displays a "Total Saved" sub-value showing the cumulative balance across all savings goals. For future months, this includes projected autopay contributions.

## Charts

### Income vs Outgoings Bar Chart

A side-by-side bar chart comparing total income and total expenses for the selected month. Hover over a bar to see the exact figure.

### Expense Breakdown Donut

A donut chart showing expenses by category for the selected month. Each segment represents a category. A legend lists each category with its total and percentage of overall spending.

## Filter Bar

The filter bar appears above the summary cards and allows you to narrow down the data shown on the Dashboard:

| Control | Description |
|---|---|
| **1M** | Single-month mode. Shows previous/next month buttons, a Month dropdown, and a Today shortcut when you are not on the current month. |
| **3M** | Previous 3 full months aggregated (excludes current month). |
| **6M** | Previous 6 full months aggregated (excludes current month). |
| **12M** | Previous 12 full months aggregated (excludes current month). |
| **Custom** | Reveals From and To month pickers to define an arbitrary date range. |

Changing any preset updates all summary cards and charts simultaneously.

### Multi-Month Mode

When 3M, 6M, 12M, or Custom is selected, the Dashboard aggregates totals across every month in the range rather than showing a single month:

- **Summary cards** — show totals for the entire range (e.g. 3M sums income across 3 months) and compare against the previous equivalent period.
- **Charts** — update to reflect the aggregated data.
- **Category breakdown table** — shows each category's total for the range. In single-month mode, each category row shows a change indicator vs the previous month.

To return to single-month mode, click **1M**.

---

<p>
  <span style="float:left;">← Back: [[Importing Data|Importing-Data]]</span>
  <span style="float:right;">[[Budget Categories|Budget-Categories]] →</span>
</p>
<div style="clear:both;"></div>
