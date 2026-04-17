# API

BasicBudget exposes a REST API used by its own frontend. You can use this API to build integrations, scripts, or automation. Most endpoints require an authenticated session cookie obtained by logging in. Public or pre-authentication exceptions include `/api/health`, `/api/version`, `/api/invite/info`, `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/verify-email`, `/api/auth/status`, `/api/auth/csrf-token`, `/api/auth/registration-status`, `/api/auth/oidc/enabled`, `/api/auth/oidc/login`, `/api/auth/oidc/callback`, `/api/auth/totp/verify`, `/api/auth/totp/verify-recovery`, and `/api/auth/totp/confirm-reset`.

## Base URL

```
http://localhost:3000/api
```

Replace `localhost:3000` with your instance's URL.

## Authentication

Most API requests require an active authenticated session. Log in via `POST /api/auth/login` to obtain a session cookie, then include it in subsequent requests. Public or pre-authentication exceptions are listed in the introduction above.

```bash
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"yourpassword"}'
```

## CSRF Protection

All mutating requests (POST, PUT, DELETE) must include a valid CSRF token in the `x-csrf-token` header. Obtain the token by calling `GET /api/auth/csrf-token`.

```bash
# Get CSRF token
curl -b cookies.txt http://localhost:3000/api/auth/csrf-token

# Use it in a mutating request
curl -b cookies.txt -X POST http://localhost:3000/api/incomes \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: <token>" \
  -d '{"name":"Salary","amount_pence":250000,...}'
```

## Auth Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new account |
| `POST` | `/api/auth/login` | Log in and receive a session cookie |
| `POST` | `/api/auth/logout` | Log out and destroy the session |
| `POST` | `/api/auth/forgot-password` | Request a password reset email |
| `POST` | `/api/auth/reset-password` | Complete password reset via token |
| `POST` | `/api/auth/verify-email` | Verify email address via token |
| `GET` | `/api/auth/status` | Check authentication status |
| `GET` | `/api/auth/csrf-token` | Get the CSRF token for the current session |
| `GET` | `/api/auth/registration-status` | Check whether public registration is enabled |

## TOTP (Two-Factor Authentication) Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/totp/setup` | Begin TOTP setup — returns QR code and secret |
| `POST` | `/api/auth/totp/verify-setup` | Complete TOTP setup by confirming a valid code |
| `POST` | `/api/auth/totp/verify` | Verify TOTP code during login |
| `POST` | `/api/auth/totp/verify-recovery` | Verify a recovery code during login |
| `POST` | `/api/auth/totp/disable` | Disable TOTP (requires current password) |
| `POST` | `/api/auth/totp/request-reset` | Request a delayed TOTP reset email link |
| `POST` | `/api/auth/totp/confirm-reset` | Confirm delayed TOTP reset via token + password |

## OIDC (Single Sign-On) Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/auth/oidc/enabled` | Check whether OIDC SSO is configured and enabled |
| `GET` | `/api/auth/oidc/login` | Initiate the OIDC login flow |
| `GET` | `/api/auth/oidc/callback` | OIDC provider callback |
| `POST` | `/api/auth/oidc/link` | Link an OIDC account to the current user |
| `DELETE` | `/api/auth/oidc/unlink` | Unlink an OIDC account (requires local password) |

## Profile Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/auth/profile` | Get current user profile |
| `PUT` | `/api/auth/profile` | Update display name |
| `PUT` | `/api/auth/profile/palette` | Set colour blindness palette |
| `PUT` | `/api/auth/profile/datetime-format` | Set date and time format preferences |
| `PUT` | `/api/auth/profile/notify-updates` | Toggle version update notifications |
| `POST` | `/api/auth/profile/change-password` | Change password (requires current password) |
| `POST` | `/api/auth/profile/change-email` | Request email change |
| `POST` | `/api/auth/profile/confirm-email-change` | Confirm email change via token |
| `POST` | `/api/auth/profile/resend-verification` | Resend email verification token |

## Session Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/auth/sessions` | List active sessions |
| `DELETE` | `/api/auth/sessions/:sid` | Revoke a session |

## Household Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/household` | Get household details and member list |
| `PUT` | `/api/household` | Update household name (owner only) |
| `POST` | `/api/household/invite` | Send a household invite (owner only) |
| `GET` | `/api/household/invites` | List active invites (owner only) |
| `DELETE` | `/api/household/invites/:id` | Rescind an invite (owner only) |
| `POST` | `/api/household/accept-invite` | Accept an invite and join the household (token email must match current user) |
| `GET` | `/api/household/summary` | Household-level budget overview |
| `PUT` | `/api/household/members/:userId/role` | Change a member's role (owner only) |
| `DELETE` | `/api/household/members/:userId` | Remove a member or leave the household; private items move to a new solo household and sessions are revoked |

## Income Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/incomes?month=YYYY-MM` | List income entries active for the given month |
| `POST` | `/api/incomes` | Create a new income entry |
| `PUT` | `/api/incomes/:id` | Update an existing income entry |
| `DELETE` | `/api/incomes/:id` | Delete an income entry |

