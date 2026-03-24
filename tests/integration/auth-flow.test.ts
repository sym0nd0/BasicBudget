import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { getApp, makeTestUser, getCsrfToken } from '../helpers.js';

let app: Awaited<ReturnType<typeof getApp>>;

beforeAll(async () => {
  app = await getApp();
});

describe('auth flow', () => {
  it('registers a new user', async () => {
    const agent = supertest.agent(app);
    const user = makeTestUser('reg');
    const csrf = await getCsrfToken(agent);
    const res = await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', csrf)
      .send({ email: user.email, password: user.password, display_name: user.displayName });
    expect(res.status).toBe(201);
    expect((res.body as { message?: string }).message).toContain('Registration successful');
  });

  it('rejects registration with weak password', async () => {
    const agent = supertest.agent(app);
    const csrf = await getCsrfToken(agent);
    const res = await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', csrf)
      .send({ email: 'weak@example.com', password: 'weak' });
    expect(res.status).toBe(400);
  });

  it('logs in successfully', async () => {
    const agent = supertest.agent(app);
    const user = makeTestUser('login');
    let csrf = await getCsrfToken(agent);
    await agent.post('/api/auth/register').set('X-CSRF-Token', csrf).send({ email: user.email, password: user.password });

    csrf = await getCsrfToken(agent);
    const res = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrf)
      .send({ email: user.email, password: user.password });
    expect(res.status).toBe(200);
  });

  it('rejects wrong password and locks after 5 failures', async () => {
    const agent = supertest.agent(app);
    const user = makeTestUser('lock');
    let csrf = await getCsrfToken(agent);
    await agent.post('/api/auth/register').set('X-CSRF-Token', csrf).send({ email: user.email, password: user.password });

    for (let i = 0; i < 5; i++) {
      csrf = await getCsrfToken(agent);
      await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email: user.email, password: 'WrongPass1' });
    }
    csrf = await getCsrfToken(agent);
    const locked = await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email: user.email, password: 'WrongPass1' });
    expect(locked.status).toBe(423);
  });

  it('status returns authenticated after login', async () => {
    const agent = supertest.agent(app);
    const user = makeTestUser('status');
    let csrf = await getCsrfToken(agent);
    await agent.post('/api/auth/register').set('X-CSRF-Token', csrf).send({ email: user.email, password: user.password });
    csrf = await getCsrfToken(agent);
    await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email: user.email, password: user.password });

    const status = await agent.get('/api/auth/status');
    expect((status.body as { authenticated?: boolean }).authenticated).toBe(true);
  });

  it('unauthenticated request to /api/incomes returns 401', async () => {
    const agent = supertest.agent(app);
    const res = await agent.get('/api/incomes');
    expect(res.status).toBe(401);
  });

  it('forgot-password always returns 200', async () => {
    const agent = supertest.agent(app);
    const csrf = await getCsrfToken(agent);
    const res = await agent
      .post('/api/auth/forgot-password')
      .set('X-CSRF-Token', csrf)
      .send({ email: 'nonexistent@example.com' });
    expect(res.status).toBe(200);
  });
});

describe('login error messages', () => {
  it('returns descriptive error on wrong password', async () => {
    const agent = supertest.agent(app);
    const user = makeTestUser('err_msg_wrong');
    let csrf = await getCsrfToken(agent);
    await agent.post('/api/auth/register').set('X-CSRF-Token', csrf).send({ email: user.email, password: user.password });

    csrf = await getCsrfToken(agent);
    const res = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrf)
      .send({ email: user.email, password: 'WrongPass1!' });
    expect(res.status).toBe(401);
    expect((res.body as { message?: string }).message).toBe('Invalid email or password');
  });

  it('returns descriptive error for non-existent user', async () => {
    const agent = supertest.agent(app);
    const csrf = await getCsrfToken(agent);
    const res = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrf)
      .send({ email: 'nonexistent@example.com', password: 'SomePass1!' });
    expect(res.status).toBe(401);
    expect((res.body as { message?: string }).message).toBe('Invalid email or password');
  });
});

