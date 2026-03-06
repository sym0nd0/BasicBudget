import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { getApp, makeTestUser } from '../helpers.js';

let app: Awaited<ReturnType<typeof getApp>>;
let agentA: ReturnType<typeof supertest.agent>;
let agentB: ReturnType<typeof supertest.agent>;

async function csrfToken(agent: ReturnType<typeof supertest.agent>): Promise<string> {
  const r = await agent.get('/api/auth/csrf-token');
  return (r.body as { token?: string }).token ?? '';
}

beforeAll(async () => {
  app = await getApp();

  agentA = supertest.agent(app);
  agentB = supertest.agent(app);

  const userA = makeTestUser('idor_a');
  const userB = makeTestUser('idor_b');

  let csrf = await csrfToken(agentA);
  await agentA.post('/api/auth/register').set('X-CSRF-Token', csrf).send({ email: userA.email, password: userA.password });
  csrf = await csrfToken(agentA);
  await agentA.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email: userA.email, password: userA.password });

  csrf = await csrfToken(agentB);
  await agentB.post('/api/auth/register').set('X-CSRF-Token', csrf).send({ email: userB.email, password: userB.password });
  csrf = await csrfToken(agentB);
  await agentB.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email: userB.email, password: userB.password });
});

describe('IDOR protection', () => {
  it('user A cannot access user B\'s expense by guessing ID', async () => {
    // B creates an expense
    let csrf = await csrfToken(agentB);
    const createRes = await agentB
      .post('/api/expenses')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'B Expense IDOR', amount_pence: 500, posting_day: 1, category: 'Other', is_household: false, split_ratio: 1, is_recurring: true, recurrence_type: 'monthly' });
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
    let csrf = await csrfToken(agentB);
    const createRes = await agentB
      .post('/api/savings-goals')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'B Goal IDOR', target_amount_pence: 10000 });
    const goalId = (createRes.body as { id: string }).id;

    csrf = await csrfToken(agentA);
    const delRes = await agentA.delete(`/api/savings-goals/${goalId}`).set('X-CSRF-Token', csrf);
    expect(delRes.status).toBe(404);
  });

  it('user A cannot edit user B\'s income by guessing ID', async () => {
    let csrf = await csrfToken(agentB);
    const createRes = await agentB
      .post('/api/incomes')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'B Salary IDOR', amount_pence: 300000, posting_day: 28, gross_or_net: 'net', is_recurring: true, recurrence_type: 'monthly' });
    const incomeId = (createRes.body as { id: string }).id;

    csrf = await csrfToken(agentA);
    const putRes = await agentA
      .put(`/api/incomes/${incomeId}`)
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Hacked' });
    expect(putRes.status).toBe(404);
  });

  it('user A cannot delete user B\'s debt by guessing ID', async () => {
    let csrf = await csrfToken(agentB);
    const createRes = await agentB
      .post('/api/debts')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'B Loan IDOR', balance_pence: 100000, interest_rate: 5.0, minimum_payment_pence: 500, posting_day: 1, is_recurring: true, recurrence_type: 'monthly' });
    const debtId = (createRes.body as { id: string }).id;

    csrf = await csrfToken(agentA);
    const delRes = await agentA.delete(`/api/debts/${debtId}`).set('X-CSRF-Token', csrf);
    expect(delRes.status).toBe(404);
  });
});
