# Project Structure

## Directory Layout

```
BasicBudget/
├── src/                  # Frontend (React/TypeScript)
│   ├── components/       # Reusable UI components
│   ├── pages/            # Page components (one per route)
│   ├── utils/            # Frontend utilities (formatters, duplicates, etc.)
│   └── hooks/            # Custom React hooks
├── server/               # Backend (Express/TypeScript)
│   ├── routes/           # Express route handlers (one file per resource)
│   ├── services/         # Business logic (settings, etc.)
│   ├── utils/            # Server utilities (recurring engine, etc.)
│   ├── db.ts             # Database initialisation and migrations
│   └── index.ts          # Express app entry point
├── shared/
│   └── types.ts          # Shared TypeScript types (used by both src/ and server/)
├── .github/
│   └── workflows/
│       ├── ci.yml            # CI — test and type-check on pull requests
│       ├── docker-publish.yml # Docker image build & push (GHCR)
│       └── trufflehog.yml    # Secret scanning
├── docs/                 # Wiki source files
├── data/                 # SQLite database (gitignored)
├── dist/                 # Compiled frontend (gitignored)
├── dist-server/          # Compiled server (gitignored)
├── tsconfig.app.json     # Frontend TypeScript config
├── tsconfig.server.json  # Server TypeScript config
├── tsconfig.node.json    # Vite config TypeScript config
└── vite.config.ts        # Vite configuration
```

## Request Flow

```
Browser → Vite dev server (:5173)
            └─ /api/* proxy → Express (:3001) → better-sqlite3 → data/basicbudget.db

Production:
Browser → Express (:3000) → serves dist/ (static) + /api/* routes
```

## TypeScript Split

Three separate compilation units share one `shared/types.ts`:

| Config | Scope | Mode |
|---|---|---|
| `tsconfig.app.json` | `src/` | `noEmit`, bundler mode (Vite owns emit) |
| `tsconfig.node.json` | `vite.config.ts` | `noEmit`, bundler mode |
| `tsconfig.server.json` | `server/`, `shared/` | emits to `dist-server/`, NodeNext module resolution |

Server imports must use `.js` extensions even for `.ts` source files (NodeNext requirement). For example: `import db from '../db.js'`.

## Key Modules

### Recurring Engine (`server/utils/recurring.ts`)

All GET list endpoints filter through `filterActiveInMonth(items, yearMonth)`. This determines whether each income/expense/debt is active in the requested month based on `recurrence_type`, `start_date`, `end_date`, and `posting_day`. Weekly items have `amount_pence` multiplied by the number of occurrences.

### Money Storage

All monetary values are stored as **integer pence**. The `src/utils/formatters.ts` module handles pence → display conversion. Never store or compute with floating-point pounds.

### Settings Service (`server/services/settings.ts`)

SMTP and OIDC configuration is stored in the `system_settings` SQLite table. The service maintains an in-memory cache invalidated on writes.

### Duplicate Detection (`src/utils/duplicates.ts`)

The `norm(v)` function canonicalises values before comparison, handling SQLite boolean integers correctly.

---

<p>
  <span style="float:left;">← Back: [[Development Setup|Development-Setup]]</span>
  <span style="float:right;">[[Contributing]] →</span>
</p>
<div style="clear:both;"></div>
