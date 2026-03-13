# Getting Started

## Docker (Recommended)

The quickest way to run BasicBudget is with Docker Compose.

```yaml
services:
  basicbudget:
    image: ghcr.io/sym0nd0/basicbudget:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      SESSION_SECRET: your-long-random-secret
      TOTP_ENCRYPTION_KEY: your-32-char-hex-key
      APP_URL: https://budget.example.com
      CORS_ORIGIN: https://budget.example.com
      NODE_ENV: production
    volumes:
      - ./data:/app/data
```

Save this as `docker-compose.yml`, then run:

```bash
docker compose up -d
```

BasicBudget will be available at `http://localhost:3000` (or your configured `APP_URL`).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SESSION_SECRET` | Yes | Secret used to sign session cookies. Use a long random string (32+ characters). |
| `TOTP_ENCRYPTION_KEY` | Yes | 32-character hex string used to encrypt TOTP secrets at rest. Generate with `openssl rand -hex 32`. |
| `APP_URL` | Yes | Public URL of the application (e.g. `https://budget.example.com`). Used in email links and OIDC redirects. |
| `CORS_ORIGIN` | No | Allowed CORS origin. Defaults to `APP_URL` if not set. |
| `DB_PATH` | No | Path to the SQLite database file. Defaults to `data/basicbudget.db`. |
| `PORT` | No | Port the Express server listens on. Defaults to `3000`. |
| `NODE_ENV` | No | Set to `production` for production deployments. |

> **Security:** Never commit `SESSION_SECRET` or `TOTP_ENCRYPTION_KEY` to version control. Use Docker secrets, environment files excluded from git, or a secrets manager.

## First Login

1. Navigate to your BasicBudget URL.
2. Click **Register** and create the first account.
3. The first registered user is automatically assigned the **Admin** role.
4. Log in and explore the [Admin panel](Admin.md) to configure SMTP, OIDC, and user settings.

## Development Mode

To run BasicBudget locally without Docker:

**Prerequisites:** Node.js 20+

```bash
git clone https://github.com/sym0nd0/BasicBudget.git
cd BasicBudget
npm install
```

Create a `.env` file in the project root:

```env
SESSION_SECRET=dev-secret-change-me
TOTP_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
APP_URL=http://localhost:5173
NODE_ENV=development
```

Start the development servers (runs Vite on `:5173` and Express on `:3001`):

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.


---

| ← [[Home]] | | [[Dashboard]] → |
| :-- | --- | --: |