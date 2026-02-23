import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { getApp, makeTestUser } from '../helpers.js';

let app: Awaited<ReturnType<typeof getApp>>;

beforeAll(async () => {
  app = await getApp();
});

async function csrfToken(agent: ReturnType<typeof supertest.agent>): Promise<string> {
  const r = await agent.get('/api/auth/csrf-token');
  return (r.body as { token?: string }).token ?? '';
}

describe('session security', () => {
  it('session ID changes on login (session fixation prevention)', async () => {
    const agent = supertest.agent(app);
    const user = makeTestUser('sess');

    // Get initial session cookie
    const initRes = await agent.get('/api/auth/status');
    const sidBefore = initRes.headers['set-cookie']?.[0]?.split(';')[0] ?? '';

    let csrf = await csrfToken(agent);
    await agent.post('/api/auth/register').set('X-CSRF-Token', csrf).send({ email: user.email, password: user.password });

    csrf = await csrfToken(agent);
    const loginRes = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrf)
      .send({ email: user.email, password: user.password });

    const sidAfter = loginRes.headers['set-cookie']?.[0]?.split(';')[0] ?? '';
    // SIDs should differ (session was regenerated)
    expect(sidBefore).not.toBe(sidAfter);
  });

  it('unauthenticated access to protected routes returns 401', async () => {
    const freshAgent = supertest.agent(app);
    const res = await freshAgent.get('/api/incomes');
    expect(res.status).toBe(401);
  });
});
