# Dashboard

The Dashboard is the home page of BasicBudget. It gives you an at-a-glance view of your financial position for the selected month.

## Summary Cards

Five cards appear at the top of the page:

| Card | Description |
|---|---|
| **Total Income** | Sum of all active income entries for the month |
| **Total Expenses** | Sum of all active expense entries for the month |
| **Disposable Income** | Total Income minus Total Expenses |
| **Total Debt** | Combined outstanding balance across all active debts |
| **Total Savings** | Combined current balance across all savings goals |

## Charts

### Income vs Outgoings Bar Chart

A side-by-side bar chart comparing total income and total expenses for the selected month. Hover over a bar to see the exact figure.

### Expense Breakdown Donut

A donut chart showing expenses by category for the selected month. Each segment represents a category. A legend lists each category with its total and percentage of overall spending.

## Filter Bar

The filter bar appears above the summary cards and allows you to narrow down the data shown on the Dashboard:

| Control | Description |
|---|---|
| **1M** | Single-month mode. Shows a Month dropdown to pick the exact month. Defaults to the current month. |
| **3M** | Previous 3 full months aggregated (excludes current month). |
| **6M** | Previous 6 full months aggregated (excludes current month). |
| **12M** | Previous 12 full months aggregated (excludes current month). |
| **Custom** | Reveals From and To month pickers to define an arbitrary date range. |

Changing any preset updates all summary cards and charts simultaneously.

### Multi-Month Mode

When 3M, 6M, 12M, or Custom is selected, the Dashboard aggregates totals across every month in the range rather than showing a single month:

- **Summary cards** — show totals for the entire range (e.g. 3M sums income across 3 months).
- **Charts** — update to reflect the aggregated data.

To return to single-month mode, click **1M**.

---

<p>
  <span style="float:left;">← Back: [[Importing Data|Importing-Data]]</span>
  <span style="float:right;">[[Budget Categories|Budget-Categories]] →</span>
</p>
<div style="clear:both;"></div>
