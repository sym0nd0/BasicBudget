# ADR-003: React 19 with React Router 7 (No Next.js)

**Date:** 2024-01-01
**Status:** Accepted

---

## Context

BasicBudget needed a frontend framework for building a multi-page single-page application with client-side navigation. The backend is a standalone Express API, so a meta-framework that mandates server-side rendering (SSR) or a Node.js server of its own would duplicate the existing Express server.

## Decision

We chose **React 19** as the UI component framework, **React Router 7** for client-side routing, and **Vite** as the build tool — without adopting a meta-framework such as Next.js or Remix.

The application is a fully client-side SPA. The Express server serves the compiled `dist/` directory as static files in production, and Vite's dev server proxies `/api/*` to Express during development.

React Router v7 is used for declarative route definitions and `<Link>` / `useNavigate()` navigation. Data fetching remains in `useEffect` hooks rather than route loaders, keeping the data model close to the components that use it.

## Consequences

**Positive:**
- No duplication of server logic — a single Express process handles API and static file serving
- Simple deployment: one Docker container, one port
- React 19's concurrent features (transitions, Suspense) are available when needed
- React Router 7 provides stable, well-understood routing patterns

**Negative / trade-offs:**
- No built-in SSR or SEO optimisation — this is acceptable for a private, authenticated budgeting tool
- Data fetching in `useEffect` can lead to loading-state boilerplate; route loaders could reduce this but were not adopted to avoid coupling routing to data fetching

## Alternatives Considered

| Alternative | Reason rejected |
|---|---|
| Next.js | Mandates a Node.js server (conflicts with existing Express); SSR not needed for an authenticated tool |
| Remix | Same concern as Next.js; also adds complexity with its own server conventions |
| Vue / Svelte | React was chosen for ecosystem familiarity and component library availability |
| No client-side routing (traditional MPA) | Would require full page reloads and loss of application state; poor UX for a dashboard app |
