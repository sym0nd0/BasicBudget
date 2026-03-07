import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { getApp, makeTestUser } from '../helpers.js';

let app: Awaited<ReturnType<typeof getApp>>;
let ownerAgent: ReturnType<typeof supertest.agent>;
let anonAgent: ReturnType<typeof supertest.agent>;

async function csrfToken(agent: ReturnType<typeof supertest.agent>): Promise<string> {
  const r = await agent.get('/api/auth/csrf-token');
  return (r.body as { token?: string }).token ?? '';
}

beforeAll(async () => {
  app = await getApp();

  ownerAgent = supertest.agent(app);
  const owner = makeTestUser('hinvites_owner');
  let csrf = await csrfToken(ownerAgent);
  await ownerAgent.post('/api/auth/register').set('X-CSRF-Token', csrf).send({ email: owner.email, password: owner.password });
  csrf = await csrfToken(ownerAgent);
  await ownerAgent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email: owner.email, password: owner.password });

  anonAgent = supertest.agent(app);
});

describe('Household invite management', () => {
  describe('GET /api/household/invites', () => {
    it('returns empty array when no active invites exist', async () => {
      const res = await ownerAgent.get('/api/household/invites');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(0);
    });

    it('returns 401 for unauthenticated requests', async () => {
      const res = await anonAgent.get('/api/household/invites');
      expect(res.status).toBe(401);
    });
  });

  describe('After sending an invite', () => {
    let inviteId: string;

    beforeAll(async () => {
      const csrf = await csrfToken(ownerAgent);
      await ownerAgent
        .post('/api/household/invite')
        .set('X-CSRF-Token', csrf)
        .send({ email: 'rescind-target@example.com' });
    });

    it('GET /invites returns the active invite with correct fields', async () => {
      const res = await ownerAgent.get('/api/household/invites');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const invites = res.body as Array<{ id: string; invitee_email: string; created_at: string; expires_at: string }>;
      expect(invites.length).toBeGreaterThanOrEqual(1);
      const inv = invites.find(i => i.invitee_email === 'rescind-target@example.com');
      expect(inv).toBeDefined();
      expect(inv!.id).toBeTruthy();
      expect(inv!.created_at).toBeTruthy();
      expect(inv!.expires_at).toBeTruthy();
      inviteId = inv!.id;
    });

    it('DELETE /invites/:id rescind the invite (200)', async () => {
      const csrf = await csrfToken(ownerAgent);
      const res = await ownerAgent
        .delete(`/api/household/invites/${inviteId}`)
        .set('X-CSRF-Token', csrf);
      expect(res.status).toBe(200);
      expect((res.body as { message: string }).message).toBeTruthy();
    });

    it('GET /invites no longer contains the rescinded invite', async () => {
      const res = await ownerAgent.get('/api/household/invites');
      expect(res.status).toBe(200);
      const invites = res.body as Array<{ id: string; invitee_email: string }>;
      expect(invites.find(i => i.invitee_email === 'rescind-target@example.com')).toBeUndefined();
    });

    it('DELETE /invites/:id with non-existent id returns 404', async () => {
      const csrf = await csrfToken(ownerAgent);
      const res = await ownerAgent
        .delete('/api/household/invites/non-existent-id-12345')
        .set('X-CSRF-Token', csrf);
      expect(res.status).toBe(404);
    });

    it('DELETE /invites/:id returns 401 for unauthenticated requests', async () => {
      const csrf = await csrfToken(anonAgent);
      const res = await anonAgent
        .delete(`/api/household/invites/${inviteId}`)
        .set('X-CSRF-Token', csrf);
      expect(res.status).toBe(401);
    });
  });
});
