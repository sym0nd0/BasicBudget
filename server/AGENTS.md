# AGENTS.md

Backend guidance for `server/`.

- Server imports must use `.js` specifiers.
- Keep request-body schemas in `server/validation/schemas.ts`.
- Use `.safeParse()` in route handlers so validation failures return `400` without throwing.
- Async Express handlers must pass failures to `next(err)`.
- Read route params as `req.params['key'] as string`.
- SQLite rows come back as `Record<string, unknown>`.
- Coerce SQLite boolean fields with `Boolean(...)`.
- Cast SQLite row objects through `unknown as Type`.
- Keep money values in integer pence.
- Routes under `/api/admin` require `requireAuth` and `requireAdmin`.
- Month-scoped income, expense, debt, household, and report list work must preserve `filterActiveInMonth(...)`.
