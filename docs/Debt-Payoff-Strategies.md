# Debt Payoff Strategies

BasicBudget provides tools to help you plan and accelerate debt repayment.

## Repayment Schedule

Click **View Schedule** on any debt to see a month-by-month projection table:

| Column | Description |
|---|---|
| **Month** | The calendar month. |
| **Opening Balance** | Balance at the start of the month. |
| **Interest** | Interest charged during the month. |
| **Payment** | Total payment made (minimum + overpayment). |
| **Closing Balance** | Balance at the end of the month. |

The schedule projects forward until the debt reaches zero.

## Payoff Summary

Below the schedule, a summary shows:

- **Months remaining** until the debt is paid off
- **Total interest** that will be paid over the repayment period
- **Projected payoff date**

## Overpayment

The **Overpayment** field in the debt form lets you specify an additional amount paid each month on top of the minimum. Increasing the overpayment reduces both the payoff time and the total interest paid.

**Example:** A £5,000 debt at 19.95% APR:

| Strategy | Minimum only | +£50/month | +£100/month |
|---|---|---|---|
| Months to pay off | ~72 | ~42 | ~30 |

To experiment with overpayments, edit the debt and adjust the Overpayment field. The repayment schedule updates immediately.

## Deal Periods

Deal Periods track promotional interest rates (e.g. 0% balance transfer offers). They override the standard APR for their active date range in repayment calculations.

### Adding a Deal Period

1. Open the debt's edit form.
2. Scroll to the **Deal Periods** section.
3. Click **Add Deal Period** and fill in the fields:

| Field | Description |
|---|---|
| **Deal Name** | A label for the deal (e.g. "0% BT Offer"). |
| **Interest Rate (%)** | The promotional APR during this period. |
| **Start Date** | When the promotional rate begins. |
| **End Date** | When the promotional rate expires. |
| **Email Reminder** | Enable to receive an email reminder before the deal expires. |
| **Reminder Days** | How many days before expiry to send the reminder. |

### Email Reminders

When Email Reminder is enabled, BasicBudget sends an email to your registered address the specified number of days before the deal period expires. This requires SMTP to be configured in the [[Admin]] panel.

### Effect on Repayment Schedule

During an active deal period, the repayment schedule uses the deal's interest rate instead of the standard APR. This is reflected in lower (or zero) interest charges for those months in the projection.

---

<table width="100%">
<tr>
<td align="left">&#8592; <a href="Adding-Debts">Adding Debts</a></td>
<td align="right"><a href="Debt-Charts">Debt Charts</a> &#8594;</td>
</tr>
</table>
