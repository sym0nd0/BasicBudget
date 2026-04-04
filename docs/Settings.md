# Settings

The Settings page lets you manage payment accounts, import/export, appearance, security, household membership, and month locking.

## Payment Accounts

Payment accounts represent the bank accounts, credit cards, or wallets you use to pay expenses. See [[Adding Accounts\|Adding-Accounts]] for full details.

| Action | Description |
|---|---|
| **Add Account** | Create a new account with a name and optional joint-account flag. |
| **Edit Account** | Update the name or joint-account flag for an existing account. |
| **Delete Account** | Remove an account. Expenses linked to it will become unassigned. |
| **Joint Account** | Mark an account as visible to all household members. |

## Month Locking

Month locking prevents accidental edits to historical data.

- **Lock a month** — Select a past month and click **Lock**. Locked months cannot have income, expenses, debts, or savings updated.
- **Unlock a month** — Select a locked month and click **Unlock** to re-enable editing.

The current month and future months cannot be locked.

## CSV Import

Bulk-import financial data from a CSV file. See [[Importing Data\|Importing-Data]] for how to use the import tool, and [[Data Import\|Data-Import]] for full column specifications.

## JSON Export

Click **Export JSON** to download a JSON export of your accounts, income, expenses, debts, savings goals, and month locks. See [[Exporting Data\|Exporting-Data]] for details.

## Colour Blindness Palettes

Choose a chart colour palette optimised for different types of colour vision. See [[Customisation]] for details.

## Date & Time

Choose your preferred date and time display format. These settings apply to all date and time values shown across the application.

- **Date format** — `DD/MM/YYYY` (default), `MM/DD/YYYY`, or `YYYY-MM-DD`
- **Time format** — `12-hour` (e.g. 2:30 PM) or `24-hour` (e.g. 14:30)

## Theme

Choose between **Light**, **Dark**, or **System** (follows your operating system preference). See [[Customisation]] for details.

## Security

- **Change Password** — Enter your current password and a new password.
- **Set up 2FA** — Scan a QR code with an authenticator app, confirm a 6-digit code, and save the one-time recovery codes.
- **Reset 2FA** — Disable 2FA by entering your password plus an OTP or recovery code.
- **Lost access to authenticator** — Request a delayed reset email link that becomes usable after 24 hours.
- **Active Sessions** — View current sessions and revoke any session except the one you are currently using.

## Household

- **View members** — Load the current household member list.
- **Change roles** — Household owners can switch members between Owner and Member.
- **Remove members** — Household owners can remove a member; the member's private data is moved into a new one-person household and their sessions are revoked.
- **Invite Member** — Household owners can invite a new member by email and rescind outstanding invites.

---

<p>
  <span style="float:left;">← Back: [[Backup and Restore|Backup-and-Restore]]</span>
  <span style="float:right;">[[Authentication]] →</span>
</p>
<div style="clear:both;"></div>
