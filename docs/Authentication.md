# Authentication

## Registration

1. Navigate to the BasicBudget URL and click **Register**.
2. Enter your email address, display name, and a password.
3. **Password requirements:** minimum 8 characters.
4. The first user to register is automatically assigned the **Admin** role.

If public registration is disabled by an administrator, you will need an invitation link sent to your email address.

## Login

1. Enter your email and password on the login page.
2. If two-factor authentication is enabled, you will be prompted to enter your TOTP code after a successful password entry.

### Account Lockout

After **5 consecutive failed login attempts**, your account is locked for **30 minutes**. After the lockout period, you may try again. An administrator can unlock accounts manually via the [Admin panel](Admin.md).

## Two-Factor Authentication (TOTP)

### Setting Up 2FA

1. Go to **Settings → Security**.
2. Click **Enable Two-Factor Authentication**.
3. Scan the QR code with an authenticator app (e.g. Google Authenticator, Authy, 1Password).
4. Enter the 6-digit code from the app to confirm setup.
5. **Save your recovery codes** — these are shown once and allow you to access your account if you lose your authenticator device.

### Logging In with 2FA

After entering your password, you will be prompted to enter the 6-digit code from your authenticator app.

### Using a Recovery Code

If you have lost access to your authenticator, enter one of your saved recovery codes in place of the TOTP code. Each recovery code can only be used once.

### Disabling 2FA

1. Go to **Settings → Security**.
2. Click **Disable Two-Factor Authentication**.
3. Enter your current TOTP code to confirm.

### Lost Access Reset

If you have lost both your authenticator and your recovery codes:

- **Immediate reset (with password + OTP):** Not possible if OTP is unavailable. Contact your administrator.
- **24-hour delayed reset:** Submit a reset request from the login page. After a 24-hour waiting period (to protect against unauthorised resets), 2FA will be removed from your account and you will receive an email confirmation.

Administrators can immediately remove 2FA from any account via the [Admin panel](Admin.md).

## OIDC Single Sign-On

If an administrator has configured an OIDC provider (e.g. Google, Keycloak, Authentik), an **SSO** button appears on the login page.

### Logging In with SSO

Click the **Sign in with SSO** button. You will be redirected to the identity provider. After authenticating, you are returned to BasicBudget and logged in.

### Linking an OIDC Account

If you already have a BasicBudget account (with a password), you can link your OIDC identity:

1. Log in with your password.
2. Go to **Settings → Security → Linked Accounts**.
3. Click **Link SSO Account**.
4. Authenticate with the identity provider.

### Unlinking an OIDC Account

Go to **Settings → Security → Linked Accounts** and click **Unlink**. You must have a password set before unlinking.

## Sessions

### Viewing Active Sessions

Go to **Settings → Security → Active Sessions** to see all devices and browsers where you are currently logged in. Each session shows the device, browser, IP address, and last activity time.

### Revoking a Session

Click **Revoke** next to any session to log out that device immediately.

### New Device Email Alerts

When you log in from a new device or browser, BasicBudget sends an email alert to your registered address. If you do not recognise the login, revoke the session immediately and change your password.


---

| ← [[Settings]] | | [[Admin]] → |
| :-- | --- | --: |