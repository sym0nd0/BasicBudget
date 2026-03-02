import supertest from 'supertest';

// Lazy import app to ensure env vars are set first
let _app: ReturnType<typeof import('express').default> | null = null;

export async function getApp() {
  if (!_app) {
    const mod = await import('../server/index.js');
    _app = mod.default;
  }
  return _app;
}

export async function getAgent() {
  const app = await getApp();
  return supertest.agent(app);
}

export async function getCsrfToken(agent: ReturnType<typeof supertest.agent>, cookie?: string): Promise<string> {
  const res = await agent
    .get('/api/auth/csrf-token')
    .set('Cookie', cookie ?? '');
  return (res.body as { token?: string }).token ?? '';
}

export interface TestUser {
  email: string;
  password: string;
  displayName: string;
}

export function makeTestUser(suffix = ''): TestUser {
  const ts = Date.now() + suffix;
  return {
    email: `test${ts}@example.com`,
    password: `TestPass1!${ts}`,
    displayName: `Test User ${ts}`,
  };
}

export async function createTestUser(agent: ReturnType<typeof supertest.agent>, user: TestUser) {
  const csrf = await getCsrfToken(agent);
  await agent
    .post('/api/auth/register')
    .set('X-CSRF-Token', csrf)
    .send({ email: user.email, password: user.password, display_name: user.displayName });
}

export async function loginTestUser(agent: ReturnType<typeof supertest.agent>, user: TestUser): Promise<void> {
  const csrf = await getCsrfToken(agent);
  await agent
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrf)
    .send({ email: user.email, password: user.password });
}
