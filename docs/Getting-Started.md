# Getting Started

After installing BasicBudget (see [[Docker Setup\|Docker-Setup]] or [[Manual Setup\|Manual-Setup]]), follow these steps to set up the application for first use.

## Register the First Account

1. Navigate to your BasicBudget URL.
2. Click **Register** and create an account with your email address, display name, and a password.
3. The **first user to register** is automatically assigned the **Admin** role.

> If the application is already configured with registration disabled, you will need an invitation link.

## First Login

1. Enter your email and password on the login page.
2. You are taken to the Dashboard.

## Admin Setup

As the first user (and admin), configure the application before inviting others:

1. Open the **Admin** panel from the sidebar.
2. Configure **SMTP** if you want email features (invitations, 2FA alerts, debt reminders). See [[Admin]] → SMTP Configuration.
3. Optionally configure **OIDC** for single sign-on. See [[Admin]] → OIDC Configuration.
4. Review **Expense Categories** and add or remove categories to match your budget. See [[Budget Categories\|Budget-Categories]].
5. Set **Registration Control** — disable public registration once all household members have joined if desired.

## Invite Household Members

If you share finances with others, invite them from the Household page:

1. Go to **Household** in the sidebar.
2. Enter the email address of the person you want to invite.
3. Click **Send Invite**.

They will receive an email with a link valid for 7 days.

## Next Steps

- Follow the [[Creating Your First Budget\|Creating-Your-First-Budget]] walkthrough to add your first income and expenses.
- Set up [[Adding Accounts\|Adding-Accounts]] for your payment accounts.

---

<table width="100%">
<tr>
<td align="left">&#8592; <a href="Updating-BasicBudget">Updating BasicBudget</a></td>
<td align="right"><a href="Creating-Your-First-Budget">Creating Your First Budget</a> &#8594;</td>
</tr>
</table>
