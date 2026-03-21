# ADR-004: Express 5 as the HTTP Server

**Date:** 2024-01-01
**Status:** Accepted

---

## Context

BasicBudget needed an HTTP server framework to expose a REST API, handle authentication, serve static files in production, and integrate with session management, CSRF protection, and rate limiting middleware. The choice of framework affects the middleware ecosystem, TypeScript support, and long-term maintenance burden.

## Decision

We chose **Express 5** as the HTTP server framework. Express 5 is a stable, well-understood framework with a large middleware ecosystem, first-class TypeScript types via `@types/express`, and native async/await error propagation (unhandled promise rejections in route handlers are now forwarded to the error handler automatically).

Key middleware in use:
- `express-session` — session management with SQLite store
- `csrf-csrf` — double-submit CSRF protection
- `express-rate-limit` — rate limiting on auth routes
- `helmet` — security headers
- `cors` — CORS for the Vite dev server proxy

## Consequences

**Positive:**
- Mature, stable, well-documented framework with extensive middleware ecosystem
- Express 5's async error propagation simplifies route handlers
- `@types/express` v5 provides accurate types (including the `string | string[]` params change)
- Minimal magic — middleware order is explicit and easy to reason about

**Negative / trade-offs:**
- Express is not the most performant Node.js framework (Fastify, Hono are faster)
- `@types/express` v5 types `req.params` as `string | string[]` — requires explicit casting in handlers

## Alternatives Considered

| Alternative | Reason rejected |
|---|---|
| Fastify | More performant but less familiar middleware ecosystem; schema-based validation conflicts with existing Zod approach |
| Hono | Excellent performance and TypeScript support, but less mature middleware ecosystem for sessions and CSRF |
| Koa | Requires many plugins for basic functionality; smaller ecosystem than Express |
| tRPC | Would require significant client-side changes and couples the frontend to the backend type system |
