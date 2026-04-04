import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function parseLogCalls(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown>[] {
  return spy.mock.calls
    .map(call => JSON.parse(String(call[0])) as Record<string, unknown>);
}

describe('logger', () => {
  const originalLogLevel = process.env.LOG_LEVEL;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(async () => {
    const { deleteSetting } = await import('../../server/services/settings.js');
    deleteSetting('log.level');

    if (originalLogLevel === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = originalLogLevel;
    }
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    vi.resetModules();
  });

  it('uses LOG_LEVEL as the bootstrap default when no DB value exists', async () => {
    process.env.LOG_LEVEL = 'warn';
    vi.resetModules();

    const { deleteSetting } = await import('../../server/services/settings.js');
    const { getCurrentLogLevel, logger } = await import('../../server/services/logger.js');
    deleteSetting('log.level');

    stdoutSpy.mockClear();
    stderrSpy.mockClear();

    expect(getCurrentLogLevel()).toBe('warn');

    logger.info('suppressed info log');
    logger.error('visible error log');

    expect(stdoutSpy).not.toHaveBeenCalled();
    const logs = parseLogCalls(stderrSpy);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      level: 'error',
      message: 'visible error log',
    });
  });

  it('prefers the persisted DB log level over LOG_LEVEL', async () => {
    process.env.LOG_LEVEL = 'error';
    vi.resetModules();

    const { setSetting } = await import('../../server/services/settings.js');
    const { getCurrentLogLevel } = await import('../../server/services/logger.js');

    setSetting('log.level', 'debug');

    expect(getCurrentLogLevel()).toBe('debug');
  });

  it('redacts sensitive metadata and serialises errors with stack traces', async () => {
    process.env.LOG_LEVEL = 'debug';
    vi.resetModules();

    const { logger } = await import('../../server/services/logger.js');
    stdoutSpy.mockClear();
    stderrSpy.mockClear();

    const err = new Error('boom');
    logger.error('Sensitive failure', {
      userId: 'u1',
      email: 'person@example.com',
      password: 'secret-password',
      token: 'abc123',
      debt_name: 'Private Debt',
      amount_pence: 12345,
      safe_field: 'keep-me',
      error: err,
    });

    const logs = parseLogCalls(stderrSpy);
    expect(logs).toHaveLength(1);
    expect(logs[0]['meta']).toMatchObject({
      userId: 'u1',
      email: '[REDACTED]',
      password: '[REDACTED]',
      token: '[REDACTED]',
      debt_name: '[REDACTED]',
      amount_pence: '[REDACTED]',
      safe_field: 'keep-me',
      error: {
        name: 'Error',
        message: 'boom',
      },
    });
    const meta = logs[0]['meta'] as Record<string, unknown>;
    const serialisedError = meta['error'] as Record<string, unknown>;
    expect(serialisedError['stack']).toEqual(expect.stringContaining('Error: boom'));
  });

  it('serialises circular Error causes and arrays safely', async () => {
    process.env.LOG_LEVEL = 'debug';
    vi.resetModules();

    const { logger } = await import('../../server/services/logger.js');
    stdoutSpy.mockClear();
    stderrSpy.mockClear();

    const err = new Error('boom') as Error & { cause?: unknown };
    const payload: Record<string, unknown> = { error: err, items: [] as unknown[] };
    err.cause = payload;
    (payload['items'] as unknown[]).push(payload);

    logger.error('Circular failure', payload);

    const logs = parseLogCalls(stderrSpy);
    expect(logs).toHaveLength(1);
    expect(logs[0]['message']).toBe('Circular failure');
    const meta = logs[0]['meta'] as Record<string, unknown>;
    expect(meta['items']).toEqual(['[Circular]']);
    expect((meta['error'] as Record<string, unknown>)['cause']).toBe('[Circular]');
  });
});
