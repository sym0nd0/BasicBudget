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
    await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', regCsrf)
      .send({ email: user.email, password: user.password });

    // Log in with a fresh CSRF token — session may have changed after register
    const loginCsrf = await getCsrfToken(agent);
    const loginRes = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', loginCsrf)
      .send({ email: user.email, password: user.password });

    expect(loginRes.status).not.toBe(403);
    expect(loginRes.status).toBe(200);
  });
});
