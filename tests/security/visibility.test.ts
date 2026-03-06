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

async function getHouseholdDetails(agent: ReturnType<typeof supertest.agent>) {
  const res = await agent.get('/api/household');
  return res.body as { members?: Array<{ user_id: string }> };
}

describe('Entry visibility and permissions', () => {
  describe('expenses: user cannot see private entries from others', () => {
    it('User A private expense → User B cannot see via GET /api/expenses', async () => {
      const { agent: agentA, user: userA } = await registerAndLogin('vis_exp_a');
      const { agent: agentB, user: userB } = await registerAndLogin('vis_exp_b');

      // A creates a personal expense
      let csrf = await csrfToken(agentA);
      const createRes = await agentA
        .post('/api/expenses')
        .set('X-CSRF-Token', csrf)
        .send({
          name: 'A Private Expense',
          amount_pence: 1000,
          posting_day: 1,
          type: 'fixed',
          category: 'Other',
          is_household: false,
          is_recurring: true,
          recurrence_type: 'monthly',
        });
      const expenseId = (createRes.body as { id: string }).id;

      // B lists expenses — should NOT see A's
      const getRes = await agentB.get('/api/expenses?month=2025-01');
      const expenses = (getRes.body as unknown[]) || [];
      const found = expenses.some((e: Record<string, unknown>) => e.id === expenseId);
      expect(found).toBe(false);
    });

    it('User B is contributor → can see, edit, delete the expense', async () => {
      const { agent: agentA, user: userA } = await registerAndLogin('vis_exp_contrib_a');
      const { agent: agentB, user: userB } = await registerAndLogin('vis_exp_contrib_b');

      // Get B's user_id from household
      const householdB = await getHouseholdDetails(agentB);
      const userBId = householdB.members?.[0]?.user_id || userB.id;

      // A creates expense with B as contributor
      let csrf = await csrfToken(agentA);
      const createRes = await agentA
        .post('/api/expenses')
        .set('X-CSRF-Token', csrf)
        .send({
          name: 'Contributed Expense',
          amount_pence: 2000,
          posting_day: 1,
          contributor_user_id: userBId,
          type: 'fixed',
          category: 'Other',
          is_household: false,
          is_recurring: true,
          recurrence_type: 'monthly',
        });
      const expenseId = (createRes.body as { id: string }).id;

      // B can see it (via GET)
      let getRes = await agentB.get('/api/expenses?month=2025-01');
      let found = ((getRes.body as unknown[]) || []).some((e: Record<string, unknown>) => e.id === expenseId);
      expect(found).toBe(true);

      // B can edit it
      csrf = await csrfToken(agentB);
      const editRes = await agentB
        .put(`/api/expenses/${expenseId}`)
        .set('X-CSRF-Token', csrf)
        .send({ name: 'Edited by B' });
      expect(editRes.status).toBe(200);

      // B can delete it
      csrf = await csrfToken(agentB);
      const deleteRes = await agentB
        .delete(`/api/expenses/${expenseId}`)
        .set('X-CSRF-Token', csrf);
      expect(deleteRes.status).toBe(204);
    });

    it('Household expense → visible to all members, but only creator/contributor can edit', async () => {
      const { agent: agentA, user: userA } = await registerAndLogin('vis_exp_hh_a');
      const { agent: agentB, user: userB } = await registerAndLogin('vis_exp_hh_b');

      // A creates a household expense
      let csrf = await csrfToken(agentA);
      const createRes = await agentA
        .post('/api/expenses')
        .set('X-CSRF-Token', csrf)
        .send({
          name: 'Household Expense',
          amount_pence: 3000,
          posting_day: 1,
          type: 'fixed',
          category: 'Other',
          is_household: true,
          split_ratio: 0.5,
          is_recurring: true,
          recurrence_type: 'monthly',
        });
      const expenseId = (createRes.body as { id: string }).id;

      // B can see it
      let getRes = await agentB.get('/api/expenses?month=2025-01');
      let found = ((getRes.body as unknown[]) || []).some((e: Record<string, unknown>) => e.id === expenseId);
      expect(found).toBe(true);

      // B tries to edit it → 403 (not creator/contributor)
      csrf = await csrfToken(agentB);
      const editRes = await agentB
        .put(`/api/expenses/${expenseId}`)
        .set('X-CSRF-Token', csrf)
        .send({ name: 'Hacked' });
      expect(editRes.status).toBe(403);

      // A (creator) can still edit it
      csrf = await csrfToken(agentA);
      const editRes2 = await agentA
        .put(`/api/expenses/${expenseId}`)
        .set('X-CSRF-Token', csrf)
        .send({ name: 'Edited by A' });
      expect(editRes2.status).toBe(200);
    });
  });

  describe('incomes: visibility and permissions', () => {
    it('User A private income → User B cannot see', async () => {
      const { agent: agentA } = await registerAndLogin('vis_inc_a');
      const { agent: agentB } = await registerAndLogin('vis_inc_b');

      let csrf = await csrfToken(agentA);
      const createRes = await agentA
        .post('/api/incomes')
        .set('X-CSRF-Token', csrf)
        .send({
          name: 'A Salary',
          amount_pence: 500000,
          posting_day: 28,
          gross_or_net: 'net',
          is_recurring: true,
          recurrence_type: 'monthly',
        });
      const incomeId = (createRes.body as { id: string }).id;

      const getRes = await agentB.get('/api/incomes?month=2025-01');
      const incomes = (getRes.body as unknown[]) || [];
      const found = incomes.some((i: Record<string, unknown>) => i.id === incomeId);
      expect(found).toBe(false);
    });

    it('Household income → visible to all, editable by creator only', async () => {
      const { agent: agentA } = await registerAndLogin('vis_inc_hh_a');
      const { agent: agentB } = await registerAndLogin('vis_inc_hh_b');

      let csrf = await csrfToken(agentA);
      const createRes = await agentA
        .post('/api/incomes')
        .set('X-CSRF-Token', csrf)
        .send({
          name: 'Household Income',
          amount_pence: 400000,
          posting_day: 28,
          is_household: true,
          gross_or_net: 'net',
          is_recurring: true,
          recurrence_type: 'monthly',
        });
      const incomeId = (createRes.body as { id: string }).id;

      const getRes = await agentB.get('/api/incomes?month=2025-01');
      const found = ((getRes.body as unknown[]) || []).some((i: Record<string, unknown>) => i.id === incomeId);
      expect(found).toBe(true);

      csrf = await csrfToken(agentB);
      const editRes = await agentB
        .put(`/api/incomes/${incomeId}`)
        .set('X-CSRF-Token', csrf)
        .send({ name: 'Hacked' });
      expect(editRes.status).toBe(403);
    });
  });

  describe('debts: visibility and permissions', () => {
    it('User A private debt → User B cannot see', async () => {
      const { agent: agentA } = await registerAndLogin('vis_debt_a');
      const { agent: agentB } = await registerAndLogin('vis_debt_b');

      let csrf = await csrfToken(agentA);
      const createRes = await agentA
        .post('/api/debts')
        .set('X-CSRF-Token', csrf)
        .send({
          name: 'A Credit Card',
          balance_pence: 50000,
          interest_rate: 19.9,
          minimum_payment_pence: 1000,
          posting_day: 1,
          is_recurring: true,
          recurrence_type: 'monthly',
        });
      const debtId = (createRes.body as { id: string }).id;

      const getRes = await agentB.get('/api/debts');
      const debts = (getRes.body as unknown[]) || [];
      const found = debts.some((d: Record<string, unknown>) => d.id === debtId);
      expect(found).toBe(false);
    });
  });

  describe('savings goals: visibility and permissions', () => {
    it('User A private savings goal → User B cannot see', async () => {
      const { agent: agentA } = await registerAndLogin('vis_sg_a');
      const { agent: agentB } = await registerAndLogin('vis_sg_b');

      let csrf = await csrfToken(agentA);
      const createRes = await agentA
        .post('/api/savings-goals')
        .set('X-CSRF-Token', csrf)
        .send({
          name: 'A Vacation Fund',
          target_amount_pence: 300000,
          current_amount_pence: 50000,
          monthly_contribution_pence: 10000,
        });
      const goalId = (createRes.body as { id: string }).id;

      const getRes = await agentB.get('/api/savings-goals');
      const goals = (getRes.body as unknown[]) || [];
      const found = goals.some((g: Record<string, unknown>) => g.id === goalId);
      expect(found).toBe(false);
    });
  });

  describe('summary and totals include all entries', () => {
    it('summary totals include entries user cannot see directly', async () => {
      const { agent: agentA, user: userA } = await registerAndLogin('vis_sum_a');
      const { agent: agentB, user: userB } = await registerAndLogin('vis_sum_b');

      // A creates personal + household expenses
      let csrf = await csrfToken(agentA);
      await agentA
        .post('/api/expenses')
        .set('X-CSRF-Token', csrf)
        .send({
          name: 'A Personal',
          amount_pence: 1000,
          posting_day: 1,
          type: 'fixed',
          category: 'Other',
          is_household: false,
          is_recurring: true,
          recurrence_type: 'monthly',
        });

      csrf = await csrfToken(agentA);
      await agentA
        .post('/api/expenses')
        .set('X-CSRF-Token', csrf)
        .send({
          name: 'Household',
          amount_pence: 2000,
          posting_day: 1,
          type: 'fixed',
          category: 'Other',
          is_household: true,
          split_ratio: 0.5,
          is_recurring: true,
          recurrence_type: 'monthly',
        });

      // B gets summary — should include household totals
      const summaryRes = await agentB.get('/api/household/summary?month=2025-01');
      const summary = summaryRes.body as { total_expenses_pence?: number };
      // Household expense: 2000 * 0.5 = 1000 (B's share)
      // Summary totals are household-wide, but B's share is calculated in category_breakdown
      expect(summary.total_expenses_pence).toBeGreaterThan(0);
    });
  });

  describe('export respects visibility', () => {
    it('User export does not include other users\' private entries', async () => {
      const { agent: agentA } = await registerAndLogin('vis_exp_a');
      const { agent: agentB } = await registerAndLogin('vis_exp_b');

      // A creates personal expense
      let csrf = await csrfToken(agentA);
      await agentA
        .post('/api/expenses')
        .set('X-CSRF-Token', csrf)
        .send({
          name: 'A Only',
          amount_pence: 5000,
          posting_day: 1,
          type: 'fixed',
          category: 'Other',
          is_household: false,
          is_recurring: true,
          recurrence_type: 'monthly',
        });

      // B exports
      const exportRes = await agentB.get('/api/export/json');
      const exported = exportRes.body as { expenses?: unknown[] };
      const expenses = (exported.expenses || []) as Record<string, unknown>[];
      const found = expenses.some(e => (e.name as string)?.includes('A Only'));
      expect(found).toBe(false);
    });
  });
});
