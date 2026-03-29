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
  return { agent };
}

describe('/api/summary total_saved_pence', () => {
  it('returns total_saved_pence as sum of current_amount_pence across goals', async () => {
    const { agent } = await registerAndLogin('sum_totalsaved');
    const csrf = await csrfToken(agent);

    await agent
      .post('/api/savings-goals')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Holiday Fund', target_amount_pence: 500000, current_amount_pence: 120000, monthly_contribution_pence: 10000, is_household: 0 });

    await agent
      .post('/api/savings-goals')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Emergency Fund', target_amount_pence: 1000000, current_amount_pence: 80000, monthly_contribution_pence: 15000, is_household: 0 });

    const res = await agent.get('/api/summary').expect(200);
    expect((res.body as { total_saved_pence: number }).total_saved_pence).toBe(200000); // 120000 + 80000
  });
});

describe('/api/summary total_savings_pence', () => {
  it('returns 0 when no savings goals exist', async () => {
    const { agent } = await registerAndLogin('sum_nosavings');
    const res = await agent.get('/api/summary?month=2025-01');
    expect(res.status).toBe(200);
    const body = res.body as { total_savings_pence: number };
    expect(body.total_savings_pence).toBe(0);
  });

  it('includes personal savings goal contribution in total_savings_pence', async () => {
    const { agent } = await registerAndLogin('sum_personal');
    const csrf = await csrfToken(agent);

    // Create a personal savings goal with a monthly contribution
    await agent
      .post('/api/savings-goals')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Emergency Fund',
        monthly_contribution_pence: 5000,
        is_household: 0,
        target_amount_pence: 100000,
      });

    const res = await agent.get('/api/summary?month=2025-01');
    expect(res.status).toBe(200);
    const body = res.body as { total_savings_pence: number };
    expect(body.total_savings_pence).toBe(5000);
  });

  it('includes multiple savings goals summed in total_savings_pence', async () => {
    const { agent } = await registerAndLogin('sum_multi');
    const csrf = await csrfToken(agent);

    await agent
      .post('/api/savings-goals')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Holiday', monthly_contribution_pence: 3000, is_household: 0, target_amount_pence: 50000 });

    await agent
      .post('/api/savings-goals')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'New Car', monthly_contribution_pence: 7000, is_household: 0, target_amount_pence: 200000 });

    const res = await agent.get('/api/summary?month=2025-01');
    expect(res.status).toBe(200);
    const body = res.body as { total_savings_pence: number };
    expect(body.total_savings_pence).toBe(10000);
  });
});

describe('/api/summary total_saved_pence with auto_contribute projection', () => {
  it('projects total_saved_pence forward for auto-contribute goals on a future month', async () => {
    const { agent } = await registerAndLogin('sum_autoprojection');
    const csrf = await csrfToken(agent);

    const currentAmountPence = 120000;
    const monthlyContributionPence = 10000;

    await agent
      .post('/api/savings-goals')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Auto Fund',
        target_amount_pence: 2000000,
        current_amount_pence: currentAmountPence,
        monthly_contribution_pence: monthlyContributionPence,
        auto_contribute: 1,
        is_household: 0,
      });

    const futureMonth = '2099-01';
    const currentYM = new Date().toISOString().slice(0, 7); // YYYY-MM
    const [reqY, reqM] = [2099, 1];
    const [curY, curM] = currentYM.split('-').map(Number);
    const monthsAhead = (reqY - curY) * 12 + (reqM - curM);
    const expectedSaved = currentAmountPence + monthlyContributionPence * monthsAhead;

    const res = await agent.get(`/api/summary?month=${futureMonth}`).expect(200);
    expect((res.body as { total_saved_pence: number }).total_saved_pence).toBe(expectedSaved);
  });
});
