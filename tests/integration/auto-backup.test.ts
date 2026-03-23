import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { getApp, makeTestUser } from '../helpers.js';

let app: Awaited<ReturnType<typeof getApp>>;
let adminAgent: ReturnType<typeof supertest.agent>;
let nonAdminAgent: ReturnType<typeof supertest.agent>;

async function csrfToken(agent: ReturnType<typeof supertest.agent>): Promise<string> {
  const r = await agent.get('/api/auth/csrf-token');
  return (r.body as { token?: string }).token ?? '';
}

beforeAll(async () => {
  app = await getApp();

  // First user registered becomes admin automatically
  adminAgent = supertest.agent(app);
  const adminUser = makeTestUser('abackup');
  let csrf = await csrfToken(adminAgent);
  const adminRegRes = await adminAgent.post('/api/auth/register').set('X-CSRF-Token', csrf)
    .send({ email: adminUser.email, password: adminUser.password, display_name: adminUser.displayName });
  expect(adminRegRes.status).toBe(201);
  csrf = await csrfToken(adminAgent);
  const adminLoginRes = await adminAgent.post('/api/auth/login').set('X-CSRF-Token', csrf)
    .send({ email: adminUser.email, password: adminUser.password });
  expect(adminLoginRes.status).toBe(200);

  // Second user — not admin
  nonAdminAgent = supertest.agent(app);
  const regularUser = makeTestUser('abackup-reg');
  csrf = await csrfToken(nonAdminAgent);
  const regRes = await nonAdminAgent.post('/api/auth/register').set('X-CSRF-Token', csrf)
    .send({ email: regularUser.email, password: regularUser.password, display_name: regularUser.displayName });
  expect(regRes.status).toBe(201);
  csrf = await csrfToken(nonAdminAgent);
  const loginRes = await nonAdminAgent.post('/api/auth/login').set('X-CSRF-Token', csrf)
    .send({ email: regularUser.email, password: regularUser.password });
  expect(loginRes.status).toBe(200);
});

describe('GET /api/admin/settings/backup', () => {
  it('returns 401 without auth', async () => {
    const agent = supertest.agent(app);
    const res = await agent.get('/api/admin/settings/backup');
    expect(res.status).toBe(401);
  });

  it('returns 403 for authenticated non-admin', async () => {
    const res = await nonAdminAgent.get('/api/admin/settings/backup');
    expect(res.status).toBe(403);
  });

  it('returns default config for admin', async () => {
    const res = await adminAgent.get('/api/admin/settings/backup');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      enabled: false,
      interval_hours: 24,
      max_backups: 7,
    });
    expect(res.body).toHaveProperty('last_backup_at');
    expect(res.body).toHaveProperty('next_backup_at');
    expect(res.body).toHaveProperty('backup_count');
  });
});

describe('PUT /api/admin/settings/backup', () => {
  it('returns 401 without auth', async () => {
    const agent = supertest.agent(app);
    const csrf = await csrfToken(agent);
    const res = await agent
      .put('/api/admin/settings/backup')
      .set('X-CSRF-Token', csrf)
      .send({ enabled: true, interval_hours: 12, max_backups: 5 });
    expect(res.status).toBe(401);
  });

  it('returns 403 for authenticated non-admin', async () => {
    const csrf = await csrfToken(nonAdminAgent);
    const res = await nonAdminAgent
      .put('/api/admin/settings/backup')
      .set('X-CSRF-Token', csrf)
      .send({ enabled: true, interval_hours: 12, max_backups: 5 });
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid interval_hours (0)', async () => {
    const csrf = await csrfToken(adminAgent);
    const res = await adminAgent
      .put('/api/admin/settings/backup')
      .set('X-CSRF-Token', csrf)
      .send({ enabled: true, interval_hours: 0, max_backups: 7 });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid max_backups (-1)', async () => {
    const csrf = await csrfToken(adminAgent);
    const res = await adminAgent
      .put('/api/admin/settings/backup')
      .set('X-CSRF-Token', csrf)
      .send({ enabled: false, interval_hours: 24, max_backups: -1 });
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing fields', async () => {
    const csrf = await csrfToken(adminAgent);
    const res = await adminAgent
      .put('/api/admin/settings/backup')
      .set('X-CSRF-Token', csrf)
      .send({ enabled: true });
    expect(res.status).toBe(400);
  });

  it('saves valid config and returns it on subsequent GET', async () => {
    const csrf = await csrfToken(adminAgent);
    const putRes = await adminAgent
      .put('/api/admin/settings/backup')
      .set('X-CSRF-Token', csrf)
      .send({ enabled: false, interval_hours: 6, max_backups: 3 });
    expect(putRes.status).toBe(200);
    expect(putRes.body).toHaveProperty('message');

    const getRes = await adminAgent.get('/api/admin/settings/backup');
    expect(getRes.status).toBe(200);
    expect(getRes.body).toMatchObject({
      enabled: false,
      interval_hours: 6,
      max_backups: 3,
    });
  });
});
