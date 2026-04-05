# Common Issues

## Login Problems

### Cannot log in — incorrect password

- Ensure Caps Lock is off.
- Try the **Forgot Password** link (requires SMTP to be configured).

### Account locked after failed attempts

Accounts are automatically locked for **30 minutes** after 5 consecutive failed login attempts. An administrator can unlock the account immediately via the [[Admin]] panel → User Management → **Unlock Account**.

### 2FA code not accepted

- Ensure your device clock is accurate. TOTP codes are time-based and fail if the device time is wrong by more than 30 seconds.
- Use an authenticator app that syncs time automatically (e.g. Google Authenticator with time sync enabled).
- If you have lost your authenticator, use a recovery code or request a 24-hour delayed reset from the login page.

### OIDC / SSO login fails

- Verify the **Issuer URL**, **Client ID**, and **Client Secret** in the [[Admin]] panel → OIDC Configuration.
- Confirm the redirect URI registered with your OIDC provider matches `{APP_URL}/api/auth/oidc/callback`.
- Check that `APP_URL` is set correctly in your environment — the redirect URI is derived from it.
- Review server logs for the specific error returned by the identity provider.

## Session Timeouts

Sessions expire after a period of inactivity. If you are being logged out unexpectedly:

- Check that your `SESSION_SECRET` has not changed. Changing it invalidates all existing sessions.
- Ensure your browser allows cookies for the BasicBudget domain.
- Check for reverse proxy configurations that may be stripping or modifying session cookies.

### "Invalid CSRF token" on login

This error means the session or CSRF cookie was not sent with the request. The most common cause is a mismatch between `APP_URL` and how you are accessing the app.

**Symptom:** Login returns 403 "Invalid CSRF token" immediately on submit.

**Cause:** `APP_URL` is set to an `https://` domain (e.g. for a reverse proxy), but you are accessing the app directly via a plain HTTP address (e.g. `http://192.168.1.x:8089`). Browsers reject cookies marked `Secure` on plain HTTP, so the session and CSRF cookies are never sent back to the server.

**Fix:** Add `COOKIE_SECURE=false` to your Docker environment variables and restart the container:

```yaml
environment:
  - COOKIE_SECURE=false
```

This removes the `Secure` flag from cookies so they work over both HTTP and HTTPS without affecting other security settings.

**Confirm the cause:** Check server logs for:
```text
APP_URL is HTTPS but COOKIE_SECURE is not set — direct HTTP access will fail.
```

## CORS Errors

If you see `Access-Control-Allow-Origin` errors in the browser console:

- Ensure `CORS_ORIGIN` is set to exactly match the URL you access the application from (including the protocol and port).
- If you access the app at `https://budget.example.com`, set `CORS_ORIGIN=https://budget.example.com`.
- In development, `APP_URL=http://localhost:5173` with Vite's proxy handles CORS automatically.

## Email Not Sending

- Verify SMTP settings in the [[Admin]] panel → SMTP Configuration.
- Use **Send test email** to send a test message and check for errors.
- Check that port 587 or 465 is not blocked by your firewall or hosting provider.
- Review server logs for SMTP connection errors.

---

<p>
  <span style="float:left;">← Back: [[Troubleshooting]]</span>
  <span style="float:right;">[[Database Problems|Database-Problems]] →</span>
</p>
<div style="clear:both;"></div>
