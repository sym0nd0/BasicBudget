# System Requirements

## Docker Installation

| Requirement | Minimum |
|---|---|
| **Docker Engine** | 20.10 or later |
| **Docker Compose** | v2.0 or later (plugin form: `docker compose`) |
| **Disk space** | 200 MB for the image + space for your database |
| **RAM** | 256 MB available |

Docker Desktop on macOS and Windows includes both Docker Engine and the Compose plugin.

## Manual / Development Installation

| Requirement | Minimum |
|---|---|
| **Node.js** | 20.x LTS or later |
| **npm** | 9.x or later (bundled with Node.js 20) |
| **Git** | Any recent version |
| **Disk space** | 500 MB (source + node_modules) |

## Supported Browsers

BasicBudget requires a modern browser with JavaScript enabled:

| Browser | Minimum Version |
|---|---|
| **Chrome / Chromium** | 90+ |
| **Firefox** | 90+ |
| **Safari** | 15+ |
| **Edge** | 90+ |

## Database

BasicBudget uses **SQLite** via the `better-sqlite3` package. No separate database server is required. The database file is stored at `data/basicbudget.db` by default (configurable via the `DB_PATH` environment variable).

SQLite is bundled with the application — no installation is needed.

## Network

- The application listens on port **3000** by default (configurable via `PORT`).
- HTTPS termination is typically handled by a reverse proxy (e.g. Nginx, Caddy, Traefik) in front of BasicBudget.

---

<p>
  <span style="float:left;">← Back: [[Installation]]</span>
  <span style="float:right;">[[Docker Setup|Docker-Setup]] →</span>
</p>
<div style="clear:both;"></div>
