import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import {
  getApp,
  getCsrfToken,
  makeTestUser,
  monthStartWithOffset,
  registerAndLoginDirect,
  uniqueSuffix,
  yearMonthWithOffset,
} from '../helpers.js';

let app: Awaited<ReturnType<typeof getApp>>;

beforeAll(async () => {
  app = await getApp();
});

async function registerAndLogin(suffix: string) {
  const agent = supertest.agent(app);
  const user = makeTestUser(suffix);
  await registerAndLoginDirect(agent, user);
  return { agent };
}

describe('GET /api/debts — month param', () => {
  let agent: ReturnType<typeof supertest.agent>;

  beforeEach(async () => {
    const result = await registerAndLogin(uniqueSuffix('debts_month'));
    agent = result.agent;
    const csrf = await getCsrfToken(agent);
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
    const currentYM = yearMonthWithOffset(0);
    const res = await agent.get(`/api/debts?month=${currentYM}`).expect(200);
    expect(res.body).toHaveLength(1);
    expect((res.body as { balance_pence: number }[])[0].balance_pence).toBe(100000);
  });

  it('returns estimated higher balance for previous month', async () => {
    const prevYM = yearMonthWithOffset(-1);
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

  it('returns projected lower balances for future months', async () => {
    const nextYM = yearMonthWithOffset(1);
    const res = await agent.get(`/api/debts?month=${nextYM}`).expect(200);
    const debts = res.body as Array<{ balance_pence: number; effective_pence: number }>;

    expect(debts).toHaveLength(1);
    expect(debts[0].balance_pence).toBe(96000);
    expect(debts[0].effective_pence).toBe(5000);
  });

  it('keeps selected-month payments aligned to the requested month', async () => {
    const csrf = await getCsrfToken(agent);
    await agent
      .post('/api/debts')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Yearly Debt',
        balance_pence: 120000,
        minimum_payment_pence: 2500,
        overpayment_pence: 0,
        interest_rate: 0,
        recurrence_type: 'yearly',
        start_date: `${yearMonthWithOffset(-11)}-01`,
        is_recurring: true,
      })
      .expect(201);

    const currentYM = yearMonthWithOffset(0);
    const nextYM = yearMonthWithOffset(1);

    const currentRes = await agent.get(`/api/debts?month=${currentYM}`).expect(200);
    const nextRes = await agent.get(`/api/debts?month=${nextYM}`).expect(200);

    const currentYearly = (currentRes.body as Array<{ name: string; effective_pence: number }>).find(d => d.name === 'Yearly Debt');
    const nextYearly = (nextRes.body as Array<{ name: string; effective_pence: number }>).find(d => d.name === 'Yearly Debt');

    expect(currentYearly?.effective_pence).toBe(0);
    expect(nextYearly?.effective_pence).toBe(2500);
  });

  it('future-start debt is absent before start month, appears at start month, and then decreases', async () => {
    const csrf = await getCsrfToken(agent);
    await agent
      .post('/api/debts')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Future Debt',
        balance_pence: 100000,
        minimum_payment_pence: 10000,
        overpayment_pence: 0,
        interest_rate: 0,
        recurrence_type: 'monthly',
        start_date: monthStartWithOffset(2),
        is_recurring: true,
        posting_day: 1,
      })
      .expect(201);

    const beforeStartYM = yearMonthWithOffset(1);
    const startYM = yearMonthWithOffset(2);
    const afterStartYM = yearMonthWithOffset(3);

    const beforeStart = await agent.get(`/api/debts?month=${beforeStartYM}`).expect(200);
    const startMonth = await agent.get(`/api/debts?month=${startYM}`).expect(200);
    const afterStart = await agent.get(`/api/debts?month=${afterStartYM}`).expect(200);

    expect((beforeStart.body as Array<{ name: string }>).some(d => d.name === 'Future Debt')).toBe(false);
    expect((startMonth.body as Array<{ name: string; balance_pence: number }>).find(d => d.name === 'Future Debt')?.balance_pence).toBe(90000);
    expect((afterStart.body as Array<{ name: string; balance_pence: number }>).find(d => d.name === 'Future Debt')?.balance_pence).toBe(80000);
  });

  it('month snapshot total equals the sum of row balances', async () => {
    const csrf = await getCsrfToken(agent);
    await agent
      .post('/api/debts')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Second Debt',
        balance_pence: 50000,
        minimum_payment_pence: 2500,
        overpayment_pence: 0,
        interest_rate: 0,
        recurrence_type: 'monthly',
        start_date: '2020-01-01',
        is_recurring: true,
        posting_day: 1,
      })
      .expect(201);

    const nextYM = yearMonthWithOffset(1);
    const res = await agent.get(`/api/debts?month=${nextYM}`).expect(200);
    const debts = res.body as Array<{ balance_pence: number }>;
    const total = debts.reduce((sum, debt) => sum + debt.balance_pence, 0);

    expect(total).toBe(143500);
  });
});
