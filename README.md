# BasicBudget

BasicBudget is a self-hosted household budgeting app for tracking income, expenses, debts, savings goals, and month-by-month trends in one place.

For full setup instructions and complete documentation, see the [BasicBudget Wiki](docs/Home.md).

## ⚠️ AI-Generated Code Disclaimer ⚠️
This project was built using AI tools, including [Claude Code](https://claude.com/product/claude-code) and [OpenAI Codex](https://openai.com/codex/).

Although reviewed by a human, it hasn’t been fully tested or security audited and may contain bugs or vulnerabilities.
 
Please use it at your own risk. If you plan to deploy it publicly, make sure you review, test, and secure it appropriately.

## Key Features

- Multi-user households with owner/member roles and invite-based joining
- Income, expense, debt, and savings goal tracking
- Recurring monthly, weekly, fortnightly, yearly, and one-off entries where supported
- Month-based and range-based reporting with charts and comparisons
- Debt repayment schedules, payoff projections, and promotional rate periods
- Household-only view for jointly shared finances
- Email verification, password reset, active session management, TOTP 2FA, and optional OIDC SSO
- Runtime admin settings for SMTP, OIDC, expense categories, registration control, logging, backups, and audit log
- JSON export, CSV import, month locking, colour palette preferences, and date/time format preferences

## Table of Contents

- [Visual Overview](#visual-overview)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Running the App](#running-the-app)
- [How to Use](#how-to-use)
- [Project Structure](#project-structure)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Licence](#licence)

## Visual Overview

BasicBudget follows the sidebar flow: Dashboard, Income, Expenses, Debt, Savings, Reports, Household, Settings, and admin pages.

| Dashboard | Expenses |
|---|---|
| ![Dashboard](docs/screenshots/dashboard-dark.png) | ![Expenses](docs/screenshots/expenses-dark.png) |

| Debt | Reports |
|---|---|
| ![Debt](docs/screenshots/debt-dark.png) | ![Reports](docs/screenshots/reports-dark.png) |

| Settings | Admin Settings |
|---|---|
| ![Settings](docs/screenshots/settings-dark.png) | ![Admin Settings](docs/screenshots/admin-settings-dark.png) |

Full light and dark screenshot set: [docs/Screenshots.md](docs/Screenshots.md)

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React 19, TypeScript 6, Vite 8, React Router 7, Tailwind CSS 4 |
| Charts | Recharts 3 |
| Backend | Express 5, better-sqlite3, Zod 4 |
| Auth & Security | express-session, argon2, otpauth, openid-client, csrf-csrf, express-rate-limit, Helmet |
| Testing | Vitest 4, Supertest 7, Playwright 1 |
| Deployment | Docker, Docker Compose, GHCR |

## Getting Started

### Prerequisites

- Node.js 20 or newer
- npm

### Install

```bash
npm install
```

### Create `.env`

Copy `.env.example` to `.env` and set the required secrets:

```bash
cp .env.example .env
```

Minimum local setup:

```env
SESSION_SECRET=<at least 32 random characters>
TOTP_ENCRYPTION_KEY=<64 hex characters from openssl rand -hex 32>
APP_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
```

### First Run

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- API server: `http://localhost:3001`
- The first registered user becomes the system admin

## Configuration

The server validates these environment variables at startup.

| Variable | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | Yes | Signs session cookies |
| `TOTP_ENCRYPTION_KEY` | Yes | Encrypts stored TOTP secrets; must be exactly 64 hex characters |
| `APP_URL` | No | Public app URL used for email links |
| `CORS_ORIGIN` | No | Allowed origin for browser requests |
| `DB_PATH` | No | SQLite database path, default `data/basicbudget.db` |
| `LOG_LEVEL` | No | Bootstrap log level: `debug`, `info`, `warn`, `error` |
| `NODE_ENV` | No | `development`, `production`, or `test` |
| `PORT` | No | Server port for bare Node.js runs |
| `COOKIE_SECURE` | No | Override secure-cookie behaviour for plain HTTP deployments |

SMTP and OIDC are configured at runtime in **Admin → System Settings**. For backwards compatibility, legacy SMTP and OIDC environment variables are migrated into the database on first startup if those settings are still unset.

## Running the App

### Local development

```bash
npm run dev
```

### Production build

```bash
npm run build
npm start
```

This builds the frontend into `dist/`, the server into `dist-server/`, and starts Express in production mode.

### Docker Compose

BasicBudget ships with a `compose.yml` and a production Dockerfile.

```bash
docker compose pull
docker compose up -d
```

Important Docker behaviour:

- The container always listens on port `3000`
- The host port comes from `PORT` in `.env`, default `8080`
- Data is stored in the `bb-data` volume at `/app/data`
- `NODE_ENV` and `PORT` must not be added to the compose `environment` block because the image already sets them correctly

Container logs:

```bash
docker compose logs -f basicbudget
```

## How to Use

- **Dashboard**: review current-month or selected-range totals, outgoing trends, and expense breakdown.
- **Income**: add recurring or one-off income sources, set contributor, posting day, and gross/net status.
- **Expenses**: track spending by category, account, recurrence, and household split.
- **Debt**: store balances, APR, payments, overpayments, promotional rate periods, and inspect repayment schedules.
- **Savings**: manage goals, balances, monthly contributions, auto-contributions, and manual deposits or withdrawals.
- **Reports**: switch between preset or custom ranges to analyse income, expenses, debt, savings, categories, and debt payoff projections.
- **Household**: view joint household-only finances and rename the household if you are the owner.
- **Settings**: manage accounts, CSV import, JSON export, password, 2FA, sessions, household members, invites, appearance, and month locks.
- **Admin**: manage users, SMTP, OIDC, categories, registration, logging, backups, automated backups, and the audit log.

## Project Structure

```text
src/             React app, pages, components, hooks, and client-side utilities
server/          Express routes, auth, services, database setup, and validation
shared/          Shared TypeScript types
docs/            Wiki-style project documentation and screenshots
scripts/         Screenshot and demo-seed utilities
```

## Development

### Available scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start Vite and the watched Express server |
| `npm run build` | Build frontend and server |
| `npm start` | Run the production server |
| `npm run lint` | Lint the project |
| `npm test` | Run the test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run preview` | Preview the Vite build |
| `npm run screenshots` | Regenerate the tracked screenshot set |

### Type checking

In this repository’s Windows shell environment, use the full Node path:

```bash
"C:\Program Files\nodejs\node.exe" node_modules/typescript/bin/tsc -b --noEmit
"C:\Program Files\nodejs\node.exe" node_modules/typescript/bin/tsc --project tsconfig.server.json --noEmit
```

### Linting in this environment

```bash
"C:\Program Files\nodejs\node.exe" node_modules/eslint/bin/eslint.js src server shared
```

### Additional docs

- [docs/Getting-Started.md](docs/Getting-Started.md)
- [docs/Configuration.md](docs/Configuration.md)
- [docs/Development-Setup.md](docs/Development-Setup.md)
- [docs/API.md](docs/API.md)

## Troubleshooting

- If login or CSRF requests fail over plain HTTP, check `COOKIE_SECURE=false`. Secure cookies are rejected by browsers on non-HTTPS deployments.
- In Docker, `${PORT:-8080}:3000` maps the host port to the container’s fixed port `3000`. Changing `PORT` changes the host port, not the container port.
- The **Sign in with SSO** button only appears when OIDC has been configured in Admin settings.
- Restoring a backup onto an instance with a different `TOTP_ENCRYPTION_KEY` makes encrypted secrets unrecoverable. TOTP, SMTP passwords, and OIDC client secrets will need to be set up again.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All work must be done on a named branch and submitted through a pull request.

## Licence

This project is licensed under the [MIT Licence](LICENSE).
