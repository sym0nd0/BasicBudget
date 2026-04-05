# AGENTS.md

BasicBudget is a React 19 + Vite frontend with an Express 5 + SQLite backend. Shared API and domain contracts live in `shared/types.ts`.

## Commands

- `npm run dev` starts Vite and the watched Express server.
- `npm run build` builds the frontend into `dist/` and the server into `dist-server/`.
- `npm run lint` runs ESLint.
- `npm test` runs the Vitest suite.
- Frontend type-check in this Windows shell: `"C:\Program Files\nodejs\node.exe" node_modules/typescript/bin/tsc -b --noEmit`
- Server type-check in this Windows shell: `"C:\Program Files\nodejs\node.exe" node_modules/typescript/bin/tsc --project tsconfig.server.json --noEmit`

## Always Apply

- Use UK English in UI text, comments, docs, commit messages, and PR text.
- Inspect the relevant code and docs before changing behaviour. Do not invent missing requirements.
- Keep changes minimal and local. Do not refactor or restyle outside the task.
- In reviews, prioritise bugs, regressions, and missing tests over style commentary.
- Keep all money values as integer pence.
- Treat `shared/types.ts` as the canonical cross-boundary contract.

## Workflow

- Work on a named branch only. Never commit directly to `master`.
- If user-facing behaviour, API shape, config, or operations change, review and update `README.md` and the relevant page under `docs/`.
- Bump `package.json` to the correct semver for committed changes.
- Do not open draft PRs.
- Fill out `.github/PULL_REQUEST_TEMPLATE.md` completely when opening a PR.
- Do not merge, tag, or release without explicit user approval.

## Repo Hints

- In development, Vite proxies `/api/*` to Express on `:3001`. In production, Express serves `dist/` and `/api/*`.
- If a sidebar page is added or renamed, update the screenshot assets/docs and regenerate the tracked screenshots.

## Local Instructions

- `src/AGENTS.md` for frontend-specific rules.
- `server/AGENTS.md` for backend-specific rules.
- `docs/Contributing.md`, `docs/Project-Structure.md`, and `docs/Release-Process.md` hold the longer human workflow and architecture reference material.
