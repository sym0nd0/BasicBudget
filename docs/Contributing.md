# Contributing

Thank you for your interest in contributing to BasicBudget. This page covers the branch workflow, PR conventions, and coding standards.

## Branch Workflow

All work must be on a named branch. Never commit directly to `master`.

| Type | Pattern | Example |
|---|---|---|
| Feature | `feature/<short-description>` | `feature/totp-setup-flow` |
| Bug fix | `fix/<short-description>` | `fix/login-session-timeout` |
| Docs | `docs/<short-description>` | `docs/readme-auth-section` |
| Chore / config | `chore/<short-description>` | `chore/update-dependencies` |
| Refactor | `refactor/<short-description>` | `refactor/auth-middleware` |

## Pull Request Workflow

1. Create a branch from `master`.
2. Make your changes and commit them.
3. Push the branch to origin.
4. Open a Pull Request with a clear title and description.
5. Fill in the PR template completely — do not leave placeholder sections blank.
6. Wait for review before merging.

## Pre-Push Checklist

Before pushing, verify:

- [ ] You are NOT on `master`
- [ ] TypeScript checks pass: `tsc -b --noEmit` and `tsc --project tsconfig.server.json --noEmit`
- [ ] Lint passes: `eslint src server shared`
- [ ] Tests pass: `npm test`
- [ ] `README.md` is up to date if the change affects user-facing features, API, or configuration
- [ ] Wiki (`docs/`) pages are updated if the change affects user-facing behaviour
- [ ] `package.json` version is bumped to the correct semver

## Coding Conventions

- **UK English** in all text — comments, commit messages, documentation, UI strings
- **Minimum necessary changes** — only modify what is directly needed for the task
- **No unsolicited refactoring** — do not rename variables, reorganise functions, or restructure logic unless asked
- **Money as pence** — all monetary values are integer pence; never use floats
- **SQLite booleans** — always coerce with `Boolean(row.field)`, never rely on the raw integer
- **Server imports** — use `.js` extensions even for `.ts` source files (NodeNext requirement)
- **Percentages** — use exactly 2 decimal places with `formatPercent()` for display; use `step="0.01"` on input fields

## Commit Messages

Use concise present-tense commit messages describing the change:

```
fix: correct weekly multiplier for fortnightly expenses
feat: add OIDC account linking to settings page
docs: update API endpoint table in wiki
```

---

<table width="100%">
<tr>
<td align="left">&#8592; <a href="Project-Structure">Project Structure</a></td>
<td align="right"><a href="Testing">Testing</a> &#8594;</td>
</tr>
</table>
