# ADR-009: Vite 8 as the Frontend Build Tool

**Date:** 2024-01-01
**Status:** Accepted

---

## Context

BasicBudget's frontend (`src/`) needed a build tool for development (HMR, dev server, API proxy) and production (bundling, tree-shaking, asset optimisation). The tool needed first-class support for React, TypeScript, and Tailwind CSS 4's Vite plugin.

## Decision

We chose **Vite 8** as the frontend build tool. Vite handles:
- **Development:** HMR dev server on `:5173` with `/api/*` proxy to Express on `:3001`
- **Production:** `vite build` produces an optimised bundle in `dist/`, served as static files by Express
- **Tailwind CSS 4:** via the `@tailwindcss/vite` plugin (replaces PostCSS)
- **React:** via `@vitejs/plugin-react`

The frontend TypeScript compilation uses Vite's bundler mode (`tsconfig.app.json`) — Vite owns emit; `tsc -b --noEmit` is used only for type checking.

## Consequences

**Positive:**
- Fast HMR — changes reflect in the browser in milliseconds during development
- Native ESM in development means no bundling overhead during the dev cycle
- `@tailwindcss/vite` integration replaces PostCSS entirely — one fewer configuration layer
- `vite build` produces an optimised, tree-shaken bundle ready to serve as static files

**Negative / trade-offs:**
- `process.env` is not available in `src/` — all client-exposed variables must use `import.meta.env.VITE_*`
- The Vite dev proxy must be configured correctly for new API routes — it is transparent to application code

## Alternatives Considered

| Alternative | Reason rejected |
|---|---|
| Webpack | Much slower HMR; complex configuration; no meaningful advantages over Vite for this project |
| Parcel | Less mature TypeScript and plugin ecosystem than Vite |
| esbuild (standalone) | Does not include a dev server or HMR out of the box |
| Create React App | Unmaintained; based on Webpack; no Tailwind 4 support |
