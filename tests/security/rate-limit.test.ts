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

describe('rate limiting', () => {
  it('login brute force triggers 429 after 10 attempts', async () => {
    const agent = supertest.agent(app);
    const user = makeTestUser('rl');
    let csrf = await csrfToken(agent);
    await agent.post('/api/auth/register').set('X-CSRF-Token', csrf).send({ email: user.email, password: user.password });

    let lastStatus = 0;
    for (let i = 0; i < 12; i++) {
      csrf = await csrfToken(agent);
      const res = await agent
        .post('/api/auth/login')
        .set('X-CSRF-Token', csrf)
        .send({ email: user.email, password: 'WrongPass1' });
      lastStatus = res.status;
      if (res.status === 429) break;
    }
    expect(lastStatus).toBe(429);
  });
});
