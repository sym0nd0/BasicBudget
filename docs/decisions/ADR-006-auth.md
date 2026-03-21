# ADR-006: Argon2id + TOTP + OIDC Authentication (No JWT)

**Date:** 2024-01-01
**Status:** Accepted

---

## Context

BasicBudget required a secure authentication system supporting multi-user access, optional two-factor authentication, and optional single sign-on via corporate or home identity providers. The system needed to be self-contained (no external auth service required) while supporting external OIDC providers as an optional enhancement.

## Decision

We adopted a layered authentication approach:

1. **Password hashing: Argon2id** via the `argon2` package. Argon2id is the OWASP-recommended algorithm as of 2024 — it is memory-hard, resistant to GPU cracking, and available as a native Node.js module.

2. **Session management: `express-session` with SQLite store** — server-side sessions with a cookie. Sessions are stored in the same SQLite database. This avoids the complexity of JWT rotation, revocation, and refresh token management.

3. **2FA: TOTP via `otpauth`** — standard RFC 6238 time-based one-time passwords compatible with any authenticator app (Google Authenticator, Authy, etc.). TOTP secrets are encrypted at rest using AES-256 with a `TOTP_ENCRYPTION_KEY` environment variable.

4. **SSO: OIDC via `openid-client`** — supports any OpenID Connect provider (Google, Authentik, Keycloak, etc.). Configured at runtime via the admin panel and stored in the `system_settings` table — no environment variables required.

5. **No JWTs** — stateless tokens were rejected in favour of server-side sessions for simplicity, auditability, and easy revocation.

## Consequences

**Positive:**
- Argon2id provides strong password security with no key management complexity
- Server-side sessions can be revoked instantly (delete the session row)
- TOTP is widely supported and requires no external service
- OIDC configuration at runtime (admin panel) means no redeploy needed when changing providers
- The first registered user is automatically admin — no separate admin bootstrap step

**Negative / trade-offs:**
- Sessions require database lookups on every authenticated request (mitigated by SQLite speed)
- Rotating `TOTP_ENCRYPTION_KEY` requires re-enrolling all TOTP users
- `SESSION_SECRET` rotation invalidates all active sessions
- OIDC client cache must be explicitly reset after config changes via `resetOidcClient()`

## Alternatives Considered

| Alternative | Reason rejected |
|---|---|
| JWT (stateless tokens) | No built-in revocation; refresh token complexity; harder to audit active sessions |
| bcrypt | Argon2id is the current OWASP recommendation and more resistant to GPU attacks |
| External auth service (Auth0, Clerk) | Adds external dependency and ongoing cost; not suitable for self-hosted deployment |
| WebAuthn / passkeys | Excellent security but complex implementation and limited device support at time of adoption |
