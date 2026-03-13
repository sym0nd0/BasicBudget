# Admin Panel

The Admin panel is accessible to users with the **Admin** role. The first user to register is automatically an admin. Additional admins can be assigned via the User Management section.

Navigate to the Admin panel from the sidebar under **Admin**.

## User Management

The Users table lists all registered accounts.

| Action | Description |
|---|---|
| **Change Role** | Promote a user to Admin or demote to standard user. |
| **Lock Account** | Prevent the user from logging in. Useful for suspended accounts. |
| **Unlock Account** | Re-enable a locked account (including accounts locked by failed login attempts). |
| **Remove 2FA** | Immediately remove two-factor authentication from a user's account. |
| **Delete User** | Permanently delete the user and all their data. This cannot be undone. |

## SMTP Configuration

Configure an outgoing email server so BasicBudget can send account-related emails (invitations, 2FA alerts, debt deal reminders).

| Field | Description |
|---|---|
| **Host** | SMTP server hostname (e.g. `smtp.example.com`) |
| **Port** | SMTP port (typically `587` for STARTTLS or `465` for SSL) |
| **Username** | SMTP authentication username |
| **Password** | SMTP authentication password |
| **From Address** | The "From" address shown on sent emails |
| **From Name** | The display name shown on sent emails |
| **Secure** | Enable for SSL/TLS connections (port 465) |

Click **Test Email** to send a test message to your admin account and verify the configuration.

## OIDC Configuration

Configure an OpenID Connect identity provider to enable Single Sign-On (SSO) for all users.

| Field | Description |
|---|---|
| **Issuer URL** | The OIDC provider's issuer URL (e.g. `https://accounts.google.com`) |
| **Client ID** | The client ID from your OIDC provider's application registration |
| **Client Secret** | The client secret from your OIDC provider's application registration |

The redirect URI to register with your OIDC provider is shown on this page. It follows the pattern `{APP_URL}/api/auth/oidc/callback`.

After saving, the SSO button appears on the login page.

## Expense Categories

Manage the categories available for expense entries.

| Action | Description |
|---|---|
| **Add Category** | Create a new expense category. |
| **Remove Category** | Delete a category. Expenses in that category will become uncategorised. |
| **Reorder** | Drag categories to change the order they appear in dropdowns. |
| **Reset to Defaults** | Restore the default set of categories. This does not affect existing expense assignments. |

## Registration Control

Toggle whether new users can register themselves.

- **Enabled** — Anyone with the URL can create an account.
- **Disabled** — Registration is closed. New users can only join via invitation links sent by an admin or household owner.

## Log Level

Set the verbosity of server-side logging:

| Level | Description |
|---|---|
| **debug** | Verbose output including request details. Use for troubleshooting. |
| **info** | Standard operational messages (default). |
| **warn** | Warnings and potential issues only. |
| **error** | Errors only. |

## Audit Log

The Audit Log records significant actions performed by all users.

- **Pagination** — Navigate through log entries with previous/next controls.
- **Filter by action** — Select an action type from the dropdown to narrow the list.
- **Filter by user** — Select a specific user to see only their actions.
- **Expandable rows** — Click any row to expand it and see the full detail payload for that event.

---

<p>
  <span style="float:left;">← Back: [[Authentication]]</span>
  <span style="float:right;">[[Troubleshooting]] →</span>
</p>
<div style="clear:both;"></div>
