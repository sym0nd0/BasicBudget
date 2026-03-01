# Contributing to BasicBudget

Thank you for your interest in contributing! Please read this guide before opening a PR.

## Prerequisites

- **Node.js** v20 or later
- **npm** v10 or later

## Local development setup

```bash
# 1. Install dependencies
npm install

# 2. Copy the example environment file and fill in values
cp .env.example .env

# 3. Start the development server (Vite on :5173 + Express on :3001)
npm run dev
```

The frontend proxies `/api/*` requests to the Express backend automatically in dev mode.

## Branch naming

All work must be on a named branch — direct pushes to `master` are not permitted.

| Type | Pattern | Example |
|---|---|---|
| Feature | `feature/<short-description>` | `feature/export-csv` |
| Bug fix | `fix/<short-description>` | `fix/login-redirect` |
| Documentation | `docs/<short-description>` | `docs/readme-docker` |
| Chore / config | `chore/<short-description>` | `chore/update-dependencies` |
| Refactor | `refactor/<short-description>` | `refactor/auth-middleware` |

## Pull request process

1. Fork the repository and create your branch from `master`.
2. Make your changes on the named branch.
3. Ensure TypeScript checks pass:
   ```bash
   node node_modules/typescript/bin/tsc -b --noEmit
   node node_modules/typescript/bin/tsc --project tsconfig.server.json --noEmit
   ```
4. Ensure the linter passes:
   ```bash
   node node_modules/.bin/eslint src server shared
   ```
5. Push your branch and open a Pull Request with a clear title and description.
6. PRs are squash-merged into `master`.

## Code style

- **Language**: UK English exclusively in all user-facing text, comments, commit messages, and documentation (e.g. colour, centre, organise, realise).
- **TypeScript**: strict mode; avoid `any`; cast through `unknown` when bridging SQLite rows to typed interfaces.
- **Money**: always stored and passed as integer pence — never floating-point pounds.
- **Linting**: ESLint with the project config (`eslint.config.js`).

## Commit message conventions

Use the [Conventional Commits](https://www.conventionalcommits.org/) style:

```
<type>: <short imperative summary>
```

Common types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`.

Examples:
- `feat: add CSV export for transactions`
- `fix: correct pence rounding in weekly recurring items`
- `docs: update README docker section`

## Reporting security vulnerabilities

Please **do not** open a public issue for security vulnerabilities. See [SECURITY.md](SECURITY.md) for the responsible disclosure process.
