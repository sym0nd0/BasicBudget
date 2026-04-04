import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { getApp, makeTestUser, createTestUser, loginTestUser } from '../helpers.js';
import type { TestUser } from '../helpers.js';

let app: Awaited<ReturnType<typeof getApp>>;
let adminAgent: ReturnType<typeof supertest.agent>;
let adminUser: TestUser;
let nonAdminAgent: ReturnType<typeof supertest.agent>;

async function csrfToken(agent: ReturnType<typeof supertest.agent>): Promise<string> {
  const r = await agent.get('/api/auth/csrf-token');
  return (r.body as { token?: string }).token ?? '';
}

beforeAll(async () => {
  app = await getApp();

  // Register the first user — they become admin automatically
  adminAgent = supertest.agent(app);
  adminUser = makeTestUser('admin');
  let csrf = await csrfToken(adminAgent);
  await adminAgent.post('/api/auth/register').set('X-CSRF-Token', csrf)
    .send({ email: adminUser.email, password: adminUser.password, display_name: adminUser.displayName });
  csrf = await csrfToken(adminAgent);
  await adminAgent.post('/api/auth/login').set('X-CSRF-Token', csrf)
    .send({ email: adminUser.email, password: adminUser.password });

  // Register a second user — they will NOT be admin
  nonAdminAgent = supertest.agent(app);
  const regularUser = makeTestUser('regular');
  await createTestUser(nonAdminAgent, regularUser);
  await loginTestUser(nonAdminAgent, regularUser);
});

