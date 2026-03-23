import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { getApp, makeTestUser, createTestUser, loginTestUser } from '../helpers.js';

let app: Awaited<ReturnType<typeof getApp>>;
let adminAgent: ReturnType<typeof supertest.agent>;
let nonAdminAgent: ReturnType<typeof supertest.agent>;

async function csrfToken(agent: ReturnType<typeof supertest.agent>): Promise<string> {
  const r = await agent.get('/api/auth/csrf-token');
  const token = (r.body as { token?: string }).token;
  if (!token) {
    throw new Error(
      `csrfToken: expected token from /api/auth/csrf-token but got ${r.status} — body: ${JSON.stringify(r.body)}`
    );
  }
  return token;
}

beforeAll(async () => {
  app = await getApp();

  // First user — set admin explicitly for resilience against worker reuse
  adminAgent = supertest.agent(app);
  const adminUser = makeTestUser('abackup');
  await createTestUser(adminAgent, adminUser);
  await loginTestUser(adminAgent, adminUser);

  // Ensure admin role regardless of registration order
  const db = (await import('../../server/db.js')).default;
  db.prepare("UPDATE users SET system_role = 'admin' WHERE email = ?").run(adminUser.email);

  // Second user — not admin
  nonAdminAgent = supertest.agent(app);
  const regularUser = makeTestUser('abackup-reg');
  await createTestUser(nonAdminAgent, regularUser);
  await loginTestUser(nonAdminAgent, regularUser);
});

afterAll(async () => {
  const { deleteSetting } = await import('../../server/services/settings.js');
  deleteSetting('backup.enabled');
  deleteSetting('backup.interval_hours');
  deleteSetting('backup.max_backups');
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
