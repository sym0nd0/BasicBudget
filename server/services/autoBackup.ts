import fs from 'node:fs';
import path from 'node:path';
import db from '../db.js';
import { getSetting, setSetting } from './settings.js';
import { BACKUP_TABLES, getAppVersion } from '../routes/backup.js';
import { logger } from './logger.js';

// ─── Backup directory ──────────────────────────────────────────────────────────

function getBackupDir(): string {
  const dbPath = process.env.DB_PATH;
  // Guard: in-memory databases have no parent directory
  const dataDir = dbPath && dbPath !== ':memory:'
    ? path.dirname(dbPath)
    : path.join(process.cwd(), 'data');
  return path.join(dataDir, 'backups');
}

// ─── Filename ──────────────────────────────────────────────────────────────────

export function generateBackupFilename(): string {
  const ts = new Date().toISOString().replace(/:/g, '-').replace(/\.\d{3}Z$/, '');
  return `basicbudget-auto-backup-${ts}.json`;
}

// ─── Config ────────────────────────────────────────────────────────────────────

export interface BackupScheduleConfig {
  enabled: boolean;
  interval_hours: number;
  max_backups: number;
}

export function getBackupConfig(): BackupScheduleConfig {
  const enabledRaw = getSetting('backup.enabled');
  const intervalRaw = getSetting('backup.interval_hours');
  const maxRaw = getSetting('backup.max_backups');

  const enabled = enabledRaw === 'true';
  const interval_hours = intervalRaw !== null ? parseInt(intervalRaw, 10) : 24;
  const max_backups = maxRaw !== null ? parseInt(maxRaw, 10) : 7;

  return {
    enabled,
    interval_hours: Number.isNaN(interval_hours) ? 24 : interval_hours,
    max_backups: Number.isNaN(max_backups) ? 7 : max_backups,
  };
}

// ─── Status ────────────────────────────────────────────────────────────────────

let nextBackupTime: Date | null = null;

export function getAutoBackupStatus(): {
  last_backup_at: string | null;
  next_backup_at: string | null;
  backup_count: number;
} {
  const last_backup_at = getSetting('backup.last_backup_at');
  const next_backup_at = nextBackupTime ? nextBackupTime.toISOString() : null;

  let backup_count = 0;
  const dir = getBackupDir();
  if (fs.existsSync(dir)) {
    try {
      backup_count = fs.readdirSync(dir).filter(f => /^basicbudget-auto-backup-.+\.json$/.test(f)).length;
    } catch (err) {
      logger.error('Auto-backup: failed to read backup directory', { dir, error: (err as Error).message });
      backup_count = 0;
    }
  }

  return { last_backup_at, next_backup_at, backup_count };
}

// ─── Pruning ───────────────────────────────────────────────────────────────────

export function pruneOldBackups(dir?: string, maxBackups?: number): void {
  const backupDir = dir ?? getBackupDir();
  const limit = maxBackups ?? getBackupConfig().max_backups;

  if (!fs.existsSync(backupDir)) return;

  let files: string[];
  try {
    files = fs.readdirSync(backupDir).filter(f => /^basicbudget-auto-backup-.+\.json$/.test(f));
  } catch (err) {
    logger.error('Auto-backup: failed to read backup directory for pruning', { error: (err as Error).message });
    return;
  }

  if (files.length <= limit) return;

  // Sort by mtime ascending (oldest first)
  const withMtime = files.map(f => {
    const stat = fs.statSync(path.join(backupDir, f));
    return { name: f, mtime: stat.mtimeMs };
  });
  withMtime.sort((a, b) => a.mtime - b.mtime);

  const toDelete = withMtime.slice(0, withMtime.length - limit);
  for (const { name } of toDelete) {
    try {
      fs.unlinkSync(path.join(backupDir, name));
      logger.info('Auto-backup: pruned old backup', { file: name });
    } catch (err) {
      logger.error('Auto-backup: failed to delete old backup', { file: name, error: (err as Error).message });
    }
  }
}

// ─── Backup execution ──────────────────────────────────────────────────────────

export function runBackup(): void {
  const dir = getBackupDir();
  try {
    fs.mkdirSync(dir, { recursive: true });

    const tables: Record<string, unknown[]> = {};
    const readAll = db.transaction(() => {
      for (const table of BACKUP_TABLES) {
        tables[table] = db.prepare(`SELECT * FROM ${table}`).all();
      }
    });
    readAll();

    const backup = {
      backup_type: 'full',
      backup_schema_version: 1,
      app_version: getAppVersion(),
      exported_at: new Date().toISOString(),
      encryption_warning:
        'Encrypted secrets (TOTP 2FA, SMTP password, OIDC client secret) are encrypted with ' +
        'the TOTP_ENCRYPTION_KEY. Restoring on an instance with a different key will make ' +
        'these secrets unrecoverable.',
      tables,
    };

    const filename = generateBackupFilename();
    const filePath = path.join(dir, filename);
    const tmpPath = `${filePath}.tmp`;

    fs.writeFileSync(tmpPath, JSON.stringify(backup), 'utf8');
    fs.renameSync(tmpPath, filePath);

    setSetting('backup.last_backup_at', new Date().toISOString());

    pruneOldBackups(dir);

    logger.info('Auto-backup: backup completed', { file: filename });
  } catch (err) {
    logger.error('Auto-backup: backup failed', { error: (err as Error).message });
  }
}

// ─── Scheduler ─────────────────────────────────────────────────────────────────

let backupInterval: ReturnType<typeof setInterval> | null = null;
let initialTimeout: ReturnType<typeof setTimeout> | null = null;

function stopScheduler(): void {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
  }
  if (initialTimeout) {
    clearTimeout(initialTimeout);
    initialTimeout = null;
  }
  nextBackupTime = null;
}

function startScheduler(cfg: BackupScheduleConfig): void {
  const intervalMs = cfg.interval_hours * 60 * 60 * 1000;

  // 10 second delay before first backup (matches deal reminders pattern)
  initialTimeout = setTimeout(() => {
    initialTimeout = null;
    nextBackupTime = new Date(Date.now() + intervalMs);
    runBackup();

    backupInterval = setInterval(() => {
      nextBackupTime = new Date(Date.now() + intervalMs);
      try {
        runBackup();
      } catch (err) {
        logger.error('Auto-backup: unexpected scheduler error', { error: (err as Error).message });
      }
    }, intervalMs);
    backupInterval.unref();
  }, 10_000);
  initialTimeout.unref();

  // Set next backup time to 10s from now for immediate status display
  nextBackupTime = new Date(Date.now() + 10_000);
}

export function initAutoBackup(): void {
  const cfg = getBackupConfig();
  if (cfg.enabled) {
    startScheduler(cfg);
    logger.info('Auto-backup: scheduler started', {
      interval_hours: cfg.interval_hours,
      max_backups: cfg.max_backups,
    });
  }
}

export function restartScheduler(): void {
  stopScheduler();
  const cfg = getBackupConfig();
  if (cfg.enabled) {
    startScheduler(cfg);
    logger.info('Auto-backup: scheduler restarted', {
      interval_hours: cfg.interval_hours,
      max_backups: cfg.max_backups,
    });
  } else {
    logger.info('Auto-backup: scheduler stopped (disabled in config)');
  }
}
