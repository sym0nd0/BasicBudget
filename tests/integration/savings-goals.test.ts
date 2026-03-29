import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import { getApp, makeTestUser } from '../helpers.js';
import db from '../../server/db.js';

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

describe('GET /api/savings-goals — month param', () => {
  let agent: ReturnType<typeof supertest.agent>;
  let testGoalId: string;

  beforeEach(async () => {
    const result = await registerAndLogin(`sg_month_${Date.now()}`);
    agent = result.agent;
    const csrf = await csrfToken(agent);

    // Create a savings goal
    const goalRes = await agent
      .post('/api/savings-goals')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Test Goal', target_amount_pence: 100000, current_amount_pence: 0, monthly_contribution_pence: 0, is_household: 0 });
    expect(goalRes.status).toBe(201);
    testGoalId = (goalRes.body as { id: string }).id;

    // Create a transaction in the current month with balance_after_pence = 50000
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const txRes = await agent
      .post(`/api/savings-goals/${testGoalId}/transactions`)
      .set('X-CSRF-Token', csrf)
      .send({ type: 'contribution', amount_pence: 50000, notes: `month:${currentYM}` });
    expect(txRes.status).toBe(201);
  });

  it('returns current_amount_pence = 0 for a month before any transactions', async () => {
    const now = new Date();
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const twoMonthsAgoYM = `${twoMonthsAgo.getFullYear()}-${String(twoMonthsAgo.getMonth() + 1).padStart(2, '0')}`;

    const res = await agent.get(`/api/savings-goals?month=${twoMonthsAgoYM}`).expect(200);
    const goal = (res.body as { id: string; current_amount_pence: number }[]).find(g => g.id === testGoalId);
    expect(goal?.current_amount_pence).toBe(0);
  });

  it('returns balance_after_pence of last transaction in or before requested month', async () => {
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const res = await agent.get(`/api/savings-goals?month=${currentYM}`).expect(200);
    const goal = (res.body as { id: string; current_amount_pence: number }[]).find(g => g.id === testGoalId);
    expect(goal?.current_amount_pence).toBe(50000);
  });
});

describe('PUT /api/savings-goals/:id — balance-change snapshot', () => {
  let agent: ReturnType<typeof supertest.agent>;
  let csrf: string;
  let goalId: string;

  beforeAll(async () => {
    const result = await registerAndLogin(`sg_delta_${Date.now()}`);
    agent = result.agent;
    csrf = await csrfToken(agent);

    const goalRes = await agent
      .post('/api/savings-goals')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Delta Test Goal', target_amount_pence: 200000, current_amount_pence: 50000, monthly_contribution_pence: 0, is_household: 0 });
    expect(goalRes.status).toBe(201);
    goalId = (goalRes.body as { id: string }).id;
  });

  beforeEach(async () => {
    // Reset balance to known starting value before each test so tests are independent
    const resetRes = await agent
      .put(`/api/savings-goals/${goalId}`)
      .set('X-CSRF-Token', csrf)
      .send({ current_amount_pence: 50000 });
    expect(resetRes.status).toBe(200);
  });

  it('inserts a withdrawal snapshot when balance decreases', async () => {
    const res = await agent
      .put(`/api/savings-goals/${goalId}`)
      .set('X-CSRF-Token', csrf)
      .send({ current_amount_pence: 30000 });
    expect(res.status).toBe(200);
    expect((res.body as { current_amount_pence: number }).current_amount_pence).toBe(30000);

    const rows = db
      .prepare(`SELECT type, amount_pence, balance_after_pence FROM savings_transactions WHERE savings_goal_id = ? AND notes = 'Balance updated' ORDER BY rowid DESC LIMIT 1`)
      .all(goalId) as { type: string; amount_pence: number; balance_after_pence: number }[];
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]!.type).toBe('withdrawal');
    expect(rows[0]!.amount_pence).toBe(20000);
    expect(rows[0]!.balance_after_pence).toBe(30000);
  });

  it('inserts a deposit snapshot when balance increases', async () => {
    // Each test starts from 50000 (reset by beforeEach), independent of other tests
    const res = await agent
      .put(`/api/savings-goals/${goalId}`)
      .set('X-CSRF-Token', csrf)
      .send({ current_amount_pence: 80000 });
    expect(res.status).toBe(200);
    expect((res.body as { current_amount_pence: number }).current_amount_pence).toBe(80000);

    const rows = db
      .prepare(`SELECT type, amount_pence, balance_after_pence FROM savings_transactions WHERE savings_goal_id = ? AND notes = 'Balance updated' ORDER BY rowid DESC LIMIT 1`)
      .all(goalId) as { type: string; amount_pence: number; balance_after_pence: number }[];
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]!.type).toBe('deposit');
    expect(rows[0]!.amount_pence).toBe(30000);
    expect(rows[0]!.balance_after_pence).toBe(80000);
  });
});
