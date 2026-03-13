# Troubleshooting

This section covers common problems and how to resolve them.

## Troubleshooting Guides

| Page | Topics covered |
|---|---|
| [[Common Issues\|Common-Issues]] | Login failures, session timeouts, CORS errors, OIDC configuration problems |
| [[Database Problems\|Database-Problems]] | SQLite locking, file permissions, data directory, migration failures |
| [[Chart Issues\|Chart-Issues]] | Charts not rendering, colour palette problems, browser compatibility |
| [[Resetting the Application\|Resetting-the-Application]] | How to wipe data and start fresh |

## Quick Diagnostics

### Check the Server Logs

Server logs are the first place to look for error details:

```bash
# Docker
docker compose logs -f basicbudget

# Manual
npm start  # logs appear in the terminal
```

Increase verbosity via the **Admin** panel → **Log Level** → set to `debug`.

### Check the Browser Console

For frontend errors, open your browser's developer tools (F12) and check the **Console** and **Network** tabs for error messages.

### Verify Environment Variables

Missing or incorrect environment variables cause the most common startup failures. Double-check `SESSION_SECRET`, `TOTP_ENCRYPTION_KEY`, `APP_URL`, and `CORS_ORIGIN`. See [[Configuration]].

---

<table width="100%">
<tr>
<td align="left">&#8592; <a href="Admin">Admin</a></td>
<td align="right"><a href="Common-Issues">Common Issues</a> &#8594;</td>
</tr>
</table>
