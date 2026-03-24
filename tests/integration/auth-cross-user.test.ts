import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { getApp, makeTestUser, getCsrfToken } from '../helpers.js';

let app: Awaited<ReturnType<typeof getApp>>;

beforeAll(async () => {
  app = await getApp();
});

interface AuthStatus {
  authenticated?: boolean;
  user?: { email?: string };
}

function parseAuthStatus(res: { body: unknown }): AuthStatus {
  return res.body as AuthStatus;
}

describe('cross-user login', () => {
  it('User B can log in and be identified correctly after User A logs out', async () => {
    const agent = supertest.agent(app);

    // Register User A
    const userA = makeTestUser('crossuser_a');
    let csrf = await getCsrfToken(agent);
    await agent.post('/api/auth/register').set('X-CSRF-Token', csrf).send({ email: userA.email, password: userA.password });

    // Login User A
    csrf = await getCsrfToken(agent);
    await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email: userA.email, password: userA.password });

    // Verify User A is authenticated
    const statusA = await agent.get('/api/auth/status');
    expect(parseAuthStatus(statusA).authenticated).toBe(true);
    expect(parseAuthStatus(statusA).user?.email).toBe(userA.email);

    // Logout User A
    csrf = await getCsrfToken(agent);
    const logoutRes = await agent.post('/api/auth/logout').set('X-CSRF-Token', csrf);
    expect(logoutRes.status).toBe(204);

    // Assert session is cleared after logout
    const loggedOutStatus = await agent.get('/api/auth/status');
    expect(parseAuthStatus(loggedOutStatus).authenticated).toBe(false);

    // Register User B on a separate agent
    const agentB = supertest.agent(app);
    const userB = makeTestUser('crossuser_b');
    const csrfB = await getCsrfToken(agentB);
    await agentB.post('/api/auth/register').set('X-CSRF-Token', csrfB).send({ email: userB.email, password: userB.password });

    // Login User B on User A's agent (simulates same browser)
    csrf = await getCsrfToken(agent);
    const loginRes = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrf)
      .send({ email: userB.email, password: userB.password });
    expect(loginRes.status).toBe(200);

    // Verify User B is the authenticated user
    const statusB = await agent.get('/api/auth/status');
    expect(parseAuthStatus(statusB).authenticated).toBe(true);
    expect(parseAuthStatus(statusB).user?.email).toBe(userB.email);
  });
});
