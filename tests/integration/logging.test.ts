import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAgent } from '../helpers.js';
import { deleteSetting, setSetting } from '../../server/services/settings.js';

function parseLogCalls(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown>[] {
  return spy.mock.calls.map(call => JSON.parse(String(call[0])) as Record<string, unknown>);
}

describe('request logging', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setSetting('log.level', 'debug');
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    deleteSetting('log.level');
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('logs auth denial and request completion with request metadata', async () => {
    const agent = await getAgent();
    stdoutSpy.mockClear();
    stderrSpy.mockClear();

    const res = await agent.get('/api/incomes');

    expect(res.status).toBe(401);

    const logs = parseLogCalls(stdoutSpy);
    expect(logs.some(log =>
      log['level'] === 'debug' &&
      log['message'] === 'Auth required: no authenticated session' &&
      typeof (log['meta'] as Record<string, unknown> | undefined)?.['request_id'] === 'string' &&
      (log['meta'] as Record<string, unknown> | undefined)?.['path'] === '/',
    )).toBe(true);

    expect(logs.some(log =>
      log['level'] === 'warn' &&
      log['message'] === 'HTTP request completed' &&
      (log['meta'] as Record<string, unknown> | undefined)?.['method'] === 'GET' &&
      (log['meta'] as Record<string, unknown> | undefined)?.['route'] === '/api/incomes/' &&
      (log['meta'] as Record<string, unknown> | undefined)?.['status'] === 401,
    )).toBe(true);

    expect(stderrSpy).not.toHaveBeenCalled();
  });
});
