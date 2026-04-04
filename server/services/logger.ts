import { config } from '../config.js';
import { getSetting } from './settings.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const REDACTED_VALUE = '[REDACTED]';
const SENSITIVE_KEY_PATTERN =
  /(^|[_-])(password|pass|secret|token|cookie|authori[sz]ation|email|user-agent|subject|html|name|balance_pence|amount_pence|current_amount_pence|target_amount_pence|monthly_contribution_pence|minimum_payment_pence|overpayment_pence|interest_rate)([_-]|$)/i;

function resolveLogLevel(value: string | null | undefined): LogLevel | null {
  return value && Object.prototype.hasOwnProperty.call(LEVEL_ORDER, value)
    ? value as LogLevel
    : null;
}

export function getCurrentLogLevel(): LogLevel {
  try {
    return resolveLogLevel(getSetting('log.level')) ?? config.LOG_LEVEL;
  } catch {
    return config.LOG_LEVEL;
  }
}

function serialiseError(err: Error, seen: WeakSet<object>): Record<string, unknown> {
  const output: Record<string, unknown> = {
    name: err.name,
    message: err.message,
  };

  if (err.stack) {
    output['stack'] = err.stack;
  }

  const code = (err as Error & { code?: unknown }).code;
  if (code !== undefined) {
    output['code'] = code;
  }

  const cause = (err as Error & { cause?: unknown }).cause;
  if (cause !== undefined) {
    output['cause'] = sanitiseValue(cause, seen);
  }

  return output;
}

function sanitiseValue(value: unknown, seen: WeakSet<object>): unknown {
  if (!value || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (value instanceof Error) {
    return serialiseError(value, seen);
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitiseValue(item, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? REDACTED_VALUE
      : sanitiseValue(nestedValue, seen);
  }
  return output;
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[getCurrentLogLevel()]) return;
  const line: Record<string, unknown> = { timestamp: new Date().toISOString(), level, message };
  if (meta && Object.keys(meta).length > 0) {
    line['meta'] = sanitiseValue(meta, new WeakSet<object>());
  }
  const stream = level === 'error' ? process.stderr : process.stdout;
  stream.write(JSON.stringify(line) + '\n');
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => emit('debug', message, meta),
  info:  (message: string, meta?: Record<string, unknown>) => emit('info',  message, meta),
  warn:  (message: string, meta?: Record<string, unknown>) => emit('warn',  message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit('error', message, meta),
};
