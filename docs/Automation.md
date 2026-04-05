# Automation

BasicBudget automates several repetitive budgeting tasks so you can focus on reviewing rather than re-entering data every month.

## Recurring Transactions

The most powerful automation in BasicBudget is the recurring engine. Instead of adding income and expense entries every month, you add them once with a recurrence type:

- **Monthly** entries automatically appear in every month within their start/end date range.
- **Weekly** and **Fortnightly** entries appear in every month with their amount automatically multiplied by the number of occurrences.

**Example workflow:**
1. Add your salary once as a Monthly income entry.
2. Add your rent once as a Monthly expense entry.
3. Every month, they both appear automatically — no manual re-entry needed.

See [[Recurring Expenses\|Recurring-Expenses]] for full details on recurrence types and behaviour.

## Month Locking

After reviewing a past month, lock it to prevent accidental changes:

1. Go to **Settings** → **Month Locking**.
2. Select the month and click **Lock**.

Locked months cannot have income, expenses, debts, or savings updated. The current month and future months cannot be locked.

This effectively creates an immutable historical record, which is useful for year-end reviews and tax preparation.

## Deal Period Reminders

If you have a debt with a promotional interest rate (e.g. a 0% balance transfer), you can set an email reminder:

1. Open the debt's edit form.
2. Add a **Deal Period** with an end date.
3. Set **Deal Period Reminder** to the number of months before expiry when you want the email to be sent.

BasicBudget sends the email automatically when the reminder date arrives, provided SMTP is configured.

See [[Debt Payoff Strategies\|Debt-Payoff-Strategies]] for details.

## New Device Login Alerts

BasicBudget automatically sends an email alert when you log in from a new device. No configuration is needed beyond SMTP setup. See [[Admin]] → SMTP Configuration.

---

<p>
  <span style="float:left;">← Back: [[Exporting Data|Exporting-Data]]</span>
  <span style="float:right;">[[Data Import|Data-Import]] →</span>
</p>
<div style="clear:both;"></div>
