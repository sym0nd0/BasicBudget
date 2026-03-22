# Updating BasicBudget

## Docker (Recommended)

Pull the latest image and recreate the container:

```bash
docker compose pull
docker compose up -d
```

This downloads the newest `latest` tag from GHCR and restarts the container. Your data volume is preserved.

## Pinning to a Specific Version

To pin to a specific release instead of `latest`, update your `compose.yml`:

```yaml
image: ghcr.io/sym0nd0/basicbudget:v2.23.0
```

Replace `v2.23.0` with the desired release tag. Check the [GitHub Releases page](https://github.com/sym0nd0/BasicBudget/releases) for available tags.

## Database Migrations

BasicBudget applies database schema migrations **automatically on startup**. No manual migration steps are required.

When a new version adds columns or tables, the server runs the necessary `ALTER TABLE` or `CREATE TABLE IF NOT EXISTS` statements during initialisation. Existing data is preserved.

> **Backup your database before major version upgrades.** See [[Backup and Restore\|Backup-and-Restore]] for instructions.

## Manual / Development Setup

For a manual installation, pull the latest code and reinstall dependencies:

```bash
git pull origin master
npm install
npm run build
npm start
```

## Checking the Current Version

The current version is displayed in the sidebar footer of the application. You can also query it via the API:

```bash
curl http://localhost:3000/api/version
```

---

<p>
  <span style="float:left;">← Back: [[Configuration]]</span>
  <span style="float:right;">[[Getting Started|Getting-Started]] →</span>
</p>
<div style="clear:both;"></div>