## Expense Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/expenses?month=YYYY-MM` | List expense entries active for the given month |
| `POST` | `/api/expenses` | Create a new expense entry |
| `PUT` | `/api/expenses/:id` | Update an existing expense entry |
| `DELETE` | `/api/expenses/:id` | Delete an expense entry |

## Debt Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/debts` | List all debt entries |
| `POST` | `/api/debts` | Create a new debt entry |
| `PUT` | `/api/debts/:id` | Update an existing debt entry |
| `DELETE` | `/api/debts/:id` | Delete a debt entry |
| `GET` | `/api/debts/:id/repayments` | Get the repayment schedule for a debt |

## Savings Goals Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/savings-goals` | List all savings goals |
| `POST` | `/api/savings-goals` | Create a new savings goal |
| `POST` | `/api/savings-goals/process-auto-contributions` | Catch up scheduled auto-contributions |
| `PUT` | `/api/savings-goals/:id` | Update an existing savings goal |
| `DELETE` | `/api/savings-goals/:id` | Delete a savings goal |
| `GET` | `/api/savings-goals/transactions` | List all savings transactions |
| `GET` | `/api/savings-goals/:id/transactions` | List transactions for a specific goal |
| `POST` | `/api/savings-goals/:id/transactions` | Create a deposit or withdrawal |

## Month Lock Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/months` | List locked months |
| `POST` | `/api/months/:ym/lock` | Lock a month (prevent edits) |
| `DELETE` | `/api/months/:ym/lock` | Unlock a month |

## Reports Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/reports/overview?from=YYYY-MM&to=YYYY-MM` | Overview summary for a date range |
| `GET` | `/api/reports/upcoming-bills?month=YYYY-MM` | Upcoming outgoing bills for one month |
| `GET` | `/api/reports/debt-projection?household_only=true` | Debt projection data |
| `GET` | `/api/reports/debt-payoff-timeline?strategy=snowball&household_only=false` | Per-debt payoff timeline projection |

## Import / Export Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/import/csv` | CSV import (expenses, incomes, debts, savings goals) |
| `GET` | `/api/export/json` | JSON export of all user data |

## Other Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/summary` | Dashboard summary with category breakdown |
| `GET` | `/api/accounts` | List payment accounts |
| `POST` | `/api/accounts` | Create a payment account |
| `PUT` | `/api/accounts/:id` | Update a payment account |
| `DELETE` | `/api/accounts/:id` | Delete a payment account |
| `GET` | `/api/categories` | List expense categories |
| `GET` | `/api/version` | Current and latest version info |
| `GET` | `/api/health` | Health check |

## Admin Endpoints (requires `system_role = 'admin'`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/users` | List all users (paginated) |
| `GET` | `/api/admin/users/:id` | Get single user detail |
| `PUT` | `/api/admin/users/:id/role` | Change system role (`admin`/`user`) |
| `PUT` | `/api/admin/users/:id/lock` | Lock or unlock an account |
| `DELETE` | `/api/admin/users/:id` | Delete a user and all associated data |
| `GET` | `/api/admin/settings/smtp` | Get SMTP config (password masked) |
| `PUT` | `/api/admin/settings/smtp` | Update SMTP settings |
| `POST` | `/api/admin/settings/smtp/test` | Send a test email to the current admin |
| `GET` | `/api/admin/settings/oidc` | Get OIDC config (secret masked) |
| `PUT` | `/api/admin/settings/oidc` | Update OIDC settings |
| `GET` | `/api/admin/settings/categories` | Get expense categories |
| `PUT` | `/api/admin/settings/categories` | Set custom categories |
| `DELETE` | `/api/admin/settings/categories` | Reset categories to defaults |
| `GET` | `/api/admin/settings/logging` | Get log level |
| `PUT` | `/api/admin/settings/logging` | Set log level |
| `GET` | `/api/admin/settings/registration` | Get registration status |
| `PUT` | `/api/admin/settings/registration` | Enable/disable public registration |
| `GET` | `/api/admin/settings/backup` | Get automated backup configuration and status |
| `PUT` | `/api/admin/settings/backup` | Update automated backup configuration |
| `GET` | `/api/admin/audit-log` | Paginated audit log with filters |
| `GET` | `/api/admin/backup` | Download full database backup as JSON |
| `POST` | `/api/admin/backup/restore` | Restore from backup file (`multipart/form-data`, field `file`) |

## Request and Response Format

- Request bodies use `Content-Type: application/json`.
- Monetary values in request bodies are in **pence** (integers).
- Monetary values in responses are in **pence** (integers).
- Date fields use `YYYY-MM` format for month references.

---

<p>
  <span style="float:left;">← Back: [[Data Import|Data-Import]]</span>
  <span style="float:right;">[[Customisation]] →</span>
</p>
<div style="clear:both;"></div>
