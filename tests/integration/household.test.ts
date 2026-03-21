import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { getApp, makeTestUser } from '../helpers.js';

let app: Awaited<ReturnType<typeof getApp>>;

beforeAll(async () => {
  app = await getApp();
});

async function csrfToken(agent: ReturnType<typeof supertest.agent>): Promise<string> {
  const r = await agent.get('/api/auth/csrf-token');
  return (r.body as { token?: string }).token ?? '';
}

async function registerAndLogin(suffix: string) {
  const agent = supertest.agent(app);
  const user = makeTestUser(suffix);
  let csrf = await csrfToken(agent);
  await agent.post('/api/auth/register').set('X-CSRF-Token', csrf).send({ email: user.email, password: user.password });
  csrf = await csrfToken(agent);
  await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email: user.email, password: user.password });
  return { agent, user };
}

describe('household isolation', () => {
  it('two users in different households cannot see each others data', async () => {
    const { agent: agentA } = await registerAndLogin('hh_a');
    const { agent: agentB } = await registerAndLogin('hh_b');

    // User A creates an income
    const csrf = await csrfToken(agentA);
    const createRes = await agentA
      .post('/api/incomes')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'A Income', amount_pence: 100000, posting_day: 1, gross_or_net: 'net', is_recurring: true, recurrence_type: 'monthly' });
    expect(createRes.status).toBe(201);

    // User B should not see User A's income
    const bIncomes = await agentB.get('/api/incomes');
    const incomes = bIncomes.body as { name: string }[];
    expect(incomes.find(i => i.name === 'A Income')).toBeUndefined();
  });

  it('user A cannot delete user B\'s income by ID', async () => {
    const { agent: agentA } = await registerAndLogin('hh_del_a');
    const { agent: agentB } = await registerAndLogin('hh_del_b');

    // User B creates an income
    let csrf = await csrfToken(agentB);
    const createRes = await agentB
      .post('/api/incomes')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'B Income', amount_pence: 50000, posting_day: 1, gross_or_net: 'net', is_recurring: true, recurrence_type: 'monthly' });
    const incomeId = (createRes.body as { id: string }).id;

    // User A tries to delete it
    csrf = await csrfToken(agentA);
    const delRes = await agentA.delete(`/api/incomes/${incomeId}`).set('X-CSRF-Token', csrf);
    expect(delRes.status).toBe(404);
  });
});
