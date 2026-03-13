# Backup and Restore

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
