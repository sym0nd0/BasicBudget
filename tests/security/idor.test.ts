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

describe('IDOR protection', () => {
  it('user A cannot access user B\'s expense by guessing ID', async () => {
    const { agent: agentA } = await registerAndLogin('idor_a');
    const { agent: agentB } = await registerAndLogin('idor_b');

    // B creates an expense
    let csrf = await csrfToken(agentB);
    const createRes = await agentB
      .post('/api/expenses')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'B Expense', amount_pence: 500, posting_day: 1, type: 'fixed', category: 'Other', is_household: false, split_ratio: 1, is_recurring: true, recurrence_type: 'monthly' });
    const expenseId = (createRes.body as { id: string }).id;

    // A tries to update it
    csrf = await csrfToken(agentA);
    const putRes = await agentA
      .put(`/api/expenses/${expenseId}`)
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Hacked' });
    expect(putRes.status).toBe(404);
  });

  it('user A cannot delete user B\'s savings goal', async () => {
    const { agent: agentA } = await registerAndLogin('idor_sg_a');
    const { agent: agentB } = await registerAndLogin('idor_sg_b');

    let csrf = await csrfToken(agentB);
    const createRes = await agentB
      .post('/api/savings-goals')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'B Goal', target_amount_pence: 10000 });
    const goalId = (createRes.body as { id: string }).id;

    csrf = await csrfToken(agentA);
    const delRes = await agentA.delete(`/api/savings-goals/${goalId}`).set('X-CSRF-Token', csrf);
    expect(delRes.status).toBe(404);
  });
});
