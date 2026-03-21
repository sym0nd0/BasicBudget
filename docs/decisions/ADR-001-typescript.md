# ADR-001: TypeScript with NodeNext and Three-Config Split

**Date:** 2024-01-01
**Status:** Accepted

---

## Context

BasicBudget shares code between a Vite/React frontend (`src/`), a Vite config file (`vite.config.ts`), and a Node.js/Express server (`server/`). Each compilation unit has different runtime environments (browser, Node.js bundler, Node.js ESM runtime) and therefore different module resolution requirements. A single `tsconfig.json` cannot satisfy all three simultaneously.

Additionally, the server runs as native ESM under Node.js, which requires `.js` extensions on import specifiers even when the source file is `.ts` — a requirement that the NodeNext module resolution mode enforces at compile time.

## Decision

We adopted TypeScript with three separate `tsconfig` files:

| Config | Scope | Module resolution | Emits? |
|---|---|---|---|
| `tsconfig.app.json` | `src/` | Bundler (Vite) | No — Vite owns emit |
| `tsconfig.node.json` | `vite.config.ts` | Bundler | No |
| `tsconfig.server.json` | `server/`, `shared/` | NodeNext | Yes → `dist-server/` |

The root `tsconfig.json` uses `references` to include `tsconfig.app.json` and `tsconfig.node.json`, enabling `tsc -b` to check both in one command.

Server imports use `.js` extensions on `.ts` source files (e.g. `import db from '../db.js'`) to satisfy the NodeNext module resolution requirement.

All three configs share `shared/types.ts` as the canonical definition of cross-boundary data structures.

## Consequences

**Positive:**
- Strict type checking across the full stack with correct module semantics for each environment
- NodeNext enforcement of `.js` import extensions prevents runtime `ERR_MODULE_NOT_FOUND` errors
- Vite retains full ownership of frontend bundling without interference from `tsc`
- `shared/types.ts` provides a single source of truth for API contracts

**Negative / trade-offs:**
- Developers must remember to use `.js` extensions in server imports — this is a common mistake for newcomers
- Three separate check commands are required in CI; forgetting one can let errors through

## Alternatives Considered

| Alternative | Reason rejected |
|---|---|
| Single `tsconfig.json` for everything | Cannot satisfy both browser bundler and NodeNext module resolution in one config |
| CommonJS (`require`) on the server | The project targets native ESM throughout (`"type": "module"` in `package.json`); mixing CJS would add complexity |
| `ts-node` or `tsx` in production | `tsx` is used in development only; production runs compiled JS for performance and reliability |
