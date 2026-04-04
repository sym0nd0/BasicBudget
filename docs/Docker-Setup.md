# Docker Setup

Docker is the recommended way to run BasicBudget in production.

## Prerequisites

- Docker Engine 20.10+ with the Compose plugin (`docker compose`)
- See [[System Requirements\|System-Requirements]] for full details

## Quick Start

Create a `compose.yml` file:

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
      LOG_LEVEL: info
      NODE_ENV: production
    volumes:
      - ./data:/app/data
```

Start the container:

```bash
docker compose up -d
```

BasicBudget will be available at `http://localhost:3000` (or your configured `APP_URL`).

View container logs with:

```bash
docker compose logs -f basicbudget
```

Set `LOG_LEVEL=debug` for verbose first-start diagnostics. After the Admin logging setting is saved, the DB value takes precedence.

## Data Persistence

The `./data:/app/data` volume mount stores the SQLite database on your host machine. This ensures data survives container restarts and updates.

> **Important:** Always use a named volume or bind mount. If you omit the volume, your data will be lost when the container is removed.

## Generating Secret Keys

Generate a secure `SESSION_SECRET`:

```bash
openssl rand -hex 32
```

Generate the `TOTP_ENCRYPTION_KEY` (must be exactly 64 hex characters):

```bash
openssl rand -hex 32
```

## Reverse Proxy

For HTTPS, place a reverse proxy in front of BasicBudget. Example with Caddy:

```
budget.example.com {
    reverse_proxy localhost:3000
}
```

Set `APP_URL` to your public HTTPS URL and `CORS_ORIGIN` to match.

## Environment Variables

See [[Configuration]] for a full list of supported environment variables.

## Next Steps

After starting the container, follow the [[Getting Started\|Getting-Started]] guide to register the first user and configure the application.

---

<p>
  <span style="float:left;">← Back: [[System Requirements|System-Requirements]]</span>
  <span style="float:right;">[[Manual Setup|Manual-Setup]] →</span>
</p>
<div style="clear:both;"></div>
