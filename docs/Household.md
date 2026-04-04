# Household

The Household feature allows multiple users to share a combined financial view. Household income, expenses, debts, and savings goals are visible to all members of the household.

## Household Concept

Each user belongs to one household. A household has:

- **One owner** — the user who created the household (or was assigned ownership).
- **One or more members** — users who have accepted an invitation to join.

The [Household summary page](/household) shows only items flagged as household items (income, expenses, debts, savings goals where the **Household** toggle is enabled).

## Roles

| Role | Capabilities |
|---|---|
| **Owner** | Can rename the household from the Household page, and invite members, rescind invites, change roles, and remove members from Settings. |
| **Member** | Can view household data and add household-flagged items. Cannot manage membership. |

## Inviting Members

1. Go to **Settings** → **Household**.
2. Enter the email address of the person you want to invite.
3. Click **Invite**.

An invitation email is sent with a unique link valid for **7 days**.

Invite links are bound to the invited email address. If you sign in with a different account, the invite will be rejected and the token remains unused.

## Accepting an Invite

- **Existing users:** Click the link in the invitation email. You will be asked to confirm joining the household.
- **New users:** Click the link and register a new account. You will be automatically added to the household upon registration.

If an invite expires, the owner must send a new one.

## Removing Members / Leaving

- **Owner removing a member:** Go to **Settings** → **Household**, load the members list, and click **Remove**.
- **Member leaving:** Ask a household owner to remove your account.

When a member leaves or is removed, their personal items are moved into a new one-person household and their existing sessions are revoked. Household-shared items remain in the original household.

## Household Summary Page

The `/household` page shows an aggregated view of all household-flagged items and excludes personal items:

- **Summary cards** — total income, shared expenses, debt payments, total outgoing, per-member outgoing, and disposable income
- **Charts** — income vs outgoings, expense breakdown, and a debt projection filtered to household-only debts
- **Household name** — owners can rename the household from the page header
- **Filters** — use the filter bar to switch between a single month, preset ranges, or a custom from/to range

---

<p>
  <span style="float:left;">← Back: [[Recurring Expenses|Recurring-Expenses]]</span>
  <span style="float:right;">[[Debt]] →</span>
</p>
<div style="clear:both;"></div>
