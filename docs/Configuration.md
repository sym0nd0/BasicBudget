# Configuration

BasicBudget is configured through environment variables. Set these in your `docker-compose.yml` environment block, a `.env` file, or your system environment.

## Required Variables

| Variable | Description |
|---|---|
| `SESSION_SECRET` | Secret used to sign session cookies. Use a long random string (32+ characters). Generate with `openssl rand -hex 32`. |
| `TOTP_ENCRYPTION_KEY` | 64-character hex string used to encrypt TOTP secrets at rest. Generate with `openssl rand -hex 32`. |

## Optional Variables

| Variable | Default | Description |
|---|---|---|
| `APP_URL` | `http://localhost:5173` | Public URL of the application (e.g. `https://budget.example.com`). Used in email links and OIDC redirects. No trailing slash. |
| `CORS_ORIGIN` | Same as `APP_URL` | Allowed CORS origin. Override if your frontend is served from a different URL. |
| `DB_PATH` | `data/basicbudget.db` | Path to the SQLite database file. |
| `PORT` | `3001` | Port the Express server listens on. |
| `NODE_ENV` | `development` | Set to `production` for production deployments. Enables production optimisations and stricter security. |
| `COOKIE_SECURE` | `true` in production, `false` otherwise | Override cookie security. Set to `false` when `APP_URL` is `http://` — a startup warning fires if this may be needed. |

## SMTP and OIDC

SMTP and OIDC settings are configured at runtime through the [[Admin]] panel, not environment variables. They are stored in the database and take effect immediately without a server restart.

For backwards compatibility, the following environment variables are still read on first startup and seeded into the database if the settings table is empty:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_FROM_NAME`, `SMTP_SECURE`
- `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`

After the first startup, these env vars are ignored. Use the Admin panel to manage these settings.

## Security Notes

> **Never commit `SESSION_SECRET` or `TOTP_ENCRYPTION_KEY` to version control.** Use Docker secrets, environment files excluded from git, or a secrets manager.

If you lose the `TOTP_ENCRYPTION_KEY`, all users with TOTP 2FA enabled will be unable to log in. Store it securely.

---

<p>
  <span style="float:left;">← Back: [[Manual Setup|Manual-Setup]]</span>
  <span style="float:right;">[[Updating BasicBudget|Updating-BasicBudget]] →</span>
</p>
<div style="clear:both;"></div>
