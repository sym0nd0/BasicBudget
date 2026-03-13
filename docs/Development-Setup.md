# Development Setup

This guide is for contributors and developers who want to run BasicBudget locally and make changes to the codebase.

## Prerequisites

- Node.js 20+ and npm 9+
- Git
- A code editor (VS Code recommended)

## Clone and Install

```bash
git clone https://github.com/sym0nd0/BasicBudget.git
cd BasicBudget
npm install
```

## Create a `.env` File

```env
SESSION_SECRET=dev-secret-change-me
TOTP_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
APP_URL=http://localhost:5173
NODE_ENV=development
```

## Start Development Servers

```bash
npm run dev
```

This starts two processes concurrently via `concurrently`:

| Process | Port | Description |
|---|---|---|
| **Vite dev server** | `:5173` | Frontend with hot module replacement |
| **Express API server** | `:3001` | Backend with `tsx watch` for auto-reload |

Open `http://localhost:5173` in your browser.

## TypeScript Checks

Run type checking without emitting files:

```bash
# Frontend (tsconfig.json references)
"/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc -b --noEmit

# Server
"/c/Program Files/nodejs/node.exe" node_modules/typescript/bin/tsc --project tsconfig.server.json --noEmit
```

## Linting

```bash
"/c/Program Files/nodejs/node.exe" node_modules/.bin/eslint src server shared
```

## Tests

```bash
npm test
```

See [[Testing]] for details.

## Build

```bash
npm run build
```

Produces:
- `dist/` — compiled frontend
- `dist-server/` — compiled server

Run the production build locally:

```bash
npm start
```

---

<p>
  <span style="float:left;">← Back: [[Resetting the Application|Resetting-the-Application]]</span>
  <span style="float:right;">[[Project Structure|Project-Structure]] →</span>
</p>
<div style="clear:both;"></div>
