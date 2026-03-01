import { getSetting } from './settings.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function currentLevel(): LogLevel {
  const stored = getSetting('log.level') as LogLevel | null;
  return stored && stored in LEVEL_ORDER ? stored : 'info';
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[currentLevel()]) return;
  const line: Record<string, unknown> = { timestamp: new Date().toISOString(), level, message };
  if (meta && Object.keys(meta).length > 0) line['meta'] = meta;
  process.stdout.write(JSON.stringify(line) + '\n');
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => emit('debug', message, meta),
  info:  (message: string, meta?: Record<string, unknown>) => emit('info',  message, meta),
  warn:  (message: string, meta?: Record<string, unknown>) => emit('warn',  message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit('error', message, meta),
};