describe('GET /api/admin/backup', () => {
  it('returns 401 without auth', async () => {
    const agent = supertest.agent(app);
    const res = await agent.get('/api/admin/backup');
    expect(res.status).toBe(401);
  });

  it('returns 403 for authenticated non-admin', async () => {
    const res = await nonAdminAgent.get('/api/admin/backup');
    expect(res.status).toBe(403);
  });

  it('returns valid backup JSON for admin', async () => {
    const res = await adminAgent.get('/api/admin/backup');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('backup_type', 'full');
    expect(res.body).toHaveProperty('backup_schema_version', 1);
    expect(res.body).toHaveProperty('tables');
    expect(res.body.tables).toHaveProperty('users');
    expect(res.body.tables).toHaveProperty('system_settings');
    // Ephemeral tables excluded
    expect(res.body.tables).not.toHaveProperty('sessions');
    expect(res.body.tables).not.toHaveProperty('totp_used_tokens');
    expect(res.body.tables).not.toHaveProperty('reset_tokens');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('includes created data in backup', async () => {
    const csrf = await csrfToken(adminAgent);
    await adminAgent.post('/api/incomes').set('X-CSRF-Token', csrf)
      .send({ name: 'Test Salary Backup', amount_pence: 300000, posting_day: 25, is_recurring: true });
    const res = await adminAgent.get('/api/admin/backup');
    expect(res.status).toBe(200);
    const tables = (res.body as { tables: Record<string, unknown[]> }).tables;
    const incomes = tables['incomes'] as Array<{ name: string }>;
    expect(incomes.some(i => i.name === 'Test Salary Backup')).toBe(true);
  });
});

describe('POST /api/admin/backup/restore', () => {
  it('returns 401 without auth', async () => {
    const agent = supertest.agent(app);
    const csrf = await csrfToken(agent); // CSRF must be valid for auth check to run
    const data = { backup_type: 'full', backup_schema_version: 1, tables: {} };
    const res = await agent
      .post('/api/admin/backup/restore')
      .set('X-CSRF-Token', csrf)
      .attach('file', Buffer.from(JSON.stringify(data)), 'backup.json');
    expect(res.status).toBe(401);
  });

  it('returns 403 for authenticated non-admin', async () => {
    const csrf = await csrfToken(nonAdminAgent);
    const data = { backup_type: 'full', backup_schema_version: 1, tables: {} };
    const res = await nonAdminAgent
      .post('/api/admin/backup/restore')
      .set('X-CSRF-Token', csrf)
      .attach('file', Buffer.from(JSON.stringify(data)), 'backup.json');
    expect(res.status).toBe(403);
  });

  it('returns 400 without file', async () => {
    const csrf = await csrfToken(adminAgent);
    const res = await adminAgent
      .post('/api/admin/backup/restore')
      .set('X-CSRF-Token', csrf);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON', async () => {
    const csrf = await csrfToken(adminAgent);
    const res = await adminAgent
      .post('/api/admin/backup/restore')
      .set('X-CSRF-Token', csrf)
      .attach('file', Buffer.from('not json'), 'backup.json');
    expect(res.status).toBe(400);
  });

  it('returns 400 for wrong backup_type', async () => {
    const csrf = await csrfToken(adminAgent);
    const data = { backup_type: 'partial', backup_schema_version: 1, tables: {} };
    const res = await adminAgent
      .post('/api/admin/backup/restore')
      .set('X-CSRF-Token', csrf)
      .attach('file', Buffer.from(JSON.stringify(data)), 'backup.json');
    expect(res.status).toBe(400);
  });

  it('returns 400 for wrong backup_schema_version', async () => {
    const csrf = await csrfToken(adminAgent);
    const data = { backup_type: 'full', backup_schema_version: 99, tables: {} };
    const res = await adminAgent
      .post('/api/admin/backup/restore')
      .set('X-CSRF-Token', csrf)
      .attach('file', Buffer.from(JSON.stringify(data)), 'backup.json');
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing tables', async () => {
    const csrf = await csrfToken(adminAgent);
    const data = { backup_type: 'full', backup_schema_version: 1 };
    const res = await adminAgent
      .post('/api/admin/backup/restore')
      .set('X-CSRF-Token', csrf)
      .attach('file', Buffer.from(JSON.stringify(data)), 'backup.json');
    expect(res.status).toBe(400);
  });

  it('round-trips backup and restore', async () => {
    // Create an income
    let csrf = await csrfToken(adminAgent);
    await adminAgent.post('/api/incomes').set('X-CSRF-Token', csrf)
      .send({ name: 'Roundtrip Salary', amount_pence: 300000, posting_day: 25, is_recurring: true });

    // Backup
    const backupRes = await adminAgent.get('/api/admin/backup');
    expect(backupRes.status).toBe(200);
    const backupData = backupRes.body as Record<string, unknown>;

    // Verify income appears in backup
    const tables = (backupData as { tables: Record<string, unknown[]> }).tables;
    const incomes = tables['incomes'] as Array<{ name: string }>;
    expect(incomes.some(i => i.name === 'Roundtrip Salary')).toBe(true);

    // Create another income (post-backup)
    csrf = await csrfToken(adminAgent);
    await adminAgent.post('/api/incomes').set('X-CSRF-Token', csrf)
      .send({ name: 'Post-Backup Bonus', amount_pence: 50000, posting_day: 1, is_recurring: true });

    // Count incomes before restore
    const beforeRes = await adminAgent.get('/api/incomes?month=2026-03');
    const beforeCount = (beforeRes.body as unknown[]).length;
    expect(beforeCount).toBeGreaterThan(0);

    // Restore from backup
    csrf = await csrfToken(adminAgent);
    const restoreRes = await adminAgent
      .post('/api/admin/backup/restore')
      .set('X-CSRF-Token', csrf)
      .attach('file', Buffer.from(JSON.stringify(backupData)), 'backup.json');
    expect(restoreRes.status).toBe(200);

    // Re-login (session was destroyed by restore)
    const freshAgent = supertest.agent(app);
    csrf = await csrfToken(freshAgent);
    await freshAgent.post('/api/auth/login').set('X-CSRF-Token', csrf)
      .send({ email: adminUser.email, password: adminUser.password });

    // Verify post-backup income is gone
    const afterRes = await freshAgent.get('/api/incomes?month=2026-03');
    const afterIncomes = afterRes.body as Array<{ name: string }>;
    expect(afterIncomes.some(i => i.name === 'Post-Backup Bonus')).toBe(false);

    // Restore adminAgent session for subsequent tests
    csrf = await csrfToken(adminAgent);
    await adminAgent.post('/api/auth/login').set('X-CSRF-Token', csrf)
      .send({ email: adminUser.email, password: adminUser.password });
  });

  it('invalidates sessions after restore', async () => {
    const backupRes = await adminAgent.get('/api/admin/backup');
    expect(backupRes.status).toBe(200);
    const csrf = await csrfToken(adminAgent);
    const restoreRes = await adminAgent
      .post('/api/admin/backup/restore')
      .set('X-CSRF-Token', csrf)
      .attach('file', Buffer.from(JSON.stringify(backupRes.body)), 'backup.json');
    expect(restoreRes.status).toBe(200);
    // The admin session was deleted — auth/status should report unauthenticated
    const statusRes = await adminAgent.get('/api/auth/status');
    expect(statusRes.status).toBe(200);
    expect((statusRes.body as { authenticated?: boolean }).authenticated).toBe(false);
  });
});
