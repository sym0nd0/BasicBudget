import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { getApp, makeTestUser } from '../helpers.js';

let app: Awaited<ReturnType<typeof getApp>>;
// Shared owner agent — used for all owner-only tests
let ownerAgent: ReturnType<typeof supertest.agent>;
let ownerUserId: string;

async function csrfToken(agent: ReturnType<typeof supertest.agent>): Promise<string> {
  const r = await agent.get('/api/auth/csrf-token');
  return (r.body as { token?: string }).token ?? '';
}

beforeAll(async () => {
  app = await getApp();

  ownerAgent = supertest.agent(app);
  const ownerUser = makeTestUser('hm_owner');

  let csrf = await csrfToken(ownerAgent);
  await ownerAgent.post('/api/auth/register').set('X-CSRF-Token', csrf).send({ email: ownerUser.email, password: ownerUser.password });
  csrf = await csrfToken(ownerAgent);
  await ownerAgent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email: ownerUser.email, password: ownerUser.password });

  // Get own user_id for sole-owner protection tests
  const householdRes = await ownerAgent.get('/api/household');
  ownerUserId = (householdRes.body as { members?: Array<{ user_id: string }> }).members?.[0]?.user_id ?? '';
});

describe('Household member management', () => {
  describe('GET /api/household', () => {
    it('returns the household with members list including the owner', async () => {
      const res = await ownerAgent.get('/api/household');
      expect(res.status).toBe(200);
      const body = res.body as { members?: Array<{ user_id: string; role: string }> };
      expect(Array.isArray(body.members)).toBe(true);
      expect(body.members!.length).toBeGreaterThanOrEqual(1);
      expect(body.members!.some(m => m.role === 'owner')).toBe(true);
    });
  });

  describe('Sole owner protection', () => {
    it('sole owner cannot remove themselves from the household (400)', async () => {
      const csrf = await csrfToken(ownerAgent);
      const res = await ownerAgent
        .delete(`/api/household/members/${ownerUserId}`)
        .set('X-CSRF-Token', csrf);
      expect(res.status).toBe(400);
    });

    it('sole owner cannot demote themselves to member (400)', async () => {
      const csrf = await csrfToken(ownerAgent);
      const res = await ownerAgent
        .put(`/api/household/members/${ownerUserId}/role`)
        .set('X-CSRF-Token', csrf)
        .send({ role: 'member' });
      expect(res.status).toBe(400);
    });
  });

  describe('Role update endpoint', () => {
    it('role update requires valid role value (400)', async () => {
      const csrf = await csrfToken(ownerAgent);
      const res = await ownerAgent
        .put(`/api/household/members/${ownerUserId}/role`)
        .set('X-CSRF-Token', csrf)
        .send({ role: 'superadmin' }); // Invalid role
      expect(res.status).toBe(400);
    });

    it('owner can set own role to owner (no-op, succeeds)', async () => {
      const csrf = await csrfToken(ownerAgent);
      const res = await ownerAgent
        .put(`/api/household/members/${ownerUserId}/role`)
        .set('X-CSRF-Token', csrf)
        .send({ role: 'owner' }); // Promote self to owner when already owner
      expect(res.status).toBe(200);
    });
  });

  describe('requireOwner enforcement', () => {
    it('role update requires auth (401 when not logged in)', async () => {
      const unauthAgent = supertest.agent(app);
      const csrf = await csrfToken(unauthAgent);
      const res = await unauthAgent
        .put(`/api/household/members/${ownerUserId}/role`)
        .set('X-CSRF-Token', csrf)
        .send({ role: 'member' });
      expect(res.status).toBe(401);
    });

    it('member removal requires auth (401 when not logged in)', async () => {
      const unauthAgent = supertest.agent(app);
      const csrf = await csrfToken(unauthAgent);
      const res = await unauthAgent
        .delete(`/api/household/members/${ownerUserId}`)
        .set('X-CSRF-Token', csrf);
      expect(res.status).toBe(401);
    });
  });

  describe('Invite endpoint', () => {
    it('invite requires auth (401 when not logged in)', async () => {
      const unauthAgent = supertest.agent(app);
      const csrf = await csrfToken(unauthAgent);
      const res = await unauthAgent
        .post('/api/household/invite')
        .set('X-CSRF-Token', csrf)
        .send({ email: 'anyone@example.com' });
      expect(res.status).toBe(401);
    });

    it('authenticated owner can send an invite', async () => {
      const csrf = await csrfToken(ownerAgent);
      const res = await ownerAgent
        .post('/api/household/invite')
        .set('X-CSRF-Token', csrf)
        .send({ email: `invitee${Date.now()}@example.com` });
      expect(res.status).toBe(200);
    });
  });
});
