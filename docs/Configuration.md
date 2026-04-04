# Configuration

BasicBudget is configured through environment variables. Set these in your `compose.yml` environment block, a `.env` file, or your system environment.

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
| `LOG_LEVEL` | `info` | Bootstrap server log level: `debug`, `info`, `warn`, or `error`. Once Admin → System Settings → Logging is saved, the persisted DB value takes precedence immediately and after restarts. |
| `PORT` | `3001` | In Docker deployments, controls the **host** port via `compose.yml` (`${PORT:-8080}:3000`); the container always listens internally on port 3000. In bare Node.js, sets the Express listen port directly. |
| `NODE_ENV` | `development` | In Docker, always `production` (set by the Dockerfile — **do not override via `.env`**). In bare Node.js, controls whether Express serves static files and enables production security. |
| `COOKIE_SECURE` | auto-detected from `APP_URL` | Controls whether session and CSRF cookies carry the `Secure` flag. Automatically `true` when `APP_URL` starts with `https://` in production, `false` otherwise. **Set to `false` if your `APP_URL` is an `https://` domain but you also access the app over plain HTTP** (e.g. `http://192.168.1.x:8089`). Without this, browsers silently discard session and CSRF cookies on HTTP, causing login to fail with "Invalid CSRF token". A startup warning is logged when this mismatch is detected. |

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
