import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { getApp, makeTestUser, getCsrfToken } from '../helpers.js';

let app: Awaited<ReturnType<typeof getApp>>;

beforeAll(async () => {
  app = await getApp();
});

describe('CSRF protection', () => {
  it('POST without CSRF token is rejected with 403', async () => {
    const agent = supertest.agent(app);
    const res = await agent
      .post('/api/auth/register')
      .send({ email: 'csrf@example.com', password: 'TestPass1' });
    expect(res.status).toBe(403);
  });

  it('POST with valid CSRF token succeeds', async () => {
    const agent = supertest.agent(app);
    const user = makeTestUser('csrf_ok');
    const tokenRes = await agent.get('/api/auth/csrf-token');
    const csrf = (tokenRes.body as { token?: string }).token ?? '';
    const res = await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', csrf)
      .send({ email: user.email, password: user.password });
    // 201 or 409 (already exists) — either way, not 403
    expect(res.status).not.toBe(403);
  });

  it('GET requests do not require CSRF token', async () => {
    const agent = supertest.agent(app);
    const res = await agent.get('/api/auth/status');
    expect(res.status).toBe(200);
  });

  it('login with valid CSRF token succeeds', async () => {
    const agent = supertest.agent(app);
    const user = makeTestUser('csrf_login');

    // Register
    const regCsrf = await getCsrfToken(agent);
    const regRes = await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', regCsrf)
      .send({ email: user.email, password: user.password });
    expect(regRes.status).toBe(201);

    // Log in with a fresh CSRF token — session may have changed after register
    const loginCsrf = await getCsrfToken(agent);
    const loginRes = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', loginCsrf)
      .send({ email: user.email, password: user.password });

    expect(loginRes.status).not.toBe(403);
    expect(loginRes.status).toBe(200);
  });

  it('login with a fresh CSRF token succeeds immediately after logout', async () => {
    const agent = supertest.agent(app);

    // Register + log in as user A
    const userA = makeTestUser('csrf_logout_a');
    const regCsrfA = await getCsrfToken(agent);
    const regResA = await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', regCsrfA)
      .send({ email: userA.email, password: userA.password });
    expect(regResA.status).toBe(201);

    const loginCsrfA = await getCsrfToken(agent);
    const loginResA = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', loginCsrfA)
      .send({ email: userA.email, password: userA.password });
    expect(loginResA.status).toBe(200);

    // Capture the stale token (simulates cachedCsrfToken before fix)
    const staleToken = loginCsrfA;

    // Log out as user A with a fresh token
    const logoutCsrfA = await getCsrfToken(agent);
    const logoutRes = await agent
      .post('/api/auth/logout')
      .set('X-CSRF-Token', logoutCsrfA);
    expect(logoutRes.status).toBe(204);

    // Register user B on a separate agent so the registration does not alter agent's session cookie state
    const agentB = supertest.agent(app);
    const userB = makeTestUser('csrf_logout_b');
    const regCsrfB = await getCsrfToken(agentB);
    const regResB = await agentB
      .post('/api/auth/register')
      .set('X-CSRF-Token', regCsrfB)
      .send({ email: userB.email, password: userB.password });
    expect(regResB.status).toBe(201);

    // Simulate using a stale token (no fresh fetch) — this must be rejected
    const staleLoginRes = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', staleToken)
      .send({ email: userB.email, password: userB.password });
    expect(staleLoginRes.status).toBe(403);

    // Fetch a fresh token on the same agent (simulates what the fix ensures happens)
    const freshToken = await getCsrfToken(agent);
    const freshLoginRes = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', freshToken)
      .send({ email: userB.email, password: userB.password });
    expect(freshLoginRes.status).toBe(200);
  });
});
