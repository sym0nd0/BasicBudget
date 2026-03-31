import supertest from 'supertest';
import { randomUUID } from 'node:crypto';
import db from '../server/db.js';
import { hashPassword } from '../server/auth/password.js';

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
  const token = (res.body as { token?: string }).token;
  if (!token) {
    throw new Error(
      `getCsrfToken: expected token from /api/auth/csrf-token but got ${res.status} — body: ${JSON.stringify(res.body)}`
    );
  }
  return token;
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

export function yearMonthWithOffset(offset: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthStartWithOffset(offset: number): string {
  return `${yearMonthWithOffset(offset)}-01`;
}

export function uniqueSuffix(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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
  const res = await agent
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrf)
    .send({ email: user.email, password: user.password });
  if (res.status >= 400) {
    throw new Error(`loginTestUser failed with status ${res.status}`);
  }
}

/**
 * Create a test user directly in the database and log in via HTTP.
 * This bypasses the registration rate limiter, which is useful when multiple tests
 * need to create users from the same IP address.
 */
export async function registerAndLoginDirect(
  agent: ReturnType<typeof supertest.agent>,
  user: TestUser
): Promise<void> {
  // Create user directly in database
  const userId = randomUUID();
  const householdId = randomUUID();
  const hash = await hashPassword(user.password);

  db.transaction(() => {
    db.prepare(`
      INSERT INTO users (id, email, display_name, password_hash, system_role)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, user.email.toLowerCase().trim(), user.displayName, hash, 'user');

    db.prepare('INSERT INTO households (id, name) VALUES (?, ?)').run(householdId, `${user.displayName}'s Household`);

    db.prepare(`
      INSERT INTO household_members (household_id, user_id, role)
      VALUES (?, ?, ?)
    `).run(householdId, userId, 'owner');
  })();

  // Log in via HTTP (which sets session cookie)
  await loginTestUser(agent, user);

  const statusRes = await agent.get('/api/auth/status');
  if (!(statusRes.body as { authenticated?: boolean }).authenticated) {
    await loginTestUser(agent, user);
    const retryStatusRes = await agent.get('/api/auth/status');
    if (!(retryStatusRes.body as { authenticated?: boolean }).authenticated) {
      throw new Error('registerAndLoginDirect failed to establish an authenticated session');
    }
  }
}
