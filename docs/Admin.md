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
| **Secure** | Enable for SSL/TLS connections (port 465) |

Click **Send test email** to send a test message to your admin account and verify the configuration.

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

`LOG_LEVEL` in the environment is only the bootstrap default. After this setting is saved in the Admin panel, the persisted database value takes precedence immediately and after restarts. Logs are emitted as JSON lines to stdout/stderr so `docker compose logs -f basicbudget` captures them directly.

## Database Backup

The Database Backup section lets you export or restore a full backup of the entire BasicBudget instance — all users, households, budget data, and system settings.

### Downloading a Backup

Click **Download Backup** to download a JSON file containing all data from the database. The file is named `basicbudget-backup-YYYY-MM-DD.json`.

The backup includes all persistent data (19 tables). Ephemeral data — active login sessions, one-time password replay tokens, and password reset tokens — is excluded. These are short-lived and have no value in a backup.

### Restoring from a Backup

1. Select the backup JSON file using the file picker.
2. Click **Restore Backup**.
3. Confirm the warning dialog — this operation permanently replaces **all** existing data and cannot be undone.
4. After a successful restore, all active sessions are invalidated and all users (including you) are logged out. You will be redirected to the login page after three seconds.

> **Note on encrypted secrets:** TOTP two-factor authentication secrets, the SMTP password, and the OIDC client secret are encrypted at rest using the `TOTP_ENCRYPTION_KEY` environment variable. If you restore a backup on an instance with a **different** `TOTP_ENCRYPTION_KEY`, those encrypted values will be unrecoverable. Affected users will need to re-enrol their 2FA and the admin will need to re-enter the SMTP and OIDC credentials.

### Use Cases

| Use case | Description |
|---|---|
| **Instance migration** | Move BasicBudget to a new server or fresh Docker container |
| **Disaster recovery** | Restore data after accidental deletion or a failed upgrade |
| **Testing** | Snapshot and restore a known-good state during development |

### Automated Backups

> **Requires Admin role.** Available from **Admin → System Settings → Database Backup**.

The automated backup scheduler runs in the background and saves JSON backup files to the server's `data/backups/` directory on a configurable schedule.

| Setting | Description | Range |
|---|---|---|
| **Enable automated backups** | Turns the scheduler on or off | On / Off |
| **Backup interval (hours)** | How often a backup is created | 1–720 hours |
| **Maximum backups to keep** | Oldest files are pruned when the limit is exceeded | 1–100 |

Automated backup files use the format `basicbudget-auto-backup-YYYY-MM-DDTHH-MM-SS.json` and are identical in structure to manually downloaded backups. They can be restored using the standard **Restore Backup** function.

The status display shows:
- **Backups stored** — number of automated backup files currently on disk
- **Last backup** — timestamp of the most recent automated backup
- **Next backup** — scheduled time for the next automated backup

> **Note:** The `data/backups/` directory is located alongside the database file. When running in Docker, this directory is inside the volume mounted at `/app/data/`. Ensure sufficient disk space is available for the configured number of backups.

## Audit Log

The Audit Log records significant actions performed by all users.

- **Pagination** — Navigate through log entries with previous/next controls.
- **Filter by action** — Enter an action name such as `login_success`.
- **Filter by user** — Enter a user ID to show only that user's actions.
- **Expandable rows** — Click any row to expand it and see the full detail payload for that event.

---

<p>
  <span style="float:left;">← Back: [[Authentication]]</span>
  <span style="float:right;">[[Troubleshooting]] →</span>
</p>
<div style="clear:both;"></div>
