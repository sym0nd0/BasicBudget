# ADR-007: Docker Multi-Stage Build with GHCR (No Kubernetes)

**Date:** 2024-01-01
**Status:** Accepted

---

## Context

BasicBudget is a self-hosted application. Users need a simple way to deploy and run it on a home server, VPS, or NAS without installing Node.js or managing build dependencies. The deployment target is a single host machine, not a container orchestration platform.

## Decision

We adopted a **Docker multi-stage build** published to the **GitHub Container Registry (GHCR)**. The image is built and pushed automatically by GitHub Actions on every push to `master` (produces `latest`) and on every `v*` tag push (produces a versioned tag).

**Multi-stage build rationale:** The builder stage installs all dependencies (including devDependencies) and compiles TypeScript. The runner stage copies only the compiled output (`dist/`, `dist-server/`) and production `node_modules` — the TypeScript source, test files, and devDependencies are not in the final image.

**No Kubernetes:** The application is a single-container deployment with one process and one SQLite file. Kubernetes would add enormous operational overhead for no benefit. Plain `docker run` or `docker compose` is the intended deployment method.

**No secrets in image layers:** All secrets (`SESSION_SECRET`, `TOTP_ENCRYPTION_KEY`, etc.) are passed at runtime via environment variables. The `data/` directory (SQLite database) is mounted as a host volume.

## Consequences

**Positive:**
- Simple one-command deployment: `docker run -p 3000:3000 -v ./data:/app/data ghcr.io/...`
- Multi-stage build keeps the final image small (no source, no devDependencies)
- GHCR integration is free for public repositories and requires no separate registry account
- GitHub Actions automation means every `master` merge produces a deployable image

**Negative / trade-offs:**
- SQLite on Docker volumes can encounter WAL mode failures on some filesystems (NFS, certain overlay2 backends); the server auto-detects and falls back
- No horizontal scaling — SQLite is a single-writer database; this is acceptable for the target use case
- Rotating secrets requires a container restart

## Alternatives Considered

| Alternative | Reason rejected |
|---|---|
| Docker Hub | GHCR is integrated with GitHub Actions and free for public repos; no separate account needed |
| Kubernetes / Helm | Massive operational overhead for a single-container personal tool |
| `npm start` without Docker | Requires Node.js on the host; less portable; harder to manage as a service |
| Fly.io / Render | Managed platforms have ongoing cost and add vendor dependency for a self-hosted tool |
