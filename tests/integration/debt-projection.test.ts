import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import { getApp, makeTestUser, registerAndLoginDirect } from '../helpers.js';
import type { DebtProjectionPoint } from '../../shared/types.js';

let app: Awaited<ReturnType<typeof getApp>>;

beforeAll(async () => {
  app = await getApp();
});

async function csrfToken(agent: ReturnType<typeof supertest.agent>): Promise<string> {
  const r = await agent.get('/api/auth/csrf-token');
  return (r.body as { token?: string }).token ?? '';
}

async function loginAgent(suffix: string) {
  const agent = supertest.agent(app);
  const user = makeTestUser(suffix);
  await registerAndLoginDirect(agent, user);
  return agent;
}

async function createDebt(
  agent: ReturnType<typeof supertest.agent>,
  overrides: Record<string, unknown> = {},
) {
  const csrf = await csrfToken(agent);
  const res = await agent
    .post('/api/debts')
    .set('X-CSRF-Token', csrf)
    .send({
      name: 'Test Debt',
      balance_pence: 100000,
      minimum_payment_pence: 10000,
      overpayment_pence: 0,
      interest_rate: 0,
      recurrence_type: 'monthly',
      start_date: '2020-01-01',
      is_recurring: true,
      posting_day: 1,
      ...overrides,
    })
    .expect(201);
  return res.body as { id: string; balance_pence: number };
}

describe('GET /api/reports/debt-projection', () => {
  let agent: ReturnType<typeof supertest.agent>;

  beforeEach(async () => {
    agent = await loginAgent(`proj_${Date.now()}`);
  });

  it('returns 200 with an array of projection points', async () => {
    await createDebt(agent);
    const res = await agent.get('/api/reports/debt-projection?months=3').expect(200);
    const points = res.body as DebtProjectionPoint[];
    expect(Array.isArray(points)).toBe(true);
    expect(points.length).toBeGreaterThan(0);
  });

  it('current month total_balance_pence equals the actual debt balance', async () => {
    const today = new Date();
    const postingDay = today.getDate();
    await createDebt(agent, { posting_day: postingDay, balance_pence: 100000 });

    const currentYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const res = await agent.get('/api/reports/debt-projection?months=6').expect(200);
    const points = res.body as DebtProjectionPoint[];

    const current = points.find(p => p.month === currentYM);
    expect(current).toBeDefined();
    expect(current!.total_balance_pence).toBe(100000);
  });

  it('future months have strictly decreasing total_balance_pence when payments exceed interest', async () => {
    await createDebt(agent, {
      balance_pence: 100000,
      minimum_payment_pence: 10000,
      interest_rate: 0,
      posting_day: 1,
    });

    const res = await agent.get('/api/reports/debt-projection?months=5').expect(200);
    const points = res.body as DebtProjectionPoint[];

    for (let i = 2; i < points.length; i++) {
      expect(points[i].total_balance_pence).toBeLessThan(points[i - 1].total_balance_pence);
    }
  });

  it('total_balance_pence matches sum of per_debt balances for every month', async () => {
    await createDebt(agent, { balance_pence: 60000, posting_day: 1 });
    await createDebt(agent, { name: 'Debt B', balance_pence: 40000, posting_day: 1 });

    const res = await agent.get('/api/reports/debt-projection?months=4').expect(200);
    const points = res.body as DebtProjectionPoint[];

    for (const point of points) {
      const sumOfParts = point.per_debt.reduce((s: number, d: { balance_pence: number }) => s + d.balance_pence, 0);
      expect(point.total_balance_pence).toBe(sumOfParts);
    }
  });

  it('respects household_only filter', async () => {
    await createDebt(agent, { balance_pence: 80000, is_household: false });
    await createDebt(agent, { name: 'Joint', balance_pence: 20000, is_household: true });

    const allRes = await agent.get('/api/reports/debt-projection?months=2').expect(200);
    const hhRes = await agent.get('/api/reports/debt-projection?months=2&household_only=true').expect(200);

    const allPoints = allRes.body as DebtProjectionPoint[];
    const hhPoints = hhRes.body as DebtProjectionPoint[];

    const today = new Date();
    const currentYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const allCurrent = allPoints.find(p => p.month === currentYM)!;
    const hhCurrent = hhPoints.find(p => p.month === currentYM)!;

    expect(hhCurrent.total_balance_pence).toBeLessThan(allCurrent.total_balance_pence);
    expect(hhCurrent.per_debt).toHaveLength(1);
    expect(hhCurrent.per_debt[0].name).toBe('Joint');
  });
});
