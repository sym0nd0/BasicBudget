import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { getApp, makeTestUser, createTestUser, loginTestUser } from '../helpers.js';

let app: Awaited<ReturnType<typeof getApp>>;
let agent: ReturnType<typeof supertest.agent>;
let csrfToken: string;

async function getCsrf(a: ReturnType<typeof supertest.agent>): Promise<string> {
  const r = await a.get('/api/auth/csrf-token');
  const token = (r.body as { token?: string }).token;
  if (!token) {
    throw new Error(
      `csrfToken: expected token from /api/auth/csrf-token but got ${r.status} — body: ${JSON.stringify(r.body)}`
    );
  }
  return token;
}

beforeAll(async () => {
  app = await getApp();
  agent = supertest.agent(app);
  const user = makeTestUser('profile');
  await createTestUser(agent, user);
  await loginTestUser(agent, user);
  csrfToken = await getCsrf(agent);
});

describe('GET /api/auth/me — datetime format defaults', () => {
  it('GET /api/auth/me returns date_format and time_format with defaults', async () => {
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.date_format).toBe('DD/MM/YYYY');
    expect(res.body.time_format).toBe('12h');
  });
});

describe('PUT /api/auth/profile/datetime-format', () => {
  it('updates date_format and time_format', async () => {
    const res = await agent
      .put('/api/auth/profile/datetime-format')
      .set('x-csrf-token', csrfToken)
      .send({ date_format: 'MM/DD/YYYY', time_format: '24h' });
    expect(res.status).toBe(200);
    expect(res.body.date_format).toBe('MM/DD/YYYY');
    expect(res.body.time_format).toBe('24h');

    // Verify persisted
    const me = await agent.get('/api/auth/me');
    expect(me.body.date_format).toBe('MM/DD/YYYY');
    expect(me.body.time_format).toBe('24h');
  });

  it('rejects invalid values', async () => {
    const res = await agent
      .put('/api/auth/profile/datetime-format')
      .set('x-csrf-token', csrfToken)
      .send({ date_format: 'invalid', time_format: 'nope' });
    expect(res.status).toBe(400);
  });
});
