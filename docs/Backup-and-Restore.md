# Backup and Restore

BasicBudget offers two approaches to backup and restore: the built-in **Admin UI** (recommended for most users) and **file-level SQLite backup** (for server administrators who need lower-level access).

## Admin UI Backup and Restore

> **Requires Admin role.** Available from **Admin → System Settings → Database Backup**.

### Downloading a Backup

Click **Download Backup** to download a JSON file (`basicbudget-backup-YYYY-MM-DD.json`) containing all users, households, budget data, and system settings. The backup covers all 19 persistent tables; ephemeral data (sessions, OTP tokens, password reset tokens) is excluded.

### Restoring from a Backup

1. Select the backup JSON file using the file picker.
2. Click **Restore Backup** and confirm the warning dialog.
3. The restore is atomic — either everything succeeds or nothing changes.
4. All active sessions are invalidated after a successful restore. All users are logged out automatically.

> **Encrypted secrets note:** TOTP secrets, the SMTP password, and the OIDC client secret are encrypted with the `TOTP_ENCRYPTION_KEY` environment variable. Restoring on an instance with a different key makes these secrets unrecoverable. Affected users will need to re-enrol 2FA and the admin will need to re-enter SMTP/OIDC credentials.

---

## Automated Backups

> **Requires Admin role.** Configure from **Admin → System Settings → Database Backup → Automated Backups**.

BasicBudget can automatically create JSON backups on a schedule and save them to the server's `data/backups/` directory.

### Configuration

| Setting | Default | Description |
|---|---|---|
| **Enabled** | Off | Enable or disable the automated scheduler |
| **Interval (hours)** | 24 | How often a backup is created (1–720) |
| **Maximum backups** | 7 | Number of backup files to retain; oldest are removed when the limit is exceeded (1–100) |

### Storage Location

Automated backups are saved in `data/backups/` alongside the database file. In Docker, this is within the volume at `/app/data/backups/`.

Files follow the naming convention: `basicbudget-auto-backup-YYYY-MM-DDTHH-MM-SS.json`

### Compatibility with Manual Restore

Automated backup files are structurally identical to manually downloaded backups. They can be restored using the standard **Restore Backup** function in the Admin UI.

### Retention

When the number of backup files exceeds the configured maximum, the oldest files (by last-modified time) are deleted automatically. Only files matching the `basicbudget-auto-backup-*.json` pattern are affected; manually downloaded backup files stored elsewhere are never touched.

---

## File-Level SQLite Backup

BasicBudget stores all data in a single SQLite database file. Backing it up is straightforward.

## Database Location

| Setup | Default path |
|---|---|
| **Docker** | Inside the container at `/app/data/basicbudget.db`, mapped to your host volume (e.g. `./data/basicbudget.db`) |
| **Manual** | `data/basicbudget.db` relative to the project root |

Override the path with the `DB_PATH` environment variable.

## Backing Up

### Docker

Copy the database file from your bind mount:

```bash
cp ./data/basicbudget.db ./backups/basicbudget-$(date +%Y%m%d).db
```

For a consistent backup while the container is running, use SQLite's online backup:

```bash
docker exec basicbudget sqlite3 /app/data/basicbudget.db ".backup /tmp/backup.db"
docker cp basicbudget:/tmp/backup.db ./backups/basicbudget-$(date +%Y%m%d).db
```

### Manual Setup

```bash
cp data/basicbudget.db backups/basicbudget-$(date +%Y%m%d).db
```

## Restoring

Stop the application, replace the database file, then restart:

### Docker

```bash
docker compose stop
cp ./backups/basicbudget-20260101.db ./data/basicbudget.db
docker compose start
```

### Manual

```bash
# Stop the server first, then:
cp backups/basicbudget-20260101.db data/basicbudget.db
npm start
```

## JSON Export as a Supplementary Backup

In addition to the SQLite file, you can export your data as JSON from **Settings** → **JSON Export**. This provides a human-readable backup that can be used to re-import data if the database file is lost.

See [[Exporting Data\|Exporting-Data]] for details.

## Docker Volume Management

If you use a named Docker volume instead of a bind mount:

```yaml
volumes:
  basicbudget-data:

services:
  basicbudget:
    volumes:
      - basicbudget-data:/app/data
```

Back up a named volume:

```bash
docker run --rm -v basicbudget-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/basicbudget-$(date +%Y%m%d).tar.gz -C /data .
```

Restore:

```bash
docker compose stop
docker run --rm -v basicbudget-data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/basicbudget-20260101.tar.gz -C /data
docker compose start
```

---

<p>
  <span style="float:left;">← Back: [[Customisation]]</span>
  <span style="float:right;">[[Settings]] →</span>
</p>
<div style="clear:both;"></div>
