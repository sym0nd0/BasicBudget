# Database Problems

## Database File Not Found

If the server logs show `SQLITE_CANTOPEN` or a similar error:

- Check that the `data/` directory exists and is writable by the process running BasicBudget.
- For Docker, verify the volume mount is correct: `./data:/app/data`.
- Check `DB_PATH` if you have overridden the default database location.

```bash
# Docker — inspect the volume mount
docker inspect basicbudget | grep -A5 Mounts

# Manual — check permissions
ls -la data/
```

## Database is Locked

SQLite allows only one writer at a time. The error `SQLITE_BUSY` or `database is locked` can occur if:

- Two instances of the application are running against the same database file. Ensure only one container or process is running.
- A previous process crashed while holding a write lock. Restarting the application usually resolves this.
- An external tool (e.g. DB Browser for SQLite) has the file open in write mode while the app is also running.

## Permission Errors

If the server cannot read or write the database file:

```bash
# Fix permissions (manual setup)
chmod 660 data/basicbudget.db
chown $(whoami) data/basicbudget.db
```

For Docker, the container runs as a non-root user. Ensure the host directory is writable:

```bash
chmod 775 ./data
```

## Migration Failures

BasicBudget applies schema migrations automatically on startup. If a migration fails:

1. Check the server logs for the specific SQL error.
2. Ensure the database file is not corrupted. Test with SQLite directly:
   ```bash
   sqlite3 data/basicbudget.db "PRAGMA integrity_check;"
   ```
3. Restore from a backup if the file is corrupt. See [[Backup and Restore\|Backup-and-Restore]].

## Data Directory in Docker

If you lose data after updating the container, you likely did not mount the data directory as a volume. Without a volume mount, data is stored inside the container and lost when it is removed.

Add the volume to your `docker-compose.yml`:

```yaml
volumes:
  - ./data:/app/data
```

Then restore from a backup or start fresh.

---

<table width="100%">
<tr>
<td align="left">&#8592; <a href="Common-Issues">Common Issues</a></td>
<td align="right"><a href="Chart-Issues">Chart Issues</a> &#8594;</td>
</tr>
</table>
