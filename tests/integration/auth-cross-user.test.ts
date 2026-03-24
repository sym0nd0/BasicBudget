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

describe('cross-user login', () => {
  it('User B can log in and be identified correctly after User A logs out', async () => {
    const agent = supertest.agent(app);

    // Register User A
    const userA = makeTestUser('crossuser_a');
    let csrf = await csrfToken(agent);
    await agent.post('/api/auth/register').set('X-CSRF-Token', csrf).send({ email: userA.email, password: userA.password });

    // Login User A
    csrf = await csrfToken(agent);
    await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email: userA.email, password: userA.password });

    // Verify User A is authenticated
    const statusA = await agent.get('/api/auth/status');
    expect((statusA.body as { authenticated?: boolean }).authenticated).toBe(true);
    expect((statusA.body as { user?: { email?: string } }).user?.email).toBe(userA.email);

    // Logout User A
    csrf = await csrfToken(agent);
    await agent.post('/api/auth/logout').set('X-CSRF-Token', csrf);

    // Register User B on a separate agent
    const agentB = supertest.agent(app);
    const userB = makeTestUser('crossuser_b');
    const csrfB = await csrfToken(agentB);
    await agentB.post('/api/auth/register').set('X-CSRF-Token', csrfB).send({ email: userB.email, password: userB.password });

    // Login User B on User A's agent (simulates same browser)
    csrf = await csrfToken(agent);
    const loginRes = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrf)
      .send({ email: userB.email, password: userB.password });
    expect(loginRes.status).toBe(200);

    // Verify User B is the authenticated user
    const statusB = await agent.get('/api/auth/status');
    expect((statusB.body as { authenticated?: boolean }).authenticated).toBe(true);
    expect((statusB.body as { user?: { email?: string } }).user?.email).toBe(userB.email);
  });
});
