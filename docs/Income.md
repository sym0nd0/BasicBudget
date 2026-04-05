# Income

The Income page lists all income entries active for the selected month. Entries can be recurring (salary, pension, rental income) or one-off.

## Adding Income

Click **Add Income** to open the form. Fill in the fields and click **Save**.

## Fields

| Field | Description |
|---|---|
| **Name** | A label for the income source (e.g. "Salary", "Freelance"). |
| **Amount** | The income amount in pounds. |
| **Posting Day** | The day of the month the income is received (1–31). |
| **Contributor** | The household member this income belongs to. |
| **Household** | Tick **Household income** to set `is_household = true` and include the entry in `/household`. |
| **Gross / Net** | Toggle whether the amount is gross (before tax) or net (take-home). |
| **Recurrence** | How often the income occurs: One-off, Monthly, Weekly, Yearly, or Fortnightly. |
| **Start Date** | The first date this income is active. Leave blank for "always". |
| **End Date** | The last date this income is active. Leave blank for "ongoing". |
| **Notes** | Optional free-text notes. |

## Recurrence Behaviour

| Type | Behaviour |
|---|---|
| **One-off** | Appears only in the month matching its posting date. |
| **Monthly** | Appears every month within the start/end date range. |
| **Weekly** | Amount is multiplied by the number of Mondays (or the configured day) in the selected month. |
| **Yearly** | Appears once per year in the month matching the start date. |
| **Fortnightly** | Amount is multiplied by the number of fortnightly occurrences in the selected month. |

## Editing and Deleting

Click the **edit icon** on any row to update an entry. Click the **delete icon** to remove it permanently.

## Household Income

Income assigned to a contributor appears under that household member's name. The [Household page](/household) only includes income entries where `is_household = true`. You set this flag in the Income add/edit form by ticking **Household income** before saving.

---

<p>
  <span style="float:left;">← Back: [[Budget Categories|Budget-Categories]]</span>
  <span style="float:right;">[[Expenses]] →</span>
</p>
<div style="clear:both;"></div>
