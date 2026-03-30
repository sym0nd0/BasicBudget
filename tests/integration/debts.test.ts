import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
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
  return { agent };
}

describe('GET /api/debts — month param', () => {
  let agent: ReturnType<typeof supertest.agent>;

  beforeEach(async () => {
    const result = await registerAndLogin(`debts_month_${Date.now()}`);
    agent = result.agent;
    const csrf = await csrfToken(agent);
    await agent
      .post('/api/debts')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Test Debt',
        balance_pence: 100000,
        minimum_payment_pence: 5000,
        overpayment_pence: 0,
        interest_rate: 12,
        recurrence_type: 'monthly',
        start_date: '2020-01-01',
        is_recurring: true,
      })
      .expect(201);
  });

  it('returns current balance for current month', async () => {
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const res = await agent.get(`/api/debts?month=${currentYM}`).expect(200);
    expect(res.body).toHaveLength(1);
    expect((res.body as { balance_pence: number }[])[0].balance_pence).toBe(100000);
  });

  it('returns estimated higher balance for previous month', async () => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYM = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    const res = await agent.get(`/api/debts?month=${prevYM}`).expect(200);
    // monthly_rate = 12/100/12 = 0.01; payment = 5000
    // expected = Math.round((100000 + 5000) / 1.01) = 103960
    expect((res.body as { balance_pence: number }[])[0].balance_pence).toBe(Math.round((100000 + 5000) / 1.01));
  });

  it('excludes debts with start_date after the requested month', async () => {
    const res = await agent.get('/api/debts?month=2020-01').expect(200);
    expect(res.body).toHaveLength(1); // debt started 2020-01-01, should appear
    const res2 = await agent.get('/api/debts?month=2019-12').expect(200);
    expect(res2.body).toHaveLength(0); // not yet started
  });
});
