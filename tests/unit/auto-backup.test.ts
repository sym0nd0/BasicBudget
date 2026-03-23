import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';

// Mock the settings service so these unit tests don't need a real DB
vi.mock('../../server/services/settings.js', () => ({
  getSetting: vi.fn(() => null),
  setSetting: vi.fn(),
}));

// Mock the db and backup modules to avoid DB connections in unit tests
vi.mock('../../server/db.js', () => ({ default: {} }));
vi.mock('../../server/routes/backup.js', () => ({
  BACKUP_TABLES: ['users', 'households'],
  getAppVersion: () => 'test',
}));

import {
  generateBackupFilename,
  getBackupConfig,
  pruneOldBackups,
} from '../../server/services/autoBackup.js';
import { autoBackupConfigSchema } from '../../server/validation/schemas.js';
import { getSetting } from '../../server/services/settings.js';

const mockGetSetting = getSetting as ReturnType<typeof vi.fn>;

describe('generateBackupFilename', () => {
  it('produces the expected filename format', () => {
    const name = generateBackupFilename();
    // Should match: basicbudget-auto-backup-YYYY-MM-DDTHH-MM-SS.json
    expect(name).toMatch(/^basicbudget-auto-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
  });

  it('replaces colons with hyphens', () => {
    const name = generateBackupFilename();
    expect(name).not.toContain(':');
  });

  it('does not contain milliseconds or Z suffix', () => {
    const name = generateBackupFilename();
    expect(name).not.toMatch(/\.\d{3}Z/);
    expect(name).not.toContain('Z.json');
  });
});

describe('getBackupConfig — defaults', () => {
  afterEach(() => {
    mockGetSetting.mockReturnValue(null);
  });

  it('returns enabled: false by default', () => {
    const cfg = getBackupConfig();
    expect(cfg.enabled).toBe(false);
  });

  it('returns interval_hours: 24 by default', () => {
    const cfg = getBackupConfig();
    expect(cfg.interval_hours).toBe(24);
  });

  it('returns max_backups: 7 by default', () => {
    const cfg = getBackupConfig();
    expect(cfg.max_backups).toBe(7);
  });
});

describe('getBackupConfig — stored settings', () => {
  it('parses stored enabled: true correctly', () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'backup.enabled') return 'true';
      return null;
    });
    const cfg = getBackupConfig();
    expect(cfg.enabled).toBe(true);
  });

  it('parses stored interval_hours: 12 correctly', () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'backup.interval_hours') return '12';
      return null;
    });
    const cfg = getBackupConfig();
    expect(cfg.interval_hours).toBe(12);
  });

  it('parses stored max_backups: 3 correctly', () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'backup.max_backups') return '3';
      return null;
    });
    const cfg = getBackupConfig();
    expect(cfg.max_backups).toBe(3);
  });
});

describe('getBackupConfig — invalid persisted values fall back to safe defaults', () => {
  afterEach(() => {
    mockGetSetting.mockReturnValue(null);
  });

  it('falls back when interval_hours is 0 (below schema minimum)', () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'backup.enabled') return 'true';
      if (key === 'backup.interval_hours') return '0';
      if (key === 'backup.max_backups') return '5';
      return null;
    });
    const cfg = getBackupConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg.interval_hours).toBe(24);
    expect(cfg.max_backups).toBe(7);
  });

  it('falls back when max_backups is negative', () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'backup.enabled') return 'false';
      if (key === 'backup.interval_hours') return '6';
      if (key === 'backup.max_backups') return '-1';
      return null;
    });
    const cfg = getBackupConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg.interval_hours).toBe(24);
    expect(cfg.max_backups).toBe(7);
  });

  it('falls back when interval_hours exceeds maximum (721)', () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'backup.enabled') return 'true';
      if (key === 'backup.interval_hours') return '721';
      if (key === 'backup.max_backups') return '10';
      return null;
    });
    const cfg = getBackupConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg.interval_hours).toBe(24);
    expect(cfg.max_backups).toBe(7);
  });
});

