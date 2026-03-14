# Savings

The Savings page tracks progress towards financial goals such as an emergency fund, holiday, home deposit, or any other target. It also records every deposit, withdrawal, and auto-contribution as a transaction, giving you a full audit trail and a balance growth chart.

## Adding a Savings Goal

Click **Add Savings** to open the form. Fill in the fields and click **Save**.

## Fields

| Field | Description |
|---|---|
| **Name** | A label for the goal (e.g. "Emergency Fund", "Holiday 2026"). |
| **Target Amount** | The total amount you want to save in pounds. |
| **Current Amount** | How much you have saved so far. |
| **Monthly Contribution** | The amount you plan to add each month. |
| **Target Date** | An optional date by which you want to reach the goal. |
| **Household Goal** | Tick to include this goal in Household summary views. |
| **Auto-contribute** | Visible only when Monthly Contribution is greater than zero. When ticked, the system automatically records a contribution transaction on the specified day each month. |
| **Contribution Day** | The day of the month (1–28) on which auto-contributions are applied. Only shown when Auto-contribute is enabled. |
| **Notes** | Optional free-text notes. |

## Progress Tracking

Each goal shows:

- A **progress bar** indicating how close you are to the target.
- The **current amount** and **target amount**.
- **Months to goal** — calculated from the current amount, target amount, and monthly contribution.
- An **Auto** badge when auto-contribute is enabled.

## Deposits and Withdrawals

Each goal card has two action buttons:

- **Deposit** (upward arrow) — opens a modal to add funds. Enter an amount and optional notes, then click **Deposit**.
- **Withdraw** (downward arrow) — opens the same modal in withdrawal mode. The withdrawal is rejected if the amount exceeds the current balance.

Both actions are recorded as transactions and appear in the transaction log below.

## Auto-Contributions

When **Auto-contribute** is enabled on a goal, the system automatically catches up any missed monthly contributions on the next page load. For example, if the contribution day is the 1st and you open the app on the 5th, the current month's contribution is applied automatically. Months are never double-counted.

## Household Savings Goals

Goals marked as **Household Goals** appear on the [Household](Household) summary page. The target is shared across the household; progress counts contributions from all members.

## Filter Bar

The filter bar at the top of the page controls the date range for the transaction log and the Savings Balance chart. Use the preset pills (1M, 3M, 6M, 12M) or select a custom date range.

## Savings Balance Chart

When transactions exist in the selected period, a stacked area chart shows the balance progression for each goal over time, with a dashed **Total** line showing the combined balance.

## Transaction History

Below the chart, a table lists every transaction in the selected period:

| Column | Description |
|---|---|
| **Date** | The date the transaction was recorded. |
| **Goal** | The savings goal the transaction belongs to. |
| **Type** | Auto, Deposit, or Withdrawal. |
| **Amount** | The transaction amount (+ for credits, − for debits). |
| **Balance After** | The goal balance immediately after the transaction. |
| **Notes** | Optional notes entered at the time of the transaction. |

## Editing and Deleting Goals

Click the **edit icon** on any goal card to update its details, including toggling auto-contribute. Click the **delete icon** to remove the goal and all its transactions permanently.

---

<p>
  <span style="float:left;">← Back: [[Debt Charts|Debt-Charts]]</span>
  <span style="float:right;">[[Reports]] →</span>
</p>
<div style="clear:both;"></div>
