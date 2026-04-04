# Manual Setup

Use this guide to run BasicBudget locally without Docker, for development or in environments where Docker is not available.

## Prerequisites

- Node.js 20+ and npm 9+
- Git
- See [[System Requirements\|System-Requirements]] for full details

## Clone and Install

```bash
git clone https://github.com/sym0nd0/BasicBudget.git
cd BasicBudget
npm install
```

## Create a `.env` File

Create a `.env` file in the project root:

```env
SESSION_SECRET=dev-secret-change-me
TOTP_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
APP_URL=http://localhost:5173
NODE_ENV=development
LOG_LEVEL=debug
```

> **Security:** Never use these placeholder values in a production environment. See [[Configuration]] for how to generate secure keys.

## Start Development Servers

```bash
npm run dev
```

This starts two processes concurrently:

| Process | Port | Description |
|---|---|---|
| **Vite dev server** | `:5173` | Frontend with hot module replacement |
| **Express API server** | `:3001` | Backend API with tsx watch |

Open `http://localhost:5173` in your browser.

Server logs are written as JSON lines to stdout/stderr in the terminal. Set `LOG_LEVEL=debug` for verbose diagnostics until the Admin logging setting is saved.

## Build for Production

```bash
npm run build
```

This produces:
- `dist/` — compiled frontend assets
- `dist-server/` — compiled server code

Run the production build:

```bash
npm start
```

The Express server serves both the frontend static files and the API on port 3000.

## Environment Variables

See [[Configuration]] for a full list of supported environment variables.

## Next Steps

After starting, follow the [[Getting Started\|Getting-Started]] guide to register the first user and configure the application.

---

<p>
  <span style="float:left;">← Back: [[Docker Setup|Docker-Setup]]</span>
  <span style="float:right;">[[Configuration]] →</span>
</p>
<div style="clear:both;"></div>