describe('autoBackupConfigSchema validation', () => {
  it('rejects interval_hours < 1', () => {
    const result = autoBackupConfigSchema.safeParse({ enabled: true, interval_hours: 0, max_backups: 7 });
    expect(result.success).toBe(false);
  });

  it('rejects interval_hours > 720', () => {
    const result = autoBackupConfigSchema.safeParse({ enabled: true, interval_hours: 721, max_backups: 7 });
    expect(result.success).toBe(false);
  });

  it('rejects max_backups < 1', () => {
    const result = autoBackupConfigSchema.safeParse({ enabled: false, interval_hours: 24, max_backups: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects max_backups > 100', () => {
    const result = autoBackupConfigSchema.safeParse({ enabled: false, interval_hours: 24, max_backups: 101 });
    expect(result.success).toBe(false);
  });

  it('accepts valid config within bounds', () => {
    const result = autoBackupConfigSchema.safeParse({ enabled: true, interval_hours: 6, max_backups: 10 });
    expect(result.success).toBe(true);
  });

  it('accepts boundary values (1 hour, 1 backup)', () => {
    const result = autoBackupConfigSchema.safeParse({ enabled: false, interval_hours: 1, max_backups: 1 });
    expect(result.success).toBe(true);
  });

  it('accepts boundary values (720 hours, 100 backups)', () => {
    const result = autoBackupConfigSchema.safeParse({ enabled: true, interval_hours: 720, max_backups: 100 });
    expect(result.success).toBe(true);
  });
});

describe('pruneOldBackups', () => {
  let tmpDir: string;

  afterEach(() => {
    // Clean up temp directory
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  function createBackupFile(dir: string, name: string): void {
    fs.writeFileSync(path.join(dir, name), '{}');
  }

  it('does not delete files when count is within limit', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-test-'));
    createBackupFile(tmpDir, 'basicbudget-auto-backup-2026-01-01T00-00-01.json');
    createBackupFile(tmpDir, 'basicbudget-auto-backup-2026-01-01T00-00-02.json');

    pruneOldBackups(tmpDir, 3);

    const remaining = fs.readdirSync(tmpDir);
    expect(remaining).toHaveLength(2);
  });

  it('deletes oldest files when count exceeds maxBackups', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-test-'));
    // Create files in order — we'll use different mtimes by waiting
    const file1 = 'basicbudget-auto-backup-2026-01-01T00-00-01.json';
    const file2 = 'basicbudget-auto-backup-2026-01-01T00-00-02.json';
    const file3 = 'basicbudget-auto-backup-2026-01-01T00-00-03.json';
    createBackupFile(tmpDir, file1);
    createBackupFile(tmpDir, file2);
    createBackupFile(tmpDir, file3);

    // Manually set mtime so file1 is oldest
    const now = Date.now();
    fs.utimesSync(path.join(tmpDir, file1), new Date(now - 3000), new Date(now - 3000));
    fs.utimesSync(path.join(tmpDir, file2), new Date(now - 2000), new Date(now - 2000));
    fs.utimesSync(path.join(tmpDir, file3), new Date(now - 1000), new Date(now - 1000));

    pruneOldBackups(tmpDir, 2);

    const remaining = fs.readdirSync(tmpDir);
    expect(remaining).toHaveLength(2);
    expect(remaining).not.toContain(file1);
    expect(remaining).toContain(file2);
    expect(remaining).toContain(file3);
  });

  it('only removes files matching the auto-backup pattern', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-test-'));
    createBackupFile(tmpDir, 'basicbudget-auto-backup-2026-01-01T00-00-01.json');
    createBackupFile(tmpDir, 'basicbudget-auto-backup-2026-01-01T00-00-02.json');
    createBackupFile(tmpDir, 'basicbudget-auto-backup-2026-01-01T00-00-03.json');
    fs.writeFileSync(path.join(tmpDir, 'other-file.json'), '{}');

    pruneOldBackups(tmpDir, 2);

    // other-file.json should survive; only oldest auto-backup removed
    expect(fs.existsSync(path.join(tmpDir, 'other-file.json'))).toBe(true);
  });

  it('handles non-existent directory gracefully', () => {
    expect(() => pruneOldBackups('/non/existent/path', 3)).not.toThrow();
  });
});
