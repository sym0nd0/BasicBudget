# Debt Charts

BasicBudget includes three charts focused on debt tracking, available on the [[Reports]] page.

## Debt Projection Line Chart

The Debt Projection chart shows the combined outstanding balance across all active debts, projected forward to the estimated payoff date.

- The x-axis shows months from the current date to the final payoff
- The y-axis shows the combined balance in pounds
- The line reaches zero at the projected payoff month

The projection is calculated using each debt's current balance, APR (and any active deal periods), minimum payment, and overpayment.

### Household Filter

On the [[Household]] page, the Debt Projection chart is filtered to household-only debts. On the [[Reports]] page, it reflects your personal debts.

## Debt-to-Income Ratio Chart

The Debt-to-Income Ratio chart shows the ratio of your total outstanding debt to your annual income over the selected time range.

- The x-axis shows months
- The y-axis shows the ratio as a percentage
- Lower values indicate a healthier debt position relative to income

### How It Is Calculated

```
Debt-to-Income Ratio = (Total outstanding debt ÷ Annual income) × 100
```

Where annual income is estimated from the monthly income total for each period multiplied by 12.

## Debt Payoff Timeline Chart

The Debt Payoff Timeline chart projects all your debts to £0 using either the **Snowball** (smallest balance first) or **Avalanche** (highest interest rate first) strategy. Toggle between strategies with the buttons above the chart.

- A thick line shows the combined total balance; thinner lines show individual debts
- A dashed vertical line marks the month when all debts reach £0
- Click **Show breakdown** to expand a month-by-month table of per-debt balances

See [[Debt Payoff Strategies|Debt-Payoff-Strategies]] for a full explanation of how freed minimum payments are reallocated between debts.

## Accessing Debt Charts

All three charts are on the **Reports** page, in the **Debt** section. Select a time range from the dropdown at the top of the page to adjust the period shown in the Debt-to-Income chart.

---

<p>
  <span style="float:left;">← Back: [[Debt Payoff Strategies|Debt-Payoff-Strategies]]</span>
  <span style="float:right;">[[Savings]] →</span>
</p>
<div style="clear:both;"></div>
